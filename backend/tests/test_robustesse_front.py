"""La logique de l'app ne doit JAMAIS planter sur une donnée incomplète.

Trouvé par l'audit du 06/09/2026, en passant des entrées dégradées dans les
fonctions de `src/logic/` et `src/data/`. Huit familles de plantage sont
sorties, toutes du même genre : `entrainement.series.forEach(...)` sur une
séance sans `series`, `joueur.performances[...]` sur un joueur sans
performances, `.toLowerCase()` sur autre chose qu'une chaîne.

POURQUOI C'EST GRAVE malgré l'absence de bug visible aujourd'hui : ces
fonctions sont au pied de TOUT l'affichage. `perfsVerifiees` alimente la
ligue, l'arène, le classement et les titres ; `suggererProchaineSerie` et
`recordPersonnel` tournent pendant la séance. Une exception y déclenche
l'Error Boundary (`src/components/LimiteErreur.js`), c'est-à-dire un écran
d'erreur à la place de l'app — au moment précis où l'on s'entraîne.
Ces aides sont du CONFORT : elles doivent se taire sur une donnée bancale.

Le harnais (`harnais/harnais_robustesse.mjs`) exécute le VRAI code de l'app
avec Node et rapporte tout ce qui lève une exception. Ce test échoue dès
qu'une seule reparaît. Il s'ignore si Node est absent.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"


class TestRobustesseFront(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_robustesse.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais de robustesse n'a pas pu tourner :\n" + (sortie.stderr or "")
            )
        cls.plantages = json.loads(sortie.stdout)

    def test_aucune_fonction_ne_plante_sur_une_donnee_incomplete(self):
        if self.plantages:
            details = "\n".join(f"  - {p['nom']} : {p['erreur']}" for p in self.plantages)
            self.fail(
                f"{len(self.plantages)} fonction(s) plantent sur une entrée dégradée.\n"
                "Une exception ici affiche l'Error Boundary à la place de l'app :\n"
                + details
            )


if __name__ == "__main__":
    unittest.main()
