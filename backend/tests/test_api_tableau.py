"""Le socle du TABLEAU DE PROGRESSION (04/10/2026).

Demande de Hafiz, image à l'appui : une grille semaine par semaine, où « l'app
propose, je corrige ». Le CALCUL vit côté app (src/logic/projectionProgramme.js,
testé par test_projection.py) ; le serveur ne garde que ce qui ne peut PAS se
recalculer :
 - la FOURCHETTE de reps d'un exercice (« 5 - 10 ») ;
 - les CASES corrigées à la main ;
 - les réglages du bloc (durée, semaine de décharge).

Ce que ces tests verrouillent :
 - un programme existant, sans fourchette, ne change pas de comportement ;
 - une case corrigée se relit telle quelle, et se rend au calcul quand on la vide ;
 - ⚠️ le RENOMMAGE d'un exercice emporte ses cases — le nom est l'identifiant,
   et c'est la cinquième table concernée (voir le bug du 04/09/2026) ;
 - on ne touche jamais aux cases d'un autre joueur.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_tableau_fitness_royale.db"


class TestTableauProgression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    def _inscrire(self, pseudo):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123", "sexe": "homme", "poids": 80,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _programme(self, h, joueur_id, nom, exercices):
        return self.client.post(f"/joueurs/{joueur_id}/programmes", json={
            "nom": nom, "jours": [], "exercices": exercices,
        }, headers=h).json()

    # ----- La fourchette de reps -----

    def test_une_fourchette_est_enregistree_et_relue(self):
        h, jid = self._inscrire("Fourchette")
        p = self._programme(h, jid, "Push", [
            {"exercice": "dips", "series_cibles": 3, "reps_cibles": 5, "reps_cibles_max": 10},
        ])
        relu = self.client.get(f"/programmes/{p['id']}", headers=h).json()
        self.assertEqual(relu["exercices"][0]["reps_cibles"], 5)
        self.assertEqual(relu["exercices"][0]["reps_cibles_max"], 10)

    def test_sans_fourchette_rien_ne_change(self):
        """La migration est ADDITIVE : un programme écrit comme avant garde
        exactement le même comportement, avec une fourchette vide."""
        h, jid = self._inscrire("SansFourchette")
        p = self._programme(h, jid, "Pull", [
            {"exercice": "traction", "series_cibles": 4, "reps_cibles": 8},
        ])
        relu = self.client.get(f"/programmes/{p['id']}", headers=h).json()
        self.assertEqual(relu["exercices"][0]["reps_cibles"], 8)
        self.assertIsNone(relu["exercices"][0]["reps_cibles_max"])

    def test_une_fourchette_absurde_est_refusee(self):
        h, jid = self._inscrire("FourchetteAbsurde")
        r = self.client.post(f"/joueurs/{jid}/programmes", json={
            "nom": "X", "jours": [], "exercices": [
                {"exercice": "dips", "series_cibles": 3, "reps_cibles": 5, "reps_cibles_max": 0},
            ],
        }, headers=h)
        self.assertEqual(r.status_code, 422)

    # ----- Les cases corrigées à la main -----

    def test_une_case_corrigee_se_relit_telle_quelle(self):
        h, jid = self._inscrire("Corrige")
        p = self._programme(h, jid, "Push", [
            {"exercice": "développé couché", "series_cibles": 3, "reps_cibles": 8},
        ])
        r = self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "développé couché",
            "semaine": "2", "series": 5, "reps": 6, "poids": 140,
        }, headers=h)
        self.assertEqual(r.status_code, 200)

        cases = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual(len(cases), 1)
        self.assertEqual(cases[0]["semaine"], "2")
        self.assertEqual(cases[0]["series"], 5)
        self.assertEqual(cases[0]["poids"], 140)

    def test_la_colonne_de_decharge_est_une_case_comme_une_autre(self):
        """`semaine` est du TEXTE exprès : la décharge porte la clé 'decharge',
        à côté de '1', '2'… Un entier n'aurait pas pu la nommer."""
        h, jid = self._inscrire("Decharge")
        p = self._programme(h, jid, "Push", [
            {"exercice": "squat", "series_cibles": 3, "reps_cibles": 8},
        ])
        self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "squat",
            "semaine": "decharge", "series": 2, "poids": 60,
        }, headers=h)
        cases = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual(cases[0]["semaine"], "decharge")
        self.assertEqual(cases[0]["series"], 2)
        # Les reps n'ont pas été corrigées : elles restent calculées.
        self.assertIsNone(cases[0]["reps"])

    def test_rendre_une_case_au_calcul(self):
        h, jid = self._inscrire("RendreAuCalcul")
        p = self._programme(h, jid, "Push", [
            {"exercice": "squat", "series_cibles": 3, "reps_cibles": 8},
        ])
        self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "squat", "semaine": "1", "poids": 100,
        }, headers=h)
        self.client.delete(
            f"/joueurs/{jid}/cibles-semaine",
            params={"programme_id": p["id"], "exercice": "squat", "semaine": "1"},
            headers=h,
        )
        self.assertEqual(self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json(), [])

    def test_une_case_entierement_vide_efface_la_correction(self):
        """Enregistrer une correction qui ne corrige rien n'aurait aucun sens :
        on rend la case au calcul."""
        h, jid = self._inscrire("CaseVide")
        p = self._programme(h, jid, "Push", [
            {"exercice": "squat", "series_cibles": 3, "reps_cibles": 8},
        ])
        self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "squat", "semaine": "1", "poids": 100,
        }, headers=h)
        self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "squat", "semaine": "1",
        }, headers=h)
        self.assertEqual(self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json(), [])

    def test_corriger_deux_fois_la_meme_case_la_remplace(self):
        h, jid = self._inscrire("DeuxFois")
        p = self._programme(h, jid, "Push", [
            {"exercice": "squat", "series_cibles": 3, "reps_cibles": 8},
        ])
        for poids in (100, 120):
            self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
                "programme_id": p["id"], "exercice": "squat", "semaine": "1", "poids": poids,
            }, headers=h)
        cases = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual(len(cases), 1)
        self.assertEqual(cases[0]["poids"], 120)

    # ----- Le NOM reste l'identifiant -----

    def test_renommer_un_exercice_emporte_ses_cases(self):
        """⚠️ LE PIÈGE DU 04/09/2026, une table plus loin : sans ça, renommer un
        exercice perdrait silencieusement toutes ses corrections."""
        h, jid = self._inscrire("Renomme")
        p = self._programme(h, jid, "Push", [
            {"exercice": "developpe couche", "series_cibles": 3, "reps_cibles": 8},
        ])
        self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "developpe couche",
            "semaine": "3", "poids": 110,
        }, headers=h)

        r = self.client.put(
            f"/joueurs/{jid}/exercices/developpe couche/nom",
            json={"nouveau": "développé couché"}, headers=h,
        )
        self.assertEqual(r.status_code, 200)

        cases = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual(len(cases), 1)
        self.assertEqual(cases[0]["exercice"], "développé couché")
        self.assertEqual(cases[0]["poids"], 110)

    # ----- Propriété -----

    def test_on_ne_corrige_pas_le_programme_d_un_autre(self):
        h1, jid1 = self._inscrire("Proprio")
        h2, jid2 = self._inscrire("Intrus")
        p = self._programme(h1, jid1, "Push", [
            {"exercice": "squat", "series_cibles": 3, "reps_cibles": 8},
        ])
        r = self.client.put(f"/joueurs/{jid2}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "squat", "semaine": "1", "poids": 999,
        }, headers=h2)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.get(f"/joueurs/{jid1}/cibles-semaine", headers=h1).json(), [])

    def test_on_ne_lit_pas_les_cases_d_un_autre(self):
        _, jid1 = self._inscrire("Lecteur1")
        h2, _ = self._inscrire("Lecteur2")
        r = self.client.get(f"/joueurs/{jid1}/cibles-semaine", headers=h2)
        self.assertEqual(r.status_code, 403)

    # ----- Les réglages du bloc -----

    def test_le_bloc_d_un_programme_est_enregistre(self):
        h, jid = self._inscrire("BlocProgramme")
        p = self._programme(h, jid, "Push", [
            {"exercice": "squat", "series_cibles": 3, "reps_cibles": 8},
        ])
        r = self.client.put(f"/programmes/{p['id']}/bloc",
                            json={"duree_semaines": 6, "avec_deload": True}, headers=h)
        self.assertEqual(r.status_code, 200)
        relu = self.client.get(f"/programmes/{p['id']}", headers=h).json()
        self.assertEqual(relu["duree_semaines"], 6)
        self.assertEqual(relu["avec_deload"], 1)

    def test_le_bloc_d_un_cycle_est_enregistre(self):
        h, jid = self._inscrire("BlocCycle")
        cycle = self.client.post(f"/joueurs/{jid}/cycles", json={
            "nom": "Mon PPL", "seances": [{
                "nom": "Push", "jours": ["lundi"],
                "exercices": [{"exercice": "squat", "series_cibles": 3, "reps_cibles": 8}],
            }],
        }, headers=h).json()
        r = self.client.put(f"/cycles/{cycle['id']}/bloc",
                            json={"duree_semaines": 8, "avec_deload": False}, headers=h)
        self.assertEqual(r.status_code, 200)
        cycles = self.client.get(f"/joueurs/{jid}/cycles", headers=h).json()
        self.assertEqual(cycles[0]["duree_semaines"], 8)
        self.assertEqual(cycles[0]["avec_deload"], 0)

    def test_on_ne_regle_pas_le_bloc_d_un_autre(self):
        h1, jid1 = self._inscrire("BlocProprio")
        h2, _ = self._inscrire("BlocIntrus")
        p = self._programme(h1, jid1, "Push", [
            {"exercice": "squat", "series_cibles": 3, "reps_cibles": 8},
        ])
        r = self.client.put(f"/programmes/{p['id']}/bloc",
                            json={"duree_semaines": 12, "avec_deload": True}, headers=h2)
        self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main()
