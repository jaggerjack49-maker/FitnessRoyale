"""Les deux « santés » du serveur, et ce qu'elles prouvent chacune.

Bug de Hafiz du 23/09/2026 (« je n'ai plus mes séances ni mon programme, sur
l'APK ET sur le site web ») : l'app vérifiait la connexion avec `/sante`, qui
renvoie une CONSTANTE — il prouvait donc que le serveur web était debout, mais
rien du tout sur la base. Or l'offre gratuite de Neon SUSPEND la base après
quelques minutes sans requête. L'app croyait la voie libre, enchaînait sur le
premier appel qui touche la base avec son délai court (12 s), celui-ci
expirait, et l'écran se retrouvait vide comme si tout avait été effacé.

`/sante-base` fait une VRAIE requête. Ces tests verrouillent la différence :
si un jour il redevenait une constante, le premier test le dirait.
"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_sante_fitness_royale.db"


class TestSante(unittest.TestCase):
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

    def test_sante_repond_sans_toucher_la_base(self):
        reponse = self.client.get("/sante")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json(), {"statut": "ok"})

    def test_sante_base_repond_quand_tout_va_bien(self):
        reponse = self.client.get("/sante-base")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json(), {"statut": "ok"})

    def test_sante_base_interroge_VRAIMENT_la_base(self):
        """Le cœur du correctif : si la base ne répond pas, /sante-base doit le
        DIRE (503), là où /sante continue de répondre « ok » — c'est toute la
        différence entre « le serveur est debout » et « tout est prêt »."""
        with mock.patch.object(db, "base_repond", side_effect=OSError("base endormie")):
            echec = self.client.get("/sante-base")
            quand_meme = self.client.get("/sante")
        self.assertEqual(echec.status_code, 503)
        self.assertIn("base de données", echec.json()["detail"])
        self.assertEqual(quand_meme.status_code, 200)

    def test_base_repond_fait_une_vraie_requete(self):
        """La fonction elle-même, sans passer par HTTP."""
        self.assertTrue(db.base_repond())


if __name__ == "__main__":
    unittest.main()
