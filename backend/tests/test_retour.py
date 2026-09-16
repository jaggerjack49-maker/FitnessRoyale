"""La règle du geste « retour » d'Android, vérifiée sur des instants choisis.

Signalé par Hafiz le 16/09/2026 : « quand on glisse retour arrière sur l'écran,
il sort de l'app complètement ». La règle retenue (hors sous-vue) vit dans
`src/logic/retour.js` : hors Profil on revient au Profil ; sur le Profil, un
premier retour avertit et seul un second, dans les 2 secondes, quitte.

POURQUOI CE TEST EXISTE : le geste retour n'existe pas dans le navigateur où
l'app est vérifiée. Comme les autres harnais (voir CLAUDE.md), on exécute le
VRAI code de l'app avec Node ; le test s'ignore si Node est absent.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"


class TestRetour(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_retour.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais du retour n'a pas pu tourner :\n" + (sortie.stderr or "")
            )
        cls.resultats = json.loads(sortie.stdout)

    def test_tous_les_cas_du_retour(self):
        self.assertGreater(len(self.resultats), 0, "aucun cas n'a été exécuté")
        for resultat in self.resultats:
            with self.subTest(cas=resultat["nom"]):
                self.assertNotIn(
                    "erreur", resultat,
                    f"la règle a planté : {resultat.get('erreur')}"
                )
                self.assertEqual(
                    resultat["obtenu"], resultat["attendu"],
                    f"cas « {resultat['nom']} »"
                )


if __name__ == "__main__":
    unittest.main()
