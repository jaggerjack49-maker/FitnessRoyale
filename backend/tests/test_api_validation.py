"""Tests d'intégration des deux validations SANS VIDÉO : code partagé avec un
partenaire présent, et vote communauté sur simple confiance.

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

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_validation_fitness_royale.db"


class TestAPIValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chemin_db_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_db_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    def _inscrire(self, pseudo, sexe="homme", poids=80):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123", "sexe": sexe, "poids": poids,
        })
        return r.json()["token"], r.json()["joueur"]["id"]

    def _en_tete(self, token):
        return {"Authorization": f"Bearer {token}"}

    def _ajouter_perf(self, token, joueur_id, exercice="Squat", valeur=100):
        return self.client.post(f"/joueurs/{joueur_id}/performances",
                                json={"exercice": exercice, "valeur": valeur},
                                headers=self._en_tete(token))

    # ----- Validation par code (partenaire présent) -----

    def test_flux_complet_code_validation(self):
        token_a, id_a = self._inscrire("Alpha")
        self._ajouter_perf(token_a, id_a)
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/code-validation",
                             headers=self._en_tete(token_a))
        self.assertEqual(r.status_code, 201)
        code = r.json()["code"]

        token_b, _ = self._inscrire("Beta")
        r = self.client.post("/validations/rejoindre", json={"code": code}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["statut"], "salle")

        profil = self.client.get(f"/joueurs/{id_a}").json()
        self.assertEqual(profil["performances"]["Squat"]["statut"], "salle")

    def test_creer_code_sans_perf_refuse(self):
        token_a, id_a = self._inscrire("Gamma")
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/code-validation",
                             headers=self._en_tete(token_a))
        self.assertEqual(r.status_code, 404)

    def test_creer_code_sur_perf_deja_verifiee_refuse(self):
        token_a, id_a = self._inscrire("Delta")
        self._ajouter_perf(token_a, id_a)
        token_b, _ = self._inscrire("Epsilon")
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/code-validation",
                             headers=self._en_tete(token_a))
        code = r.json()["code"]
        self.client.post("/validations/rejoindre", json={"code": code}, headers=self._en_tete(token_b))
        # La perf est maintenant "salle" -> plus possible d'en refaire un code.
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/code-validation",
                             headers=self._en_tete(token_a))
        self.assertEqual(r.status_code, 400)

    def test_creer_code_sur_la_perf_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("Zeta")
        self._ajouter_perf(token_a, id_a)
        token_b, _ = self._inscrire("Eta")
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/code-validation",
                             headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_rejoindre_avec_code_inconnu_refuse(self):
        token_a, _ = self._inscrire("Theta")
        r = self.client.post("/validations/rejoindre", json={"code": "ZZZZZZ"}, headers=self._en_tete(token_a))
        self.assertEqual(r.status_code, 404)

    def test_rejoindre_sa_propre_perf_refuse(self):
        token_a, id_a = self._inscrire("Iota")
        self._ajouter_perf(token_a, id_a)
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/code-validation",
                             headers=self._en_tete(token_a))
        code = r.json()["code"]
        r = self.client.post("/validations/rejoindre", json={"code": code}, headers=self._en_tete(token_a))
        self.assertEqual(r.status_code, 403)

    def test_rejoindre_deux_fois_le_meme_code_refuse(self):
        token_a, id_a = self._inscrire("Kappa")
        self._ajouter_perf(token_a, id_a)
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/code-validation",
                             headers=self._en_tete(token_a))
        code = r.json()["code"]
        token_b, _ = self._inscrire("Lambda")
        token_c, _ = self._inscrire("Mu")
        self.client.post("/validations/rejoindre", json={"code": code}, headers=self._en_tete(token_b))
        r = self.client.post("/validations/rejoindre", json={"code": code}, headers=self._en_tete(token_c))
        self.assertEqual(r.status_code, 400)

    # ----- Vote communauté sans vidéo -----

    def test_flux_complet_vote_sans_video(self):
        token_a, id_a = self._inscrire("Nu")
        self._ajouter_perf(token_a, id_a)
        token_b, _ = self._inscrire("Xi")

        pour_b = self.client.get("/performances/a-valider-sans-video", headers=self._en_tete(token_b)).json()
        self.assertTrue(any(p["joueur_id"] == id_a and p["exercice"] == "Squat" for p in pour_b))

        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/voter-sans-video",
                             json={"valide": True}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["statut"], "communaute")

        profil = self.client.get(f"/joueurs/{id_a}").json()
        self.assertEqual(profil["performances"]["Squat"]["statut"], "communaute")

        # Résolue -> disparaît de la liste.
        pour_b_apres = self.client.get("/performances/a-valider-sans-video", headers=self._en_tete(token_b)).json()
        self.assertFalse(any(p["joueur_id"] == id_a and p["exercice"] == "Squat" for p in pour_b_apres))

    def test_refuser_ne_valide_pas_la_perf(self):
        token_a, id_a = self._inscrire("Omicron")
        self._ajouter_perf(token_a, id_a)
        token_b, _ = self._inscrire("Pi")
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/voter-sans-video",
                             json={"valide": False}, headers=self._en_tete(token_b))
        self.assertEqual(r.json()["statut"], "declare")
        profil = self.client.get(f"/joueurs/{id_a}").json()
        self.assertEqual(profil["performances"]["Squat"]["statut"], "declare")

    def test_ne_peut_pas_voter_sur_sa_propre_perf(self):
        token_a, id_a = self._inscrire("Rho")
        self._ajouter_perf(token_a, id_a)
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/voter-sans-video",
                             json={"valide": True}, headers=self._en_tete(token_a))
        self.assertEqual(r.status_code, 403)

    def test_ne_peut_pas_revoter_sur_la_meme_perf(self):
        token_a, id_a = self._inscrire("Sigma")
        self._ajouter_perf(token_a, id_a)
        token_b, _ = self._inscrire("Tau")
        self.client.post(f"/joueurs/{id_a}/performances/Squat/voter-sans-video",
                         json={"valide": False}, headers=self._en_tete(token_b))
        r = self.client.post(f"/joueurs/{id_a}/performances/Squat/voter-sans-video",
                             json={"valide": False}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 409)

    def test_perf_avec_video_en_attente_absente_du_vote_sans_video(self):
        # Si une vidéo est déjà en attente sur cette perf, elle ne doit PAS
        # apparaître dans la liste "sans vidéo" (on préfère la vidéo, plus rigoureuse).
        token_a, id_a = self._inscrire("Upsilon")
        self._ajouter_perf(token_a, id_a)
        self.client.post(
            f"/joueurs/{id_a}/performances/Squat/video",
            files={"fichier": ("preuve.mp4", b"FAKE", "video/mp4")},
            headers=self._en_tete(token_a),
        )
        token_b, _ = self._inscrire("Phi")
        pour_b = self.client.get("/performances/a-valider-sans-video", headers=self._en_tete(token_b)).json()
        self.assertFalse(any(p["joueur_id"] == id_a and p["exercice"] == "Squat" for p in pour_b))

    def test_vote_sans_video_sans_connexion_refuse(self):
        r = self.client.post("/joueurs/1/performances/Squat/voter-sans-video", json={"valide": True})
        self.assertEqual(r.status_code, 401)


if __name__ == "__main__":
    unittest.main()
