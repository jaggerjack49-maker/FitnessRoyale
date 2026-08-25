"""Tests du MODE TEST (comptes administrateur).

Le plus important ici n'est pas que les outils marchent, mais qu'un compte
NORMAL ne puisse RIEN faire de tout ça : le drapeau admin ne s'obtient qu'en
base, jamais depuis l'app.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_modetest_fitness_royale.db"


class TestAPIModeTest(unittest.TestCase):
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

    def _inscrire(self, pseudo, sexe="homme"):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123", "sexe": sexe, "poids": 80,
        })
        return r.json()["token"], r.json()["joueur"]["id"]

    def _promouvoir(self, joueur_id):
        """Passe un compte en admin — comme on le ferait à la main en base."""
        with db.connexion() as conn:
            conn.execute("UPDATE joueurs SET admin = 1 WHERE id = ?", (joueur_id,))

    def _en_tete(self, token):
        return {"Authorization": f"Bearer {token}"}

    # ----- Garde-fous : un compte normal n'a accès à rien -----

    def test_compte_normal_refuse_partout(self):
        token, _ = self._inscrire("JoueurNormal")
        h = self._en_tete(token)
        self.assertEqual(self.client.post("/admin/mes-perfs", json={"palier": 3}, headers=h).status_code, 403)
        self.assertEqual(self.client.post("/admin/mes-points", json={"points": 999}, headers=h).status_code, 403)
        self.assertEqual(self.client.post("/admin/joueurs-test", json={"nombre": 3}, headers=h).status_code, 403)
        self.assertEqual(self.client.delete("/admin/joueurs-test", headers=h).status_code, 403)

    def test_sans_connexion_refuse(self):
        self.assertEqual(self.client.post("/admin/mes-perfs", json={"palier": 3}).status_code, 401)

    def test_l_inscription_ne_rend_jamais_admin(self):
        corps = self.client.post("/auth/inscription", json={
            "pseudo": "PasAdmin", "mot_de_passe": "motdepasse123", "sexe": "homme", "poids": 80,
        }).json()
        self.assertFalse(corps["joueur"].get("admin"))

    # ----- Les outils eux-mêmes -----

    def test_se_placer_a_un_palier(self):
        token, joueur_id = self._inscrire("AdminPalier")
        self._promouvoir(joueur_id)
        r = self.client.post("/admin/mes-perfs", json={"palier": 3},
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        # 15 exercices au palier Gold → moyenne 3 → ligue Gold.
        self.assertEqual(r.json()["perfs_ecrites"], 15)
        self.assertEqual(r.json()["ligue"], "Gold")

    def test_palier_sur_une_partie_des_exercices_seulement(self):
        """Le levier qui compte pour le classement : la POLYVALENCE."""
        token, joueur_id = self._inscrire("AdminPartiel")
        self._promouvoir(joueur_id)
        r = self.client.post("/admin/mes-perfs", json={"palier": 6, "nb_exercices": 5},
                             headers=self._en_tete(token))
        self.assertEqual(r.json()["perfs_ecrites"], 5)
        # 5 exercices à Royal sur 15 → moyenne 2 → Silver, pas Royal.
        self.assertEqual(r.json()["ligue"], "Silver")

    def test_palier_zero_efface_les_perfs(self):
        token, joueur_id = self._inscrire("AdminRAZ")
        self._promouvoir(joueur_id)
        self.client.post("/admin/mes-perfs", json={"palier": 2}, headers=self._en_tete(token))
        r = self.client.post("/admin/mes-perfs", json={"palier": 0}, headers=self._en_tete(token))
        self.assertEqual(r.json()["perfs_effacees"], 15)
        self.assertEqual(self.client.get(f"/joueurs/{joueur_id}").json()["performances"], {})

    def test_remplir_remplace_sans_cumuler(self):
        """Repasser à un palier plus bas ne doit pas laisser d'anciennes perfs."""
        token, joueur_id = self._inscrire("AdminRemplace")
        self._promouvoir(joueur_id)
        self.client.post("/admin/mes-perfs", json={"palier": 5}, headers=self._en_tete(token))
        r = self.client.post("/admin/mes-perfs", json={"palier": 1, "nb_exercices": 3},
                             headers=self._en_tete(token))
        joueur = self.client.get(f"/joueurs/{joueur_id}").json()
        self.assertEqual(len(joueur["performances"]), 3)
        self.assertEqual(r.json()["perfs_ecrites"], 3)

    def test_fixer_les_points(self):
        token, joueur_id = self._inscrire("AdminPoints")
        self._promouvoir(joueur_id)
        self.client.post("/admin/mes-points", json={"points": 4200}, headers=self._en_tete(token))
        self.assertEqual(self.client.get(f"/joueurs/{joueur_id}").json()["points"], 4200)

    def test_generer_puis_supprimer_des_joueurs_test(self):
        token, joueur_id = self._inscrire("AdminGenerateur")
        self._promouvoir(joueur_id)
        avant = len(self.client.get("/joueurs").json())
        r = self.client.post("/admin/joueurs-test", json={"nombre": 6},
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["crees"], 6)
        self.assertEqual(len(self.client.get("/joueurs").json()), avant + 6)

        suppression = self.client.delete("/admin/joueurs-test", headers=self._en_tete(token))
        self.assertEqual(suppression.json()["supprimes"], 6)
        # Les VRAIS comptes sont toujours là.
        apres = self.client.get("/joueurs").json()
        self.assertEqual(len(apres), avant)
        self.assertTrue(any(j["pseudo"] == "AdminGenerateur" for j in apres))

    def test_les_joueurs_test_ne_peuvent_pas_se_connecter(self):
        token, joueur_id = self._inscrire("AdminSansMdp")
        self._promouvoir(joueur_id)
        cree = self.client.post("/admin/joueurs-test", json={"nombre": 1},
                                headers=self._en_tete(token)).json()["joueurs"][0]
        r = self.client.post("/auth/connexion",
                             json={"pseudo": cree["pseudo"], "mot_de_passe": ""})
        self.assertEqual(r.status_code, 401)

    def test_les_joueurs_generes_apparaissent_au_classement(self):
        token, joueur_id = self._inscrire("AdminClassement")
        self._promouvoir(joueur_id)
        self.client.post("/admin/joueurs-test", json={"nombre": 5, "palier_min": 4, "palier_max": 6},
                         headers=self._en_tete(token))
        classement = self.client.get("/classement/global").json()
        generes = [j for j in classement if j["pseudo"].startswith("TEST-")]
        self.assertGreaterEqual(len(generes), 5)
        # Ils ont bien des perfs vérifiées, donc une ligue.
        self.assertTrue(all(j["ligue"] != "Aucune" for j in generes))

    def test_admin_peut_valider_sa_propre_perf(self):
        """Exception mode test : sans ça, il faudrait deux comptes pour chaque perf."""
        token, joueur_id = self._inscrire("AdminAutoValide")
        self._promouvoir(joueur_id)
        self.client.post(f"/joueurs/{joueur_id}/performances",
                         json={"exercice": "Squat", "valeur": 120},
                         headers=self._en_tete(token))
        r = self.client.post(f"/joueurs/{joueur_id}/performances/Squat/verifier",
                             json={"statut": "communaute"}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        perf = self.client.get(f"/joueurs/{joueur_id}").json()["performances"]["Squat"]
        self.assertEqual(perf["statut"], "communaute")

    def test_un_compte_normal_ne_peut_toujours_pas_s_auto_valider(self):
        """La règle de fond ne bouge PAS pour les joueurs ordinaires."""
        token, joueur_id = self._inscrire("NormalAutoValide")
        self.client.post(f"/joueurs/{joueur_id}/performances",
                         json={"exercice": "Squat", "valeur": 120},
                         headers=self._en_tete(token))
        r = self.client.post(f"/joueurs/{joueur_id}/performances/Squat/verifier",
                             json={"statut": "communaute"}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main()
