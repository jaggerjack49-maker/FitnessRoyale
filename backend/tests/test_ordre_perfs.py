"""L'ordre de la liste « Enregistrées » de l'onglet Perfs (15/11/2026).

La perf qu'on vient d'enregistrer « disparaissait » : le serveur en ligne la
renvoyait en dernier et elle glissait en bas de la liste. L'écran trie
désormais lui-même : la dernière perf en tête, puis l'ordre du barème.

Les règles vivent dans `src/logic/classement.js (ordrePerfs)` ; le harnais Node exécute le
VRAI code de l'app. Le test s'ignore si Node est absent.
"""

import json
import shutil
import subprocess
import unittest
from pathlib import Path

HARNAIS = Path(__file__).parent / "harnais"


class TestOrdrePerfs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest("Node n'est pas installé : impossible d'exécuter le code de l'app.")
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_ordre_perfs.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError("Le harnais n'a pas pu tourner :\n" + (sortie.stderr or ""))
        cls.resultats = json.loads(sortie.stdout)

    def test_tous_les_cas(self):
        self.assertGreater(len(self.resultats), 0, "aucun cas n'a été exécuté")
        for resultat in self.resultats:
            with self.subTest(cas=resultat["nom"]):
                self.assertNotIn("erreur", resultat, f"le calcul a planté : {resultat.get('erreur')}")
                self.assertEqual(resultat["obtenu"], resultat["attendu"], f"cas « {resultat['nom']} »")


if __name__ == "__main__":
    unittest.main()
