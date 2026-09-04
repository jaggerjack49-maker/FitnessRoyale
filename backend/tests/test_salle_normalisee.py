"""La SALLE est un identifiant de clan : sa comparaison doit être normalisée.

Avant le 04/09/2026, la salle était comparée telle quelle. « Iron Temple »,
« iron temple » et « Iron Temple » (espace final) formaient donc TROIS clans
distincts : deux membres de la même salle ne se voyaient ni au classement par
salle, ni dans le chat.

`cle_salle()` est le portage exact de `cleSalle()` (src/logic/classement.js) —
les deux doivent rester d'accord.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from app.logique import cle_salle, classer_salles, nom_salle_affiche
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_salle_normalisee_fitness_royale.db"


def joueur(pseudo, salle):
    """Un joueur minimal : seul le regroupement par salle nous intéresse ici."""
    return {"pseudo": pseudo, "salle": salle, "sexe": "homme", "poids": 80,
            "points": 0, "performances": {}}


class TestCleSalle(unittest.TestCase):
    def test_casse_et_espaces_donnent_la_meme_cle(self):
        attendu = "iron temple"
        for ecriture in ("Iron Temple", "iron temple", "  Iron Temple  ",
                         "IRON  TEMPLE", "Iron Temple\t"):
            self.assertEqual(cle_salle(ecriture), attendu, ecriture)

    def test_les_accents_sont_conserves(self):
        """Choix volontaire : deux noms qui ne diffèrent que par un accent sont
        bien plus souvent DIFFÉRENTS que le même nom mal orthographié."""
        self.assertNotEqual(cle_salle("Élite"), cle_salle("Elite"))

    def test_vide_et_none_ne_font_pas_de_clan(self):
        self.assertEqual(cle_salle(None), "")
        self.assertEqual(cle_salle("   "), "")

    def test_l_affichage_garde_la_casse_saisie(self):
        self.assertEqual(nom_salle_affiche("  Iron   Temple "), "Iron Temple")

    def test_le_classement_regroupe_les_ecritures_differentes(self):
        classement = classer_salles([
            joueur("A", "Iron Temple"),
            joueur("B", "iron temple"),
            joueur("C", "  IRON TEMPLE  "),
            joueur("D", "Other Gym"),
        ])
        salles = {s["salle"]: s["nb_membres"] for s in classement}
        self.assertEqual(salles, {"Iron Temple": 3, "Other Gym": 1})

    def test_une_salle_vide_n_apparait_pas_au_classement(self):
        classement = classer_salles([joueur("A", None), joueur("B", "   ")])
        self.assertEqual(classement, [])


class TestChatClanNormalise(unittest.TestCase):
    # Voir test_api_auth.py : redirection de db.CHEMIN_DB dans setUpClass.
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

    def _inscrire(self, pseudo, salle):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": "homme", "poids": 80, "salle": salle,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]

    def test_deux_ecritures_partagent_le_meme_chat(self):
        h1, _ = self._inscrire("MembreMajuscules", "Titan Gym")
        h2, _ = self._inscrire("MembreMinuscules", "titan gym")

        envoi = self.client.post("/clans/Titan Gym/messages",
                                 json={"texte": "Salut le clan"}, headers=h1)
        self.assertEqual(envoi.status_code, 201)

        # L'autre membre lit le MÊME chat, avec son orthographe à lui.
        messages = self.client.get("/clans/titan gym/messages", headers=h2)
        self.assertEqual(messages.status_code, 200)
        self.assertEqual([m["texte"] for m in messages.json()], ["Salut le clan"])

    def test_un_membre_d_une_autre_salle_reste_refuse(self):
        """La normalisation ne doit pas ouvrir le chat à tout le monde."""
        self._inscrire("MembreIci", "Salle A")
        h_autre, _ = self._inscrire("MembreAilleurs", "Salle B")
        r = self.client.get("/clans/Salle A/messages", headers=h_autre)
        self.assertEqual(r.status_code, 403)

    def test_les_espaces_parasites_sont_nettoyes_a_l_inscription(self):
        _, joueur_cree = self._inscrire("EspacesInscription", "  Espace Gym  ")
        self.assertEqual(joueur_cree["salle"], "Espace Gym")

    def test_les_espaces_parasites_sont_nettoyes_au_changement(self):
        h, joueur_cree = self._inscrire("EspacesChangement", "Ancienne")
        r = self.client.put(f"/joueurs/{joueur_cree['id']}/salle",
                            json={"salle": "   Nouvelle   Salle  "}, headers=h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["salle"], "Nouvelle Salle")

    def test_changer_la_casse_de_sa_salle_ne_perd_pas_le_chat(self):
        """Le cas le plus vicieux : réécrire sa salle autrement laissait les
        anciens messages inaccessibles, sous l'ancienne chaîne."""
        h, joueur_cree = self._inscrire("CasseChangee", "Gym Historique")
        self.client.post("/clans/Gym Historique/messages",
                         json={"texte": "Message d'avant"}, headers=h)

        self.client.put(f"/joueurs/{joueur_cree['id']}/salle",
                        json={"salle": "GYM HISTORIQUE"}, headers=h)

        messages = self.client.get("/clans/GYM HISTORIQUE/messages", headers=h)
        self.assertEqual(messages.status_code, 200)
        self.assertEqual([m["texte"] for m in messages.json()], ["Message d'avant"])


if __name__ == "__main__":
    unittest.main()
