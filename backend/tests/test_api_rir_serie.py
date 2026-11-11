"""Le RIR RESSENTI d'une série — 11/11/2026.

Demande de Hafiz : « pouvoir noter l'effort ressenti pendant la série via le
RIR ». Le RIR (« reps in reserve ») dit combien de répétitions on avait encore
en réserve à la fin de la série : 0 = jusqu'à l'échec, 3 = on aurait pu en
faire trois de plus.

Chaque série peut le porter (colonne `rir` de `series_journal`), FACULTATIF :
une série sans RIR noté reste parfaitement valide. À ne pas confondre avec
`rir_cible` d'un programme, qui est l'effort VISÉ (voir test_api_repos_rir.py).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_rir_serie_fitness_royale.db"


class TestRirSerie(unittest.TestCase):
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
            "pseudo": pseudo, "mot_de_passe": "motdepasse", "sexe": "homme", "poids": 80,
        })
        self.assertEqual(r.status_code, 201, r.text)
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _logger(self, h, jid, series):
        return self.client.post(f"/joueurs/{jid}/entrainements", json={
            "programme_id": None, "date": "2026-11-11", "series": series,
        }, headers=h)

    @staticmethod
    def _serie(n, rir="absent"):
        serie = {"exercice": "Squat", "numero_serie": n, "reps": 8, "poids": 100}
        if rir != "absent":
            serie["rir"] = rir
        return serie

    def test_le_rir_est_range_avec_chaque_serie(self):
        h, jid = self._inscrire("Rir1")
        r = self._logger(h, jid, [self._serie(1, 3), self._serie(2, 1)])
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual([s["rir"] for s in r.json()["series"]], [3, 1])
        relu = self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json()
        self.assertEqual([s["rir"] for s in relu[0]["series"]], [3, 1])

    def test_le_rir_est_facultatif(self):
        h, jid = self._inscrire("Rir2")
        r = self._logger(h, jid, [self._serie(1), self._serie(2, 2)])
        self.assertEqual(r.status_code, 201, r.text)
        relu = self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json()
        self.assertEqual([s["rir"] for s in relu[0]["series"]], [None, 2])

    def test_zero_est_une_vraie_valeur(self):
        """RIR 0 = jusqu'à l'échec : il ne doit JAMAIS devenir « pas noté »."""
        h, jid = self._inscrire("Rir3")
        self._logger(h, jid, [self._serie(1, 0)])
        relu = self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json()
        self.assertEqual(relu[0]["series"][0]["rir"], 0)

    def test_un_rir_absurde_est_refuse(self):
        h, jid = self._inscrire("Rir4")
        for rir in (-1, 11):
            r = self._logger(h, jid, [self._serie(1, rir)])
            self.assertEqual(r.status_code, 422, f"RIR {rir} accepté")


if __name__ == "__main__":
    unittest.main()
