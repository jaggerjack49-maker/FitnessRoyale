"""Le REPOS et l'EFFORT VISÉ (RIR) d'un exercice de programme (08/11/2026).

Demande de Hafiz : « on doit pouvoir fixer des temps de repos lorsqu'on crée le
programme […] et l'ordre des exercices doit être pris en compte et aussi on
peut fixer l'effort, le RIR par exemple ».

Le serveur ne fait que GARDER ces deux réglages (le minuteur de repos tourne
dans l'app). Ce que ces tests verrouillent :
 - repos et RIR sont enregistrés et relus, à la création comme à l'édition ;
 - un programme écrit comme avant (sans eux) reste valide, avec None ;
 - ils passent aussi par un programme COMPLET (cycle) et l'ajout d'une séance ;
 - l'ORDRE des exercices est celui de l'envoi, y compris après réordonnancement ;
 - les valeurs absurdes sont refusées (repos négatif ou > 15 min, RIR > 10).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_repos_rir_fitness_royale.db"


class TestReposEtRir(unittest.TestCase):
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

    def _programme(self, h, jid, exercices):
        return self.client.post(f"/joueurs/{jid}/programmes", json={
            "nom": "Push", "jours": [], "exercices": exercices,
        }, headers=h)

    def test_repos_et_rir_sont_enregistres_et_relus(self):
        h, jid = self._inscrire("ReposRir")
        r = self._programme(h, jid, [
            {"exercice": "developpe couche", "series_cibles": 4, "reps_cibles": 6,
             "repos_secondes": 180, "rir_cible": 2},
        ])
        self.assertEqual(r.status_code, 201, r.text)
        relu = self.client.get(f"/programmes/{r.json()['id']}", headers=h).json()
        self.assertEqual(relu["exercices"][0]["repos_secondes"], 180)
        self.assertEqual(relu["exercices"][0]["rir_cible"], 2)

    def test_un_rir_de_zero_est_garde_tel_quel(self):
        """0 = jusqu'à l'échec : une vraie valeur, pas « pas fixé »."""
        h, jid = self._inscrire("RirZero")
        r = self._programme(h, jid, [
            {"exercice": "dips", "series_cibles": 3, "reps_cibles": 10, "rir_cible": 0},
        ])
        relu = self.client.get(f"/programmes/{r.json()['id']}", headers=h).json()
        self.assertEqual(relu["exercices"][0]["rir_cible"], 0)

    def test_sans_repos_ni_rir_rien_ne_change(self):
        h, jid = self._inscrire("SansRepos")
        r = self._programme(h, jid, [
            {"exercice": "traction", "series_cibles": 4, "reps_cibles": 8},
        ])
        self.assertEqual(r.status_code, 201, r.text)
        exo = self.client.get(f"/programmes/{r.json()['id']}", headers=h).json()["exercices"][0]
        self.assertIsNone(exo["repos_secondes"])
        self.assertIsNone(exo["rir_cible"])

    def test_l_ordre_d_envoi_est_l_ordre_relu(self):
        h, jid = self._inscrire("Ordre")
        noms = ["squat", "presse", "leg curl", "mollets"]
        r = self._programme(h, jid, [
            {"exercice": n, "series_cibles": 3, "reps_cibles": 10} for n in noms
        ])
        relu = self.client.get(f"/programmes/{r.json()['id']}", headers=h).json()
        self.assertEqual([e["exercice"] for e in relu["exercices"]], noms)

    def test_reordonner_puis_modifier_garde_le_nouvel_ordre_et_les_reglages(self):
        h, jid = self._inscrire("Reordonne")
        r = self._programme(h, jid, [
            {"exercice": "a", "series_cibles": 3, "reps_cibles": 10, "repos_secondes": 60},
            {"exercice": "b", "series_cibles": 3, "reps_cibles": 10, "rir_cible": 1},
        ])
        pid = r.json()["id"]
        r2 = self.client.put(f"/programmes/{pid}/exercices", json={"exercices": [
            {"exercice": "b", "series_cibles": 3, "reps_cibles": 10, "rir_cible": 1},
            {"exercice": "a", "series_cibles": 3, "reps_cibles": 10, "repos_secondes": 60},
        ]}, headers=h)
        self.assertEqual(r2.status_code, 200, r2.text)
        exos = r2.json()["exercices"]
        self.assertEqual([e["exercice"] for e in exos], ["b", "a"])
        self.assertEqual(exos[0]["rir_cible"], 1)
        self.assertEqual(exos[1]["repos_secondes"], 60)

    def test_un_programme_complet_garde_repos_et_rir(self):
        h, jid = self._inscrire("CycleRepos")
        r = self.client.post(f"/joueurs/{jid}/cycles", json={"nom": "PPL", "seances": [
            {"nom": "Push", "jours": ["lundi"], "exercices": [
                {"exercice": "dips", "series_cibles": 3, "reps_cibles": 10,
                 "repos_secondes": 120, "rir_cible": 2},
            ]},
        ]}, headers=h)
        self.assertEqual(r.status_code, 201, r.text)
        exo = r.json()["seances"][0]["exercices"][0]
        self.assertEqual((exo["repos_secondes"], exo["rir_cible"]), (120, 2))
        # … et l'ajout d'une séance à ce programme aussi.
        r2 = self.client.post(f"/cycles/{r.json()['id']}/seances", json={
            "nom": "Pull", "jours": ["mardi"], "exercices": [
                {"exercice": "traction", "series_cibles": 4, "reps_cibles": 6,
                 "repos_secondes": 150, "rir_cible": 1},
            ]}, headers=h)
        self.assertEqual(r2.status_code, 201, r2.text)
        pull = [s for s in r2.json()["seances"] if s["nom"] == "Pull"][0]
        self.assertEqual(pull["exercices"][0]["repos_secondes"], 150)
        self.assertEqual(pull["exercices"][0]["rir_cible"], 1)

    def test_les_valeurs_absurdes_sont_refusees(self):
        h, jid = self._inscrire("Absurde")
        for mauvais in ({"repos_secondes": -5}, {"repos_secondes": 901},
                        {"rir_cible": -1}, {"rir_cible": 11}):
            r = self._programme(h, jid, [
                {"exercice": "dips", "series_cibles": 3, "reps_cibles": 10, **mauvais},
            ])
            self.assertEqual(r.status_code, 422, mauvais)


if __name__ == "__main__":
    unittest.main()
