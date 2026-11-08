"""L'écran « Progrès » : statistiques et courbes (08/11/2026).

Demande de Hafiz : « au niveau de historique et records on devrait renommer ça
en progrès, il va regrouper les statistiques avec aussi la possibilité de voir
les performances sous forme de graphique ».

Les calculs vivent dans src/logic/progres.js ; le harnais Node exécute le VRAI
code de l'app. Le test s'ignore si Node est absent.
"""

import json
import shutil
import subprocess
import unittest
from pathlib import Path

HARNAIS = Path(__file__).parent / "harnais"


class TestProgres(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest("Node n'est pas installÃ© : impossible d'exÃ©cuter le code de l'app.")
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_progres.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError("Le harnais n'a pas pu tourner :\n" + (sortie.stderr or ""))
        cls.resultats = json.loads(sortie.stdout)

    def test_tous_les_cas(self):
        self.assertGreater(len(self.resultats), 0, "aucun cas n'a Ã©tÃ© exÃ©cutÃ©")
        for resultat in self.resultats:
            with self.subTest(cas=resultat["nom"]):
                self.assertNotIn("erreur", resultat, f"le calcul a plantÃ© : {resultat.get('erreur')}")
                self.assertEqual(resultat["obtenu"], resultat["attendu"], f"cas Â« {resultat['nom']} Â»")


if __name__ == "__main__":
    unittest.main()
