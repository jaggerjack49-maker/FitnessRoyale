"""Les listes du formulaire du site doivent coller à celles du serveur.

Même motif que `test_listes_partagees.py` : les choix proposés par les
`<select>` de `site/index.html` sont RECOPIÉS des constantes de `main.py`.
Le serveur refuse (400) une valeur absente de sa liste — une divergence
donnerait donc à un visiteur un refus incompréhensible sur une valeur que le
site lui a lui-même proposée, et rien ne le signalerait avant.

La duplication n'est pas supprimée : faire servir ces listes par l'API
ajouterait un aller-retour réseau au chargement d'une page qui doit s'ouvrir
instantanément, et rendrait le formulaire dépendant d'une machine endormie.
Ce test la rend IMPOSSIBLE À OUBLIER.
"""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import (
    FORMULES_COACHING,
    MATERIELS_COACHING,
    NIVEAUX_COACHING,
    OBJECTIFS_COACHING,
)

PAGE = Path(__file__).parent.parent.parent / "site" / "index.html"


def choix_du_select(html: str, identifiant: str) -> list:
    """Les valeurs proposées par un <select>, dans l'ordre de la page.

    La valeur vide (« Choisis… ») est ignorée : c'est l'invite, pas un choix.
    """
    bloc = re.search(
        r'<select[^>]*\bid="' + re.escape(identifiant) + r'"[^>]*>(.*?)</select>',
        html, re.S)
    assert bloc, f"Aucun <select id=\"{identifiant}\"> dans site/index.html"
    return [v for v in re.findall(r'<option value="([^"]*)"', bloc.group(1)) if v]


class TestListesSiteCoaching(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def _comparer(self, identifiant, attendues, nom_constante):
        self.assertEqual(
            choix_du_select(self.html, identifiant), list(attendues),
            f"Le <select id=\"{identifiant}\"> de site/index.html ne propose pas "
            f"les mêmes valeurs que {nom_constante} dans backend/app/main.py. "
            "Le serveur refuserait un visiteur sur un choix que le site lui "
            "a proposé : il faut remettre les deux listes d'accord.")

    def test_les_objectifs_sont_les_memes(self):
        self._comparer("objectif", OBJECTIFS_COACHING, "OBJECTIFS_COACHING")

    def test_les_niveaux_sont_les_memes(self):
        self._comparer("niveau", NIVEAUX_COACHING, "NIVEAUX_COACHING")

    def test_les_materiels_sont_les_memes(self):
        self._comparer("materiel", MATERIELS_COACHING, "MATERIELS_COACHING")

    def test_les_formules_sont_les_memes(self):
        # L'ordre diffère volontairement sur la page (« Je ne sais pas encore »
        # est proposé en premier, c'est la réponse la plus fréquente), donc on
        # compare les ENSEMBLES et non la suite.
        self.assertEqual(
            sorted(choix_du_select(self.html, "formule")), sorted(FORMULES_COACHING),
            "Le <select id=\"formule\"> ne propose pas les mêmes formules que "
            "FORMULES_COACHING dans backend/app/main.py.")

    def test_les_jours_par_semaine_couvrent_ce_que_le_serveur_accepte(self):
        # Ceux-là ne sont pas une constante mais des bornes (Field ge=1, le=7).
        self.assertEqual(choix_du_select(self.html, "jours_par_semaine"),
                         [str(n) for n in range(1, 8)])

    def test_le_champ_piege_existe_et_reste_cache(self):
        """Le piège à robots doit exister dans la page ET être invisible.

        S'il devenait visible, de vraies personnes le rempliraient et se
        feraient refuser leur demande sans comprendre pourquoi.
        """
        self.assertIn('id="piege"', self.html, "le champ piège a disparu du formulaire")
        self.assertRegex(self.html, r'class="piege"',
                         "le champ piège n'est plus dans son bloc masqué")
        css = (PAGE.parent / "styles.css").read_text(encoding="utf-8")
        regle = re.search(r"\.piege\s*\{(.*?)\}", css, re.S)
        self.assertIsNotNone(regle, "aucune règle .piege dans site/styles.css")
        self.assertIn("-9999px", regle.group(1),
                      "la règle .piege ne sort plus le champ de l'écran")


if __name__ == "__main__":
    unittest.main()
