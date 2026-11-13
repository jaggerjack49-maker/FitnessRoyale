"""Le poids de corps se modifie (13/11/2026).

Avant, il était fixé à l'inscription pour toujours : un joueur passé de 78 à
82 kg restait classé en -80 kg. `PUT /joueurs/{id}/poids` le change, et la
catégorie de poids du classement suit.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_poids_fitness_royale.db"


class TestPoidsModifiable(unittest.TestCase):
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

    def _inscrire(self, pseudo, poids=78):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": "homme", "poids": poids,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]

    def _changer(self, joueur_id, poids, headers):
        return self.client.put(f"/joueurs/{joueur_id}/poids",
                               json={"poids": poids}, headers=headers)

    def test_le_poids_change_et_se_relit(self):
        h, j = self._inscrire("PoidsChange")
        r = self._changer(j["id"], 82.5, h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["poids"], 82.5)
        # Relu par /auth/moi, comme le fait l'app à chaque rafraîchissement.
        self.assertEqual(self.client.get("/auth/moi", headers=h).json()["poids"], 82.5)

    def test_la_categorie_du_classement_suit(self):
        h, j = self._inscrire("PoidsCategorie", poids=78)

        def categorie_de(pseudo):
            for groupe in self.client.get("/classement/poids").json():
                if any(x["pseudo"] == pseudo for x in groupe["joueurs"]):
                    return groupe["categorie"]
            return None

        self.assertEqual(categorie_de("PoidsCategorie"), "-80 kg")
        self._changer(j["id"], 82, h)
        self.assertEqual(categorie_de("PoidsCategorie"), "-90 kg")

    def test_arrondi_au_dixieme(self):
        h, j = self._inscrire("PoidsArrondi")
        self.assertEqual(self._changer(j["id"], 80.04, h).json()["poids"], 80.0)

    def test_valeurs_absurdes_refusees(self):
        """Mêmes bornes qu'à l'inscription : strictement entre 30 et 300 kg."""
        h, j = self._inscrire("PoidsAbsurde")
        for valeur in (0, 30, -5, 300, 1000, "lourd"):
            self.assertEqual(self._changer(j["id"], valeur, h).status_code, 422, valeur)
        self.assertEqual(self.client.get("/auth/moi", headers=h).json()["poids"], 78)

    def test_on_ne_change_pas_le_poids_d_un_autre(self):
        h_moi, _ = self._inscrire("PoidsMoi")
        _, autre = self._inscrire("PoidsAutre", poids=70)
        self.assertEqual(self._changer(autre["id"], 120, h_moi).status_code, 403)
        self.assertEqual(db.lire_joueur(autre["id"])["poids"], 70)

    def test_sans_connexion_refuse(self):
        _, j = self._inscrire("PoidsAnonyme")
        self.assertEqual(self.client.put(f"/joueurs/{j['id']}/poids",
                                         json={"poids": 90}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
