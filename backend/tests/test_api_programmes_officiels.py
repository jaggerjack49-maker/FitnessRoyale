"""Tests des PROGRAMMES OFFICIELS (publiés par l'admin, copiés par les autres).

Le point important : seul un admin PUBLIE, mais TOUT LE MONDE peut lire le
catalogue — sinon la fonctionnalité n'aurait aucun intérêt.

Et une règle qu'on verrouille ici : copier un programme officiel crée un
programme PERSONNEL, indépendant. Retirer l'officiel du catalogue ne doit
jamais faire disparaître la copie de quelqu'un.
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


class TestProgrammesOfficiels(unittest.TestCase):
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

    # ----- Qui a le droit de publier -----

    def test_un_compte_normal_ne_peut_pas_publier(self):
        token, _ = self._inscrire("NormalPublie")
        r = self.client.post("/admin/programmes-officiels", json=PROGRAMME,
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 403)

    def test_sans_connexion_on_ne_peut_pas_publier(self):
        r = self.client.post("/admin/programmes-officiels", json=PROGRAMME)
        self.assertEqual(r.status_code, 401)

    def test_l_admin_publie_et_tout_le_monde_lit(self):
        token, joueur_id = self._inscrire("AdminPublie")
        self._promouvoir(joueur_id)
        r = self.client.post("/admin/programmes-officiels", json=PROGRAMME,
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)

        # Lecture SANS être connecté : c'est du catalogue, rien de personnel.
        catalogue = self.client.get("/programmes-officiels").json()
        noms = [p["nom"] for p in catalogue]
        self.assertIn("PPL Fitness Royale", noms)

        publie = next(p for p in catalogue if p["nom"] == "PPL Fitness Royale")
        self.assertEqual(publie["description"], "Le Push Pull Legs officiel.")
        self.assertEqual(len(publie["seances"]), 2)
        self.assertEqual(publie["seances"][0]["jours"], ["lundi", "jeudi"])
        self.assertEqual(publie["seances"][0]["exercices"][0]["exercice"], "Développé couché")

    def test_un_jour_invalide_est_refuse(self):
        token, joueur_id = self._inscrire("AdminJourFaux")
        self._promouvoir(joueur_id)
        mauvais = {
            "nom": "Programme cassé", "description": "",
            "seances": [{"nom": "Push", "jours": ["lundu"], "exercices": []}],
        }
        r = self.client.post("/admin/programmes-officiels", json=mauvais,
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 400)

    def test_un_programme_sans_aucune_seance_est_refuse(self):
        token, joueur_id = self._inscrire("AdminVide")
        self._promouvoir(joueur_id)
        r = self.client.post("/admin/programmes-officiels",
                             json={"nom": "Vide", "description": "", "seances": []},
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 422)

    # ----- Retirer du catalogue -----

    def test_seul_l_admin_retire(self):
        admin_token, admin_id = self._inscrire("AdminRetire")
        self._promouvoir(admin_id)
        cree = self.client.post("/admin/programmes-officiels", json=PROGRAMME,
                                headers=self._en_tete(admin_token)).json()

        normal_token, _ = self._inscrire("NormalRetire")
        refus = self.client.delete(f"/admin/programmes-officiels/{cree['id']}",
                                   headers=self._en_tete(normal_token))
        self.assertEqual(refus.status_code, 403)

        ok = self.client.delete(f"/admin/programmes-officiels/{cree['id']}",
                                headers=self._en_tete(admin_token))
        self.assertEqual(ok.status_code, 204)
        ids = [p["id"] for p in self.client.get("/programmes-officiels").json()]
        self.assertNotIn(cree["id"], ids)

    def test_retirer_l_officiel_ne_touche_pas_aux_copies(self):
        """La copie d'un joueur lui appartient : elle survit au retrait."""
        admin_token, admin_id = self._inscrire("AdminCopie")
        self._promouvoir(admin_id)
        cree = self.client.post("/admin/programmes-officiels", json=PROGRAMME,
                                headers=self._en_tete(admin_token)).json()

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
