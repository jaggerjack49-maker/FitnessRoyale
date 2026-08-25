"""Tests des duels BO3 — lancer avec :  python -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.baremes import BAREMES
from app.duels import (
    ALPHABET_CODE,
    comptage_victoires,
    exercice_aleatoire_ia,
    gagnant_duel,
    generer_code,
    round_verrouille,
)


def round_(numero, choisi_par, exercice=None, charge=None, rc=None, ra=None):
    return {
        "numero": numero, "choisi_par": choisi_par, "exercice": exercice,
        "charge": charge, "reps_challenger": rc, "reps_adversaire": ra,
    }


class TestComptageVictoires(unittest.TestCase):
    def test_rounds_pas_encore_joues_ne_comptent_pas(self):
        rounds = [round_(1, "challenger"), round_(2, "adversaire"), round_(3, "ia")]
        self.assertEqual(comptage_victoires(rounds), {"challenger": 0, "adversaire": 0})

    def test_victoire_simple(self):
        rounds = [
            round_(1, "challenger", "Squat", 100, rc=12, ra=9),
            round_(2, "adversaire"),
            round_(3, "ia"),
        ]
        self.assertEqual(comptage_victoires(rounds), {"challenger": 1, "adversaire": 0})

    def test_egalite_de_reps_ne_marque_personne(self):
        rounds = [round_(1, "challenger", "Squat", 100, rc=10, ra=10)]
        self.assertEqual(comptage_victoires(rounds), {"challenger": 0, "adversaire": 0})

    def test_deux_a_zero(self):
        rounds = [
            round_(1, "challenger", "Squat", 100, rc=12, ra=9),
            round_(2, "adversaire", "Dips", 20, rc=15, ra=10),
            round_(3, "ia"),
        ]
        self.assertEqual(comptage_victoires(rounds), {"challenger": 2, "adversaire": 0})


class TestGagnantDuel(unittest.TestCase):
    def test_personne_avant_deux_victoires(self):
        rounds = [round_(1, "challenger", "Squat", 100, rc=12, ra=9)]
        self.assertIsNone(gagnant_duel(rounds))

    def test_challenger_gagne_deux_zero(self):
        rounds = [
            round_(1, "challenger", "Squat", 100, rc=12, ra=9),
            round_(2, "adversaire", "Dips", 20, rc=15, ra=10),
        ]
        self.assertEqual(gagnant_duel(rounds), "challenger")

    def test_adversaire_gagne_apres_departage(self):
        rounds = [
            round_(1, "challenger", "Squat", 100, rc=8, ra=11),
            round_(2, "adversaire", "Dips", 20, rc=15, ra=10),
            round_(3, "ia", "Développé couché", 70, rc=9, ra=12),
        ]
        self.assertEqual(gagnant_duel(rounds), "adversaire")


class TestExerciceIA(unittest.TestCase):
    def test_exercice_ia_est_en_kg_avec_charge_bronze(self):
        for sexe in ("homme", "femme"):
            choix = exercice_aleatoire_ia(sexe)
            bareme = BAREMES[sexe][choix["exercice"]]
            self.assertEqual(bareme["unite"], "kg")
            self.assertEqual(choix["charge"], bareme["paliers"][0])


class TestCodeDuel(unittest.TestCase):
    def test_code_a_la_bonne_longueur_et_le_bon_alphabet(self):
        for _ in range(50):
            code = generer_code()
            self.assertEqual(len(code), 6)
            self.assertTrue(all(c in ALPHABET_CODE for c in code))

    def test_codes_ambigus_exclus(self):
        # 0/O et 1/I/L sont ambigus à l'oral — exclus de l'alphabet du code.
        for caractere in "01OIL":
            self.assertNotIn(caractere, ALPHABET_CODE)

    def test_deux_codes_generes_sont_generalement_differents(self):
        codes = {generer_code() for _ in range(20)}
        self.assertGreater(len(codes), 1)  # aléatoire : quasi impossible d'avoir 20 fois le même


class TestRoundVerrouille(unittest.TestCase):
    def test_round_pas_encore_joue_nest_pas_verrouille(self):
        self.assertFalse(round_verrouille(round_(1, "challenger")))

    def test_round_partiellement_joue_nest_pas_verrouille(self):
        self.assertFalse(round_verrouille(round_(1, "challenger", "Squat", 100, rc=10)))

    def test_egalite_nest_pas_verrouillee_rejouable(self):
        self.assertFalse(round_verrouille(round_(1, "challenger", "Squat", 100, rc=10, ra=10)))

    def test_resultat_decisif_est_verrouille(self):
        self.assertTrue(round_verrouille(round_(1, "challenger", "Squat", 100, rc=12, ra=9)))


if __name__ == "__main__":
    unittest.main()
