"""Tests des PROGRAMMES PARTAGÉS (l'admin partage, on récupère avec un code).

Le point le plus important est une NON-fonctionnalité : il ne doit exister
AUCUN moyen de lister les programmes partagés. Sans le code, un joueur ne peut
même pas savoir qu'un programme existe (demande de Hafiz du 02/09/2026 :
« je ne veux pas que tout le monde voie le programme »).

Et une règle qu'on verrouille aussi : copier un programme partagé crée un
programme PERSONNEL, indépendant. Retirer le partage ne doit jamais faire
disparaître la copie de quelqu'un.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_prog_officiels_fitness_royale.db"

# Un programme d'exemple, dans la forme attendue par l'app.
PROGRAMME = {
    "nom": "PPL Fitness Royale",
    "description": "Le Push Pull Legs officiel.",
    "seances": [
        {
            "nom": "Push",
            "jours": ["lundi", "jeudi"],
            "exercices": [
                {"exercice": "Développé couché", "series_cibles": 4, "reps_cibles": 8},
            ],
        },
        {
            "nom": "Pull",
            "jours": ["mardi"],
            "exercices": [
                {"exercice": "Traction prise large", "series_cibles": 4, "reps_cibles": 6},
            ],
        },
    ],
}


class TestProgrammesPartages(unittest.TestCase):
    # Voir test_api_auth.py : la redirection de db.CHEMIN_DB doit se faire ICI,
    # pas au niveau du fichier, sinon les fichiers de test se mélangent.
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
        return r.json()["token"], r.json()["joueur"]["id"]

    def _promouvoir(self, joueur_id):
        with db.connexion() as conn:
            conn.execute("UPDATE joueurs SET admin = 1 WHERE id = ?", (joueur_id,))

    def _en_tete(self, token):
        return {"Authorization": f"Bearer {token}"}

    def _partager(self, token, programme=None):
        return self.client.post("/admin/programmes-officiels",
                                json=programme or PROGRAMME,
                                headers=self._en_tete(token))

    # ----- Qui a le droit de partager -----

    def test_un_compte_normal_ne_peut_pas_partager(self):
        token, _ = self._inscrire("NormalPartage")
        self.assertEqual(self._partager(token).status_code, 403)

    def test_sans_connexion_on_ne_peut_pas_partager(self):
        self.assertEqual(self.client.post("/admin/programmes-officiels",
                                          json=PROGRAMME).status_code, 401)

    def test_partager_renvoie_un_code(self):
        token, joueur_id = self._inscrire("AdminCode")
        self._promouvoir(joueur_id)
        r = self._partager(token)
        self.assertEqual(r.status_code, 201)
        code = r.json()["code"]
        self.assertEqual(len(code), 6)
        # Le code ne contient que les caractères non ambigus des codes de duel.
        self.assertTrue(all(c in "ABCDEFGHJKMNPQRSTUVWXYZ23456789" for c in code), code)

    # ----- Le code est le SEUL chemin -----

    def test_avec_le_code_on_recupere_le_programme(self):
        token, joueur_id = self._inscrire("AdminDonne")
        self._promouvoir(joueur_id)
        code = self._partager(token).json()["code"]

        autre_token, _ = self._inscrire("JoueurRecoit")
        r = self.client.get(f"/programmes-partages/{code}", headers=self._en_tete(autre_token))
        self.assertEqual(r.status_code, 200)
        corps = r.json()
        self.assertEqual(corps["nom"], "PPL Fitness Royale")
        self.assertEqual(len(corps["seances"]), 2)
        self.assertEqual(corps["seances"][0]["jours"], ["lundi", "jeudi"])

    def test_le_code_est_insensible_a_la_casse(self):
        token, joueur_id = self._inscrire("AdminCasse")
        self._promouvoir(joueur_id)
        code = self._partager(token).json()["code"]
        autre_token, _ = self._inscrire("JoueurCasse")
        r = self.client.get(f"/programmes-partages/{code.lower()}",
                            headers=self._en_tete(autre_token))
        self.assertEqual(r.status_code, 200)

    def test_un_mauvais_code_ne_donne_rien(self):
        token, _ = self._inscrire("JoueurMauvaisCode")
        r = self.client.get("/programmes-partages/ZZZZZZ", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 404)

    def test_le_code_sert_plusieurs_fois(self):
        """Contrairement aux codes de duel et de validation, celui-ci n'est PAS
        à usage unique : il est fait pour être donné à plusieurs personnes."""
        token, joueur_id = self._inscrire("AdminMultiple")
        self._promouvoir(joueur_id)
        code = self._partager(token).json()["code"]
        for pseudo in ("Recoit1", "Recoit2", "Recoit3"):
            t, _ = self._inscrire(pseudo)
            r = self.client.get(f"/programmes-partages/{code}", headers=self._en_tete(t))
            self.assertEqual(r.status_code, 200)

    def test_aucun_moyen_de_lister_les_programmes_des_autres(self):
        """LE test de cette fonctionnalité : rien ne doit être visible sans code."""
        admin_token, admin_id = self._inscrire("AdminSecret")
        self._promouvoir(admin_id)
        self._partager(admin_token)

        joueur_token, _ = self._inscrire("Curieux")
        # L'ancien catalogue public n'existe plus.
        self.assertEqual(self.client.get("/programmes-officiels").status_code, 404)
        # Et la liste réservée à l'admin est refusée à un compte normal.
        self.assertEqual(
            self.client.get("/admin/programmes-officiels",
                            headers=self._en_tete(joueur_token)).status_code, 403)

    def test_l_admin_voit_ses_partages_avec_leurs_codes(self):
        token, joueur_id = self._inscrire("AdminListe")
        self._promouvoir(joueur_id)
        code = self._partager(token).json()["code"]
        liste = self.client.get("/admin/programmes-officiels",
                                headers=self._en_tete(token)).json()
        self.assertIn(code, [p["code"] for p in liste])

    def test_un_admin_ne_voit_que_ses_propres_partages(self):
        a_token, a_id = self._inscrire("AdminA")
        self._promouvoir(a_id)
        code_a = self._partager(a_token).json()["code"]

        b_token, b_id = self._inscrire("AdminB")
        self._promouvoir(b_id)
        codes_b = [p["code"] for p in self.client.get(
            "/admin/programmes-officiels", headers=self._en_tete(b_token)).json()]
        self.assertNotIn(code_a, codes_b)

    # ----- Garde-fous de contenu -----

    def test_un_jour_invalide_est_refuse(self):
        token, joueur_id = self._inscrire("AdminJourFaux")
        self._promouvoir(joueur_id)
        mauvais = {
            "nom": "Programme cassé", "description": "",
            "seances": [{"nom": "Push", "jours": ["lundu"], "exercices": []}],
        }
        self.assertEqual(self._partager(token, mauvais).status_code, 400)

    def test_un_programme_sans_aucune_seance_est_refuse(self):
        token, joueur_id = self._inscrire("AdminVide")
        self._promouvoir(joueur_id)
        vide = {"nom": "Vide", "description": "", "seances": []}
        self.assertEqual(self._partager(token, vide).status_code, 422)

    # ----- Retirer un partage -----

    def test_seul_l_admin_retire(self):
        admin_token, admin_id = self._inscrire("AdminRetire")
        self._promouvoir(admin_id)
        cree = self._partager(admin_token).json()

        normal_token, _ = self._inscrire("NormalRetire")
        self.assertEqual(
            self.client.delete(f"/admin/programmes-officiels/{cree['id']}",
                               headers=self._en_tete(normal_token)).status_code, 403)

        self.assertEqual(
            self.client.delete(f"/admin/programmes-officiels/{cree['id']}",
                               headers=self._en_tete(admin_token)).status_code, 204)

    def test_le_code_ne_marche_plus_apres_retrait(self):
        admin_token, admin_id = self._inscrire("AdminRetireCode")
        self._promouvoir(admin_id)
        cree = self._partager(admin_token).json()

        joueur_token, _ = self._inscrire("JoueurApresRetrait")
        self.assertEqual(
            self.client.get(f"/programmes-partages/{cree['code']}",
                            headers=self._en_tete(joueur_token)).status_code, 200)

        self.client.delete(f"/admin/programmes-officiels/{cree['id']}",
                           headers=self._en_tete(admin_token))
        self.assertEqual(
            self.client.get(f"/programmes-partages/{cree['code']}",
                            headers=self._en_tete(joueur_token)).status_code, 404)

    def test_retirer_le_partage_ne_touche_pas_aux_copies(self):
        """La copie d'un joueur lui appartient : elle survit au retrait."""
        admin_token, admin_id = self._inscrire("AdminCopie")
        self._promouvoir(admin_id)
        cree = self._partager(admin_token).json()

        # Un joueur « colle » le programme : ça crée un programme à LUI
        # (exactement ce que fait l'app en appelant l'endpoint habituel).
        joueur_token, joueur_id = self._inscrire("JoueurCopie")
        h = self._en_tete(joueur_token)
        copie = self.client.post(f"/joueurs/{joueur_id}/programmes", json={
            "nom": "Push", "jours": ["lundi", "jeudi"],
            "exercices": [{"exercice": "Développé couché", "series_cibles": 4, "reps_cibles": 8}],
        }, headers=h)
        self.assertEqual(copie.status_code, 201)

        self.client.delete(f"/admin/programmes-officiels/{cree['id']}",
                           headers=self._en_tete(admin_token))

        mes_programmes = self.client.get(f"/joueurs/{joueur_id}/programmes", headers=h).json()
        self.assertEqual([p["nom"] for p in mes_programmes], ["Push"])


if __name__ == "__main__":
    unittest.main()
