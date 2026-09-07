"""Le repérage des séances MANQUÉES, vérifié sur des dates choisies.

Demande de Hafiz du 07/09/2026 : « si en cours de semaine on rate un jour, il
peut être rattrapé ».

POURQUOI CE TEST EXISTE : cette section de l'écran ne s'affiche QUE les jours
où l'on a réellement raté une séance. On ne peut donc pas la vérifier en
regardant l'app — un lundi, par exemple, aucun jour de la semaine n'est encore
passé et elle est forcément vide. Le calcul a donc été sorti de l'écran
(`src/logic/rattrapage.js`) pour pouvoir lui donner des dates arbitraires.

Comme pour la parité front/back et la robustesse (voir CLAUDE.md), les cas
vivent dans UN SEUL fichier de données (`harnais/cas_rattrapage.json`) et le
harnais Node exécute le VRAI code de l'app — pas une reformulation en Python
qui pourrait dire autre chose que ce que l'utilisateur voit.

Le test s'ignore si Node est absent : la suite backend doit rester lançable
sans l'outillage de l'app.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"


class TestRattrapage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_rattrapage.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais de rattrapage n'a pas pu tourner :\n" + (sortie.stderr or "")
            )
        cls.resultats = json.loads(sortie.stdout)

    def test_tous_les_cas_de_rattrapage(self):
        self.assertGreater(len(self.resultats), 0, "aucun cas n'a été exécuté")
        for resultat in self.resultats:
            with self.subTest(cas=resultat["nom"]):
                self.assertNotIn(
                    "erreur", resultat,
                    f"le calcul a planté : {resultat.get('erreur')}"
                )
                self.assertEqual(
                    resultat["obtenu"], resultat["attendu"],
                    f"cas « {resultat['nom']} »"
                )


if __name__ == "__main__":
    unittest.main()
