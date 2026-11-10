"""Aucun texte affiché ne parle de « serveur » — verrou posé le 10/11/2026.

Demande de Hafiz, après un message « Bloc NON démarré : le serveur n'a pas pu
enregistrer le plan » : « ne parle pas de serveur dans un message d'erreur ni
partout ailleurs ». Pour la personne qui s'entraîne, il n'y a pas de serveur :
il y a une connexion internet, et des choses enregistrées ou non. Les 38
textes concernés ont été réécrits (« Changement NON enregistré », « la
connexion est trop lente », « CONNEXION IMPOSSIBLE »…).

POURQUOI UN TEST POUR UNE ABSENCE : le mot revient naturellement sous les
doigts d'un développeur — c'est son vocabulaire, pas celui de l'utilisateur.
Même méthode que `test_pas_d_emoji_interface.py`.

CE QUI EST VÉRIFIÉ :
- côté app : chaque chaîne, gabarit et texte JSX de App.js et src/ (via le
  parseur Babel du projet — les commentaires et les noms de variables comme
  `moiServeur` ne comptent pas) ;
- côté backend : chaque chaîne de backend/app qui n'est PAS une docstring —
  les messages d'erreur du backend (`HTTPException`) sont affichés tels quels
  par l'app.

Vu ÉCHOUER en remettant « Changement NON enregistré côté serveur » dans un
écran et « … configurée sur le serveur » dans main.py.
"""

import ast
import shutil
import subprocess
import unittest
from pathlib import Path

RACINE = Path(__file__).parent.parent.parent
SCANNER = Path(__file__).parent / "harnais" / "textes_affiches.cjs"
MOT = "serveur"


class TestPasDeServeurALEcran(unittest.TestCase):
    @unittest.skipIf(shutil.which("node") is None, "Node absent : pas d'analyse des écrans")
    def test_aucun_texte_de_l_app_ne_dit_serveur(self):
        sortie = subprocess.run(
            ["node", str(SCANNER), str(RACINE), MOT],
            capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
        trouvailles = [l for l in sortie.splitlines() if not l.startswith("TOTAL")]
        self.assertTrue(sortie.strip().endswith("TOTAL 0"), (
            "Ces textes affichés parlent de « serveur » — parle plutôt de "
            "connexion ou d'enregistrement :\n" + "\n".join(trouvailles)
        ))

    def test_aucun_message_du_backend_ne_dit_serveur(self):
        fautifs = []
        for fichier in sorted((RACINE / "backend" / "app").glob("*.py")):
            arbre = ast.parse(fichier.read_text(encoding="utf-8"))
            docstrings = set()
            for noeud in ast.walk(arbre):
                if isinstance(noeud, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    corps = noeud.body
                    if corps and isinstance(corps[0], ast.Expr) and isinstance(corps[0].value, ast.Constant):
                        docstrings.add(id(corps[0].value))
            for noeud in ast.walk(arbre):
                if (isinstance(noeud, ast.Constant) and isinstance(noeud.value, str)
                        and id(noeud) not in docstrings and MOT in noeud.value.lower()):
                    fautifs.append(f"{fichier.name}:{noeud.lineno}: {noeud.value[:100]}")
        self.assertEqual(fautifs, [], "Messages du backend qui parlent de « serveur » :\n"
                         + "\n".join(fautifs))


if __name__ == "__main__":
    unittest.main()
