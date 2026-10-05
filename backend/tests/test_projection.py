"""Le tableau de progression semaine par semaine (src/logic/projectionProgramme.js).

Demande de Hafiz du 04/10/2026, image à l'appui (`icones/IMG_1703.PNG`) :
« je veux qu'on puisse visualiser les programmes de cette façon » — une grille
avec une ligne par exercice (groupée par jour) et une colonne par semaine.

LA RÈGLE N'EST PAS RÉÉCRITE : la projection rejoue `suggererProchaineSerie`
semaine après semaine, en lui donnant la semaine projetée comme si elle avait
été faite. Le premier cas du harnais verrouille ça noir sur blanc — la
semaine 1 du tableau doit dire EXACTEMENT ce qu'affiche « 🎯 Attendu » dans
l'écran de séance. Sans ça, le tableau annoncerait une charge et la séance en
réclamerait une autre.

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


class TestProjection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_projection.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais de projection n'a pas pu tourner :\n" + (sortie.stderr or "")
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
