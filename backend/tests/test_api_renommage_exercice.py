"""Tests du RENOMMAGE D'UN EXERCICE partout où il est mentionné.

Le nom d'un exercice est son seul identifiant : il est écrit tel quel dans les
exercices cibles d'un programme, dans les séries loggées, et dans la correction
manuelle de groupe musculaire. Le renommer à un seul endroit coupait le lien
avec tout le reste (records, suggestion de charge, comptage de séries).

Ce que ces tests verrouillent :
 - les trois tables suivent bien le renommage ;
 - un joueur ne renomme QUE chez lui — jamais dans les données d'un autre ;
 - la contrainte UNIQUE de `groupes_exercices` ne fait pas planter le
   renommage quand le nouveau nom a déjà sa propre correction.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_renommage_fitness_royale.db"


class TestRenommageExercice(unittest.TestCase):
    # Voir test_api_auth.py : la redirection de db.CHEMIN_DB se fait ICI, pas au
    # niveau du fichier, sinon les fichiers de test se mélangent.
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

    def _programme(self, h, joueur_id, nom, exercice):
        return self.client.post(f"/joueurs/{joueur_id}/programmes", json={
            "nom": nom, "jours": [],
            "exercices": [{"exercice": exercice, "series_cibles": 4, "reps_cibles": 8}],
        }, headers=h).json()

    def _logger(self, h, joueur_id, date, exercice):
        return self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "programme_id": None, "date": date,
            "series": [
                {"exercice": exercice, "numero_serie": 1, "reps": 8, "poids": 100},
                {"exercice": exercice, "numero_serie": 2, "reps": 8, "poids": 100},
            ],
        }, headers=h)

    def _renommer(self, h, joueur_id, ancien, nouveau):
        return self.client.put(
            f"/joueurs/{joueur_id}/exercices/{ancien}/nom",
            json={"nouveau": nouveau}, headers=h,
        )

    # ----- Le cœur : les trois tables suivent -----

    def test_le_renommage_touche_programmes_historique_et_groupe(self):
        h, joueur_id = self._inscrire("RenommeTout")
        self._programme(h, joueur_id, "Push", "Développé couché")
        self._programme(h, joueur_id, "Push bis", "Développé couché")
        self._logger(h, joueur_id, "2026-09-01", "Développé couché")
        self.client.put(
            f"/joueurs/{joueur_id}/groupes-exercices/Développé couché",
            json={"groupe": "Pectoraux"}, headers=h,
        )

        r = self._renommer(h, joueur_id, "Développé couché", "Bench press")
        self.assertEqual(r.status_code, 200)
        compte = r.json()
        self.assertEqual(compte["programmes"], 2)  # les DEUX programmes
        self.assertEqual(compte["series"], 2)
        self.assertEqual(compte["groupes"], 1)

        # Les programmes portent le nouveau nom.
        programmes = self.client.get(f"/joueurs/{joueur_id}/programmes", headers=h).json()
        noms = {exo["exercice"] for p in programmes for exo in p["exercices"]}
        self.assertEqual(noms, {"Bench press"})

        # L'historique aussi — c'est lui qui porte records et suggestions.
        entrainements = self.client.get(f"/joueurs/{joueur_id}/entrainements", headers=h).json()
        exercices = {s["exercice"] for e in entrainements for s in e["series"]}
        self.assertEqual(exercices, {"Bench press"})

        # Et la correction de groupe musculaire.
        groupes = self.client.get(f"/joueurs/{joueur_id}/groupes-exercices", headers=h).json()
        self.assertEqual(
            [g for g in groupes if g["exercice"] == "Bench press"][0]["groupe"], "Pectoraux")
        self.assertEqual([g for g in groupes if g["exercice"] == "Développé couché"], [])

    # ----- Cloisonnement entre joueurs -----

    def test_on_ne_renomme_jamais_chez_un_autre_joueur(self):
        h1, id1 = self._inscrire("RenommeurA")
        h2, id2 = self._inscrire("VictimeB")
        self._programme(h1, id1, "Push A", "Squat")
        self._programme(h2, id2, "Push B", "Squat")
        self._logger(h2, id2, "2026-09-01", "Squat")

        self._renommer(h1, id1, "Squat", "Back squat")

        # Le programme ET l'historique de l'AUTRE joueur n'ont pas bougé.
        programmes = self.client.get(f"/joueurs/{id2}/programmes", headers=h2).json()
        self.assertEqual(programmes[0]["exercices"][0]["exercice"], "Squat")
        entrainements = self.client.get(f"/joueurs/{id2}/entrainements", headers=h2).json()
        self.assertEqual(entrainements[0]["series"][0]["exercice"], "Squat")

    def test_renommer_chez_quelqu_un_d_autre_est_refuse(self):
        h1, _ = self._inscrire("Intrus")
        _, id2 = self._inscrire("CibleIntrus")
        r = self._renommer(h1, id2, "Squat", "Peu importe")
        self.assertEqual(r.status_code, 403)

    def test_sans_connexion_c_est_refuse(self):
        r = self.client.put("/joueurs/1/exercices/Squat/nom", json={"nouveau": "Autre"})
        self.assertEqual(r.status_code, 401)

    # ----- Cas limites -----

    def test_le_nouveau_nom_avait_deja_sa_correction_de_groupe(self):
        """La table porte UNIQUE (joueur, exercice) : sans traitement, l'UPDATE
        violerait la contrainte. La correction du NOUVEAU nom fait autorité."""
        h, joueur_id = self._inscrire("CollisionGroupe")
        self._logger(h, joueur_id, "2026-09-01", "Leg curl")
        for exercice, groupe in (("Leg curl", "Biceps"), ("Ischio machine", "Ischio-jambiers")):
            self.client.put(f"/joueurs/{joueur_id}/groupes-exercices/{exercice}",
                            json={"groupe": groupe}, headers=h)

        r = self._renommer(h, joueur_id, "Leg curl", "Ischio machine")
        self.assertEqual(r.status_code, 200)

        groupes = self.client.get(f"/joueurs/{joueur_id}/groupes-exercices", headers=h).json()
        restants = {g["exercice"]: g["groupe"] for g in groupes}
        self.assertEqual(restants.get("Ischio machine"), "Ischio-jambiers")
        self.assertNotIn("Leg curl", restants)

    def test_renommer_vers_le_meme_nom_ne_fait_rien(self):
        h, joueur_id = self._inscrire("MemeNom")
        self._programme(h, joueur_id, "Push", "Dips")
        r = self._renommer(h, joueur_id, "Dips", "Dips")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"programmes": 0, "series": 0, "groupes": 0})

    def test_un_nom_vide_est_refuse(self):
        h, joueur_id = self._inscrire("NomVide")
        r = self._renommer(h, joueur_id, "Dips", "   ")
        self.assertEqual(r.status_code, 400)

    def test_renommer_un_exercice_inexistant_ne_plante_pas(self):
        h, joueur_id = self._inscrire("Inexistant")
        r = self._renommer(h, joueur_id, "Exercice jamais fait", "Autre chose")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"programmes": 0, "series": 0, "groupes": 0})

    def test_le_renommage_ne_touche_pas_les_performances_du_bareme(self):
        """Les perfs du barème Fitness Royale sont un AUTRE espace de noms :
        elles ne doivent jamais bouger quand on renomme un exercice
        d'entraînement (texte libre)."""
        h, joueur_id = self._inscrire("BaremeIntact")
        self.client.post(f"/joueurs/{joueur_id}/performances", json={
            "exercice": "Développé couché", "valeur": 100, "statut": "communaute",
        }, headers=h)
        self._logger(h, joueur_id, "2026-09-01", "Développé couché")

        self._renommer(h, joueur_id, "Développé couché", "Bench press")

        joueur = self.client.get(f"/joueurs/{joueur_id}").json()
        self.assertIn("Développé couché", joueur["performances"])
        self.assertNotIn("Bench press", joueur["performances"])


if __name__ == "__main__":
    unittest.main()
