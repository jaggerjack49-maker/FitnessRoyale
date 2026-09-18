"""Les routes de nutrition : analyse d'une photo, journal, objectif du jour.

L'IA n'est JAMAIS appelée : `nutrition.analyser_photo` est remplacée par une
fausse fonction, et la présence d'une clé est simulée. On vérifie ce que fait
NOTRE serveur : droits d'accès, limite quotidienne d'analyses, totaux
recalculés, et les photos qui ne montrent pas de nourriture.
"""

import base64
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from app import nutrition
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_nutrition_fitness_royale.db"
PHOTO = base64.b64encode(b"\xff\xd8\xff" + b"0" * 200).decode()

ANALYSE = nutrition.normaliser_analyse({
    "est_de_la_nourriture": True, "description": "Omelette",
    "aliments": [{"nom": "Omelette 3 oeufs", "portion": "1 assiette", "grammes": 180,
                  "kcal": 280, "proteines_g": 19.5, "glucides_g": 1.2, "lipides_g": 21.0}],
    "confiance": "elevee", "remarque": "",
})


class TestApiNutrition(unittest.TestCase):
    # Voir test_api_auth.py : redirection de db.CHEMIN_DB dans setUpClass.
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()
        cls.h_alice, cls.id_alice = cls._inscrire(cls, "AliceMange")
        cls.h_bob, cls.id_bob = cls._inscrire(cls, "BobGourmand")
        cls.cle_originale = os.environ.get("ANTHROPIC_API_KEY")
        cls.analyser_original = nutrition.analyser_photo

    @classmethod
    def tearDownClass(cls):
        nutrition.analyser_photo = cls.analyser_original
        if cls.cle_originale is None:
            os.environ.pop("ANTHROPIC_API_KEY", None)
        else:
            os.environ["ANTHROPIC_API_KEY"] = cls.cle_originale
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    def setUp(self):
        # Une clé factice : le serveur croit l'analyse configurée. Et une
        # fausse analyse, qui compte ses appels au lieu d'appeler l'IA.
        os.environ["ANTHROPIC_API_KEY"] = "cle-factice-de-test"
        self.appels = []

        def fausse_analyse(image_base64, media_type, client=None):
            self.appels.append(media_type)
            return dict(ANALYSE)

        nutrition.analyser_photo = fausse_analyse

    def _inscrire(cls, pseudo):
        r = cls.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123", "sexe": "homme", "poids": 80,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _analyser(self, headers=None, joueur=None, **photo):
        corps = {"image_base64": PHOTO, "media_type": "image/jpeg", **photo}
        return self.client.post(f"/joueurs/{joueur or self.id_alice}/nutrition/analyser",
                                json=corps, headers=headers or self.h_alice)

    # ---------------- analyse d'une photo ----------------

    def test_analyse_renvoie_le_resultat_sans_l_enregistrer(self):
        r = self._analyser()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["totaux"]["kcal"], 280)
        self.assertIn("analyses_restantes", r.json())
        journal = self.client.get(f"/joueurs/{self.id_alice}/repas", headers=self.h_alice).json()
        self.assertEqual(journal["repas"], [], "une analyse seule ne doit rien ajouter au journal")

    def test_analyse_reservee_au_proprietaire(self):
        self.assertEqual(self._analyser(headers=self.h_bob).status_code, 403)
        self.assertEqual(self.client.post(
            f"/joueurs/{self.id_alice}/nutrition/analyser",
            json={"image_base64": PHOTO, "media_type": "image/jpeg"}).status_code, 401)
        self.assertEqual(self.appels, [], "l'IA ne doit jamais être appelée pour un intrus")

    def test_format_et_photo_verifies_avant_l_ia(self):
        self.assertEqual(self._analyser(media_type="image/gif").status_code, 400)
        self.assertEqual(self._analyser(image_base64="!!pas du base64!!" * 10).status_code, 400)
        self.assertEqual(self.appels, [])

    def test_sans_cle_503_et_rien_n_est_compte(self):
        os.environ.pop("ANTHROPIC_API_KEY", None)
        jour = db.nb_analyses_du_jour(self.id_bob, __import__("datetime").date.today().isoformat())
        r = self._analyser(headers=self.h_bob, joueur=self.id_bob)
        self.assertEqual(r.status_code, 503)
        apres = db.nb_analyses_du_jour(self.id_bob, __import__("datetime").date.today().isoformat())
        self.assertEqual(apres, jour, "une analyse impossible faute de clé ne doit pas être comptée")

    def test_photo_sans_nourriture_422(self):
        def pas_de_nourriture(image_base64, media_type, client=None):
            return nutrition.normaliser_analyse(
                {"est_de_la_nourriture": False, "aliments": [], "remarque": "C'est un chat."})

        nutrition.analyser_photo = pas_de_nourriture
        r = self._analyser()
        self.assertEqual(r.status_code, 422)
        self.assertIn("chat", r.json()["detail"])

    def test_echec_de_l_ia_502_avec_message(self):
        def echec(image_base64, media_type, client=None):
            raise nutrition.AnalyseImpossible("L'IA a refusé d'analyser cette photo.")

        nutrition.analyser_photo = echec
        r = self._analyser()
        self.assertEqual(r.status_code, 502)
        self.assertIn("refusé", r.json()["detail"])

    def test_limite_quotidienne(self):
        # Un joueur neuf, pour partir d'un compteur à zéro.
        h, j = self._inscrire("ClaraQuota")
        for i in range(nutrition.QUOTA_ANALYSES_PAR_JOUR):
            r = self._analyser(headers=h, joueur=j)
            self.assertEqual(r.status_code, 200, f"analyse {i + 1} : {r.text}")
        self.assertEqual(r.json()["analyses_restantes"], 0)
        r = self._analyser(headers=h, joueur=j)
        self.assertEqual(r.status_code, 429)
        self.assertEqual(len(self.appels), nutrition.QUOTA_ANALYSES_PAR_JOUR,
                         "au-delà de la limite, l'IA ne doit plus être appelée")

    # ---------------- journal ----------------

    def test_journal_totaux_recalcules_par_le_serveur(self):
        h, j = self._inscrire("DavidJournal")
        for aliments in (
            [{"nom": "Pomme", "kcal": 80, "proteines_g": 0.4, "glucides_g": 19, "lipides_g": 0.3}],
            [{"nom": "Steak", "kcal": 300, "proteines_g": 40, "glucides_g": 0, "lipides_g": 15},
             {"nom": "Frites", "kcal": 450, "proteines_g": 5, "glucides_g": 55, "lipides_g": 22}],
        ):
            r = self.client.post(f"/joueurs/{j}/repas", headers=h, json={
                "nom": "Repas", "date": "2026-09-18", "aliments": aliments,
                # Un total mensonger envoyé par l'app : ignoré (le champ n'existe pas).
                "kcal": 1,
            })
            self.assertEqual(r.status_code, 201, r.text)
        journal = self.client.get(f"/joueurs/{j}/repas?date=2026-09-18", headers=h).json()
        self.assertEqual(len(journal["repas"]), 2)
        self.assertEqual(journal["repas"][1]["kcal"], 750)
        self.assertEqual(journal["totaux"]["kcal"], 830)
        self.assertEqual(journal["totaux"]["proteines_g"], 45.4)
        # Un autre jour est vide.
        autre = self.client.get(f"/joueurs/{j}/repas?date=2026-09-17", headers=h).json()
        self.assertEqual(autre["repas"], [])

    def test_repas_mal_formes_refuses(self):
        url = f"/joueurs/{self.id_alice}/repas"
        for corps in (
            {"nom": "Vide", "aliments": []},
            {"nom": "Négatif", "aliments": [{"nom": "x", "kcal": -5}]},
            {"nom": "Énorme", "aliments": [{"nom": "x", "kcal": 99999}]},
        ):
            with self.subTest(corps=corps["nom"]):
                self.assertEqual(self.client.post(url, json=corps, headers=self.h_alice).status_code, 422)
        r = self.client.post(url, headers=self.h_alice, json={
            "nom": "Date", "date": "18/09/2026", "aliments": [{"nom": "x", "kcal": 5}]})
        self.assertEqual(r.status_code, 400)

    def test_journal_et_suppression_prives(self):
        r = self.client.post(f"/joueurs/{self.id_alice}/repas", headers=self.h_alice, json={
            "nom": "Secret", "aliments": [{"nom": "Gâteau", "kcal": 400}]})
        repas_id = r.json()["id"]
        self.assertEqual(self.client.get(f"/joueurs/{self.id_alice}/repas",
                                         headers=self.h_bob).status_code, 403)
        self.assertEqual(self.client.delete(f"/repas/{repas_id}", headers=self.h_bob).status_code, 403)
        self.assertIsNotNone(db.lire_repas(repas_id), "Bob ne doit pas pouvoir supprimer le repas d'Alice")
        self.assertEqual(self.client.delete(f"/repas/{repas_id}", headers=self.h_alice).status_code, 204)
        self.assertIsNone(db.lire_repas(repas_id))
        self.assertEqual(self.client.delete(f"/repas/{repas_id}", headers=self.h_alice).status_code, 404)

    # ---------------- objectif du jour ----------------

    def test_objectifs(self):
        h, j = self._inscrire("EmmaObjectif")
        self.assertEqual(self.client.get(f"/joueurs/{j}/objectifs-nutrition", headers=h).json(),
                         {"kcal": None, "proteines": None})
        r = self.client.put(f"/joueurs/{j}/objectifs-nutrition", headers=h,
                            json={"kcal": 2400, "proteines": 160})
        self.assertEqual(r.json(), {"kcal": 2400, "proteines": 160})
        r = self.client.put(f"/joueurs/{j}/objectifs-nutrition", headers=h,
                            json={"kcal": 2200, "proteines": None})
        self.assertEqual(r.json(), {"kcal": 2200, "proteines": None})
        self.assertEqual(self.client.get(f"/joueurs/{j}/repas", headers=h).json()["objectifs"],
                         {"kcal": 2200, "proteines": None})
        self.assertEqual(self.client.put(f"/joueurs/{j}/objectifs-nutrition", headers=h,
                                         json={"kcal": 50}).status_code, 422)
        self.assertEqual(self.client.put(f"/joueurs/{j}/objectifs-nutrition", headers=self.h_bob,
                                         json={"kcal": 2000}).status_code, 403)


if __name__ == "__main__":
    unittest.main()
