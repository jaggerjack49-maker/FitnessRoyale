"""Tests d'intégration de l'authentification — de VRAIES requêtes HTTP contre
l'app FastAPI (via TestClient), sur une base de données TEMPORAIRE.

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

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_auth_fitness_royale.db"


class TestAPIAuth(unittest.TestCase):
    # IMPORTANT : db.CHEMIN_DB est une variable GLOBALE au module basededonnees.
    # Si on la redirige au niveau du fichier (import time), le fichier de test
    # importé EN DERNIER écrase le chemin pour tous les autres fichiers de test
    # qui tournent dans le même process (`python -m unittest discover`) — d'où
    # des comptes de test qui se mélangent entre fichiers ! On la redirige donc
    # ICI, dans setUpClass/tearDownClass, pour qu'elle ne soit active que le
    # temps du test de CETTE classe (même principe que test_auth.TestSessions).
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()  # déclenche le startup event (tables + seed démo)

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    def _inscrire(self, pseudo, mdp="motdepasse123", sexe="homme", poids=80):
        return self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": mdp, "sexe": sexe, "poids": poids,
        })

    def _en_tete(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_inscription_renvoie_un_token_sans_exposer_le_hash(self):
        r = self._inscrire("Alice")
        self.assertEqual(r.status_code, 201)
        corps = r.json()
        self.assertIn("token", corps)
        self.assertNotIn("mot_de_passe_hash", corps["joueur"])

    def test_inscription_pseudo_deja_pris(self):
        self._inscrire("Bob")
        r = self._inscrire("Bob")
        self.assertEqual(r.status_code, 409)

    def test_connexion_bon_mot_de_passe(self):
        self._inscrire("Carla", mdp="bonmotdepasse")
        r = self.client.post("/auth/connexion", json={"pseudo": "Carla", "mot_de_passe": "bonmotdepasse"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("token", r.json())

    def test_connexion_mauvais_mot_de_passe(self):
        self._inscrire("David", mdp="bonmotdepasse")
        r = self.client.post("/auth/connexion", json={"pseudo": "David", "mot_de_passe": "faux"})
        self.assertEqual(r.status_code, 401)

    def test_connexion_pseudo_inconnu(self):
        r = self.client.post("/auth/connexion", json={"pseudo": "PersonnePasInscrite", "mot_de_passe": "x"})
        self.assertEqual(r.status_code, 401)

    def test_auth_moi_sans_token(self):
        r = self.client.get("/auth/moi")
        self.assertEqual(r.status_code, 401)

    def test_auth_moi_avec_token(self):
        token = self._inscrire("Emma").json()["token"]
        r = self.client.get("/auth/moi", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["pseudo"], "Emma")

    def test_ne_peut_pas_modifier_les_perfs_dun_autre(self):
        r_a = self._inscrire("Fred")
        joueur_a_id = r_a.json()["joueur"]["id"]
        token_b = self._inscrire("Gina").json()["token"]
        r = self.client.post(
            f"/joueurs/{joueur_a_id}/performances",
            json={"exercice": "Squat", "valeur": 100},
            headers=self._en_tete(token_b),
        )
        self.assertEqual(r.status_code, 403)

    def test_peut_modifier_ses_propres_perfs(self):
        r_inscription = self._inscrire("Hugo")
        token = r_inscription.json()["token"]
        joueur_id = r_inscription.json()["joueur"]["id"]
        r = self.client.post(
            f"/joueurs/{joueur_id}/performances",
            json={"exercice": "Squat", "valeur": 100},
            headers=self._en_tete(token),
        )
        self.assertEqual(r.status_code, 201)

    def test_sans_token_du_tout_est_refuse(self):
        r_inscription = self._inscrire("Hector")
        joueur_id = r_inscription.json()["joueur"]["id"]
        r = self.client.post(
            f"/joueurs/{joueur_id}/performances", json={"exercice": "Squat", "valeur": 100},
        )
        self.assertEqual(r.status_code, 401)

    def test_ne_peut_pas_verifier_sa_propre_perf_communaute(self):
        r_inscription = self._inscrire("Iris")
        token = r_inscription.json()["token"]
        joueur_id = r_inscription.json()["joueur"]["id"]
        self.client.post(f"/joueurs/{joueur_id}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token))
        r = self.client.post(
            f"/joueurs/{joueur_id}/performances/Squat/verifier",
            json={"statut": "communaute"},
            headers=self._en_tete(token),
        )
        self.assertEqual(r.status_code, 403)

    def test_peut_verifier_salle_sur_soi_meme(self):
        # La vérification "salle" (partenaire) reste auto-appliquée par
        # l'utilisateur affilié — voir décision notée dans CLAUDE.md.
        r_inscription = self._inscrire("Jules")
        token = r_inscription.json()["token"]
        joueur_id = r_inscription.json()["joueur"]["id"]
        self.client.post(f"/joueurs/{joueur_id}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token))
        r = self.client.post(
            f"/joueurs/{joueur_id}/performances/Squat/verifier",
            json={"statut": "salle"},
            headers=self._en_tete(token),
        )
        self.assertEqual(r.status_code, 200)

    def test_autre_joueur_peut_verifier_communaute(self):
        r_a = self._inscrire("Karim")
        token_a = r_a.json()["token"]
        joueur_a_id = r_a.json()["joueur"]["id"]
        token_b = self._inscrire("Lina").json()["token"]
        self.client.post(f"/joueurs/{joueur_a_id}/performances", json={"exercice": "Squat", "valeur": 100},
                         headers=self._en_tete(token_a))
        r = self.client.post(
            f"/joueurs/{joueur_a_id}/performances/Squat/verifier",
            json={"statut": "communaute"},
            headers=self._en_tete(token_b),
        )
        self.assertEqual(r.status_code, 200)

    def test_deconnexion_invalide_le_token(self):
        token = self._inscrire("Marc").json()["token"]
        r = self.client.post("/auth/deconnexion", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        r2 = self.client.get("/auth/moi", headers=self._en_tete(token))
        self.assertEqual(r2.status_code, 401)

    def test_ne_peut_pas_ajouter_une_seance_pour_un_autre(self):
        r_a = self._inscrire("Nadia")
        joueur_a_id = r_a.json()["joueur"]["id"]
        token_b = self._inscrire("Omar").json()["token"]
        r = self.client.post(
            f"/joueurs/{joueur_a_id}/seances", json={"minutes": 45}, headers=self._en_tete(token_b),
        )
        self.assertEqual(r.status_code, 403)

    def test_ne_peut_pas_valider_un_defi_pour_un_autre(self):
        r_a = self._inscrire("Paul")
        joueur_a_id = r_a.json()["joueur"]["id"]
        token_b = self._inscrire("Quentin").json()["token"]
        r = self.client.post(
            f"/joueurs/{joueur_a_id}/defis/jour/valider", headers=self._en_tete(token_b),
        )
        self.assertEqual(r.status_code, 403)

    # ----- Changer de mot de passe + mot de passe oublié (code de secours) -----

    def test_inscription_renvoie_un_code_de_recuperation(self):
        corps = self._inscrire("Rita").json()
        self.assertIn("code_recuperation", corps)
        self.assertEqual(len(corps["code_recuperation"]), 8)
        # Le hash du code ne fuite jamais dans le profil renvoyé.
        self.assertNotIn("code_recuperation_hash", corps["joueur"])

    def test_changer_mot_de_passe_exige_l_ancien(self):
        token = self._inscrire("Sami", mdp="ancienmdp").json()["token"]
        r = self.client.post("/auth/changer-mot-de-passe",
                             json={"ancien_mot_de_passe": "faux", "nouveau_mot_de_passe": "nouveaumdp"},
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 403)
        # L'ancien mot de passe marche toujours (rien n'a changé).
        r2 = self.client.post("/auth/connexion", json={"pseudo": "Sami", "mot_de_passe": "ancienmdp"})
        self.assertEqual(r2.status_code, 200)

    def test_changer_mot_de_passe_ok(self):
        token = self._inscrire("Tania", mdp="ancienmdp").json()["token"]
        r = self.client.post("/auth/changer-mot-de-passe",
                             json={"ancien_mot_de_passe": "ancienmdp", "nouveau_mot_de_passe": "nouveaumdp"},
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        # Le nouveau marche, l'ancien non.
        ok = self.client.post("/auth/connexion", json={"pseudo": "Tania", "mot_de_passe": "nouveaumdp"})
        self.assertEqual(ok.status_code, 200)
        ko = self.client.post("/auth/connexion", json={"pseudo": "Tania", "mot_de_passe": "ancienmdp"})
        self.assertEqual(ko.status_code, 401)

    def test_mot_de_passe_oublie_avec_le_code_de_secours(self):
        corps = self._inscrire("Ugo", mdp="perdu").json()
        code = corps["code_recuperation"]
        ancien_token = corps["token"]
        r = self.client.post("/auth/mot-de-passe-oublie",
                             json={"pseudo": "Ugo", "code_recuperation": code,
                                   "nouveau_mot_de_passe": "toutneuf"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("token", r.json())  # reconnecté directement
        # Le nouveau mot de passe marche.
        ok = self.client.post("/auth/connexion", json={"pseudo": "Ugo", "mot_de_passe": "toutneuf"})
        self.assertEqual(ok.status_code, 200)
        # Sécurité : les ANCIENNES sessions sont mortes (déconnexion partout).
        r2 = self.client.get("/auth/moi", headers=self._en_tete(ancien_token))
        self.assertEqual(r2.status_code, 401)

    def test_mot_de_passe_oublie_code_faux(self):
        self._inscrire("Vera", mdp="perdu")
        r = self.client.post("/auth/mot-de-passe-oublie",
                             json={"pseudo": "Vera", "code_recuperation": "FAUXCODE",
                                   "nouveau_mot_de_passe": "pirate"})
        self.assertEqual(r.status_code, 401)

    def test_code_de_secours_a_usage_unique(self):
        code = self._inscrire("Walid", mdp="perdu").json()["code_recuperation"]
        premier = self.client.post("/auth/mot-de-passe-oublie",
                                   json={"pseudo": "Walid", "code_recuperation": code,
                                         "nouveau_mot_de_passe": "neuf1"})
        self.assertEqual(premier.status_code, 200)
        second = self.client.post("/auth/mot-de-passe-oublie",
                                  json={"pseudo": "Walid", "code_recuperation": code,
                                        "nouveau_mot_de_passe": "neuf2"})
        self.assertEqual(second.status_code, 401)

    def test_regenerer_un_code_de_secours_invalide_l_ancien(self):
        corps = self._inscrire("Yanis", mdp="perdu").json()
        ancien_code = corps["code_recuperation"]
        token = corps["token"]
        r = self.client.post("/auth/code-recuperation", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        nouveau_code = r.json()["code_recuperation"]
        # L'ancien code ne marche plus…
        ko = self.client.post("/auth/mot-de-passe-oublie",
                              json={"pseudo": "Yanis", "code_recuperation": ancien_code,
                                    "nouveau_mot_de_passe": "x1234"})
        self.assertEqual(ko.status_code, 401)
        # … le nouveau, si.
        ok = self.client.post("/auth/mot-de-passe-oublie",
                              json={"pseudo": "Yanis", "code_recuperation": nouveau_code,
                                    "nouveau_mot_de_passe": "x1234"})
        self.assertEqual(ok.status_code, 200)


if __name__ == "__main__":
    unittest.main()
