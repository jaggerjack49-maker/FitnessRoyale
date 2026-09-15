"""Le compteur de pompes du duel en ligne, vérifié sur des mouvements simulés.

Demande de Hafiz du 15/09/2026 : un duel de pompes en ligne où la caméra compte
les pompes de chacun. Étape 1 : un PROTOTYPE du compteur, à essayer sur un vrai
téléphone avant de construire le duel autour.

POURQUOI CE TEST EXISTE : la vraie détection demande une caméra et quelqu'un qui
fait des pompes — impossible à rejouer ici. La RÈGLE de comptage, elle, a été
sortie dans `src/logic/compteurPompes.js` : le harnais Node lui donne des suites
d'angles de coudes fabriquées (une pompe propre, une image mal détectée, un
angle qui tremble…) et vérifie ce qu'elle compte.

Comme les autres harnais (voir CLAUDE.md), il exécute le VRAI code de l'app, et
le test s'ignore si Node est absent.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"


class TestCompteurPompes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_compteur_pompes.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais du compteur de pompes n'a pas pu tourner :\n" + (sortie.stderr or "")
            )
        cls.resultats = json.loads(sortie.stdout)

    def test_tous_les_cas_du_compteur(self):
        self.assertGreater(len(self.resultats), 0, "aucun cas n'a été exécuté")
        for resultat in self.resultats:
            with self.subTest(cas=resultat["nom"]):
                self.assertNotIn(
                    "erreur", resultat,
                    f"le compteur a planté : {resultat.get('erreur')}"
                )
                self.assertEqual(
                    resultat["obtenu"], resultat["attendu"],
                    f"cas « {resultat['nom']} »"
                )


if __name__ == "__main__":
    unittest.main()
