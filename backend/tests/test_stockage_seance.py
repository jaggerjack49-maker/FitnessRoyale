"""La séance en cours doit survivre à la fermeture de l'app — et à rien d'autre.

Demandes de Hafiz du 07/09/2026 : « les performances des entraînements doivent
être enregistrées même si on recommence le programme à zéro » et « on doit
pouvoir rattraper une séance en cours même si on est déconnecté du serveur ;
si on se reconnecte, on est lancé directement sur la séance ».

CE QUI SE PERDAIT AVANT :
  - la séance en cours vivait dans l'état React de `EntrainementScreen`, or
    App.js DÉMONTE cet écran à chaque changement d'onglet : toucher « Profil »
    au milieu d'une séance effaçait toutes les séries saisies ;
  - une séance terminée hors-ligne n'existait que dans cet état, et
    `chargerTout()` remplaçait ensuite toute la liste par celle du serveur —
    qui ne l'avait jamais reçue. Elle disparaissait donc au moment précis où
    l'on se reconnectait.

POURQUOI CE TEST PLUTÔT QU'UN ESSAI À L'ÉCRAN : ce qu'on veut prouver est le
comportement APRÈS une fermeture de l'app, et l'ABSENCE de fuite d'un compte à
l'autre — deux choses qu'on ne voit pas en regardant l'écran. Le harnais Node
exécute le vrai `src/stockageSeance.js` avec un AsyncStorage en mémoire.

S'ignore si Node est absent : la suite backend doit rester lançable sans
l'outillage de l'app.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"


class TestStockageSeance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_stockage_seance.mjs"],
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
