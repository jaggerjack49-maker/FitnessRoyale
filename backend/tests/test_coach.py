"""Le COACH de progression (16/11/2026, « le 3 » des grands chantiers).

Trois règles, toutes côté app :
  - le RIR noté à chaque série pilote la montée de charge (RIR trop bas par
    rapport à l'effort visé → on refait la charge ; grande réserve → deux crans) ;
  - un exercice bloqué (3 séances à la même charge sans une rep gagnée, et la
    règle ne chargerait pas) propose une DÉCHARGE de 10 % ;
  - le BILAN d'un bloc (progrès / stable / recul au 1RM estimé, départ du bloc
    suivant).
Et une promesse : la séance, les « Attendu » et le tableau lisent les objectifs
d'un exercice de la MÊME façon (`suggestionPourExercice`).

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


class TestCoach(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_coach.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais du coach n'a pas pu tourner :\n" + (sortie.stderr or "")
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
