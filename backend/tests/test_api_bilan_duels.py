"""Le bilan des duels et leur historique (13/11/2026).

Le Profil affichait TOUJOURS « 0 victoire · 0 défaite » : rien ne comptait les
duels côté serveur. Et un duel EN DIRECT (un seul téléphone) n'existait que
dans la mémoire de l'app : il disparaissait au rafraîchissement suivant, avec
ses points. Désormais :
- `/auth/moi` porte `stats` = duels en ligne terminés + duels en direct ;
- `POST /joueurs/{id}/duels-direct` garde un duel en direct, recalcule son
  vainqueur à partir des rounds et crédite des points fixés par le serveur ;
- `GET /joueurs/{id}/historique-duels` raconte tous mes duels DE MON CÔTÉ.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app, RECOMPENSE_DUEL_DIRECT

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_bilan_duels_fitness_royale.db"


def _round(mes, ses, choisi="moi"):
    return {"exercice": "Squat", "charge": 100, "choisiPar": choisi,
            "mesReps": mes, "sesReps": ses}


class TestBilanDuels(unittest.TestCase):
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
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": "homme", "poids": 80,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]

    def _moi(self, h):
        return self.client.get("/auth/moi", headers=h).json()

    def _direct(self, joueur_id, h, rounds, adversaire="Karim"):
        return self.client.post(f"/joueurs/{joueur_id}/duels-direct",
                                json={"adversaire": adversaire, "rounds": rounds}, headers=h)

    def _duel_en_ligne(self, h_a, h_b, reps_a, reps_b):
        """Joue un duel en ligne complet. reps_a/reps_b : une liste par round."""
        duel = self.client.post("/duels/creer", json={}, headers=h_a).json()
        self.client.post("/duels/rejoindre", json={"code": duel["code"]}, headers=h_b)
        for numero, (ra, rb) in enumerate(zip(reps_a, reps_b), start=1):
            if numero == 3:
                self.client.post(f"/duels/{duel['id']}/rounds/3/tirer-ia", headers=h_a)
            else:
                qui = h_a if numero == 1 else h_b
                self.client.post(f"/duels/{duel['id']}/rounds/{numero}/choisir-exercice",
                                 json={"exercice": "Squat", "charge": 100}, headers=qui)
            self.client.post(f"/duels/{duel['id']}/rounds/{numero}/mes-reps",
                             json={"reps": ra}, headers=h_a)
            self.client.post(f"/duels/{duel['id']}/rounds/{numero}/mes-reps",
                             json={"reps": rb}, headers=h_b)
        return duel["id"]

    # ---- Le Profil n'affiche plus toujours 0 ----
    def test_un_compte_neuf_a_un_bilan_vide(self):
        h, _ = self._inscrire("BilanNeuf")
        self.assertEqual(self._moi(h)["stats"], {"victoires": 0, "defaites": 0})

    def test_un_duel_en_ligne_compte_pour_les_deux_joueurs(self):
        h_a, _ = self._inscrire("BilanA")
        h_b, _ = self._inscrire("BilanB")
        self._duel_en_ligne(h_a, h_b, [12, 15], [9, 10])
        self.assertEqual(self._moi(h_a)["stats"], {"victoires": 1, "defaites": 0})
        self.assertEqual(self._moi(h_b)["stats"], {"victoires": 0, "defaites": 1})

    def test_un_duel_en_ligne_pas_fini_ne_compte_pas(self):
        h_a, _ = self._inscrire("BilanC")
        h_b, _ = self._inscrire("BilanD")
        self._duel_en_ligne(h_a, h_b, [12], [9])  # 1-0, pas fini
        self.assertEqual(self._moi(h_a)["stats"], {"victoires": 0, "defaites": 0})
        self.assertEqual(self._moi(h_b)["stats"], {"victoires": 0, "defaites": 0})

    # ---- Le duel en direct est enfin gardé ----
    def test_un_duel_direct_gagne_compte_et_rapporte_ses_points(self):
        h, j = self._inscrire("DirectGagne")
        r = self._direct(j["id"], h, [_round(12, 9), _round(10, 8, "lui")])
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["gagne"])
        moi = self._moi(h)
        self.assertEqual(moi["stats"], {"victoires": 1, "defaites": 0})
        self.assertEqual(moi["points"], RECOMPENSE_DUEL_DIRECT)

    def test_un_duel_direct_perdu_compte_sans_points(self):
        h, j = self._inscrire("DirectPerdu")
        self._direct(j["id"], h, [_round(12, 9), _round(5, 8, "lui"), _round(4, 6, "ia")])
        moi = self._moi(h)
        self.assertEqual(moi["stats"], {"victoires": 0, "defaites": 1})
        self.assertEqual(moi["points"], 0)

    def test_le_vainqueur_est_recalcule_par_le_serveur(self):
        """Le serveur ne croit pas l'app sur parole : c'est le score des
        rounds qui décide, et un duel sans vainqueur est refusé."""
        h, j = self._inscrire("DirectSansVainqueur")
        r = self._direct(j["id"], h, [_round(12, 9), _round(5, 8, "lui")])  # 1-1
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self._moi(h)["stats"], {"victoires": 0, "defaites": 0})

    def test_valeurs_absurdes_refusees(self):
        h, j = self._inscrire("DirectAbsurde")
        for rounds in ([_round(12, 9)],  # un seul round
                       [_round(-1, 9), _round(10, 8)],
                       [dict(_round(12, 9), choisiPar="arbitre"), _round(10, 8)]):
            self.assertEqual(self._direct(j["id"], h, rounds).status_code, 422)
        self.assertEqual(self._direct(j["id"], h, [_round(12, 9), _round(10, 8)],
                                      adversaire="").status_code, 422)

    def test_on_n_enregistre_pas_un_duel_pour_un_autre(self):
        h_moi, _ = self._inscrire("DirectMoi")
        _, autre = self._inscrire("DirectAutre")
        r = self._direct(autre["id"], h_moi, [_round(12, 9), _round(10, 8)])
        self.assertEqual(r.status_code, 403)
        self.assertEqual(db.stats_duels(autre["id"]), {"victoires": 0, "defaites": 0})

    # ---- L'historique, raconté de mon côté ----
    def test_l_historique_reunit_les_deux_sortes_de_duels(self):
        h_a, j_a = self._inscrire("HistoA")
        h_b, j_b = self._inscrire("HistoB")
        self._duel_en_ligne(h_a, h_b, [12, 15], [9, 10])
        self._direct(j_a["id"], h_a, [_round(12, 9), _round(10, 8)], adversaire="Sami")

        histo = self.client.get(f"/joueurs/{j_a['id']}/historique-duels", headers=h_a).json()
        self.assertEqual([d["type"] for d in histo], ["direct", "en_ligne"])  # récent d'abord
        direct, en_ligne = histo
        self.assertEqual(direct["adversaire"], "Sami")
        self.assertEqual(direct["statut"], "gagné")
        self.assertEqual(en_ligne["adversaire"], "HistoB")
        self.assertEqual(en_ligne["statut"], "gagné")
        self.assertEqual(len(en_ligne["rounds"]), 2)  # le round 3 n'a pas été joué

        # Le MÊME duel, vu par l'adversaire : perdu, reps inversées, choix inversés.
        vu_par_b = self.client.get(f"/joueurs/{j_b['id']}/historique-duels", headers=h_b).json()
        self.assertEqual(len(vu_par_b), 1)
        self.assertEqual(vu_par_b[0]["adversaire"], "HistoA")
        self.assertEqual(vu_par_b[0]["statut"], "perdu")
        r1 = vu_par_b[0]["rounds"][0]
        self.assertEqual((r1["mesReps"], r1["sesReps"], r1["choisiPar"]), (9, 12, "lui"))
        r1_a = en_ligne["rounds"][0]
        self.assertEqual((r1_a["mesReps"], r1_a["sesReps"], r1_a["choisiPar"]), (12, 9, "moi"))

    def test_un_duel_en_attente_n_est_pas_dans_l_historique(self):
        h, j = self._inscrire("HistoAttente")
        self.client.post("/duels/creer", json={}, headers=h)
        self.assertEqual(self.client.get(f"/joueurs/{j['id']}/historique-duels",
                                         headers=h).json(), [])

    def test_l_historique_est_prive(self):
        h_moi, _ = self._inscrire("HistoPriveMoi")
        _, autre = self._inscrire("HistoPriveAutre")
        self.assertEqual(self.client.get(f"/joueurs/{autre['id']}/historique-duels",
                                         headers=h_moi).status_code, 403)
        self.assertEqual(self.client.get(f"/joueurs/{autre['id']}/historique-duels")
                         .status_code, 401)


if __name__ == "__main__":
    unittest.main()
