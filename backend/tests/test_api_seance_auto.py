"""Logger un entraînement enregistre la séance du jour — et donc les défis.

Demande de Hafiz du 24/09/2026 : « les défis doivent se valider
automatiquement lorsqu'ils sont atteints » et « le comptabilisateur de séance
au niveau du profil ne fonctionne pas ».

LES DEUX AVAIENT LA MÊME CAUSE : les séances n'existaient QUE dans l'état React
de l'app (un tableau de minutes, remis à zéro à chaque connexion, jamais envoyé
au serveur). Le compteur du Profil repartait donc à zéro, et les défis — qui,
eux, se basent sur les séances DU SERVEUR — n'étaient jamais réussis, quoi que
le joueur fasse.

Maintenant, enregistrer un entraînement enregistre la séance du jour côté
serveur. Une seule écriture, au seul endroit où une séance peut naître.
"""

import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from app import seances as regles_seances
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_seance_auto_fitness_royale.db"


class TestSeanceAutomatique(unittest.TestCase):
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

    def _inscrire(self, pseudo):
        reponse = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse", "sexe": "homme", "poids": 80,
        })
        self.assertEqual(reponse.status_code, 201, reponse.text)
        corps = reponse.json()
        return {"Authorization": f"Bearer {corps['token']}"}, corps["joueur"]["id"]

    def _logger(self, entete, joueur_id, jour, nb_series):
        return self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "programme_id": None, "date": jour,
            "series": [{"exercice": "Squat", "numero_serie": n + 1, "reps": 8, "poids": 100}
                       for n in range(nb_series)],
        }, headers=entete)

    # ---- LE CŒUR : la séance naît avec l'entraînement ----
    def test_logger_un_entrainement_cree_la_seance_du_jour(self):
        entete, joueur_id = self._inscrire("SeanceAuto1")
        avant = self.client.get(f"/joueurs/{joueur_id}/seances", headers=entete).json()
        self.assertEqual(avant, [])
        self._logger(entete, joueur_id, "2026-09-21", 12)
        apres = self.client.get(f"/joueurs/{joueur_id}/seances", headers=entete).json()
        self.assertEqual(len(apres), 1)
        self.assertEqual(apres[0]["date"], "2026-09-21")
        self.assertEqual(apres[0]["minutes"], regles_seances.duree_estimee(12))

    def test_deux_entrainements_le_meme_jour_font_UNE_seance(self):
        """Sinon on validerait « 4 séances cette semaine » en une seule journée."""
        entete, joueur_id = self._inscrire("SeanceAuto2")
        self._logger(entete, joueur_id, "2026-09-21", 10)
        self._logger(entete, joueur_id, "2026-09-21", 4)
        seances = self.client.get(f"/joueurs/{joueur_id}/seances", headers=entete).json()
        self.assertEqual(len(seances), 1, "un jour = une séance")
        self.assertEqual(
            seances[0]["minutes"],
            regles_seances.duree_estimee(10) + regles_seances.duree_estimee(4),
            "les minutes des deux entraînements s'additionnent",
        )

    def test_des_jours_differents_font_des_seances_differentes(self):
        entete, joueur_id = self._inscrire("SeanceAuto3")
        self._logger(entete, joueur_id, "2026-09-21", 10)
        self._logger(entete, joueur_id, "2026-09-22", 10)
        seances = self.client.get(f"/joueurs/{joueur_id}/seances", headers=entete).json()
        self.assertEqual(len(seances), 2)

    # ---- CE QUE ÇA DÉBLOQUE : les défis deviennent atteignables ----
    def test_le_defi_du_jour_devient_reussi_apres_un_entrainement(self):
        entete, joueur_id = self._inscrire("SeanceAuto4")
        avant = self.client.get(f"/joueurs/{joueur_id}/defis", headers=entete).json()
        self.assertFalse([d for d in avant if d["id"] == "jour"][0]["reussi"])
        # 12 séries → 36 min estimées, au-dessus des 30 min demandées.
        self._logger(entete, joueur_id, date.today().isoformat(), 12)
        apres = self.client.get(f"/joueurs/{joueur_id}/defis", headers=entete).json()
        defi_jour = [d for d in apres if d["id"] == "jour"][0]
        self.assertTrue(defi_jour["reussi"], "s'être entraîné aujourd'hui doit suffire")
        self.assertFalse(defi_jour["deja_valide"], "réussi n'est pas validé : l'app s'en charge")

    def test_le_defi_de_la_semaine_demande_bien_QUATRE_jours(self):
        entete, joueur_id = self._inscrire("SeanceAuto5")
        aujourdhui = date.today()
        for jours_avant in (0, 1, 2):
            self._logger(entete, joueur_id, (aujourdhui - timedelta(days=jours_avant)).isoformat(), 10)
        etat = self.client.get(f"/joueurs/{joueur_id}/defis", headers=entete).json()
        semaine = [d for d in etat if d["id"] == "semaine"][0]
        # Trois jours de la semaine EN COURS au plus (selon le jour où le test
        # tourne) : le défi ne peut pas être réussi avec moins de quatre.
        self.assertFalse(semaine["reussi"])

    def test_la_validation_donne_les_points_et_ne_marche_qu_une_fois(self):
        entete, joueur_id = self._inscrire("SeanceAuto6")
        self._logger(entete, joueur_id, date.today().isoformat(), 12)
        premiere = self.client.post(f"/joueurs/{joueur_id}/defis/jour/valider", headers=entete)
        self.assertEqual(premiere.status_code, 200, premiere.text)
        self.assertEqual(premiere.json()["points"], 20)
        seconde = self.client.post(f"/joueurs/{joueur_id}/defis/jour/valider", headers=entete)
        self.assertEqual(seconde.status_code, 409, "déjà validé aujourd'hui")
        profil = self.client.get("/auth/moi", headers=entete).json()
        self.assertEqual(profil["points"], 20)

    # ---- L'estimation elle-même ----
    def test_la_duree_estimee(self):
        self.assertEqual(regles_seances.duree_estimee(1), 20, "minimum 20 minutes")
        self.assertEqual(regles_seances.duree_estimee(12), 36, "3 minutes par série")
        self.assertEqual(regles_seances.duree_estimee(0), 0)
        self.assertEqual(regles_seances.duree_estimee(None), 0, "jamais de plantage")

    def test_logger_un_entrainement_ne_touche_pas_aux_performances(self):
        """Garde-fou historique : l'entraînement est indépendant du barème."""
        entete, joueur_id = self._inscrire("SeanceAuto7")
        self._logger(entete, joueur_id, "2026-09-21", 5)
        profil = self.client.get("/auth/moi", headers=entete).json()
        self.assertEqual(profil["performances"], {})


if __name__ == "__main__":
    unittest.main()
