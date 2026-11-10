"""La durée RÉELLE d'une séance — 10/11/2026.

Demande de Hafiz : « au niveau de l'historique on peut ajouter la durée de la
séance, et au niveau des stats la durée moyenne des séances ».

L'app mesure la durée avec son chrono (début de séance → dernière série notée,
voir src/logic/seanceLibre.js) et l'envoie avec l'entraînement. Le serveur :
  - la RANGE avec la séance (colonne `duree_minutes`), pour l'historique ;
  - la PRÉFÈRE à l'estimation (≈3 min par série) pour la séance du jour, qui
    alimente le compteur du Profil et le défi du jour ;
  - garde l'estimation quand l'app n'envoie rien (séance d'avant le chrono,
    ou durée impossible à mesurer honnêtement).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from app import seances as regles_seances
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_duree_seance_fitness_royale.db"


class TestDureeSeance(unittest.TestCase):
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

    def _logger(self, h, jid, jour, nb_series, duree=None, cle=None):
        corps = {
            "programme_id": None, "date": jour,
            "series": [{"exercice": "Squat", "numero_serie": n + 1, "reps": 8, "poids": 100}
                       for n in range(nb_series)],
        }
        if duree is not None:
            corps["duree_minutes"] = duree
        if cle is not None:
            corps["cle_locale"] = cle
        return self.client.post(f"/joueurs/{jid}/entrainements", json=corps, headers=h)

    def test_la_duree_est_rangee_avec_la_seance(self):
        h, jid = self._inscrire("Duree1")
        r = self._logger(h, jid, "2026-11-10", 6, duree=47)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["duree_minutes"], 47)
        liste = self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json()
        self.assertEqual(liste[0]["duree_minutes"], 47)

    def test_sans_duree_la_seance_n_en_invente_pas(self):
        h, jid = self._inscrire("Duree2")
        self._logger(h, jid, "2026-11-10", 6)
        liste = self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json()
        self.assertIsNone(liste[0]["duree_minutes"])

    def test_la_duree_mesuree_prime_pour_la_seance_du_jour(self):
        """6 séries s'estimeraient à 20 min ; la séance a duré 47 min."""
        h, jid = self._inscrire("Duree3")
        self._logger(h, jid, "2026-11-10", 6, duree=47)
        seances = self.client.get(f"/joueurs/{jid}/seances", headers=h).json()
        self.assertEqual(seances[0]["minutes"], 47)

    def test_sans_duree_la_seance_du_jour_garde_l_estimation(self):
        h, jid = self._inscrire("Duree4")
        self._logger(h, jid, "2026-11-10", 12)
        seances = self.client.get(f"/joueurs/{jid}/seances", headers=h).json()
        self.assertEqual(seances[0]["minutes"], regles_seances.duree_estimee(12))

    def test_deux_seances_le_meme_jour_additionnent_leurs_vraies_durees(self):
        h, jid = self._inscrire("Duree5")
        self._logger(h, jid, "2026-11-10", 4, duree=25)
        self._logger(h, jid, "2026-11-10", 4, duree=35)
        seances = self.client.get(f"/joueurs/{jid}/seances", headers=h).json()
        self.assertEqual(len(seances), 1)
        self.assertEqual(seances[0]["minutes"], 60)

    def test_une_duree_absurde_est_refusee(self):
        h, jid = self._inscrire("Duree6")
        for duree in (0, -5, 301):
            r = self._logger(h, jid, "2026-11-10", 3, duree=duree)
            self.assertEqual(r.status_code, 422, f"durée {duree} acceptée")

    def test_un_renvoi_ne_double_pas_les_minutes(self):
        """Une séance renvoyée (réponse perdue) est reconnue par sa clé : ses
        minutes ne sont pas ajoutées une deuxième fois."""
        h, jid = self._inscrire("Duree7")
        self._logger(h, jid, "2026-11-10", 4, duree=40, cle="local-1")
        self._logger(h, jid, "2026-11-10", 4, duree=40, cle="local-1")
        seances = self.client.get(f"/joueurs/{jid}/seances", headers=h).json()
        self.assertEqual(seances[0]["minutes"], 40)


if __name__ == "__main__":
    unittest.main()
