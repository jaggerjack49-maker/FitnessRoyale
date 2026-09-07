"""L'HISTORIQUE D'ENTRAÎNEMENT SURVIT À LA MORT DE SON PROGRAMME.

Demande de Hafiz du 07/09/2026 : « je veux que les performances des
entraînements soient enregistrées même si on recommence le programme à zéro ».

CE QUI EST EN JEU : le journal de séances est la matière première de TOUT
l'onglet Entraînement — les records personnels, la suggestion de charge
(surcharge progressive), la détection de stagnation et le comptage de séries
par groupe musculaire en découlent tous. Perdre l'historique en refaisant son
programme reviendrait à repartir de zéro sur sa progression, ce qui est le
contraire de ce que l'app promet.

CE QUI LE GARANTIT AUJOURD'HUI : `entrainements.programme_id` est déclaré
`ON DELETE SET NULL` (et non `CASCADE`) dans `basededonnees.py`. Une séance
loggée n'appartient donc pas à son programme : elle appartient au JOUEUR, et
le programme n'est qu'une étiquette qui peut disparaître.

C'est un mot-clé dans une définition de table — le genre de détail qu'on
change sans y penser en réécrivant un schéma. D'où ce test.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db


class TestHistoriqueSurvit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.mkdtemp()
        cls.ancien_chemin = db.CHEMIN_DB
        db.CHEMIN_DB = os.path.join(cls.dossier, "test.db")
        db.initialiser()

    @classmethod
    def tearDownClass(cls):
        db.CHEMIN_DB = cls.ancien_chemin

    def _joueur_avec_seance(self, pseudo):
        """Un joueur, un programme d'un exercice, et une séance loggée dessus."""
        joueur_id = db.creer_joueur(pseudo, "homme", 80.0, None)
        programme_id = db.creer_programme(joueur_id, "Push", "2026-09-01", ["lundi"])
        db.ajouter_exercice_programme(programme_id, "développé couché", 1, 4, 8)
        entrainement_id = db.creer_entrainement(
            joueur_id, programme_id, "2026-09-01", "2026-09-01T10:00:00.000"
        )
        db.ajouter_serie(entrainement_id, "développé couché", 1, 8, 100.0)
        db.ajouter_serie(entrainement_id, "développé couché", 2, 8, 100.0)
        return joueur_id, programme_id

    def test_supprimer_le_programme_ne_supprime_pas_les_seances(self):
        joueur_id, programme_id = self._joueur_avec_seance("SupprimeSonProgramme")
        self.assertEqual(len(db.entrainements_du_joueur(joueur_id)), 1)

        db.supprimer_programme(programme_id)

        seances = db.entrainements_du_joueur(joueur_id)
        self.assertEqual(len(seances), 1, "la séance loggée a disparu avec le programme")
        self.assertEqual(len(seances[0]["series"]), 2, "les séries ont disparu")
        self.assertEqual(seances[0]["series"][0]["poids"], 100.0)
        # Le lien vers le programme, lui, n'a plus d'objet : c'est normal.
        self.assertIsNone(seances[0]["programme_id"])

    def test_supprimer_le_cycle_entier_ne_supprime_pas_les_seances(self):
        """Le cas réel de « recommencer le programme à zéro » : on supprime le
        CYCLE, ce qui emporte toutes ses séances-programmes d'un coup."""
        joueur_id, programme_id = self._joueur_avec_seance("SupprimeSonCycle")
        cycle_id = db.creer_cycle(joueur_id, "PPL", "2026-09-01")
        db.rattacher_programme_au_cycle(cycle_id, programme_id)

        db.supprimer_cycle(cycle_id)

        seances = db.entrainements_du_joueur(joueur_id)
        self.assertEqual(len(seances), 1, "l'historique a été emporté par le cycle")
        self.assertEqual(seances[0]["series"][0]["exercice"], "développé couché")

    def test_un_programme_recree_retrouve_l_historique_de_ses_exercices(self):
        """Ce qui compte vraiment pour l'utilisateur : après avoir tout refait,
        ses records et ses suggestions de charge doivent repartir de là où il
        en était. Ils sont retrouvés par le NOM de l'exercice (le seul
        identifiant qui existe, voir CLAUDE.md), pas par le programme."""
        joueur_id, programme_id = self._joueur_avec_seance("RecommenceAZero")
        db.supprimer_programme(programme_id)

        nouveau = db.creer_programme(joueur_id, "Push v2", "2026-09-07", ["lundi"])
        db.ajouter_exercice_programme(nouveau, "développé couché", 1, 4, 8)

        series = [
            serie
            for seance in db.entrainements_du_joueur(joueur_id)
            for serie in seance["series"]
            if serie["exercice"] == "développé couché"
        ]
        self.assertEqual(len(series), 2)
        self.assertEqual(max(s["poids"] for s in series), 100.0)


if __name__ == "__main__":
    unittest.main()
