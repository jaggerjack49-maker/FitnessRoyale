"""Les listes RECOPIÉES entre l'app et le serveur doivent rester identiques.

Point 3 de l'audit du 03/09/2026. Deux listes existent en double :
 - les GROUPES MUSCULAIRES : `GROUPES_MUSCULAIRES` (main.py) et
   `groupesMusculaires` (src/data/groupesMusculaires.js) ;
 - les JOURS DE LA SEMAINE : `JOURS_SEMAINE` (main.py) et `joursSemaine`
   (src/data/programmesStandards.js).

Le serveur REFUSE (400) une valeur absente de sa liste. Une divergence
donnerait donc, côté app, un refus incompréhensible sur une valeur qu'elle
propose elle-même dans son interface — et rien ne le signalerait avant.

Ces tests ne suppriment pas la duplication (fusionner demanderait de faire
servir la liste par le serveur, ce qui ajoute un appel réseau à un écran qui
marche hors-ligne) : ils la rendent IMPOSSIBLE À OUBLIER.
"""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import GROUPES_MUSCULAIRES, JOURS_SEMAINE

RACINE = Path(__file__).parent.parent.parent


def liste_js(chemin_relatif: str, nom_variable: str) -> list:
    """Extrait une liste de chaînes d'un fichier JavaScript.

    Volontairement simple (une expression régulière, pas un analyseur JS) :
    ces deux listes sont des tableaux de chaînes littérales, écrits à plat.
    Si la forme du fichier change au point de casser cette lecture, le test
    échoue bruyamment — ce qui est le comportement voulu.
    """
    source = (RACINE / chemin_relatif).read_text(encoding="utf-8")
    motif = re.compile(
        r"export const %s\s*=\s*\[(.*?)\]" % re.escape(nom_variable), re.S
    )
    trouve = motif.search(source)
    if trouve is None:
        raise AssertionError(
            f"`{nom_variable}` est introuvable dans {chemin_relatif} — "
            "le test ne peut plus vérifier la synchronisation."
        )
    return re.findall(r"'([^']*)'", trouve.group(1))


class TestListesPartagees(unittest.TestCase):
    def test_les_groupes_musculaires_sont_identiques(self):
        cote_app = liste_js("src/data/groupesMusculaires.js", "groupesMusculaires")
        self.assertEqual(
            cote_app, GROUPES_MUSCULAIRES,
            "GROUPES_MUSCULAIRES (backend/app/main.py) et groupesMusculaires "
            "(src/data/groupesMusculaires.js) ont divergé. Le serveur refuserait "
            "un groupe que l'app propose pourtant à l'écran.",
        )

    def test_les_jours_de_la_semaine_sont_identiques(self):
        cote_app = liste_js("src/data/programmesStandards.js", "joursSemaine")
        self.assertEqual(
            cote_app, JOURS_SEMAINE,
            "JOURS_SEMAINE (backend/app/main.py) et joursSemaine "
            "(src/data/programmesStandards.js) ont divergé. Enregistrer un "
            "programme sur le jour concerné échouerait avec un 400.",
        )

    def test_l_ordre_compte_aussi(self):
        """L'égalité est volontairement stricte, ORDRE COMPRIS : les deux
        listes servent aussi à AFFICHER des choix, et deux ordres différents
        entre l'app et le serveur seraient un piège de plus."""
        self.assertIsInstance(GROUPES_MUSCULAIRES, list)
        self.assertIsInstance(JOURS_SEMAINE, list)
        self.assertEqual(JOURS_SEMAINE[0], "lundi")
        self.assertEqual(len(JOURS_SEMAINE), 7)


if __name__ == "__main__":
    unittest.main()
