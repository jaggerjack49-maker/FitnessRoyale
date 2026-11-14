"""Renommer un programme COMPLET (14/11/2026).

Il fallait jusqu'ici le supprimer et le recréer. `PUT /cycles/{id}/nom` change
le nom du programme ; ses séances (« Push », « Pull »…) gardent le leur.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_renommer_cycle_fitness_royale.db"


class TestRenommerCycle(unittest.TestCase):
    # Voir test_api_auth.py : redirection de db.CHEMIN_DB dans setUpClass.
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
            "sexe": "homme", "poids": 78,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _cycle(self, jid, h):
        return self.client.post(f"/joueurs/{jid}/cycles", json={
            "nom": "Mon PPL", "seances": [
                {"nom": "Push", "jours": ["lundi"], "exercices": [
                    {"exercice": "developpe couche", "series_cibles": 3, "reps_cibles": 8}]},
                {"nom": "Pull", "jours": ["mardi"], "exercices": [
                    {"exercice": "tractions", "series_cibles": 3, "reps_cibles": 8}]},
            ],
        }, headers=h).json()

    def test_le_programme_est_renomme_et_relu(self):
        h, jid = self._inscrire("RenomCycle")
        cycle = self._cycle(jid, h)
        r = self.client.put(f"/cycles/{cycle['id']}/nom", json={"nom": "  PPL hiver  "}, headers=h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["nom"], "PPL hiver")  # espaces autour retirés
        relu = self.client.get(f"/joueurs/{jid}/cycles", headers=h).json()[0]
        self.assertEqual(relu["nom"], "PPL hiver")

    def test_les_seances_gardent_leur_nom(self):
        h, jid = self._inscrire("RenomSeances")
        cycle = self._cycle(jid, h)
        self.client.put(f"/cycles/{cycle['id']}/nom", json={"nom": "Autre"}, headers=h)
        relu = self.client.get(f"/joueurs/{jid}/cycles", headers=h).json()[0]
        self.assertEqual([s["nom"] for s in relu["seances"]], ["Push", "Pull"])

    def test_un_nom_vide_est_refuse(self):
        h, jid = self._inscrire("RenomVide")
        cycle = self._cycle(jid, h)
        for nom in ["", "   "]:
            r = self.client.put(f"/cycles/{cycle['id']}/nom", json={"nom": nom}, headers=h)
            self.assertEqual(r.status_code, 422, nom)
        relu = self.client.get(f"/joueurs/{jid}/cycles", headers=h).json()[0]
        self.assertEqual(relu["nom"], "Mon PPL")

    def test_on_ne_renomme_pas_le_programme_d_un_autre(self):
        h, jid = self._inscrire("RenomProprio")
        h2, _ = self._inscrire("RenomIntrus")
        cycle = self._cycle(jid, h)
        r = self.client.put(f"/cycles/{cycle['id']}/nom", json={"nom": "Pirate"}, headers=h2)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.put(f"/cycles/{cycle['id']}/nom", json={"nom": "X"}).status_code, 401)
        relu = self.client.get(f"/joueurs/{jid}/cycles", headers=h).json()[0]
        self.assertEqual(relu["nom"], "Mon PPL")

    def test_programme_inexistant(self):
        h, _ = self._inscrire("RenomAbsent")
        self.assertEqual(self.client.put("/cycles/999999/nom", json={"nom": "X"}, headers=h).status_code, 404)


if __name__ == "__main__":
    unittest.main()
