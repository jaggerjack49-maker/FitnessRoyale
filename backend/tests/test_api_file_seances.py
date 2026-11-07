"""Une séance terminée finit TOUJOURS par arriver au serveur — une seule fois.

Retour de Hafiz du 08/11/2026, capture à l'appui : « 14 séances gardées sur ce
téléphone — elles partiront au retour du réseau », alors que le réseau allait
très bien. Les séances ne partaient jamais.

LA CAUSE, reproduite avant d'écrire une ligne de correctif : une séance qui
attend dans la file du téléphone pointe vers son programme. Si ce programme a
été SUPPRIMÉ entre-temps, le serveur refusait la séance (erreur 500, clé
étrangère) — à chaque renvoi, pour toujours. Et l'app abandonnait toute la
file au premier refus : UNE séance refusée bloquait les treize autres.

Ces tests verrouillent les trois règles de `db.enregistrer_entrainement_complet` :
1. un programme disparu (ou qui n'est pas à moi) ne fait plus refuser la
   séance — on retire l'étiquette, on garde les séries ;
2. une séance renvoyée n'est JAMAIS enregistrée deux fois (clé locale, et
   séries identiques pour les séances envoyées avant la clé) ;
3. tout l'enregistrement tient dans UNE connexion, quel que soit le nombre de
   séries.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app
from tests.test_cout_lectures import CompteurConnexions

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_file_seances_fitness_royale.db"


def series(n, poids=100):
    return [{"exercice": "Squat", "numero_serie": i + 1, "reps": 8, "poids": poids}
            for i in range(n)]


class TestFileDesSeances(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chemin_original = db.CHEMIN_DB
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()
        db.CHEMIN_DB = _FICHIER_TEMP
        cls.client = TestClient(app, raise_server_exceptions=False)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        db.CHEMIN_DB = cls.chemin_original
        if _FICHIER_TEMP.exists():
            _FICHIER_TEMP.unlink()

    def _inscrire(self, pseudo):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse", "sexe": "homme", "poids": 80,
        })
        self.assertEqual(r.status_code, 201, r.text)
        corps = r.json()
        return {"Authorization": f"Bearer {corps['token']}"}, corps["joueur"]["id"]

    def _programme(self, entete, joueur_id, nom="Push"):
        r = self.client.post(f"/joueurs/{joueur_id}/programmes", json={
            "nom": nom, "exercices": [{"exercice": "Squat", "series_cibles": 3, "reps_cibles": 8}],
        }, headers=entete)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["id"]

    def _envoyer(self, entete, joueur_id, **corps):
        corps.setdefault("date", "2026-11-02")
        corps.setdefault("series", series(3))
        return self.client.post(f"/joueurs/{joueur_id}/entrainements", json=corps, headers=entete)

    def _seances(self, entete, joueur_id):
        return self.client.get(f"/joueurs/{joueur_id}/entrainements", headers=entete).json()

    # ---- 1. Le programme disparu ne bloque plus rien ----
    def test_le_programme_supprime_entre_temps_ne_fait_plus_refuser_la_seance(self):
        """LE CAS DE HAFIZ : avant ce correctif, 500 à chaque renvoi."""
        entete, jid = self._inscrire("FileSupprime")
        pid = self._programme(entete, jid)
        self.client.delete(f"/programmes/{pid}", headers=entete)
        r = self._envoyer(entete, jid, programme_id=pid, cle_locale="local-1")
        self.assertEqual(r.status_code, 201, r.text)
        self.assertIsNone(r.json()["programme_id"])
        self.assertEqual(len(r.json()["series"]), 3, "les séries doivent être gardées")
        seances = self.client.get(f"/joueurs/{jid}/seances", headers=entete).json()
        self.assertEqual(len(seances), 1, "la séance du jour doit compter aussi")

    def test_le_programme_d_un_autre_joueur_n_est_pas_rattache(self):
        entete_a, jid_a = self._inscrire("FileProprioA")
        entete_b, jid_b = self._inscrire("FileProprioB")
        pid_b = self._programme(entete_b, jid_b)
        r = self._envoyer(entete_a, jid_a, programme_id=pid_b)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertIsNone(r.json()["programme_id"])

    def test_le_programme_existant_reste_rattache(self):
        entete, jid = self._inscrire("FileNormal")
        pid = self._programme(entete, jid)
        r = self._envoyer(entete, jid, programme_id=pid)
        self.assertEqual(r.json()["programme_id"], pid)

    # ---- 2. Jamais deux fois la même séance ----
    def test_la_meme_cle_envoyee_deux_fois_ne_cree_qu_une_seance(self):
        entete, jid = self._inscrire("FileDoublon")
        premier = self._envoyer(entete, jid, cle_locale="local-42").json()
        second = self._envoyer(entete, jid, cle_locale="local-42").json()
        self.assertEqual(premier["id"], second["id"])
        self.assertEqual(len(self._seances(entete, jid)), 1)
        minutes = self.client.get(f"/joueurs/{jid}/seances", headers=entete).json()[0]["minutes"]
        self.assertEqual(minutes, 20, "les minutes ne doivent pas être comptées deux fois")

    def test_une_seance_envoyee_avant_la_cle_est_reconnue(self):
        """Une séance reçue par l'ancien serveur (sans clé), puis renvoyée par la
        file : ce sont les mêmes séries le même jour, c'est la même séance."""
        entete, jid = self._inscrire("FileAncienne")
        ancienne = self._envoyer(entete, jid, series=series(4, poids=102.5)).json()
        renvoi = self._envoyer(entete, jid, series=series(4, poids=102.5),
                               cle_locale="local-7").json()
        self.assertEqual(ancienne["id"], renvoi["id"])
        self.assertEqual(len(self._seances(entete, jid)), 1)

    def test_une_autre_seance_le_meme_jour_n_est_pas_confondue(self):
        entete, jid = self._inscrire("FileDeuxSeances")
        self._envoyer(entete, jid, series=series(4, poids=100))
        self._envoyer(entete, jid, series=series(4, poids=105), cle_locale="local-8")
        self.assertEqual(len(self._seances(entete, jid)), 2)

    def test_la_meme_cle_chez_deux_joueurs_ne_les_melange_pas(self):
        entete_a, jid_a = self._inscrire("FileCleA")
        entete_b, jid_b = self._inscrire("FileCleB")
        a = self._envoyer(entete_a, jid_a, cle_locale="local-99").json()
        b = self._envoyer(entete_b, jid_b, cle_locale="local-99").json()
        self.assertNotEqual(a["id"], b["id"])
        self.assertEqual(b["joueur_id"], jid_b)

    def test_sans_cle_le_comportement_est_inchange(self):
        """Deux envois sans clé = deux séances (la reconnaissance par séries
        identiques ne sert qu'à une séance RENVOYÉE, donc munie d'une clé)."""
        entete, jid = self._inscrire("FileSansCle")
        self._envoyer(entete, jid)
        self._envoyer(entete, jid)
        self.assertEqual(len(self._seances(entete, jid)), 2)

    # ---- 3. Une seule connexion ----
    def test_enregistrer_coute_pareil_quel_que_soit_le_nombre_de_series(self):
        jid = db.creer_joueur("FileCout", "homme", 80, None)
        couts = []
        for n in (2, 30):
            with CompteurConnexions() as compteur:
                db.enregistrer_entrainement_complet(
                    jid, None, "2026-11-03", "2026-11-03T10:00:00.000",
                    series(n), 20, f"local-cout-{n}")
            couts.append(compteur.emprunts)
        self.assertEqual(couts, [1, 1], f"emprunts pour 2 puis 30 séries : {couts}")


if __name__ == "__main__":
    unittest.main()
