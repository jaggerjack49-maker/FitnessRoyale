"""Le JOURNAL NUTRITION (12/11/2026) : les totaux des derniers jours notés.

On vérifie : un jour = une ligne avec ses totaux additionnés, les jours sans
repas absents, la fenêtre de dates respectée (bornes incluses), le tri du plus
récent au plus ancien, la vie privée, les bornes absurdes refusées — et que le
coût ne dépend PAS du nombre de jours ni de repas (une seule requête).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_historique_nutrition_fitness_royale.db"


class TestHistoriqueNutrition(unittest.TestCase):
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

    def _repas(self, h, j, jour, kcal, p=0, g=0, l=0):
        r = self.client.post(f"/joueurs/{j}/repas", headers=h, json={
            "nom": "Repas", "date": jour, "source": "manuel",
            "aliments": [{"nom": "x", "kcal": kcal, "proteines_g": p, "glucides_g": g, "lipides_g": l}],
        })
        self.assertEqual(r.status_code, 201, r.text)

    def _historique(self, h, j, **params):
        return self.client.get(f"/joueurs/{j}/nutrition/historique", headers=h, params=params)

    def test_un_jour_une_ligne_avec_ses_totaux(self):
        h, j = self._inscrire("JournalTotaux")
        self._repas(h, j, "2026-11-10", 500, 30, 60, 10.5)
        self._repas(h, j, "2026-11-10", 700, 40.2, 80, 20)
        self._repas(h, j, "2026-11-08", 300, 10, 40, 5)
        r = self._historique(h, j, jusqu_au="2026-11-12", jours=7)
        self.assertEqual(r.status_code, 200, r.text)
        corps = r.json()
        self.assertEqual(corps["depuis"], "2026-11-06")
        self.assertEqual(corps["jusqu_au"], "2026-11-12")
        self.assertEqual([d["date"] for d in corps["jours"]], ["2026-11-10", "2026-11-08"])
        jour = corps["jours"][0]
        self.assertEqual(jour["nb_repas"], 2)
        self.assertEqual(jour["kcal"], 1200)
        self.assertEqual(jour["proteines_g"], 70.2)
        self.assertEqual(jour["glucides_g"], 140)
        self.assertEqual(jour["lipides_g"], 30.5)
        self.assertIn("objectifs", corps)

    def test_la_fenetre_de_dates_est_respectee_bornes_incluses(self):
        h, j = self._inscrire("JournalFenetre")
        for jour in ("2026-11-01", "2026-11-02", "2026-11-08", "2026-11-09"):
            self._repas(h, j, jour, 100)
        # 7 jours jusqu'au 08 : du 02 au 08, le 01 et le 09 sont dehors.
        corps = self._historique(h, j, jusqu_au="2026-11-08", jours=7).json()
        self.assertEqual([d["date"] for d in corps["jours"]], ["2026-11-08", "2026-11-02"])

    def test_un_compte_sans_repas_a_un_journal_vide(self):
        h, j = self._inscrire("JournalVide")
        self.assertEqual(self._historique(h, j, jusqu_au="2026-11-12").json()["jours"], [])

    def test_prive(self):
        h_a, j_a = self._inscrire("JournalAlice")
        h_b, _ = self._inscrire("JournalBob")
        self._repas(h_a, j_a, "2026-11-10", 500)
        self.assertEqual(self._historique(h_b, j_a).status_code, 403)
        self.assertEqual(self.client.get(f"/joueurs/{j_a}/nutrition/historique").status_code, 401)

    def test_bornes_absurdes_refusees(self):
        h, j = self._inscrire("JournalBornes")
        for params in ({"jours": 0}, {"jours": 91}, {"jusqu_au": "12/11/2026"}):
            with self.subTest(params=params):
                self.assertEqual(self._historique(h, j, **params).status_code, 400)

    def test_le_cout_ne_depend_pas_du_nombre_de_jours(self):
        _, j = self._inscrire("JournalCout")
        requetes = []
        vraie = db._ConnexionAdaptee.execute

        def comptee(self_conn, *args, **kwargs):
            requetes.append(1)
            return vraie(self_conn, *args, **kwargs)

        def compter():
            requetes.clear()
            db._ConnexionAdaptee.execute = comptee
            try:
                db.bilans_nutrition(j, "2026-10-01", "2026-11-30")
            finally:
                db._ConnexionAdaptee.execute = vraie
            return len(requetes)

        db.creer_repas(j, "2026-11-01", "t", "r", "manuel", [], {
            "kcal": 1, "proteines_g": 0, "glucides_g": 0, "lipides_g": 0})
        peu = compter()
        for n in range(30):
            jour = f"2026-11-{(n % 28) + 1:02d}"
            db.creer_repas(j, jour, "t", "r", "manuel", [], {
                "kcal": 1, "proteines_g": 0, "glucides_g": 0, "lipides_g": 0})
        self.assertEqual(compter(), peu)
        self.assertEqual(peu, 1)


if __name__ == "__main__":
    unittest.main()
