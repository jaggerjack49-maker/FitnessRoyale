"""Tests d'intégration du chat de clan — de VRAIES requêtes HTTP contre l'app
FastAPI (via TestClient), sur une base de données TEMPORAIRE.

Lancer avec : python -m unittest discover tests
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_clan_fitness_royale.db"


class TestAPIClan(unittest.TestCase):
    # Voir le commentaire dans test_api_auth.py sur la redirection de db.CHEMIN_DB.
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

    def _inscrire(self, pseudo, salle, mdp="motdepasse123", sexe="homme", poids=80):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": mdp, "sexe": sexe, "poids": poids, "salle": salle,
        })
        return r.json()["token"], r.json()["joueur"]["id"]

    def _en_tete(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_membre_peut_envoyer_et_lire(self):
        token, _ = self._inscrire("Alpha", "Club SP")
        r = self.client.post("/clans/Club SP/messages", json={"texte": "Salut le clan !"},
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["pseudo"], "Alpha")

        r2 = self.client.get("/clans/Club SP/messages", headers=self._en_tete(token))
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(len(r2.json()), 1)
        self.assertEqual(r2.json()[0]["texte"], "Salut le clan !")

    def test_deux_membres_de_la_meme_salle_se_voient(self):
        token_a, _ = self._inscrire("Beta", "PowerHouse")
        token_b, _ = self._inscrire("Gamma", "PowerHouse")
        self.client.post("/clans/PowerHouse/messages", json={"texte": "Message de Beta"},
                         headers=self._en_tete(token_a))
        r = self.client.get("/clans/PowerHouse/messages", headers=self._en_tete(token_b))
        self.assertEqual(len(r.json()), 1)
        self.assertEqual(r.json()[0]["pseudo"], "Beta")

    def test_non_membre_ne_peut_pas_lire(self):
        token_a, _ = self._inscrire("Delta", "Titan Gym")
        self.client.post("/clans/Titan Gym/messages", json={"texte": "Message privé du clan"},
                         headers=self._en_tete(token_a))
        token_b, _ = self._inscrire("Epsilon", "Autre Salle")
        r = self.client.get("/clans/Titan Gym/messages", headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_non_membre_ne_peut_pas_ecrire(self):
        self._inscrire("Zeta", "Salle Z")
        token_b, _ = self._inscrire("Eta", "Autre Salle 2")
        r = self.client.post("/clans/Salle Z/messages", json={"texte": "Je m'incruste"},
                             headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_joueur_sans_salle_na_acces_a_aucun_clan(self):
        token, _ = self._inscrire("Theta", None)
        r = self.client.get("/clans/Club SP/messages", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 403)

    def test_sans_connexion_refuse(self):
        r = self.client.get("/clans/Club SP/messages")
        self.assertEqual(r.status_code, 401)

    def test_messages_dans_lordre_chronologique(self):
        token, _ = self._inscrire("Iota", "Salle Ordre")
        for texte in ("Premier", "Deuxième", "Troisième"):
            self.client.post("/clans/Salle Ordre/messages", json={"texte": texte},
                             headers=self._en_tete(token))
        r = self.client.get("/clans/Salle Ordre/messages", headers=self._en_tete(token))
        self.assertEqual([m["texte"] for m in r.json()], ["Premier", "Deuxième", "Troisième"])

    def test_message_vide_refuse(self):
        token, _ = self._inscrire("Kappa", "Salle Vide")
        r = self.client.post("/clans/Salle Vide/messages", json={"texte": ""}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 422)  # validation Pydantic (min_length=1)


if __name__ == "__main__":
    unittest.main()
