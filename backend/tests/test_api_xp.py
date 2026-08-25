"""Tests de l'XP — la jauge d'ACTIVITÉ (séances, défis, duels gagnés).

Vérifie surtout LA RÈGLE FONDATRICE : l'XP ne change ni la ligue, ni le
classement (ceux-là restent sur les perfs vérifiées uniquement).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_xp_fitness_royale.db"


class TestAPIXP(unittest.TestCase):
    # Voir le commentaire dans test_api_auth.py sur la redirection de db.CHEMIN_DB.
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

    def test_un_nouveau_joueur_a_zero_xp(self):
        _, joueur_id = self._inscrire("XPZero")
        r = self.client.get(f"/joueurs/{joueur_id}/xp")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["total"], 0)

    def test_une_seance_donne_20_xp(self):
        token, joueur_id = self._inscrire("XPSeance")
        self.client.post(f"/joueurs/{joueur_id}/seances", json={"minutes": 45, "date": "2026-08-10"},
                         headers=self._en_tete(token))
        corps = self.client.get(f"/joueurs/{joueur_id}/xp").json()
        self.assertEqual(corps["total"], 20)
        self.assertEqual(corps["sources"]["seances"]["nombre"], 1)

    def test_deux_traces_le_meme_jour_ne_comptent_qu_une_fois(self):
        # Une séance déclarée ET un entraînement loggé le même jour = 1 journée.
        token, joueur_id = self._inscrire("XPMemeJour")
        self.client.post(f"/joueurs/{joueur_id}/seances", json={"minutes": 60, "date": "2026-08-10"},
                         headers=self._en_tete(token))
        self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "date": "2026-08-10",
            "series": [{"exercice": "Squat", "numero_serie": 1, "reps": 8, "poids": 100}],
        }, headers=self._en_tete(token))
        corps = self.client.get(f"/joueurs/{joueur_id}/xp").json()
        self.assertEqual(corps["sources"]["seances"]["nombre"], 1)
        self.assertEqual(corps["total"], 20)

    def test_deux_jours_differents_comptent_deux_fois(self):
        token, joueur_id = self._inscrire("XPDeuxJours")
        for jour in ("2026-08-10", "2026-08-11"):
            self.client.post(f"/joueurs/{joueur_id}/seances", json={"minutes": 45, "date": jour},
                             headers=self._en_tete(token))
        self.assertEqual(self.client.get(f"/joueurs/{joueur_id}/xp").json()["total"], 40)

    def test_l_xp_apparait_dans_le_profil(self):
        token, joueur_id = self._inscrire("XPProfil")
        self.client.post(f"/joueurs/{joueur_id}/seances", json={"minutes": 30, "date": "2026-08-10"},
                         headers=self._en_tete(token))
        profil = self.client.get("/auth/moi", headers=self._en_tete(token)).json()
        self.assertEqual(profil["xp"], 20)

    def test_l_xp_ne_change_ni_la_ligue_ni_le_classement(self):
        """RÈGLE FONDATRICE : seules les perfs vérifiées font monter."""
        token_actif, id_actif = self._inscrire("TresActif")
        token_fort, id_fort = self._inscrire("TresFort")

        # L'actif s'entraîne 10 jours mais ne fait vérifier aucune perf.
        for j in range(1, 11):
            self.client.post(f"/joueurs/{id_actif}/seances",
                             json={"minutes": 60, "date": f"2026-08-{j:02d}"},
                             headers=self._en_tete(token_actif))

        # Le fort ne logge aucune séance mais a des perfs VÉRIFIÉES.
        # Il en faut plusieurs : la moyenne se calcule sur les 15 exercices du
        # barème (voir "polyvalence récompensée"), donc 1 perf ne suffit pas.
        perfs_bronze = {
            "Développé couché": 70, "Développé incliné": 65, "Développé décliné": 80,
            "Traction prise large": 10, "Soulevé de terre": 120, "Rowing planche": 60,
            "Développé avec haltères": 20, "Curl barre": 30,
        }
        for exercice, valeur in perfs_bronze.items():
            self.client.post(f"/joueurs/{id_fort}/performances",
                             json={"exercice": exercice, "valeur": valeur},
                             headers=self._en_tete(token_fort))
            self.client.post(f"/joueurs/{id_fort}/performances/{exercice}/verifier",
                             json={"statut": "salle"}, headers=self._en_tete(token_fort))

        xp_actif = self.client.get(f"/joueurs/{id_actif}/xp").json()["total"]
        xp_fort = self.client.get(f"/joueurs/{id_fort}/xp").json()["total"]
        self.assertEqual(xp_actif, 200)   # 10 jours x 20
        self.assertEqual(xp_fort, 0)

        # …et pourtant c'est le FORT qui a une ligue, pas l'actif.
        actif = self.client.get(f"/joueurs/{id_actif}").json()
        fort = self.client.get(f"/joueurs/{id_fort}").json()
        self.assertEqual(actif["ligue"], "Aucune")
        self.assertNotEqual(fort["ligue"], "Aucune")

    def test_xp_dun_joueur_inconnu(self):
        self.assertEqual(self.client.get("/joueurs/999999/xp").status_code, 404)


if __name__ == "__main__":
    unittest.main()
