"""DÉMARRER UN BLOC : le plan figé, et ce qui le protège (05/10/2026).

Demande de Hafiz : « il faut qu'on puisse maintenant créer des cycles… un cycle
sur un mois… à partir du programme, on peut faire le cycle qui sera visualisé en
tableau », avec le choix « le plan, mais qui se rattrape ».

CE QUE DÉMARRER UN BLOC CHANGE : jusqu'ici le tableau était une PROJECTION, qui
se recalculait depuis l'historique à chaque ouverture. Pour qu'une séance puisse
annoncer « semaine 2/4 — 8 reps à 105 kg », le plan doit être FIGÉ : on écrit
donc toutes les cases d'un coup, avec une date de début.

Ce que ces tests verrouillent :
 - le plan s'écrit en UN SEUL appel et UNE SEULE connexion, quel que soit le
   nombre de cases (le motif N+1 qui a fait disparaître l'onglet le 23/09/2026) ;
 - ⚠️ une case CORRIGÉE À LA MAIN survit à un recalcul de la suite du bloc —
   c'est la promesse « l'app propose, je corrige », et elle est tenue par la
   BASE, pas par l'écran ;
 - régler la durée d'un bloc ne le déplace pas dans le temps ;
 - on ne peut pas écrire dans le plan de quelqu'un d'autre.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_bloc_fitness_royale.db"


class CompteurConnexions:
    """Remplace `db.connexion` le temps d'un appel et compte les emprunts.

    Repris de `test_cout_lectures.py` : on compte les ALLERS-RETOURS, pas les
    millisecondes. En SQLite local une durée ne dirait rien, alors que c'est
    exactement ce qui se paie contre une base distante (Neon)."""

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


class TestBlocServeur(unittest.TestCase):
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
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123", "sexe": "homme", "poids": 80,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _programme(self, h, joueur_id, nom="Push", exercices=None):
        return self.client.post(f"/joueurs/{joueur_id}/programmes", json={
            "nom": nom, "jours": ["lundi"],
            "exercices": exercices or [
                {"exercice": "developpe couche", "series_cibles": 3, "reps_cibles": 8},
            ],
        }, headers=h).json()

    def _cases(self, programme_id, nb_semaines, exercice="developpe couche"):
        return [
            {"programme_id": programme_id, "exercice": exercice,
             "semaine": str(n), "series": 3, "reps": 8, "poids": 100 + 2.5 * (n - 1)}
            for n in range(1, nb_semaines + 1)
        ]

    # ------------------------------------------------ la date de début du bloc

    def test_demarrer_un_bloc_pose_sa_date_de_debut(self):
        h, jid = self._inscrire("BlocDate")
        cycle = self.client.post(f"/joueurs/{jid}/cycles", json={
            "nom": "Mon PPL", "seances": [
                {"nom": "Push", "jours": ["lundi"], "exercices": [
                    {"exercice": "developpe couche", "series_cibles": 3, "reps_cibles": 8},
                ]},
            ],
        }, headers=h).json()
        r = self.client.put(f"/cycles/{cycle['id']}/bloc", json={
            "duree_semaines": 4, "avec_deload": True, "date_debut": "2026-10-05",
        }, headers=h)
        self.assertEqual(r.status_code, 200)
        relu = self.client.get(f"/joueurs/{jid}/cycles", headers=h).json()[0]
        self.assertEqual(relu["date_debut"], "2026-10-05")
        self.assertEqual(relu["duree_semaines"], 4)
        self.assertEqual(relu["avec_deload"], 1)

    def test_regler_la_duree_ne_deplace_pas_un_bloc_deja_commence(self):
        """Sans `date_debut`, la date existante ne doit PAS être effacée.

        Sinon passer un bloc de 4 à 6 semaines le ferait repartir de zéro sans
        que l'utilisateur l'ait demandé."""
        h, jid = self._inscrire("BlocGardeSaDate")
        p = self._programme(h, jid)
        self.client.put(f"/programmes/{p['id']}/bloc", json={
            "duree_semaines": 4, "avec_deload": False, "date_debut": "2026-10-05",
        }, headers=h)
        self.client.put(f"/programmes/{p['id']}/bloc", json={
            "duree_semaines": 6, "avec_deload": True,
        }, headers=h)
        relu = self.client.get(f"/programmes/{p['id']}", headers=h).json()
        self.assertEqual(relu["date_debut"], "2026-10-05")
        self.assertEqual(relu["duree_semaines"], 6)

    def test_arreter_un_bloc_efface_sa_date_de_debut(self):
        """Un bloc démarré par erreur doit pouvoir être arrêté.

        `date_debut = None` ne peut pas servir à ça : il veut déjà dire « ne
        touche pas à la date ». D'où le drapeau `arreter`, à part."""
        h, jid = self._inscrire("BlocArrete")
        p = self._programme(h, jid)
        self.client.put(f"/programmes/{p['id']}/bloc", json={
            "duree_semaines": 4, "avec_deload": False, "date_debut": "2026-10-05",
        }, headers=h)
        r = self.client.put(f"/programmes/{p['id']}/bloc", json={
            "duree_semaines": 4, "avec_deload": False, "arreter": True,
        }, headers=h)
        self.assertEqual(r.status_code, 200)
        relu = self.client.get(f"/programmes/{p['id']}", headers=h).json()
        self.assertIsNone(relu["date_debut"])
        self.assertEqual(relu["duree_semaines"], 4, "la durée a été perdue au passage")

    def test_une_date_de_debut_invalide_est_refusee(self):
        h, jid = self._inscrire("BlocMauvaiseDate")
        p = self._programme(h, jid)
        r = self.client.put(f"/programmes/{p['id']}/bloc", json={
            "duree_semaines": 4, "avec_deload": False, "date_debut": "5 octobre",
        }, headers=h)
        self.assertEqual(r.status_code, 400)
        self.assertIn("AAAA-MM-JJ", r.json()["detail"])

    # ------------------------------------------------------ le plan en un lot

    def test_le_plan_entier_s_ecrit_en_un_seul_appel(self):
        h, jid = self._inscrire("PlanLot")
        p = self._programme(h, jid)
        r = self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": self._cases(p["id"], 4),
        }, headers=h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"ecrites": 4, "preservees": 0})
        cases = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual(len(cases), 4)
        par_semaine = {c["semaine"]: c for c in cases}
        self.assertEqual(par_semaine["1"]["poids"], 100)
        self.assertEqual(par_semaine["4"]["poids"], 107.5)
        # Toutes viennent du PLAN, pas d'une correction à la main.
        self.assertEqual({c["origine"] for c in cases}, {"plan"})

    def test_le_cout_ne_depend_pas_du_nombre_de_cases(self):
        """40 cases doivent coûter le même nombre de connexions que 4.

        C'est LA leçon du 23/09/2026 : un motif parfaitement sain en SQLite
        (ouvrir une connexion par écriture) devient ruineux contre une base
        distante."""
        h, jid = self._inscrire("PlanCout")
        p = self._programme(h, jid)
        petit = self._cases(p["id"], 4)
        grand = [
            {"programme_id": p["id"], "exercice": f"exercice {i}",
             "semaine": str(n), "series": 3, "reps": 8, "poids": 100}
            for i in range(10) for n in range(1, 5)
        ]
        couts = []
        for cases in (petit, grand):
            with CompteurConnexions() as compteur:
                r = self.client.put(f"/joueurs/{jid}/cibles-semaine/lot",
                                    json={"cases": cases}, headers=h)
            self.assertEqual(r.status_code, 200)
            couts.append(compteur.emprunts)
        self.assertEqual(
            couts[0], couts[1],
            f"4 cases ont coûté {couts[0]} connexions et 40 en ont coûté {couts[1]} : "
            "l'écriture en lot est repartie en N+1.",
        )

    def test_un_lot_vide_est_refuse(self):
        h, jid = self._inscrire("PlanVide")
        r = self.client.put(f"/joueurs/{jid}/cibles-semaine/lot",
                            json={"cases": []}, headers=h)
        self.assertEqual(r.status_code, 422)

    # ------------------- LE CŒUR : « l'app propose, JE corrige » tient

    def test_une_correction_a_la_main_survit_a_un_recalcul_du_plan(self):
        h, jid = self._inscrire("CorrectionProtegee")
        p = self._programme(h, jid)
        self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": self._cases(p["id"], 4),
        }, headers=h)
        # Hafiz corrige la semaine 2 à la main : 140 kg.
        self.client.put(f"/joueurs/{jid}/cibles-semaine", json={
            "programme_id": p["id"], "exercice": "developpe couche",
            "semaine": "2", "series": 3, "reps": 8, "poids": 140,
        }, headers=h)
        # Puis le bloc dérive et on recalcule la suite : le plan réécrit tout.
        r = self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": self._cases(p["id"], 4),
        }, headers=h)
        self.assertEqual(r.json(), {"ecrites": 3, "preservees": 1})
        cases = {c["semaine"]: c for c in
                 self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()}
        self.assertEqual(cases["2"]["poids"], 140, "la correction a été écrasée")
        self.assertEqual(cases["2"]["origine"], "manuel")
        # Les cases du plan, elles, ont bien été remises à jour.
        self.assertEqual(cases["3"]["poids"], 105)
        self.assertEqual(cases["3"]["origine"], "plan")

    def test_une_case_du_plan_est_bien_remplacee_par_un_recalcul(self):
        h, jid = self._inscrire("PlanRecalcule")
        p = self._programme(h, jid)
        self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": [{"programme_id": p["id"], "exercice": "developpe couche",
                       "semaine": "3", "series": 3, "reps": 8, "poids": 105}],
        }, headers=h)
        self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": [{"programme_id": p["id"], "exercice": "developpe couche",
                       "semaine": "3", "series": 4, "reps": 6, "poids": 95}],
        }, headers=h)
        cases = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual(len(cases), 1, "le recalcul a créé un doublon")
        self.assertEqual(cases[0]["poids"], 95)
        self.assertEqual(cases[0]["series"], 4)

    def test_une_case_ecrite_avant_cette_colonne_compte_comme_manuelle(self):
        """Les cases d'avant le 05/10/2026 étaient TOUTES des corrections.

        Le DEFAULT de la colonne doit donc les protéger, elles aussi — sans
        quoi le premier bloc démarré effacerait le travail déjà fait."""
        h, jid = self._inscrire("CaseAncienne")
        p = self._programme(h, jid)
        with db.connexion() as conn:
            conn.execute(
                "INSERT INTO cibles_semaine "
                "(joueur_id, programme_id, exercice, semaine, series, reps, poids) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (jid, p["id"], "developpe couche", "1", 3, 8, 133),
            )
        r = self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": self._cases(p["id"], 2),
        }, headers=h)
        self.assertEqual(r.json(), {"ecrites": 1, "preservees": 1})
        cases = {c["semaine"]: c for c in
                 self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()}
        self.assertEqual(cases["1"]["poids"], 133)
        self.assertEqual(cases["1"]["origine"], "manuel")

    def test_vider_une_case_la_rend_au_calcul_meme_apres_un_plan(self):
        h, jid = self._inscrire("CaseRendue")
        p = self._programme(h, jid)
        self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": self._cases(p["id"], 2),
        }, headers=h)
        r = self.client.delete(
            f"/joueurs/{jid}/cibles-semaine",
            params={"programme_id": p["id"], "exercice": "developpe couche",
                    "semaine": "1"},
            headers=h)
        self.assertEqual(r.status_code, 200)
        restantes = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual([c["semaine"] for c in restantes], ["2"])

    # --------------------------------------------------------- les garde-fous

    def test_on_ne_peut_pas_ecrire_dans_le_plan_d_un_autre(self):
        h1, jid1 = self._inscrire("PlanProprio")
        h2, jid2 = self._inscrire("PlanIntrus")
        p = self._programme(h1, jid1)
        # Le programme n'est pas à moi, même si je mets MON numéro de joueur.
        r = self.client.put(f"/joueurs/{jid2}/cibles-semaine/lot", json={
            "cases": self._cases(p["id"], 2),
        }, headers=h2)
        self.assertEqual(r.status_code, 403)
        # Et le plan du propriétaire est resté vide.
        self.assertEqual(
            self.client.get(f"/joueurs/{jid1}/cibles-semaine", headers=h1).json(), [])

    def test_le_plan_exige_une_connexion(self):
        h, jid = self._inscrire("PlanAnonyme")
        p = self._programme(h, jid)
        r = self.client.put(f"/joueurs/{jid}/cibles-semaine/lot",
                            json={"cases": self._cases(p["id"], 2)})
        self.assertEqual(r.status_code, 401)

    def test_demarrer_un_bloc_exige_d_en_etre_le_proprietaire(self):
        h1, jid1 = self._inscrire("BlocProprio")
        h2, _ = self._inscrire("BlocIntrus")
        p = self._programme(h1, jid1)
        r = self.client.put(f"/programmes/{p['id']}/bloc", json={
            "duree_semaines": 4, "avec_deload": False, "date_debut": "2026-10-05",
        }, headers=h2)
        self.assertEqual(r.status_code, 403)

    def test_renommer_un_exercice_emporte_les_cases_du_plan(self):
        """Le nom est l'identifiant — y compris pour les cases d'un plan figé."""
        h, jid = self._inscrire("PlanRenomme")
        p = self._programme(h, jid)
        self.client.put(f"/joueurs/{jid}/cibles-semaine/lot", json={
            "cases": self._cases(p["id"], 3),
        }, headers=h)
        r = self.client.put(
            f"/joueurs/{jid}/exercices/developpe couche/nom",
            json={"nouveau": "bench press"}, headers=h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["cibles"], 3)
        cases = self.client.get(f"/joueurs/{jid}/cibles-semaine", headers=h).json()
        self.assertEqual({c["exercice"] for c in cases}, {"bench press"})


if __name__ == "__main__":
    unittest.main()
