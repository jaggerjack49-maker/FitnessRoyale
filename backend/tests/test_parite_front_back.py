"""Les DEUX implémentations du classement doivent rester d'accord.

Point 4 de l'audit du 03/09/2026. Le classement existe en double depuis
toujours : `backend/app/logique.py` (Python) et `src/logic/classement.js`
(JavaScript), décrit comme un « portage exact ». Chacun a ses tests, mais rien
ne garantissait qu'ils calculent la MÊME chose — et c'est l'app qui recalcule
les classements affichés (voir « Branchement backend » dans CLAUDE.md).
Une règle changée d'un seul côté serait donc passée inaperçue : le joueur
verrait un classement, le serveur en connaîtrait un autre.

COMMENT : les cas de test vivent dans UN SEUL fichier
(`harnais/cas_classement.json`), lu par les deux côtés. Le code JavaScript est
exécuté tel quel par Node (`harnais/harnais_classement.mjs`), et son résultat
est comparé à celui de Python.

Si Node n'est pas installé, le test est IGNORÉ plutôt qu'en échec : la suite
backend doit rester lançable sans l'outillage de l'app.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.logique import (
    classer_global,
    classer_par_categories,
    classer_par_exercice,
    classer_salles,
    cle_salle,
    ligue_joueur,
    moyenne_paliers,
)

HARNAIS = Path(__file__).parent / "harnais"
CAS = HARNAIS / "cas_classement.json"


def resultat_python(cas: dict) -> dict:
    """Fait passer les cas dans l'implémentation Python, dans la MÊME forme que
    celle produite par le harnais JavaScript."""
    resultat = {}
    for nom, entree in cas.items():
        if nom.startswith("_"):
            continue
        joueurs = entree["joueurs"]
        resultat[nom] = {
            "moyennes": [round(moyenne_paliers(j), 2) for j in joueurs],
            "ligues": [ligue_joueur(j) for j in joueurs],
            "global": [j["pseudo"] for j in classer_global(joueurs)],
            "categories": [
                {"categorie": g["categorie"],
                 "joueurs": [j["pseudo"] for j in g["joueurs"]]}
                for g in classer_par_categories(joueurs)
            ],
            "salles": [
                {"salle": s["salle"], "nbMembres": s["nb_membres"]}
                for s in classer_salles(joueurs)
            ],
            "parExercice": [
                {"exercice": exo,
                 "joueurs": [j["pseudo"] for j in classer_par_exercice(joueurs, exo)]}
                for exo in entree.get("exercices", [])
            ],
            "clesSalles": [cle_salle(j.get("salle")) for j in joueurs],
        }
    return resultat


def resultat_javascript(chemin_cas: Path) -> dict:
    """Exécute le code de l'APP avec Node et récupère son résultat."""
    sortie = subprocess.run(
        ["node", "--import", "./resolveur.mjs",
         "harnais_classement.mjs", str(chemin_cas)],
        cwd=HARNAIS, capture_output=True, text=True, encoding="utf-8", timeout=120,
    )
    if sortie.returncode != 0:
        raise AssertionError(
            "Le harnais JavaScript n'a pas pu tourner :\n" + (sortie.stderr or "")
        )
    return json.loads(sortie.stdout)


class TestPariteFrontBack(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        cls.cas = json.loads(CAS.read_text(encoding="utf-8"))
        cls.js = resultat_javascript(CAS)
        cls.py = resultat_python(cls.cas)

    def test_les_deux_implementations_traitent_les_memes_cas(self):
        self.assertEqual(sorted(self.js), sorted(self.py))
        self.assertGreaterEqual(len(self.py), 5, "trop peu de cas pour être utile")

    def test_le_classement_global_est_le_meme(self):
        for nom in self.py:
            self.assertEqual(self.js[nom]["global"], self.py[nom]["global"],
                             f"classement global différent sur le cas « {nom} »")

    def test_les_moyennes_et_les_ligues_sont_les_memes(self):
        for nom in self.py:
            self.assertEqual(self.js[nom]["moyennes"], self.py[nom]["moyennes"],
                             f"moyennes de paliers différentes sur « {nom} »")
            self.assertEqual(self.js[nom]["ligues"], self.py[nom]["ligues"],
                             f"ligues différentes sur « {nom} »")

    def test_les_categories_de_poids_sont_les_memes(self):
        for nom in self.py:
            self.assertEqual(self.js[nom]["categories"], self.py[nom]["categories"],
                             f"catégories de poids différentes sur « {nom} »")

    def test_le_classement_par_exercice_est_le_meme(self):
        for nom in self.py:
            self.assertEqual(self.js[nom]["parExercice"], self.py[nom]["parExercice"],
                             f"classement par exercice différent sur « {nom} »")

    def test_le_regroupement_par_salle_est_le_meme(self):
        """Couvre aussi le correctif du 04/09/2026 : les deux côtés doivent
        normaliser la salle de la même façon."""
        for nom in self.py:
            self.assertEqual(self.js[nom]["salles"], self.py[nom]["salles"],
                             f"classement par salle différent sur « {nom} »")
            self.assertEqual(self.js[nom]["clesSalles"], self.py[nom]["clesSalles"],
                             f"clés de salle différentes sur « {nom} »")

    def test_les_cas_couvrent_bien_les_regles_qui_comptent(self):
        """Garde-fou sur les cas eux-mêmes : un fichier de cas qui se viderait
        rendrait tous les tests ci-dessus verts sans rien vérifier."""
        polyvalence = self.py["polyvalence_contre_specialisation"]["global"]
        self.assertEqual(polyvalence[0], "Polyvalent",
                         "la polyvalence doit primer sur la spécialisation")
        verifie = self.py["seul_le_verifie_compte"]["global"]
        self.assertEqual(verifie[0], "Verifie",
                         "une perf déclarée ne doit pas peser au classement")
        salles = self.py["salles_ecrites_differemment"]["salles"]
        self.assertEqual([s["nbMembres"] for s in salles], [3],
                         "les trois écritures d'« Iron Temple » forment un seul clan")


if __name__ == "__main__":
    unittest.main()
