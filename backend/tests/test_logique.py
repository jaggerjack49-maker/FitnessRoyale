"""Tests de la logique Club SP — lancer avec :  python3 -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.logique import (
    palier_exercice, moyenne_paliers, ligue_joueur,
    categorie_poids, classer_global, classer_par_categories, classer_salles,
    classer_par_exercice,
)


def joueur(pseudo, sexe, poids, perfs, points=0, salle=None):
    """Petit constructeur de joueur pour les tests."""
    return {
        "pseudo": pseudo, "sexe": sexe, "poids": poids, "points": points,
        "salle": salle,
        "performances": {exo: {"valeur": v, "statut": st} for exo, (v, st) in perfs.items()},
    }


HAFIZ = joueur("Hafiz", "homme", 75, {
    "Développé couché": (100, "salle"),        # Gold (3)
    "Squat": (110, "salle"),                   # Silver (2)
    "Soulevé de terre": (175, "communaute"),   # Gold (3)
    "Traction prise large": (22, "communaute"),# Gold (3)
    "Dips": (42, "declare"),                   # déclaré → NE COMPTE PAS
}, points=380, salle="Club SP")


class TestPaliers(unittest.TestCase):
    def test_paliers_homme(self):
        self.assertEqual(palier_exercice("homme", "Développé couché", 100), 3)  # Gold
        self.assertEqual(palier_exercice("homme", "Développé couché", 69), 0)   # sous Bronze
        self.assertEqual(palier_exercice("homme", "Développé couché", 145), 6)  # Royal
        self.assertEqual(palier_exercice("homme", "Traction prise large", 15), 2)  # Silver

    def test_paliers_femme(self):
        self.assertEqual(palier_exercice("femme", "Squat", 60), 3)   # Gold
        self.assertEqual(palier_exercice("femme", "Squat", 80), 5)   # Titan (max femme)
        self.assertEqual(palier_exercice("femme", "Développé couché", 52.5), 4)  # Legend

    def test_perf_declaree_ne_compte_pas(self):
        # 4 perfs vérifiées (3+2+3+3 = 11), divisé par les 15 exercices du
        # barème homme (PAS seulement les 4 vérifiées — les Dips déclarés
        # sont exclus du numérateur, mais tous les exercices comptent au
        # dénominateur) = 11/15 = 0.73
        self.assertEqual(moyenne_paliers(HAFIZ), 0.73)
        self.assertEqual(ligue_joueur(HAFIZ), "Bronze")

    def test_categories_poids(self):
        self.assertEqual(categorie_poids(75), "-80 kg")
        self.assertEqual(categorie_poids(59.9), "-60 kg")
        self.assertEqual(categorie_poids(96), "+90 kg")


class TestClassements(unittest.TestCase):
    def setUp(self):
        self.joueurs = [
            HAFIZ,
            joueur("IronMax", "homme", 96, {"Développé couché": (125, "salle"),
                                            "Squat": (150, "salle")}, points=520, salle="Titan Gym"),
            joueur("SarahFit", "femme", 58, {"Développé couché": (47.5, "salle"),
                                             "Squat": (72, "salle")}, points=610, salle="Club SP"),
        ]

    def test_rangs_globaux(self):
        classement = classer_global(self.joueurs)
        self.assertEqual([j["rang"] for j in classement], [1, 2, 3])
        # La moyenne interne ne doit JAMAIS être exposée
        self.assertNotIn("_moyenne", classement[0])

    def test_la_polyvalence_prime_sur_un_seul_exercice_pousse_a_fond(self):
        # A : 4 exercices vérifiés à Gold (palier 3) chacun -> 12/15 = 0.80
        # B : 1 seul exercice vérifié, mais au max (Royal, palier 6) -> 6/15 = 0.40
        # Même si B est meilleur SUR CET exercice, A doit passer devant : la
        # moyenne se calcule sur TOUS les exercices du barème (voir CLAUDE.md).
        polyvalent = joueur("Polyvalent", "homme", 75, {
            "Développé couché": (100, "salle"),   # Gold (3)
            "Squat": (120, "salle"),              # Gold (3)
            "Rowing planche": (80, "salle"),      # Gold (3)
            "Curl barre": (45, "salle"),           # Gold (3)
        })
        specialiste = joueur("Spécialiste", "homme", 75, {
            "Développé couché": (145, "salle"),   # Royal (6)
        })
        classement = classer_global([specialiste, polyvalent])
        self.assertEqual(classement[0]["pseudo"], "Polyvalent")

    def test_departage_aux_points(self):
        a = joueur("A", "homme", 75, {"Squat": (120, "salle")}, points=500)
        b = joueur("B", "homme", 75, {"Squat": (121, "salle")}, points=100)  # même palier Gold
        classement = classer_global([b, a])
        self.assertEqual(classement[0]["pseudo"], "A")  # plus de points → devant

    def test_categories(self):
        groupes = classer_par_categories(self.joueurs)
        categories = [g["categorie"] for g in groupes]
        self.assertIn("-80 kg", categories)   # Hafiz
        self.assertIn("+90 kg", categories)   # IronMax
        pour_80 = next(g for g in groupes if g["categorie"] == "-80 kg")
        self.assertEqual(pour_80["joueurs"][0]["rang"], 1)

    def test_salles(self):
        classement = classer_salles(self.joueurs)
        self.assertEqual(len(classement), 2)  # Club SP et Titan Gym
        club_sp = next(s for s in classement if s["salle"] == "Club SP")
        self.assertEqual(club_sp["nb_membres"], 2)

    def test_classement_par_exercice(self):
        # Sur "Développé couché" : IronMax (125kg homme -> Legend, palier 4) devant.
        # Hafiz (100kg homme -> Gold, palier 3) et SarahFit (47.5kg femme -> Gold,
        # palier 3 sur SON barème) sont à égalité de palier -> départagés aux
        # points (610 > 380), pas à la valeur brute (kg pas comparables entre sexes).
        classement = classer_par_exercice(self.joueurs, "Développé couché")
        self.assertEqual([j["pseudo"] for j in classement], ["IronMax", "SarahFit", "Hafiz"])
        self.assertEqual(classement[0]["palier_exo"], 4)  # Legend
        self.assertEqual(classement[0]["valeur_exo"], 125)

    def test_classement_par_exercice_ignore_les_perfs_non_verifiees(self):
        # Les Dips de Hafiz sont "declare" (non vérifiés) -> absent du classement.
        classement = classer_par_exercice(self.joueurs, "Dips")
        self.assertEqual(classement, [])

    def test_classement_par_exercice_departage_aux_points_pas_a_la_valeur_brute(self):
        # Même palier Gold (3) sur Squat : A a moins de kg mais plus de points -> devant.
        a = joueur("A", "homme", 75, {"Squat": (120, "salle")}, points=500)
        b = joueur("B", "homme", 75, {"Squat": (135, "salle")}, points=100)
        classement = classer_par_exercice([a, b], "Squat")
        self.assertEqual([j["pseudo"] for j in classement], ["A", "B"])


if __name__ == "__main__":
    unittest.main()
