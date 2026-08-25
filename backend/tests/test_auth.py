"""Tests de l'authentification — lancer avec :  python -m unittest discover tests

Les tests de hachage/propriétaire sont des fonctions pures (pas de base de
données). Les tests de sessions ont besoin de la base : on redirige
temporairement app.basededonnees.CHEMIN_DB vers un fichier de test, pour ne
JAMAIS toucher à la vraie base de développement (fitness_royale.db).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import HTTPException

from app import auth
from app import basededonnees as db


class TestHachageMotDePasse(unittest.TestCase):
    def test_bon_mot_de_passe_verifie(self):
        hash_ = auth.hacher_mot_de_passe("motdepasse123")
        self.assertTrue(auth.verifier_mot_de_passe("motdepasse123", hash_))

    def test_mauvais_mot_de_passe_refuse(self):
        hash_ = auth.hacher_mot_de_passe("motdepasse123")
        self.assertFalse(auth.verifier_mot_de_passe("autrechose", hash_))

    def test_deux_hash_du_meme_mot_de_passe_sont_differents(self):
        # Le sel est aléatoire à chaque hachage : deux hash du même mot de
        # passe ne doivent JAMAIS être identiques (sinon deux comptes avec le
        # même mot de passe auraient le même hash, ce qui facilite les attaques).
        hash_1 = auth.hacher_mot_de_passe("motdepasse123")
        hash_2 = auth.hacher_mot_de_passe("motdepasse123")
        self.assertNotEqual(hash_1, hash_2)
        self.assertTrue(auth.verifier_mot_de_passe("motdepasse123", hash_1))
        self.assertTrue(auth.verifier_mot_de_passe("motdepasse123", hash_2))

    def test_hash_vide_ou_invalide_refuse(self):
        self.assertFalse(auth.verifier_mot_de_passe("motdepasse123", None))
        self.assertFalse(auth.verifier_mot_de_passe("motdepasse123", ""))
        self.assertFalse(auth.verifier_mot_de_passe("motdepasse123", "pas_de_dollar_dedans"))


class TestVerifierProprietaire(unittest.TestCase):
    def test_proprietaire_ok(self):
        auth.verifier_proprietaire({"id": 5}, 5)  # ne doit rien lever

    def test_pas_proprietaire_refuse(self):
        with self.assertRaises(HTTPException) as ctx:
            auth.verifier_proprietaire({"id": 5}, 6)
        self.assertEqual(ctx.exception.status_code, 403)


class TestSessions(unittest.TestCase):
    """Ces tests touchent la base — on utilise un fichier temporaire dédié."""

    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        cls.fichier_temp = Path(tempfile.gettempdir()) / "test_auth_fitness_royale.db"
        if cls.fichier_temp.exists():
            cls.fichier_temp.unlink()
        db.CHEMIN_DB = cls.fichier_temp
        db.initialiser()

    @classmethod
    def tearDownClass(cls):
        db.CHEMIN_DB = cls.chemin_original
        if cls.fichier_temp.exists():
            cls.fichier_temp.unlink()

    def test_creer_session_et_retrouver_le_joueur(self):
        joueur_id = db.creer_joueur("TestSessionUser", "homme", 80, None,
                                    auth.hacher_mot_de_passe("secret123"))
        token = auth.creer_session_pour(joueur_id)
        self.assertEqual(db.joueur_id_pour_token(token), joueur_id)

    def test_token_inconnu_ne_retrouve_personne(self):
        self.assertIsNone(db.joueur_id_pour_token("token-qui-nexiste-pas"))

    def test_deconnexion_invalide_le_token(self):
        joueur_id = db.creer_joueur("TestDeconnexion", "femme", 60, None,
                                    auth.hacher_mot_de_passe("secret123"))
        token = auth.creer_session_pour(joueur_id)
        db.supprimer_session(token)
        self.assertIsNone(db.joueur_id_pour_token(token))

    def test_lire_joueur_ne_renvoie_jamais_le_hash(self):
        joueur_id = db.creer_joueur("TestSansHash", "homme", 75, None,
                                    auth.hacher_mot_de_passe("secret123"))
        joueur = db.lire_joueur(joueur_id)
        self.assertNotIn("mot_de_passe_hash", joueur)

    def test_lire_joueur_par_pseudo_renvoie_le_hash_pour_la_connexion(self):
        hash_attendu = auth.hacher_mot_de_passe("secret123")
        db.creer_joueur("TestAvecHash", "homme", 75, None, hash_attendu)
        joueur = db.lire_joueur_par_pseudo("TestAvecHash")
        self.assertEqual(joueur["mot_de_passe_hash"], hash_attendu)

    def test_joueur_de_demo_sans_mot_de_passe_na_pas_de_hash(self):
        joueur_id = db.creer_joueur("TestDemoSansMdp", "homme", 75, "Club SP")
        joueur = db.lire_joueur_par_pseudo("TestDemoSansMdp")
        self.assertIsNone(joueur["mot_de_passe_hash"])
        self.assertFalse(auth.verifier_mot_de_passe("nimporte_quoi", joueur["mot_de_passe_hash"]))


if __name__ == "__main__":
    unittest.main()
