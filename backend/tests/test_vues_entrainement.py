"""Le découpage de l'onglet Entraînement reste sain (13/11/2026).

EntrainementScreen.js faisait 5 600 lignes. Ses dix vues (séance, programmes,
suivi, progrès…) vivent maintenant dans src/screens/entrainement/, et l'écran
principal les appelle comme de simples fonctions en leur passant un paquet
(`vueSeance(ctx)`). Trois erreurs ne se verraient qu'au moment où l'écran
concerné s'affiche — l'écran d'erreur à la place de la séance :
- un hook (useState…) ajouté dans une vue, appelée sous condition ;
- une vue qui lit un nom absent de son paquet ;
- un nom déclaré nulle part après un déplacement de code.

Vu ÉCHOUER sur chacune : un `useState` ajouté dans vueSeance.js, un nom retiré
du paquet `ctxAccueil`, et un import supprimé dans vueProgres.js.
"""

import shutil
import subprocess
import unittest
from pathlib import Path

RACINE = Path(__file__).parent.parent.parent
VERIFICATEUR = Path(__file__).parent / "harnais" / "verifier_vues_entrainement.cjs"


class TestVuesEntrainement(unittest.TestCase):
    @unittest.skipIf(shutil.which("node") is None, "Node absent : pas d'analyse des écrans")
    def test_le_decoupage_est_coherent(self):
        sortie = subprocess.run(
            ["node", str(VERIFICATEUR), str(RACINE)],
            capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
        problemes = [l for l in sortie.splitlines() if not l.startswith("TOTAL")]
        self.assertTrue(sortie.strip().endswith("TOTAL 0"), "\n".join(problemes))


if __name__ == "__main__":
    unittest.main()
