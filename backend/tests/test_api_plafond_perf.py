"""Une perf ne peut plus dépasser 3 fois le palier le plus haut (14/11/2026).

Signalé par l'audit du 06/09/2026 : 1 000 000 000 kg au développé couché était
accepté. Ça ne faussait pas le classement (« la polyvalence récompensée »
plafonne l'effet d'un seul exercice), mais ça polluait l'affichage. La limite
est la même côté app (`valeurMaxExercice`, comparée par test_parite_front_back).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_plafond_perf_fitness_royale.db"


class TestPlafondPerf(unittest.TestCase):
    # Voir test_api_auth.py : redirection de db.CHEMIN_DB dans setUpClass.
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
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": sexe, "poids": 78,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]

    def _perf(self, joueur, headers, exercice, valeur):
        return self.client.post(f"/joueurs/{joueur['id']}/performances",
                                json={"exercice": exercice, "valeur": valeur},
                                headers=headers)

    def test_une_valeur_absurde_est_refusee(self):
        h, j = self._inscrire("PlafondAbsurde")
        r = self._perf(j, h, "Développé couché", 1_000_000_000)
        self.assertEqual(r.status_code, 400)
        self.assertIn("trop haute", r.json()["detail"])
        # Et rien n'est enregistré.
        self.assertNotIn("Développé couché",
                         self.client.get("/auth/moi", headers=h).json()["performances"])

    def test_le_plafond_lui_meme_est_accepte(self):
        # Homme, développé couché : palier Royal 145 kg → plafond 435 kg.
        h, j = self._inscrire("PlafondPile")
        self.assertEqual(self._perf(j, h, "Développé couché", 435).status_code, 201)
        self.assertEqual(self._perf(j, h, "Développé couché", 435.5).status_code, 400)

    def test_une_vraie_grosse_perf_passe(self):
        h, j = self._inscrire("PlafondFort")
        self.assertEqual(self._perf(j, h, "Squat", 250).status_code, 201)

    def test_le_plafond_suit_le_bareme_du_sexe(self):
        # Femme, traction prise large : palier le plus haut 15 reps → 45 reps.
        h, j = self._inscrire("PlafondFemme", sexe="femme")
        self.assertEqual(self._perf(j, h, "Traction prise large", 45).status_code, 201)
        self.assertEqual(self._perf(j, h, "Traction prise large", 46).status_code, 400)


if __name__ == "__main__":
    unittest.main()
