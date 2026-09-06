"""Les données d'entraînement d'un joueur ne se lisent QUE par lui.

Trouvé par l'audit du 06/09/2026 : l'ÉCRITURE était correctement verrouillée
partout (15 tentatives d'écriture chez autrui, 15 refus), mais la LECTURE ne
l'était nulle part. Il suffisait de connaître un numéro de joueur — un entier —
pour lire, SANS MÊME ÊTRE CONNECTÉ, ses programmes, son journal de séances,
son calendrier, ses objectifs et son XP.

C'était une asymétrie, pas un choix : rien dans le projet ne dit que ces
données sont publiques. Le classement, lui, reste ouvert — c'est son rôle.

Ces tests verrouillent les deux moitiés : personne d'autre ne lit, et le
propriétaire lit toujours.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_lecture_privee_fitness_royale.db"


class TestLecturePrivee(unittest.TestCase):
    # Voir test_api_auth.py : redirection de db.CHEMIN_DB dans setUpClass.
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()

        # Un joueur avec des données dans TOUTES les tables personnelles.
        cls.h_alice, cls.id_alice = cls._inscrire_statique(cls, "AliceLecture")
        cls.h_bob, cls.id_bob = cls._inscrire_statique(cls, "BobCurieux")

        cls.client.post(f"/joueurs/{cls.id_alice}/programmes", json={
            "nom": "Programme d'Alice", "jours": ["lundi"],
            "exercices": [{"exercice": "Squat", "series_cibles": 4, "reps_cibles": 8}],
        }, headers=cls.h_alice)
        cls.client.post(f"/joueurs/{cls.id_alice}/entrainements", json={
            "programme_id": None, "date": "2026-09-01",
            "series": [{"exercice": "Squat", "numero_serie": 1, "reps": 8, "poids": 140}],
        }, headers=cls.h_alice)
        cls.client.post(f"/joueurs/{cls.id_alice}/seances",
                        json={"date": "2026-09-01", "duree_minutes": 60}, headers=cls.h_alice)

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    def _inscrire_statique(cls, pseudo):
        r = cls.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123", "sexe": "homme", "poids": 80,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _lectures(self):
        """Toutes les lectures personnelles, avec leur URL pour Alice."""
        return {
            "programmes": f"/joueurs/{self.id_alice}/programmes",
            "entrainements": f"/joueurs/{self.id_alice}/entrainements",
            "seances": f"/joueurs/{self.id_alice}/seances",
            "planning": f"/joueurs/{self.id_alice}/planning",
            "cycles": f"/joueurs/{self.id_alice}/cycles",
            "objectifs-series": f"/joueurs/{self.id_alice}/objectifs-series",
            "groupes-exercices": f"/joueurs/{self.id_alice}/groupes-exercices",
            "duels": f"/joueurs/{self.id_alice}/duels",
            "defis": f"/joueurs/{self.id_alice}/defis",
            "xp": f"/joueurs/{self.id_alice}/xp",
            "dernier exercice": f"/joueurs/{self.id_alice}/exercices/Squat/dernier",
        }

    def test_aucune_lecture_personnelle_sans_connexion(self):
        for nom, url in self._lectures().items():
            with self.subTest(endpoint=nom):
                self.assertEqual(self.client.get(url).status_code, 401)

    def test_aucune_lecture_personnelle_par_un_autre_joueur(self):
        for nom, url in self._lectures().items():
            with self.subTest(endpoint=nom):
                self.assertEqual(
                    self.client.get(url, headers=self.h_bob).status_code, 403)

    def test_le_proprietaire_lit_toujours_tout(self):
        """L'autre moitié : verrouiller ne doit rien casser pour Alice."""
        for nom, url in self._lectures().items():
            with self.subTest(endpoint=nom):
                self.assertEqual(
                    self.client.get(url, headers=self.h_alice).status_code, 200)

    def test_le_contenu_reste_correct_pour_le_proprietaire(self):
        entrainements = self.client.get(
            f"/joueurs/{self.id_alice}/entrainements", headers=self.h_alice).json()
        self.assertEqual(entrainements[0]["series"][0]["poids"], 140)
        programmes = self.client.get(
            f"/joueurs/{self.id_alice}/programmes", headers=self.h_alice).json()
        self.assertEqual(programmes[0]["nom"], "Programme d'Alice")

    def test_un_programme_precis_ne_se_lit_que_par_son_proprietaire(self):
        programme = self.client.get(
            f"/joueurs/{self.id_alice}/programmes", headers=self.h_alice).json()[0]
        url = f"/programmes/{programme['id']}"
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.get(url, headers=self.h_bob).status_code, 403)
        self.assertEqual(self.client.get(url, headers=self.h_alice).status_code, 200)

    def test_le_classement_reste_public(self):
        """Contre-épreuve : on n'a pas verrouillé ce qui doit rester ouvert.
        Le classement est le cœur du jeu, il se lit sans connexion."""
        for url in ("/joueurs", "/classement/global", "/classement/poids",
                    "/classement/salles", "/sante", "/bareme/homme"):
            with self.subTest(endpoint=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_on_ne_peut_plus_deviner_qu_un_joueur_existe(self):
        """Un id inexistant renvoie 403 comme un id qui ne m'appartient pas :
        impossible de sonder la base en comparant les codes de réponse."""
        inexistant = self.client.get("/joueurs/999999/entrainements", headers=self.h_bob)
        autre = self.client.get(
            f"/joueurs/{self.id_alice}/entrainements", headers=self.h_bob)
        self.assertEqual(inexistant.status_code, autre.status_code)


if __name__ == "__main__":
    unittest.main()
