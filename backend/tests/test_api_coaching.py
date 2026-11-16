"""Les demandes de coaching venues du SITE WEB (`site/`).

Ce qui est vérifié ici, et pourquoi :
- la route de DÉPÔT est volontairement ouverte sans connexion (la personne
  qui demande un coaching n'a pas encore de compte) — mais elle valide tout ;
- la LECTURE est réservée à l'admin : une demande porte le contact, l'âge et
  le poids de quelqu'un de réel. C'est l'asymétrie « écriture verrouillée,
  lecture ouverte » trouvée par l'audit du 06/09/2026, qu'on ne refait pas ;
- le garde-fou anti-doublon compare les contacts de façon NORMALISÉE : une
  majuscule ou un espace ne doit pas permettre de le contourner (c'est le
  même motif que le nom d'exercice, la salle et le pseudo).
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_coaching_fitness_royale.db"

# Une demande complète et valide, recopiée puis retouchée par chaque test.
DEMANDE = {
    "prenom": "Karim",
    "contact": "karim@exemple.fr",
    "objectif": "prise_de_masse",
    "niveau": "intermediaire",
    "jours_par_semaine": 4,
    "materiel": "salle_complete",
    "formule": "suivi",
    "age": 28,
    "poids": 78.5,
    "taille": 180,
    "limitations": "Épaule droite sensible",
    "message": "Je veux gagner en masse sans perdre mes abdos.",
}


class TestApiCoaching(unittest.TestCase):
    # Voir test_api_auth.py : redirection de db.CHEMIN_DB dans setUpClass.
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app)
        cls.client.__enter__()
        cls.h_admin = cls._inscrire("PatronCoach", admin=True)
        cls.h_joueur = cls._inscrire("JoueurOrdinaire")

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    @classmethod
    def _inscrire(cls, pseudo, admin=False):
        r = cls.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": "homme", "poids": 80,
        })
        joueur_id = r.json()["joueur"]["id"]
        if admin:
            # Le drapeau admin ne s'obtient QUE à la main en base, jamais par
            # l'API — exactement comme le fait Hafiz en production.
            with db.connexion() as conn:
                conn.execute("UPDATE joueurs SET admin = 1 WHERE id = ?", (joueur_id,))
        return {"Authorization": f"Bearer {r.json()['token']}"}

    def setUp(self):
        # Chaque test repart d'une table vide : le garde-fou des 24 h ferait
        # sinon échouer le deuxième test qui réutilise le même contact.
        with db.connexion() as conn:
            conn.execute("DELETE FROM demandes_coaching")

    def _envoyer(self, **retouches):
        return self.client.post("/coaching/demandes", json={**DEMANDE, **retouches})

    def _demandes(self):
        r = self.client.get("/admin/coaching/demandes", headers=self.h_admin)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    # ---------------- le dépôt depuis le site ----------------

    def test_une_demande_valide_est_enregistree_sans_connexion(self):
        r = self._envoyer()
        self.assertEqual(r.status_code, 201, r.text)
        self.assertIn("id", r.json())

        demandes = self._demandes()
        self.assertEqual(len(demandes), 1)
        recue = demandes[0]
        self.assertEqual(recue["prenom"], "Karim")
        self.assertEqual(recue["contact"], "karim@exemple.fr")
        self.assertEqual(recue["objectif"], "prise_de_masse")
        self.assertEqual(recue["jours_par_semaine"], 4)
        self.assertEqual(recue["age"], 28)
        self.assertAlmostEqual(recue["poids"], 78.5)
        self.assertEqual(recue["limitations"], "Épaule droite sensible")
        self.assertEqual(recue["statut"], "nouvelle", "une demande arrive « nouvelle »")
        self.assertTrue(recue["cree_le"], "une demande est horodatée")

    def test_les_champs_facultatifs_peuvent_etre_absents(self):
        r = self.client.post("/coaching/demandes", json={
            "prenom": "Lina", "contact": "0612345678",
            "objectif": "force", "niveau": "debutant",
            "jours_par_semaine": 3, "materiel": "poids_du_corps",
        })
        self.assertEqual(r.status_code, 201, r.text)
        recue = self._demandes()[0]
        for vide in ("formule", "age", "poids", "taille", "limitations", "message"):
            self.assertIsNone(recue[vide], f"{vide} devrait rester vide")

    def test_un_champ_laisse_blanc_vaut_rien_du_tout(self):
        self._envoyer(limitations="   ", message="")
        recue = self._demandes()[0]
        self.assertIsNone(recue["limitations"])
        self.assertIsNone(recue["message"])

    def test_un_champ_obligatoire_manquant_est_refuse(self):
        for manquant in ("prenom", "contact", "objectif", "niveau",
                         "jours_par_semaine", "materiel"):
            corps = {**DEMANDE}
            del corps[manquant]
            r = self.client.post("/coaching/demandes", json=corps)
            self.assertEqual(r.status_code, 422, f"{manquant} : {r.text}")
        self.assertEqual(self._demandes(), [])

    def test_une_valeur_hors_liste_est_refusee(self):
        for champ, valeur in (("objectif", "devenir_riche"),
                              ("niveau", "dieu"),
                              ("materiel", "une_pierre"),
                              ("formule", "gratuit_a_vie")):
            r = self._envoyer(**{champ: valeur})
            self.assertEqual(r.status_code, 400, f"{champ} : {r.text}")
        self.assertEqual(self._demandes(), [], "rien ne doit être enregistré")

    def test_des_valeurs_absurdes_sont_refusees(self):
        for champ, valeur in (("jours_par_semaine", 0), ("jours_par_semaine", 8),
                              ("age", 4), ("poids", 5), ("taille", 30),
                              ("prenom", "X")):
            r = self._envoyer(**{champ: valeur})
            self.assertEqual(r.status_code, 422, f"{champ}={valeur} : {r.text}")

    def test_le_champ_piege_fait_refuser_sans_rien_enregistrer(self):
        r = self._envoyer(piege="http://pilules-pas-cheres.example")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._demandes(), [],
                         "une demande piégée ne doit jamais atteindre la base")

    def test_le_piege_vide_ne_gene_personne(self):
        # Un humain envoie le champ caché VIDE : ça doit passer normalement.
        self.assertEqual(self._envoyer(piege="").status_code, 201)

    # ---------------- le garde-fou anti-doublon ----------------

    def test_deux_demandes_du_meme_contact_coup_sur_coup(self):
        self.assertEqual(self._envoyer().status_code, 201)
        r = self._envoyer()
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(len(self._demandes()), 1)

    def test_la_casse_et_les_espaces_ne_contournent_pas_le_garde_fou(self):
        self.assertEqual(self._envoyer(contact="jean@mail.com").status_code, 201)
        for deguisement in ("  jean@mail.com", "JEAN@MAIL.COM", " Jean@Mail.Com  "):
            r = self._envoyer(contact=deguisement)
            self.assertEqual(r.status_code, 409,
                             f"« {deguisement} » est le même contact : {r.text}")
        self.assertEqual(len(self._demandes()), 1)

    def test_un_autre_contact_passe_normalement(self):
        self.assertEqual(self._envoyer(contact="un@mail.com").status_code, 201)
        self.assertEqual(self._envoyer(contact="autre@mail.com").status_code, 201)
        self.assertEqual(len(self._demandes()), 2)

    # ---------------- la lecture est RÉSERVÉE À L'ADMIN ----------------

    def test_personne_d_autre_ne_peut_lire_les_demandes(self):
        self._envoyer()
        self.assertEqual(
            self.client.get("/admin/coaching/demandes").status_code, 401,
            "sans connexion : 401")
        self.assertEqual(
            self.client.get("/admin/coaching/demandes",
                            headers=self.h_joueur).status_code, 403,
            "un compte ordinaire ne lit pas les coordonnées des demandeurs")

    def test_personne_d_autre_ne_peut_changer_un_statut(self):
        identifiant = self._envoyer().json()["id"]
        chemin = f"/admin/coaching/demandes/{identifiant}/statut"
        self.assertEqual(
            self.client.put(chemin, json={"statut": "acceptee"}).status_code, 401)
        self.assertEqual(
            self.client.put(chemin, json={"statut": "acceptee"},
                            headers=self.h_joueur).status_code, 403)
        self.assertEqual(self._demandes()[0]["statut"], "nouvelle")

    # ---------------- le suivi d'une demande ----------------

    def test_l_admin_fait_avancer_une_demande(self):
        identifiant = self._envoyer().json()["id"]
        for statut in ("en_cours", "acceptee", "refusee"):
            r = self.client.put(f"/admin/coaching/demandes/{identifiant}/statut",
                                json={"statut": statut}, headers=self.h_admin)
            self.assertEqual(r.status_code, 200, r.text)
            self.assertEqual(self._demandes()[0]["statut"], statut)

    def test_un_statut_inconnu_ou_une_demande_absente_sont_refuses(self):
        identifiant = self._envoyer().json()["id"]
        r = self.client.put(f"/admin/coaching/demandes/{identifiant}/statut",
                            json={"statut": "peut_etre"}, headers=self.h_admin)
        self.assertEqual(r.status_code, 400, r.text)
        r = self.client.put("/admin/coaching/demandes/999999/statut",
                            json={"statut": "acceptee"}, headers=self.h_admin)
        self.assertEqual(r.status_code, 404, r.text)

    def test_les_demandes_sortent_de_la_plus_recente_a_la_plus_ancienne(self):
        for n in range(3):
            self._envoyer(prenom=f"Joueur{n}", contact=f"p{n}@mail.com")
        prenoms = [d["prenom"] for d in self._demandes()]
        self.assertEqual(prenoms, ["Joueur2", "Joueur1", "Joueur0"])

    def test_le_cout_de_la_lecture_ne_depend_pas_du_nombre_de_demandes(self):
        """Une connexion, qu'il y ait 1 demande ou 30.

        Le piège payé deux fois par ce projet (25/08 et 23/09/2026) : une
        boucle qui rappelle une fonction de basededonnees.py coûte un
        aller-retour réseau par tour vers la base distante.
        """
        vraie = db.connexion
        emprunts = []

        def comptee(*args, **kwargs):
            emprunts.append(1)
            return vraie(*args, **kwargs)

        self._envoyer()
        try:
            db.connexion = comptee
            emprunts.clear()
            db.demandes_coaching()
            cout_une = len(emprunts)
        finally:
            db.connexion = vraie

        for n in range(30):
            db.creer_demande_coaching("2026-11-15T10:00:00.000",
                                      {**DEMANDE, "contact": f"lot{n}@mail.com"})
        try:
            db.connexion = comptee
            emprunts.clear()
            db.demandes_coaching()
            cout_trente = len(emprunts)
        finally:
            db.connexion = vraie

        self.assertEqual(cout_une, cout_trente,
                         f"{cout_une} connexion(s) pour 1 demande, "
                         f"{cout_trente} pour 31 : le coût grandit avec les données")
        self.assertEqual(len(self._demandes()), 31)


if __name__ == "__main__":
    unittest.main()
