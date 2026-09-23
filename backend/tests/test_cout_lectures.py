"""Le COÛT d'une lecture ne doit pas grandir avec les données du joueur.

Bug de Hafiz du 23/09/2026 : « je n'ai plus mes séances ni mon programme ».
Rien n'était perdu — `entrainements_du_joueur` demandait la liste des
identifiants, puis appelait `lire_entrainement` pour CHACUN, donc un emprunt de
connexion PAR SÉANCE. Sur SQLite c'est gratuit ; vers la base distante (Neon),
chaque emprunt coûte un aller-retour réseau. Le chargement s'allongeait donc à
mesure qu'il s'entraînait, jusqu'à dépasser le délai de 12 s de l'app : écran
vide, identique à une perte de données. Un compte neuf ne voyait jamais rien.

C'est le piège déjà payé le 25/08/2026 sur `lire_tous_les_joueurs`
(« LENTEUR POSTGRES : une connexion par appel, ça ne pardonne pas à
distance »). Ces tests le VERROUILLENT là où il peut revenir : le nombre de
connexions empruntées ne doit dépendre QUE de la fonction appelée, jamais du
nombre de séances, de programmes ou de cycles.

Compter les connexions plutôt que chronométrer : une durée dépend de la
machine et ne dirait rien en SQLite local, alors que le nombre d'allers-retours
est exactement ce qui se paie sur une base distante.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_cout_lectures_fitness_royale.db"


class CompteurConnexions:
    """Remplace `db.connexion` le temps d'un appel et compte les emprunts."""

    def __init__(self):
        self.vraie = db.connexion
        self.emprunts = 0

    def __enter__(self):
        compteur = self

        def connexion_comptee(*args, **kwargs):
            compteur.emprunts += 1
            return compteur.vraie(*args, **kwargs)

        db.connexion = connexion_comptee
        return self

    def __exit__(self, *exc):
        db.connexion = self.vraie
        return False


def emprunts_pour(fonction, *args):
    with CompteurConnexions() as compteur:
        resultat = fonction(*args)
    return compteur.emprunts, resultat


class TestCoutLectures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        db.initialiser()
        # Deux joueurs : un « petit » et un qui s'entraîne depuis des mois.
        cls.petit = db.creer_joueur("Debutant", "homme", 80, None)
        cls.gros = db.creer_joueur("Assidu", "homme", 90, None)
        cls._remplir(cls.petit, seances=2, programmes=1, cycles=1)
        cls._remplir(cls.gros, seances=40, programmes=12, cycles=3)

    @classmethod
    def tearDownClass(cls):
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    @classmethod
    def _remplir(cls, joueur_id, seances, programmes, cycles):
        maintenant = "2026-08-01T10:00:00.000"
        ids_programmes = []
        for i in range(programmes):
            pid = db.creer_programme(joueur_id, f"Programme {i}", maintenant, ["lundi"])
            db.ajouter_exercice_programme(pid, "Squat", 1, 4, 8)
            db.ajouter_exercice_programme(pid, "Développé", 2, 3, 10)
            ids_programmes.append(pid)
        for c in range(cycles):
            cycle_id = db.creer_cycle(joueur_id, f"Cycle {c}", maintenant)
            for pid in ids_programmes[:3]:
                db.rattacher_programme_au_cycle(cycle_id, pid)
        for j in range(seances):
            eid = db.creer_entrainement(
                joueur_id, None, f"2026-08-{(j % 28) + 1:02d}", maintenant)
            for n in range(4):
                db.ajouter_serie(eid, "Squat", n + 1, 8, 100)

    # ---- LE CŒUR : le coût ne bouge pas quand les données grossissent ----
    def test_lire_les_seances_coute_pareil_avec_2_ou_40_seances(self):
        peu, seances_peu = emprunts_pour(db.entrainements_du_joueur, self.petit)
        beaucoup, seances_beaucoup = emprunts_pour(db.entrainements_du_joueur, self.gros)
        self.assertEqual(len(seances_peu), 2)
        self.assertEqual(len(seances_beaucoup), 40)
        self.assertEqual(
            peu, beaucoup,
            f"le nombre de connexions dépend du nombre de séances ({peu} pour 2, "
            f"{beaucoup} pour 40) — c'est exactement le bug du 23/09/2026",
        )
        self.assertEqual(beaucoup, 1, "une seule connexion doit suffire")

    def test_lire_les_programmes_coute_pareil_avec_1_ou_12_programmes(self):
        peu, _ = emprunts_pour(db.programmes_du_joueur, self.petit)
        beaucoup, liste = emprunts_pour(db.programmes_du_joueur, self.gros)
        self.assertEqual(len(liste), 12)
        self.assertEqual(peu, beaucoup)
        self.assertEqual(beaucoup, 1)

    def test_lire_les_cycles_coute_pareil_avec_1_ou_3_cycles(self):
        peu, _ = emprunts_pour(db.cycles_du_joueur, self.petit)
        beaucoup, liste = emprunts_pour(db.cycles_du_joueur, self.gros)
        self.assertEqual(len(liste), 3)
        self.assertEqual(peu, beaucoup)
        self.assertEqual(beaucoup, 1)

    # ---- …et les données restent COMPLÈTES (le lot ne perd rien) ----
    def test_les_seances_gardent_toutes_leurs_series(self):
        seances = db.entrainements_du_joueur(self.gros)
        self.assertTrue(all(len(s["series"]) == 4 for s in seances))
        premiere = seances[0]["series"][0]
        self.assertEqual(premiere["exercice"], "Squat")
        self.assertEqual(premiere["reps"], 8)
        self.assertEqual(premiere["poids"], 100)
        # Les plus récentes d'abord : l'ordre ne doit pas changer non plus.
        dates = [s["date"] for s in seances]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_les_programmes_gardent_leurs_exercices_et_leurs_jours(self):
        programmes = db.programmes_du_joueur(self.gros)
        self.assertTrue(all(len(p["exercices"]) == 2 for p in programmes))
        self.assertEqual(programmes[0]["exercices"][0]["exercice"], "Squat")
        self.assertEqual(programmes[0]["jours"], ["lundi"])

    def test_les_cycles_gardent_leurs_seances(self):
        cycles = db.cycles_du_joueur(self.gros)
        self.assertTrue(all(len(c["seances"]) == 3 for c in cycles))
        self.assertEqual(len(cycles[0]["seances"][0]["exercices"]), 2)

    def test_lire_un_programme_seul_marche_toujours(self):
        programmes = db.programmes_du_joueur(self.petit)
        seul = db.lire_programme(programmes[0]["id"])
        self.assertEqual(seul["nom"], programmes[0]["nom"])
        self.assertEqual(len(seul["exercices"]), 2)
        self.assertIsNone(db.lire_programme(999999))


if __name__ == "__main__":
    unittest.main()
