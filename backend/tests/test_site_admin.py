"""La page de LECTURE des demandes (`site/admin.html`) et ses garde-fous.

Ces vérifications portent sur des fichiers du SITE, pas sur l'API : ce sont
des règles qu'on ne peut pas faire tenir par le serveur, et qu'il serait très
facile de défaire sans s'en rendre compte en retouchant la page.

Trois d'entre elles verrouillent une ABSENCE (pas d'`innerHTML`, pas de lien
public, plus d'écran dans l'app) — même méthode que
`test_plus_de_mode_hors_ligne.py` : ce qui n'est pas écrit ne se voit pas,
donc ça se teste.
"""

import re
import unittest
from pathlib import Path

RACINE = Path(__file__).parent.parent.parent
SITE = RACINE / "site"
APP = RACINE / "src"


def lire(chemin):
    return chemin.read_text(encoding="utf-8")


def sans_commentaires(code):
    """Le code JS débarrassé de ses commentaires.

    Sans ça, un test qui cherche `innerHTML` échouerait sur l'avertissement
    en tête de `admin.js`, qui explique justement pourquoi on ne s'en sert
    pas. (Même précaution que `test_pas_d_emoji_interface.py`.)
    """
    code = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", code)


class TestPageDeLecture(unittest.TestCase):
    """Ce qui protège la page admin elle-même."""

    def test_la_page_admin_n_est_pas_indexable(self):
        # Un formulaire de connexion référencé par Google attire les robots
        # qui essaient des mots de passe au hasard.
        page = lire(SITE / "admin.html")
        robots = re.search(r'<meta\s+name="robots"\s+content="([^"]+)"', page)
        self.assertIsNotNone(robots, "La page admin doit porter une balise robots.")
        self.assertIn("noindex", robots.group(1))

    def test_la_page_publique_ne_mene_pas_a_la_page_admin(self):
        # On ne montre pas une porte qu'aucun visiteur n'a à pousser. Ce n'est
        # PAS ce qui protège les demandes (c'est le serveur qui le fait), mais
        # un formulaire de connexion sur un site public n'a aucun intérêt pour
        # les gens qui viennent demander un coaching.
        self.assertNotIn("admin.html", lire(SITE / "index.html"))

    def test_aucune_donnee_recue_n_est_posee_en_HTML(self):
        """Le garde-fou le plus important de tout le site.

        Une demande est écrite par n'importe quel visiteur. Collée dans la
        page avec `innerHTML`, une demande contenant une balise de script
        s'exécuterait DANS la page d'administration — là où vit le jeton — et
        pourrait le voler. Tout doit passer par `textContent`.
        """
        interdits = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"]
        for fichier in ("admin.js", "script.js", "commun.js"):
            code = sans_commentaires(lire(SITE / fichier))
            for interdit in interdits:
                self.assertNotIn(
                    interdit, code,
                    f"{fichier} emploie {interdit} : le texte reçu doit passer "
                    f"par textContent, jamais par du HTML.",
                )

    def test_la_page_admin_demande_bien_les_routes_protegees(self):
        code = sans_commentaires(lire(SITE / "admin.js"))
        self.assertIn("/admin/coaching/demandes", code)
        # Le jeton est transmis par `commun.js`, qui pose l'en-tête.
        self.assertIn("Bearer ", sans_commentaires(lire(SITE / "commun.js")))

    def test_l_adresse_de_l_api_n_est_ecrite_qu_a_un_endroit(self):
        """Une adresse recopiée finit toujours par diverger.

        Quand elle se trompe, elle pointe sur `localhost`, c'est-à-dire sur
        l'appareil du visiteur : la page marche chez soi et chez personne
        d'autre (le bug du 21/09/2026).
        """
        porteurs = [
            f.name for f in sorted(SITE.glob("*.js"))
            if "fitnessroyale.onrender.com" in lire(f)
        ]
        self.assertEqual(porteurs, ["commun.js"])


class TestPlusDeLectureDansLApp(unittest.TestCase):
    """Les demandes se lisent sur le SITE, et nulle part ailleurs.

    L'écran qui vivait dans le Profil de l'application a été retiré le
    16/11/2026 : deux endroits pour la même chose finissent toujours par
    diverger, et celui-ci demandait en plus un nouvel APK à chaque retouche.
    """

    def test_l_ecran_de_l_app_n_existe_plus(self):
        self.assertFalse((APP / "components" / "DemandesCoaching.js").exists())

    def test_plus_personne_ne_l_appelle_dans_l_app(self):
        fautifs = []
        for fichier in list(APP.rglob("*.js")) + [RACINE / "App.js"]:
            texte = lire(fichier)
            if "DemandesCoaching" in texte or "demandesCoaching" in texte:
                fautifs.append(str(fichier.relative_to(RACINE)))
        self.assertEqual(fautifs, [], "Les demandes se lisent sur le site, pas dans l'app.")


if __name__ == "__main__":
    unittest.main()
