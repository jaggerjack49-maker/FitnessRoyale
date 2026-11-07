"""La bibliothèque d'exercices (passe 3 de la refonte Entraînement).

Deux vérifications très différentes vivent ici :

1. LE HARNAIS NODE (`harnais/harnais_bibliotheque.mjs`) exécute le VRAI code de
   l'app sur les 96 fiches : groupes et matériels connus, noms uniques,
   recherche, et surtout l'ACCORD entre chaque fiche et la détection par
   mots-clés. Ce dernier point est le plus utile du lot : un désaccord ne casse
   rien tout de suite (la fiche gagne à l'exécution), il pose une mine — le
   jour où le même exercice est tapé à la main au lieu d'être choisi dans la
   liste, ses séries partent dans un AUTRE groupe que celles d'avant. Deux
   historiques pour un seul mouvement, sans un mot à l'écran. C'est la famille
   de bug du 03/09/2026 (« unilatéral raises » comptées dans le Dos).

2. LES CLÉS DE MATÉRIEL doivent exister dans le répertoire d'icônes. Celui-ci
   vit dans un composant React (`src/components/Icones.js`), que Node ne peut
   pas importer : on le compare donc par LECTURE DE FICHIER, comme le fait déjà
   `test_listes_partagees.py` pour les listes recopiées entre le front et le
   back. Un matériel sans icône afficherait un point d'interrogation.
"""

import json
import re
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

RACINE = Path(__file__).parent.parent.parent
HARNAIS = Path(__file__).parent / "harnais"


class TestBibliothequeFront(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        sortie = subprocess.run(
            ["node", "--import", "./resolveur.mjs", "harnais_bibliotheque.mjs"],
            cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
        )
        if sortie.returncode != 0:
            raise AssertionError(
                "Le harnais de la bibliothèque n'a pas pu tourner :\n" + (sortie.stderr or "")
            )
        cls.echecs = json.loads(sortie.stdout)

    def test_la_bibliotheque_est_coherente(self):
        if self.echecs:
            details = "\n".join(f"  - {e['nom']} : {e['detail']}" for e in self.echecs)
            self.fail(f"{len(self.echecs)} vérification(s) en échec :\n" + details)


class TestMaterielsEtIcones(unittest.TestCase):
    """Les clés de `MATERIELS` et le répertoire `NOMS_ICONES` doivent s'accorder."""

    @classmethod
    def setUpClass(cls):
        cls.biblio = (RACINE / "src" / "data" / "bibliothequeExercices.js").read_text(
            encoding="utf-8"
        )
        cls.icones = (RACINE / "src" / "components" / "Icones.js").read_text(
            encoding="utf-8"
        )

    def noms_icones_du_materiel(self):
        """Les valeurs `icone: 'mat-…'` déclarées dans MATERIELS."""
        bloc = self.biblio.split("export const MATERIELS")[1].split("};")[0]
        return re.findall(r"icone:\s*'([^']+)'", bloc)

    def test_chaque_materiel_a_son_icone_dans_le_repertoire(self):
        trouves = self.noms_icones_du_materiel()
        self.assertGreaterEqual(len(trouves), 5, "MATERIELS n'a pas été lu correctement")
        repertoire = self.icones.split("export const NOMS_ICONES")[1].split("};")[0]
        for nom in trouves:
            self.assertIn(
                f"'{nom}'", repertoire,
                f"Le matériel déclare l'icône « {nom} », absente de NOMS_ICONES "
                "(src/components/Icones.js) : la ligne afficherait un point "
                "d'interrogation.",
            )

    def test_chaque_icone_de_materiel_est_vraiment_dessinee(self):
        """Une entrée du répertoire ne suffit pas : il faut le composant."""
        for nom in self.noms_icones_du_materiel():
            # 'mat-halteres' -> 'IconeMaterielHalteres'
            morceaux = nom.replace("mat-", "materiel-").split("-")
            attendu = "Icone" + "".join(m.capitalize() for m in morceaux)
            self.assertIn(
                f"export function {attendu}(", self.icones,
                f"L'icône « {nom} » est au répertoire mais la fonction "
                f"{attendu} n'existe pas.",
            )

    def test_la_recherche_de_la_bibliotheque_ne_depend_pas_de_react(self):
        """La bibliothèque doit rester testable par Node.

        Si elle importait un composant, `react-native` entrerait dans la chaîne
        d'imports et le harnais ci-dessus ne pourrait plus tourner du tout —
        on perdrait la vérification des 96 fiches sans que rien ne le dise.
        """
        for interdit in ("react", "react-native", "./Icones", "../components"):
            self.assertNotIn(
                f"from '{interdit}'", self.biblio,
                f"bibliothequeExercices.js ne doit pas importer « {interdit} ».",
            )


if __name__ == "__main__":
    unittest.main()
