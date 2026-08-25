"""Tests des défis récurrents — lancer avec :  python -m unittest discover tests"""

import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.defis import (
    defi_jour_reussi,
    defi_semaine_reussi,
    meme_semaine,
    periode_jour,
    periode_semaine,
)

# Dimanche 19 juillet 2026 = semaine ISO 29.
AUJOURDHUI = date(2026, 7, 19)


def seance(date_str, minutes):
    return {"date": date_str, "minutes": minutes}


class TestPeriodes(unittest.TestCase):
    def test_periode_jour_format(self):
        self.assertEqual(periode_jour(AUJOURDHUI), "2026-07-19")

    def test_periode_semaine_format(self):
        self.assertEqual(periode_semaine(AUJOURDHUI), "2026-S29")

    def test_meme_semaine(self):
        self.assertTrue(meme_semaine("2026-07-15", AUJOURDHUI))  # mercredi, même semaine ISO
        self.assertFalse(meme_semaine("2026-07-06", AUJOURDHUI))  # semaine précédente
        self.assertFalse(meme_semaine("date-invalide", AUJOURDHUI))


class TestDefiJour(unittest.TestCase):
    def test_reussi_avec_seance_du_jour_suffisamment_longue(self):
        seances = [seance("2026-07-19", 35), seance("2026-07-18", 60)]
        self.assertTrue(defi_jour_reussi(seances, AUJOURDHUI))

    def test_echoue_si_seance_trop_courte(self):
        seances = [seance("2026-07-19", 20)]
        self.assertFalse(defi_jour_reussi(seances, AUJOURDHUI))

    def test_echoue_si_seance_pas_aujourdhui(self):
        seances = [seance("2026-07-18", 60)]
        self.assertFalse(defi_jour_reussi(seances, AUJOURDHUI))


class TestDefiSemaine(unittest.TestCase):
    def test_reussi_avec_quatre_seances_cette_semaine(self):
        seances = [
            seance("2026-07-13", 45), seance("2026-07-15", 40),
            seance("2026-07-17", 50), seance("2026-07-19", 30),
        ]
        self.assertTrue(defi_semaine_reussi(seances, AUJOURDHUI))

    def test_echoue_avec_trois_seances_seulement(self):
        seances = [
            seance("2026-07-13", 45), seance("2026-07-15", 40), seance("2026-07-17", 50),
        ]
        self.assertFalse(defi_semaine_reussi(seances, AUJOURDHUI))

    def test_seances_hors_semaine_ne_comptent_pas(self):
        seances = [
            seance("2026-07-13", 45), seance("2026-07-15", 40),
            seance("2026-07-17", 50), seance("2026-07-06", 60),  # semaine précédente
        ]
        self.assertFalse(defi_semaine_reussi(seances, AUJOURDHUI))


if __name__ == "__main__":
    unittest.main()
