"""Les axes de surcharge progressive (src/logic/surchargeProgressive.js).

Demande de Hafiz du 24/09/2026 : « les perfs attendues à la prochaine séance
devront être cohérentes avec le type de progressive overload qu'on a choisi
pour les exercices : les séries, les reps ou le poids. On peut choisir un ou un
mélange des 3. »

La règle : UN SEUL axe avance à la fois, dans l'ordre séries → reps → poids,
et seuls les axes cochés bougent. La double progression d'origine (reps puis
poids) en est le cas par défaut — un exercice sans réglage ne change donc pas
de comportement.

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


class TestProgression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_progression.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais de progression n'a pas pu tourner :\n" + (sortie.stderr or "")
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
