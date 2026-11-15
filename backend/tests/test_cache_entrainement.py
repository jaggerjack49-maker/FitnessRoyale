"""L'écran Entraînement s'affiche sans attendre le réseau (15/11/2026).

La dernière réponse du serveur est gardée sur le téléphone (`src/cacheEntrainement.js`)
et affichée tout de suite à l'ouverture de l'onglet. Ce test vérifie son contrat :
relue à l'identique, jamais d'un compte à l'autre, jamais à moitié abîmée.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"


class TestCacheEntrainement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_cache_entrainement.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais de stockage n'a pas pu tourner :\n" + (sortie.stderr or "")
            )
        cls.resultats = json.loads(sortie.stdout)

    def test_le_contrat_de_sauvegarde_locale_est_tenu(self):
        self.assertGreater(len(self.resultats), 0, "aucun cas n'a été exécuté")
        for resultat in self.resultats:
            with self.subTest(cas=resultat["nom"]):
                self.assertTrue(
                    resultat["ok"],
                    f"« {resultat['nom']} » : {resultat.get('erreur')}"
                )


if __name__ == "__main__":
    unittest.main()
