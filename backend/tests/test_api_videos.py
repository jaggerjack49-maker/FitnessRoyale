"""Tests d'intégration des preuves vidéo — de VRAIES requêtes HTTP (avec un
vrai upload multipart) contre l'app FastAPI, sur une base ET un dossier de
vidéos TEMPORAIRES.

Lancer avec : python -m unittest discover tests
"""

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from app import videos as regles_videos
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_videos_fitness_royale.db"
_DOSSIER_TEMP = Path(tempfile.gettempdir()) / "test_api_videos_fitness_royale_videos"

# Un tout petit contenu binaire factice qui fait office de "vidéo" pour les tests
# (le serveur ne vérifie pas le contenu réel, seulement l'extension et la taille).
FAUX_CONTENU_VIDEO = b"FAKE_MP4_CONTENT_FOR_TESTS"


class TestAPIVideos(unittest.TestCase):
    # Voir le commentaire dans test_api_auth.py : on redirige la base ET le
    # dossier de stockage vidéo ICI (setUpClass/tearDownClass), jamais au
    # niveau du fichier, pour ne pas polluer le vrai dossier backend/videos/
    # ni écraser le chemin utilisé par d'autres fichiers de test.
    @classmethod
    def setUpClass(cls):
        cls.chemin_db_original = db.CHEMIN_DB
        cls.dossier_videos_original = regles_videos.DOSSIER_VIDEOS
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        shutil.rmtree(_DOSSIER_TEMP, ignore_errors=True)
        db.CHEMIN_DB = _FICHIER_TEMP
        regles_videos.DOSSIER_VIDEOS = _DOSSIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_db_original
        regles_videos.DOSSIER_VIDEOS = cls.dossier_videos_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        shutil.rmtree(_DOSSIER_TEMP, ignore_errors=True)

    def _inscrire(self, pseudo, mdp="motdepasse123", sexe="homme", poids=80):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": mdp, "sexe": sexe, "poids": poids,
        })
        return r.json()["token"], r.json()["joueur"]["id"]

    def _en_tete(self, token):
        return {"Authorization": f"Bearer {token}"}

    def _joindre_video(self, token, joueur_id, exercice="Squat", nom_fichier="preuve.mp4"):
        return self.client.post(
            f"/joueurs/{joueur_id}/performances/{exercice}/video",
            files={"fichier": (nom_fichier, FAUX_CONTENU_VIDEO, "video/mp4")},
            headers=self._en_tete(token),
        )

    # ----- Upload -----

    def test_upload_video_sur_sa_propre_perf(self):
        token, joueur_id = self._inscrire("Alpha")
        self.client.post(f"/joueurs/{joueur_id}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token))
        r = self._joindre_video(token, joueur_id)
        self.assertEqual(r.status_code, 201)
        corps = r.json()
        self.assertEqual(corps["statut"], "en_attente")
        self.assertEqual(corps["exercice"], "Squat")

    def test_upload_sans_connexion_refuse(self):
        r = self.client.post(
            "/joueurs/1/performances/Squat/video",
            files={"fichier": ("preuve.mp4", FAUX_CONTENU_VIDEO, "video/mp4")},
        )
        self.assertEqual(r.status_code, 401)

    def test_upload_sur_la_perf_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("Beta")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        token_b, _ = self._inscrire("Gamma")
        r = self._joindre_video(token_b, id_a)
        self.assertEqual(r.status_code, 403)

    def test_upload_sans_perf_existante_refuse(self):
        token, joueur_id = self._inscrire("Delta")
        r = self._joindre_video(token, joueur_id, exercice="Squat")
        self.assertEqual(r.status_code, 404)

    def test_upload_extension_non_supportee_refusee(self):
        token, joueur_id = self._inscrire("Epsilon")
        self.client.post(f"/joueurs/{joueur_id}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token))
        r = self.client.post(
            f"/joueurs/{joueur_id}/performances/Squat/video",
            files={"fichier": ("preuve.exe", FAUX_CONTENU_VIDEO, "application/octet-stream")},
            headers=self._en_tete(token),
        )
        self.assertEqual(r.status_code, 400)

    # ----- Liste des vidéos en attente -----

    def test_video_en_attente_visible_par_les_autres_pas_par_soi_meme(self):
        token_a, id_a = self._inscrire("Zeta")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        self._joindre_video(token_a, id_a)
        token_b, _ = self._inscrire("Eta")

        pour_moi = self.client.get("/videos/en-attente", headers=self._en_tete(token_a)).json()
        self.assertNotIn(id_a, [v["joueur_id"] for v in pour_moi])

        pour_lautre = self.client.get("/videos/en-attente", headers=self._en_tete(token_b)).json()
        self.assertIn(id_a, [v["joueur_id"] for v in pour_lautre])

    # ----- Vote -----

    def test_valider_fait_passer_la_perf_en_communaute(self):
        token_a, id_a = self._inscrire("Theta")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        token_b, _ = self._inscrire("Iota")

        r = self.client.post(f"/videos/{video['id']}/voter", json={"valide": True}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["statut"], "validee")

        profil = self.client.get("/joueurs/" + str(id_a)).json()
        self.assertEqual(profil["performances"]["Squat"]["statut"], "communaute")

    def test_refuser_ne_valide_pas_la_perf(self):
        token_a, id_a = self._inscrire("Kappa")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        token_b, _ = self._inscrire("Lambda")

        r = self.client.post(f"/videos/{video['id']}/voter", json={"valide": False}, headers=self._en_tete(token_b))
        self.assertEqual(r.json()["statut"], "refusee")

        profil = self.client.get("/joueurs/" + str(id_a)).json()
        self.assertEqual(profil["performances"]["Squat"]["statut"], "declare")

    def test_ne_peut_pas_voter_sur_sa_propre_video(self):
        token_a, id_a = self._inscrire("Mu")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        r = self.client.post(f"/videos/{video['id']}/voter", json={"valide": True}, headers=self._en_tete(token_a))
        self.assertEqual(r.status_code, 403)

    def test_ne_peut_pas_revoter_apres_resolution(self):
        token_a, id_a = self._inscrire("Nu")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        token_b, _ = self._inscrire("Xi")
        token_c, _ = self._inscrire("Omicron")

        self.client.post(f"/videos/{video['id']}/voter", json={"valide": True}, headers=self._en_tete(token_b))
        r = self.client.post(f"/videos/{video['id']}/voter", json={"valide": False}, headers=self._en_tete(token_c))
        self.assertEqual(r.status_code, 400)

    def test_recuperer_le_fichier_video(self):
        token_a, id_a = self._inscrire("Pi")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        r = self.client.get(f"/videos/{video['id']}/fichier")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.content, FAUX_CONTENU_VIDEO)

    # ----- Aucun stockage permanent (demande de Hafiz, 20/08/2026) -----

    def test_le_fichier_disparait_du_disque_apres_validation(self):
        token_a, id_a = self._inscrire("Rho")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        chemin = regles_videos.chemin_video(video["fichier"])
        self.assertTrue(chemin.exists())  # présent tant que personne n'a voté

        token_b, _ = self._inscrire("Sigma")
        self.client.post(f"/videos/{video['id']}/voter", json={"valide": True}, headers=self._en_tete(token_b))

        self.assertFalse(chemin.exists())  # supprimé dès la résolution du vote
        r = self.client.get(f"/videos/{video['id']}/fichier")
        self.assertEqual(r.status_code, 404)

    def test_le_fichier_disparait_du_disque_apres_refus(self):
        token_a, id_a = self._inscrire("Tau")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        chemin = regles_videos.chemin_video(video["fichier"])

        token_b, _ = self._inscrire("Upsilon")
        self.client.post(f"/videos/{video['id']}/voter", json={"valide": False}, headers=self._en_tete(token_b))

        self.assertFalse(chemin.exists())
        r = self.client.get(f"/videos/{video['id']}/fichier")
        self.assertEqual(r.status_code, 404)

    def test_la_perf_et_le_statut_du_vote_restent_apres_suppression_du_fichier(self):
        """La TRACE (statut, qui a validé) reste en base — seul le FICHIER disparaît."""
        token_a, id_a = self._inscrire("Phi")
        self.client.post(f"/joueurs/{id_a}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        video = self._joindre_video(token_a, id_a).json()
        token_b, _ = self._inscrire("Chi")
        self.client.post(f"/videos/{video['id']}/voter", json={"valide": True}, headers=self._en_tete(token_b))

        profil = self.client.get("/joueurs/" + str(id_a)).json()
        self.assertEqual(profil["performances"]["Squat"]["statut"], "communaute")


if __name__ == "__main__":
    unittest.main()
