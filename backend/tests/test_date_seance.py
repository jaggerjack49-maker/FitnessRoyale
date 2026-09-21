"""À quel jour appartient une séance ? (src/logic/dateSeance.js)

Bug de Hafiz du 21/09/2026 : une séance faite lundi mais enregistrée mardi
était datée de mardi. La règle — une séance appartient au jour où l'on a fait
le plus de séries, à égalité le plus ancien — est vérifiée ici sur des dates
CHOISIES, ce qu'on ne peut pas faire depuis l'écran sans mentir à l'horloge.

Le test s'ignore si Node est absent (voir les autres harnais, CLAUDE.md).
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"


class TestDateSeance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_date_seance.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais de datation n'a pas pu tourner :\n" + (sortie.stderr or "")
            )
        cls.resultats = json.loads(sortie.stdout)

    def test_tous_les_cas(self):
        self.assertGreater(len(self.resultats), 0, "aucun cas n'a été exécuté")
        for resultat in self.resultats:
            with self.subTest(cas=resultat["nom"]):
                self.assertNotIn("erreur", resultat, f"plantage : {resultat.get('erreur')}")
                self.assertEqual(
                    resultat["obtenu"], resultat["attendu"], f"cas « {resultat['nom']} »"
                )


if __name__ == "__main__":
    unittest.main()
