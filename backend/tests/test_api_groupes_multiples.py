"""Un exercice dans plusieurs groupes musculaires, côté serveur (15/11/2026).

Le groupe PRINCIPAL reste dans `groupe` (un ancien APK ne lit que lui) ; les
groupes EN PLUS vivent dans `groupes_en_plus`. Un ancien APK qui ne les envoie
pas ne doit jamais les effacer.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_groupes_multiples_fitness_royale.db"


class TestGroupesMultiplesAPI(unittest.TestCase):
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

    def _inscrire(self, pseudo):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": "homme", "poids": 78,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _poser(self, jid, h, exercice, corps):
        return self.client.put(f"/joueurs/{jid}/groupes-exercices/{exercice}", json=corps, headers=h)

    def _lire(self, jid, h):
        return {g["exercice"]: g for g in
                self.client.get(f"/joueurs/{jid}/groupes-exercices", headers=h).json()}

    def test_principal_et_groupes_en_plus_relus(self):
        h, jid = self._inscrire("GrpPlus")
        r = self._poser(jid, h, "dev couche", {"groupe": "Pectoraux", "groupes_en_plus": ["Triceps", "Épaules"]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["groupes_en_plus"], ["Triceps", "Épaules"])
        g = self._lire(jid, h)["dev couche"]
        self.assertEqual((g["groupe"], g["groupes_en_plus"]), ("Pectoraux", ["Triceps", "Épaules"]))
        # Et dans le lot de l'écran Entraînement.
        lot = self.client.get(f"/joueurs/{jid}/donnees-entrainement", headers=h).json()
        self.assertEqual(lot["groupes_exercices"][0]["groupes_en_plus"], ["Triceps", "Épaules"])

    def test_un_ancien_apk_ne_les_efface_pas(self):
        # Un ancien APK n'envoie que `groupe` : les groupes en plus restent.
        h, jid = self._inscrire("GrpAncien")
        self._poser(jid, h, "dips", {"groupe": "Triceps", "groupes_en_plus": ["Pectoraux"]})
        self._poser(jid, h, "dips", {"groupe": "Triceps"})
        self.assertEqual(self._lire(jid, h)["dips"]["groupes_en_plus"], ["Pectoraux"])

    def test_le_principal_sort_des_groupes_en_plus(self):
        h, jid = self._inscrire("GrpPrincipal")
        self._poser(jid, h, "dips", {"groupe": "Triceps", "groupes_en_plus": ["Pectoraux"]})
        self._poser(jid, h, "dips", {"groupe": "Pectoraux"})
        g = self._lire(jid, h)["dips"]
        self.assertEqual((g["groupe"], g["groupes_en_plus"]), ("Pectoraux", []))

    def test_liste_vide_efface_les_groupes_en_plus(self):
        h, jid = self._inscrire("GrpVide")
        self._poser(jid, h, "dips", {"groupe": "Triceps", "groupes_en_plus": ["Pectoraux"]})
        self._poser(jid, h, "dips", {"groupe": "Triceps", "groupes_en_plus": []})
        self.assertEqual(self._lire(jid, h)["dips"]["groupes_en_plus"], [])

    def test_sans_groupe_en_plus_rien_ne_change(self):
        h, jid = self._inscrire("GrpSimple")
        self._poser(jid, h, "curl", {"groupe": "Biceps"})
        self.assertEqual(self._lire(jid, h)["curl"]["groupes_en_plus"], [])

    def test_groupe_inconnu_refuse(self):
        h, jid = self._inscrire("GrpInconnu")
        r = self._poser(jid, h, "dips", {"groupe": "Triceps", "groupes_en_plus": ["Pas un groupe"]})
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("dips", self._lire(jid, h))

    def test_proprietaire_seulement(self):
        h, jid = self._inscrire("GrpProprio")
        h2, _ = self._inscrire("GrpIntrus")
        r = self._poser(jid, h2, "dips", {"groupe": "Triceps", "groupes_en_plus": ["Dos"]})
        self.assertEqual(r.status_code, 403)

    def test_renommer_l_exercice_garde_ses_groupes_en_plus(self):
        h, jid = self._inscrire("GrpRenomme")
        self._poser(jid, h, "dev couche", {"groupe": "Pectoraux", "groupes_en_plus": ["Triceps"]})
        self.client.put(f"/joueurs/{jid}/exercices/dev couche/nom", json={"nouveau": "Développé couché"}, headers=h)
        self.assertEqual(self._lire(jid, h)["Développé couché"]["groupes_en_plus"], ["Triceps"])

if __name__ == "__main__":
    unittest.main()
