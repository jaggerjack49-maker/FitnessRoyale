"""Tests d'intégration des duels en ligne — de VRAIES requêtes HTTP contre
l'app FastAPI (via TestClient), sur une base de données TEMPORAIRE.

Lancer avec : python -m unittest discover tests
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_duels_fitness_royale.db"


class TestAPIDuels(unittest.TestCase):
    # Voir le commentaire dans test_api_auth.py : db.CHEMIN_DB est redirigée
    # ICI (pas au niveau du fichier) pour ne pas écraser le chemin utilisé par
    # d'autres fichiers de test tournant dans le même process.
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    def _inscrire(self, pseudo, mdp="motdepasse123", sexe="homme", poids=80):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": mdp, "sexe": sexe, "poids": poids,
        })
        return r.json()["token"], r.json()["joueur"]["id"]

    def _en_tete(self, token):
        return {"Authorization": f"Bearer {token}"}

    def _duel_pret_a_jouer(self, pseudo_a="Alpha", pseudo_b="Beta"):
        """Crée 2 comptes, un duel, et fait rejoindre le second — prêt pour les rounds."""
        token_a, id_a = self._inscrire(pseudo_a)
        token_b, id_b = self._inscrire(pseudo_b)
        duel = self.client.post("/duels/creer", json={"recompense": 100},
                                headers=self._en_tete(token_a)).json()
        self.client.post("/duels/rejoindre", json={"code": duel["code"]},
                         headers=self._en_tete(token_b))
        return {"duel_id": duel["id"], "token_a": token_a, "id_a": id_a,
                "token_b": token_b, "id_b": id_b}

    # ----- Création et jonction -----

    def test_creer_duel_renvoie_un_code(self):
        token, _ = self._inscrire("Nadia")
        r = self.client.post("/duels/creer", json={"recompense": 100}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        corps = r.json()
        self.assertEqual(len(corps["code"]), 6)
        self.assertEqual(corps["statut"], "en_attente")
        self.assertIsNone(corps["adversaire_id"])

    def test_creer_duel_sans_connexion_refuse(self):
        r = self.client.post("/duels/creer", json={"recompense": 100})
        self.assertEqual(r.status_code, 401)

    def test_rejoindre_avec_bon_code(self):
        token_a, id_a = self._inscrire("Omar")
        token_b, id_b = self._inscrire("Petra")
        duel = self.client.post("/duels/creer", json={"recompense": 100},
                                headers=self._en_tete(token_a)).json()
        r = self.client.post("/duels/rejoindre", json={"code": duel["code"]},
                             headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["statut"], "en_cours")
        self.assertEqual(r.json()["adversaire_id"], id_b)

    def test_rejoindre_code_insensible_a_la_casse(self):
        token_a, _ = self._inscrire("Quentin")
        token_b, _ = self._inscrire("Rosa")
        duel = self.client.post("/duels/creer", json={"recompense": 100},
                                headers=self._en_tete(token_a)).json()
        r = self.client.post("/duels/rejoindre", json={"code": duel["code"].lower()},
                             headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 200)

    def test_rejoindre_code_inconnu(self):
        token, _ = self._inscrire("Samir")
        r = self.client.post("/duels/rejoindre", json={"code": "ZZZZZZ"}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 404)

    def test_ne_peut_pas_rejoindre_son_propre_duel(self):
        token, _ = self._inscrire("Tina")
        duel = self.client.post("/duels/creer", json={"recompense": 100}, headers=self._en_tete(token)).json()
        r = self.client.post("/duels/rejoindre", json={"code": duel["code"]}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 400)

    def test_ne_peut_pas_rejoindre_deux_fois(self):
        token_a, _ = self._inscrire("Ugo")
        token_b, _ = self._inscrire("Vera")
        token_c, _ = self._inscrire("Walid")
        duel = self.client.post("/duels/creer", json={"recompense": 100},
                                headers=self._en_tete(token_a)).json()
        self.client.post("/duels/rejoindre", json={"code": duel["code"]}, headers=self._en_tete(token_b))
        r = self.client.post("/duels/rejoindre", json={"code": duel["code"]}, headers=self._en_tete(token_c))
        self.assertEqual(r.status_code, 404)

    # ----- Choix d'exercice -----

    def test_seul_le_challenger_choisit_le_round_1(self):
        ctx = self._duel_pret_a_jouer("Xavier", "Yasmine")
        r = self.client.post(
            f"/duels/{ctx['duel_id']}/rounds/1/choisir-exercice",
            json={"exercice": "Squat", "charge": 100},
            headers=self._en_tete(ctx["token_b"]),  # l'ADVERSAIRE tente le round 1 → refusé
        )
        self.assertEqual(r.status_code, 403)

    def test_challenger_choisit_le_round_1_avec_succes(self):
        ctx = self._duel_pret_a_jouer("Zack", "Amelie")
        r = self.client.post(
            f"/duels/{ctx['duel_id']}/rounds/1/choisir-exercice",
            json={"exercice": "Squat", "charge": 100},
            headers=self._en_tete(ctx["token_a"]),
        )
        self.assertEqual(r.status_code, 200)

    def test_seul_ladversaire_choisit_le_round_2(self):
        ctx = self._duel_pret_a_jouer("Boris", "Chloe")
        r = self.client.post(
            f"/duels/{ctx['duel_id']}/rounds/2/choisir-exercice",
            json={"exercice": "Dips", "charge": 20},
            headers=self._en_tete(ctx["token_a"]),  # le CHALLENGER tente le round 2 → refusé
        )
        self.assertEqual(r.status_code, 403)

    # ----- Soumission des reps + victoire -----

    def test_flux_complet_victoire_directe_deux_zero(self):
        ctx = self._duel_pret_a_jouer("Driss", "Elena")
        duel_id, token_a, token_b = ctx["duel_id"], ctx["token_a"], ctx["token_b"]

        # Round 1 : challenger choisit, chacun soumet ses reps (challenger gagne).
        self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(token_a))
        self.client.post(f"/duels/{duel_id}/rounds/1/mes-reps", json={"reps": 12}, headers=self._en_tete(token_a))
        r1 = self.client.post(f"/duels/{duel_id}/rounds/1/mes-reps", json={"reps": 9}, headers=self._en_tete(token_b))
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()["statut"], "en_cours")  # 1-0, pas encore gagné

        # Round 2 : adversaire choisit, challenger regagne → 2-0, duel terminé.
        self.client.post(f"/duels/{duel_id}/rounds/2/choisir-exercice",
                         json={"exercice": "Dips", "charge": 20}, headers=self._en_tete(token_b))
        self.client.post(f"/duels/{duel_id}/rounds/2/mes-reps", json={"reps": 15}, headers=self._en_tete(token_a))
        r2 = self.client.post(f"/duels/{duel_id}/rounds/2/mes-reps", json={"reps": 10}, headers=self._en_tete(token_b))
        self.assertEqual(r2.json()["statut"], "termine")
        self.assertEqual(r2.json()["gagnant_id"], ctx["id_a"])

        # Les points de récompense doivent être crédités au vainqueur.
        profil_a = self.client.get("/auth/moi", headers=self._en_tete(token_a)).json()
        self.assertEqual(profil_a["points"], 100)

    def test_departage_apres_un_partout(self):
        ctx = self._duel_pret_a_jouer("Farah", "Gustav")
        duel_id, token_a, token_b = ctx["duel_id"], ctx["token_a"], ctx["token_b"]

        # Round 1 : adversaire gagne (B > A).
        self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(token_a))
        self.client.post(f"/duels/{duel_id}/rounds/1/mes-reps", json={"reps": 8}, headers=self._en_tete(token_a))
        self.client.post(f"/duels/{duel_id}/rounds/1/mes-reps", json={"reps": 11}, headers=self._en_tete(token_b))

        # Round 2 : challenger gagne (A > B) → 1-1.
        self.client.post(f"/duels/{duel_id}/rounds/2/choisir-exercice",
                         json={"exercice": "Dips", "charge": 20}, headers=self._en_tete(token_b))
        self.client.post(f"/duels/{duel_id}/rounds/2/mes-reps", json={"reps": 15}, headers=self._en_tete(token_a))
        avant_departage = self.client.post(f"/duels/{duel_id}/rounds/2/mes-reps", json={"reps": 10},
                                           headers=self._en_tete(token_b))
        self.assertEqual(avant_departage.json()["statut"], "en_cours")

        # Départage : l'IA tire l'exercice du round 3.
        tirage = self.client.post(f"/duels/{duel_id}/rounds/3/tirer-ia", headers=self._en_tete(token_a))
        self.assertEqual(tirage.status_code, 200)
        round_3 = next(r for r in tirage.json()["rounds"] if r["numero"] == 3)
        self.assertIsNotNone(round_3["exercice"])

        # Chacun soumet ses reps du départage.
        self.client.post(f"/duels/{duel_id}/rounds/3/mes-reps", json={"reps": 9}, headers=self._en_tete(token_a))
        final = self.client.post(f"/duels/{duel_id}/rounds/3/mes-reps", json={"reps": 14},
                                 headers=self._en_tete(token_b))
        self.assertEqual(final.json()["statut"], "termine")
        self.assertEqual(final.json()["gagnant_id"], ctx["id_b"])

    def test_ne_peut_pas_tirer_lia_avant_les_rounds_1_et_2(self):
        ctx = self._duel_pret_a_jouer("Hana", "Idris")
        r = self.client.post(f"/duels/{ctx['duel_id']}/rounds/3/tirer-ia", headers=self._en_tete(ctx["token_a"]))
        self.assertEqual(r.status_code, 400)

    def test_un_spectateur_ne_peut_pas_soumettre_de_reps(self):
        ctx = self._duel_pret_a_jouer("Joon", "Karla")
        token_spectateur, _ = self._inscrire("Liam")
        self.client.post(f"/duels/{ctx['duel_id']}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(ctx["token_a"]))
        r = self.client.post(f"/duels/{ctx['duel_id']}/rounds/1/mes-reps", json={"reps": 10},
                             headers=self._en_tete(token_spectateur))
        self.assertEqual(r.status_code, 403)

    def test_egalite_de_reps_ne_termine_pas_le_round(self):
        ctx = self._duel_pret_a_jouer("Mona", "Nils")
        duel_id, token_a, token_b = ctx["duel_id"], ctx["token_a"], ctx["token_b"]
        self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(token_a))
        self.client.post(f"/duels/{duel_id}/rounds/1/mes-reps", json={"reps": 10}, headers=self._en_tete(token_a))
        r = self.client.post(f"/duels/{duel_id}/rounds/1/mes-reps", json={"reps": 10}, headers=self._en_tete(token_b))
        self.assertEqual(r.json()["statut"], "en_cours")  # égalité : personne ne marque

        # Rejouable : le challenger peut re-choisir l'exercice du round 1.
        rejeu = self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                                 json={"exercice": "Dips", "charge": 20}, headers=self._en_tete(token_a))
        self.assertEqual(rejeu.status_code, 200)

    # ----- Statut en direct (chrono de série) -----

    def test_commencer_enregistre_mon_horodatage(self):
        ctx = self._duel_pret_a_jouer("Odile", "Paul")
        duel_id, token_a, token_b = ctx["duel_id"], ctx["token_a"], ctx["token_b"]
        self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(token_a))
        r = self.client.post(f"/duels/{duel_id}/rounds/1/commencer", headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 200)
        round_1 = next(rd for rd in r.json()["rounds"] if rd["numero"] == 1)
        self.assertIsNotNone(round_1["adversaire_debut"])
        self.assertIsNone(round_1["challenger_debut"])

    def test_commencer_avant_le_choix_de_lexercice_refuse(self):
        ctx = self._duel_pret_a_jouer("Quitterie", "Remi")
        r = self.client.post(f"/duels/{ctx['duel_id']}/rounds/1/commencer", headers=self._en_tete(ctx["token_a"]))
        self.assertEqual(r.status_code, 400)

    def test_commencer_ne_change_pas_le_resultat_du_round(self):
        # "Commencer" est juste un statut d'affichage — ne doit jamais, à lui
        # seul, faire gagner ni terminer un round ou un duel.
        ctx = self._duel_pret_a_jouer("Sami", "Tara")
        duel_id, token_a, token_b = ctx["duel_id"], ctx["token_a"], ctx["token_b"]
        self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(token_a))
        self.client.post(f"/duels/{duel_id}/rounds/1/commencer", headers=self._en_tete(token_a))
        r = self.client.post(f"/duels/{duel_id}/rounds/1/commencer", headers=self._en_tete(token_b))
        self.assertEqual(r.json()["statut"], "en_cours")
        round_1 = next(rd for rd in r.json()["rounds"] if rd["numero"] == 1)
        self.assertIsNone(round_1["reps_challenger"])
        self.assertIsNone(round_1["reps_adversaire"])

    def test_un_spectateur_ne_peut_pas_commencer(self):
        ctx = self._duel_pret_a_jouer("Ugo2", "Vera2")
        token_spectateur, _ = self._inscrire("Wassim")
        self.client.post(f"/duels/{ctx['duel_id']}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(ctx["token_a"]))
        r = self.client.post(f"/duels/{ctx['duel_id']}/rounds/1/commencer", headers=self._en_tete(token_spectateur))
        self.assertEqual(r.status_code, 403)

    def test_rejouer_le_round_remet_les_chronos_a_zero(self):
        ctx = self._duel_pret_a_jouer("Xena", "Yanis")
        duel_id, token_a = ctx["duel_id"], ctx["token_a"]
        self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                         json={"exercice": "Squat", "charge": 100}, headers=self._en_tete(token_a))
        self.client.post(f"/duels/{duel_id}/rounds/1/commencer", headers=self._en_tete(token_a))
        # Le challenger re-choisit l'exercice (rejoue le round) -> le chrono repart à zéro.
        r = self.client.post(f"/duels/{duel_id}/rounds/1/choisir-exercice",
                             json={"exercice": "Dips", "charge": 20}, headers=self._en_tete(token_a))
        round_1 = next(rd for rd in r.json()["rounds"] if rd["numero"] == 1)
        self.assertIsNone(round_1["challenger_debut"])


if __name__ == "__main__":
    unittest.main()
