"""Deux pseudos ne doivent pas pouvoir se ressembler au point d'être confondus.

Trouvé par l'audit du 06/09/2026. La comparaison à l'inscription était EXACTE :
« Champion », « champion », « CHAMPION », « Champion » (espace final) et
« Champion » (espaces autour) donnaient CINQ comptes distincts — et le
classement affichait cinq lignes visuellement identiques.

C'est la TROISIÈME occurrence du même motif dans ce projet, après le nom
d'exercice (04/09) et la salle de gym (04/09) : une saisie libre qui sert
d'identifiant, comparée telle quelle.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_pseudo_unique_fitness_royale.db"


class TestPseudoUnique(unittest.TestCase):
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
        return self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": "homme", "poids": 80,
        })

    def test_les_variantes_de_casse_et_d_espaces_sont_refusees(self):
        self.assertEqual(self._inscrire("Champion").status_code, 201)
        for variante in ("champion", "CHAMPION", "ChAmPiOn",
                         " Champion ", "Champion ", "  Champion"):
            with self.subTest(variante=repr(variante)):
                r = self._inscrire(variante)
                self.assertEqual(r.status_code, 409, r.text)

    def test_le_pseudo_est_nettoye_avant_d_etre_enregistre(self):
        r = self._inscrire("  Espacé  ")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["joueur"]["pseudo"], "Espacé")

    def test_les_espaces_internes_multiples_sont_reduits(self):
        r = self._inscrire("Deux   Mots")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["joueur"]["pseudo"], "Deux Mots")

    def test_un_pseudo_fait_uniquement_d_espaces_est_refuse(self):
        """Avant l'audit, « '  ' » créait un compte au pseudo invisible."""
        r = self._inscrire("    ")
        self.assertEqual(r.status_code, 400)

    def test_des_pseudos_vraiment_differents_restent_acceptes(self):
        """Contre-épreuve : on n'a pas rendu l'inscription impossible."""
        for pseudo in ("Alpha", "Beta", "Champion2", "Le Champion"):
            with self.subTest(pseudo=pseudo):
                self.assertEqual(self._inscrire(pseudo).status_code, 201)

    def test_les_accents_distinguent_toujours_deux_pseudos(self):
        """Même choix que pour la salle de gym : on normalise la casse et les
        espaces, PAS les accents — « Rene » et « René » sont deux personnes."""
        self.assertEqual(self._inscrire("Rene").status_code, 201)
        self.assertEqual(self._inscrire("René").status_code, 201)

    def test_le_classement_n_affiche_plus_de_lignes_identiques(self):
        """Le symptôme visible qui a motivé le correctif."""
        self._inscrire("Unique")
        for variante in ("unique", "UNIQUE", " Unique "):
            self._inscrire(variante)
        joueurs = self.client.get("/joueurs").json()
        semblables = [j["pseudo"] for j in joueurs
                      if j["pseudo"].strip().lower() == "unique"]
        self.assertEqual(semblables, ["Unique"])

    def test_la_connexion_marche_toujours_avec_le_pseudo_nettoye(self):
        self._inscrire("Connexion Test")
        r = self.client.post("/auth/connexion", json={
            "pseudo": "Connexion Test", "mot_de_passe": "motdepasse123"})
        self.assertEqual(r.status_code, 200)


if __name__ == "__main__":
    unittest.main()
