"""Tests d'intégration de la section Entraînement (programmes + journal de
séance) — de VRAIES requêtes HTTP contre l'app FastAPI, sur une base de
données TEMPORAIRE.

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

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_entrainement_fitness_royale.db"


class TestAPIEntrainement(unittest.TestCase):
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

    def _programme_exemple(self):
        return {
            "nom": "Push",
            "exercices": [
                {"exercice": "Développé couché haltères", "series_cibles": 4, "reps_cibles": 8},
                {"exercice": "Élévations latérales", "series_cibles": 3, "reps_cibles": 12},
            ],
        }

    # ----- Programmes -----

    def test_creer_programme_avec_ses_exercices(self):
        token, joueur_id = self._inscrire("Alpha")
        r = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        corps = r.json()
        self.assertEqual(corps["nom"], "Push")
        self.assertEqual(len(corps["exercices"]), 2)
        self.assertEqual(corps["exercices"][0]["exercice"], "Développé couché haltères")
        self.assertEqual(corps["exercices"][0]["ordre"], 1)

    def test_creer_programme_sans_connexion_refuse(self):
        r = self.client.post("/joueurs/1/programmes", json=self._programme_exemple())
        self.assertEqual(r.status_code, 401)

    def test_creer_programme_pour_un_autre_refuse(self):
        token_a, id_a = self._inscrire("Beta")
        token_b, _ = self._inscrire("Gamma")
        r = self.client.post(f"/joueurs/{id_a}/programmes", json=self._programme_exemple(),
                             headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_programme_sans_exercice_refuse(self):
        token, joueur_id = self._inscrire("Delta")
        r = self.client.post(f"/joueurs/{joueur_id}/programmes",
                             json={"nom": "Vide", "exercices": []}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 422)

    def test_creer_programme_avec_jours_et_calendrier(self):
        token, joueur_id = self._inscrire("AlphaJours")
        programme = self._programme_exemple()
        programme["jours"] = ["lundi", "jeudi"]
        programme["duree_semaines"] = 4
        programme["date_debut"] = "2026-08-17"
        r = self.client.post(f"/joueurs/{joueur_id}/programmes", json=programme,
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        corps = r.json()
        self.assertEqual(corps["jours"], ["lundi", "jeudi"])
        self.assertEqual(corps["duree_semaines"], 4)
        self.assertEqual(corps["date_debut"], "2026-08-17")

    def test_programme_sans_jours_renvoie_liste_vide(self):
        # Un programme "à l'ancienne" (sans jours ni calendrier) doit continuer
        # à marcher : jours = [] (jamais None), durée/début = None.
        token, joueur_id = self._inscrire("AlphaSansJours")
        r = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["jours"], [])
        self.assertIsNone(r.json()["duree_semaines"])
        self.assertIsNone(r.json()["date_debut"])

    def test_programme_jour_inconnu_refuse(self):
        token, joueur_id = self._inscrire("AlphaJourFaux")
        programme = self._programme_exemple()
        programme["jours"] = ["lundi", "vendredredi"]
        r = self.client.post(f"/joueurs/{joueur_id}/programmes", json=programme,
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 400)

    def test_programme_date_debut_invalide_refusee(self):
        token, joueur_id = self._inscrire("AlphaDateFausse")
        programme = self._programme_exemple()
        programme["date_debut"] = "17/08/2026"  # mauvais format (attendu : AAAA-MM-JJ)
        r = self.client.post(f"/joueurs/{joueur_id}/programmes", json=programme,
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 400)

    def test_changer_les_jours_dun_programme(self):
        token, joueur_id = self._inscrire("SemaineType")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        r = self.client.put(f"/programmes/{programme['id']}/jours",
                            json={"jours": ["lundi", "jeudi"]}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["jours"], ["lundi", "jeudi"])
        # Liste vide = retirer tous les jours.
        r2 = self.client.put(f"/programmes/{programme['id']}/jours",
                             json={"jours": []}, headers=self._en_tete(token))
        self.assertEqual(r2.json()["jours"], [])

    def test_changer_les_jours_du_programme_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("SemaineTypeA")
        programme = self.client.post(f"/joueurs/{id_a}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token_a)).json()
        token_b, _ = self._inscrire("SemaineTypeB")
        r = self.client.put(f"/programmes/{programme['id']}/jours",
                            json={"jours": ["lundi"]}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_planifier_un_programme_sur_une_date(self):
        token, joueur_id = self._inscrire("Planificateur")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        r = self.client.post(f"/joueurs/{joueur_id}/planning",
                             json={"date": "2026-08-21", "programme_id": programme["id"]},
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        liste = self.client.get(f"/joueurs/{joueur_id}/planning").json()
        self.assertEqual(len(liste), 1)
        self.assertEqual(liste[0]["date"], "2026-08-21")
        self.assertEqual(liste[0]["programme_id"], programme["id"])

    def test_planifier_deux_fois_le_meme_jour_refuse(self):
        token, joueur_id = self._inscrire("PlanifDouble")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        corps = {"date": "2026-08-21", "programme_id": programme["id"]}
        self.client.post(f"/joueurs/{joueur_id}/planning", json=corps, headers=self._en_tete(token))
        r = self.client.post(f"/joueurs/{joueur_id}/planning", json=corps, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 409)

    def test_planifier_le_programme_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("PlanifA")
        programme_a = self.client.post(f"/joueurs/{id_a}/programmes", json=self._programme_exemple(),
                                       headers=self._en_tete(token_a)).json()
        token_b, id_b = self._inscrire("PlanifB")
        # B essaie de mettre le programme de A dans SON planning : refusé.
        r = self.client.post(f"/joueurs/{id_b}/planning",
                             json={"date": "2026-08-21", "programme_id": programme_a["id"]},
                             headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_changer_les_exercices_dun_programme(self):
        token, joueur_id = self._inscrire("EditeurExos")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        r = self.client.put(f"/programmes/{programme['id']}/exercices",
                            json={"exercices": [
                                {"exercice": "Développé couché haltères", "series_cibles": 5, "reps_cibles": 5},
                            ]}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        exercices = r.json()["exercices"]
        self.assertEqual(len(exercices), 1)
        self.assertEqual(exercices[0]["series_cibles"], 5)
        self.assertEqual(exercices[0]["reps_cibles"], 5)

    def test_changer_les_exercices_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("EditeurExosA")
        programme = self.client.post(f"/joueurs/{id_a}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token_a)).json()
        token_b, _ = self._inscrire("EditeurExosB")
        r = self.client.put(f"/programmes/{programme['id']}/exercices",
                            json={"exercices": [
                                {"exercice": "Squat", "series_cibles": 3, "reps_cibles": 10},
                            ]}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    # ----- Volume : objectifs de séries par groupe musculaire -----

    def test_definir_et_lire_les_objectifs_de_series(self):
        token, joueur_id = self._inscrire("VolumeOK")
        r = self.client.put(f"/joueurs/{joueur_id}/objectifs-series", json={"objectifs": [
            {"groupe": "Pectoraux", "series_cibles": 12},
            {"groupe": "Dos", "series_cibles": 16},
        ]}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        liste = self.client.get(f"/joueurs/{joueur_id}/objectifs-series").json()
        self.assertEqual(len(liste), 2)
        par_groupe = {o["groupe"]: o["series_cibles"] for o in liste}
        self.assertEqual(par_groupe, {"Pectoraux": 12, "Dos": 16})

    def test_les_objectifs_remplacent_les_precedents(self):
        token, joueur_id = self._inscrire("VolumeRemplace")
        self.client.put(f"/joueurs/{joueur_id}/objectifs-series", json={"objectifs": [
            {"groupe": "Pectoraux", "series_cibles": 12},
        ]}, headers=self._en_tete(token))
        self.client.put(f"/joueurs/{joueur_id}/objectifs-series", json={"objectifs": [
            {"groupe": "Biceps", "series_cibles": 8},
        ]}, headers=self._en_tete(token))
        liste = self.client.get(f"/joueurs/{joueur_id}/objectifs-series").json()
        self.assertEqual(len(liste), 1)
        self.assertEqual(liste[0]["groupe"], "Biceps")

    def test_objectif_groupe_inconnu_refuse(self):
        token, joueur_id = self._inscrire("VolumeGroupeFaux")
        r = self.client.put(f"/joueurs/{joueur_id}/objectifs-series", json={"objectifs": [
            {"groupe": "Muscle imaginaire", "series_cibles": 10},
        ]}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 400)

    def test_objectifs_dun_autre_refuses(self):
        _, id_a = self._inscrire("VolumeA")
        token_b, _ = self._inscrire("VolumeB")
        r = self.client.put(f"/joueurs/{id_a}/objectifs-series", json={"objectifs": [
            {"groupe": "Dos", "series_cibles": 10},
        ]}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_corriger_le_groupe_dun_exercice(self):
        token, joueur_id = self._inscrire("GroupeExo")
        r = self.client.put(f"/joueurs/{joueur_id}/groupes-exercices/Mon%20exo%20maison",
                            json={"groupe": "Dos"}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        liste = self.client.get(f"/joueurs/{joueur_id}/groupes-exercices").json()
        self.assertEqual(liste[0]["exercice"], "Mon exo maison")
        self.assertEqual(liste[0]["groupe"], "Dos")
        # Réassigner le même exercice écrase l'ancien groupe (pas de doublon).
        self.client.put(f"/joueurs/{joueur_id}/groupes-exercices/Mon%20exo%20maison",
                        json={"groupe": "Biceps"}, headers=self._en_tete(token))
        liste2 = self.client.get(f"/joueurs/{joueur_id}/groupes-exercices").json()
        self.assertEqual(len(liste2), 1)
        self.assertEqual(liste2[0]["groupe"], "Biceps")

    def test_corriger_le_groupe_avec_un_groupe_inconnu_refuse(self):
        token, joueur_id = self._inscrire("GroupeExoFaux")
        r = self.client.put(f"/joueurs/{joueur_id}/groupes-exercices/Squat",
                            json={"groupe": "Zboub"}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 400)

    # ----- Cycles : un programme complet réparti sur la semaine -----

    def _cycle_exemple(self):
        return {
            "nom": "Mon PPL",
            "seances": [
                {"jours": ["lundi"], "nom": "Push", "exercices": [
                    {"exercice": "Développé couché", "series_cibles": 4, "reps_cibles": 8},
                ]},
                {"jours": ["mercredi"], "nom": "Pull", "exercices": [
                    {"exercice": "Tractions", "series_cibles": 4, "reps_cibles": 8},
                ]},
                {"jours": ["vendredi"], "nom": "Legs", "exercices": [
                    {"exercice": "Squat", "series_cibles": 5, "reps_cibles": 5},
                ]},
            ],
        }

    def test_creer_un_cycle_cree_une_seance_par_jour(self):
        token, joueur_id = self._inscrire("Cycliste")
        r = self.client.post(f"/joueurs/{joueur_id}/cycles", json=self._cycle_exemple(),
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        cycle = r.json()
        self.assertEqual(cycle["nom"], "Mon PPL")
        self.assertEqual(len(cycle["seances"]), 3)
        # Chaque séance porte SON jour et ses exercices.
        self.assertEqual(cycle["seances"][0]["jours"], ["lundi"])
        self.assertEqual(cycle["seances"][0]["nom"], "Push")
        self.assertEqual(cycle["seances"][2]["exercices"][0]["exercice"], "Squat")
        # Les séances apparaissent aussi comme programmes classiques
        # (donc dans la semaine type et le calendrier).
        programmes = self.client.get(f"/joueurs/{joueur_id}/programmes").json()
        self.assertEqual(len(programmes), 3)

    def test_une_seance_de_cycle_peut_revenir_plusieurs_jours(self):
        # PPL 6 jours : « Push » se fait le lundi ET le jeudi.
        token, joueur_id = self._inscrire("CyclisteSixJours")
        r = self.client.post(f"/joueurs/{joueur_id}/cycles", json={
            "nom": "PPL 6 jours",
            "seances": [
                {"jours": ["lundi", "jeudi"], "nom": "Push", "exercices": [
                    {"exercice": "Développé couché", "series_cibles": 4, "reps_cibles": 8},
                ]},
            ],
        }, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["seances"][0]["jours"], ["lundi", "jeudi"])

    def test_creer_un_cycle_pour_un_autre_refuse(self):
        _, id_a = self._inscrire("CyclisteA")
        token_b, _ = self._inscrire("CyclisteB")
        r = self.client.post(f"/joueurs/{id_a}/cycles", json=self._cycle_exemple(),
                             headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_creer_un_cycle_jour_inconnu_refuse(self):
        token, joueur_id = self._inscrire("CyclisteJourFaux")
        cycle = self._cycle_exemple()
        cycle["seances"][0]["jours"] = ["lundredi"]
        r = self.client.post(f"/joueurs/{joueur_id}/cycles", json=cycle,
                             headers=self._en_tete(token))
        self.assertEqual(r.status_code, 400)

    def test_lister_et_supprimer_un_cycle(self):
        token, joueur_id = self._inscrire("CyclisteSuppr")
        cycle = self.client.post(f"/joueurs/{joueur_id}/cycles", json=self._cycle_exemple(),
                                 headers=self._en_tete(token)).json()
        self.assertEqual(len(self.client.get(f"/joueurs/{joueur_id}/cycles").json()), 1)
        r = self.client.delete(f"/cycles/{cycle['id']}", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(f"/joueurs/{joueur_id}/cycles").json(), [])
        # Les séances du cycle disparaissent avec lui.
        self.assertEqual(self.client.get(f"/joueurs/{joueur_id}/programmes").json(), [])

    def test_supprimer_le_cycle_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("CyclisteSupprA")
        cycle = self.client.post(f"/joueurs/{id_a}/cycles", json=self._cycle_exemple(),
                                 headers=self._en_tete(token_a)).json()
        token_b, _ = self._inscrire("CyclisteSupprB")
        r = self.client.delete(f"/cycles/{cycle['id']}", headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_renommer_un_programme(self):
        token, joueur_id = self._inscrire("Renommeur")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        r = self.client.put(f"/programmes/{programme['id']}/nom",
                            json={"nom": "Séance du lundi"}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["nom"], "Séance du lundi")

    def test_renommer_le_programme_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("RenommeurA")
        programme = self.client.post(f"/joueurs/{id_a}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token_a)).json()
        token_b, _ = self._inscrire("RenommeurB")
        r = self.client.put(f"/programmes/{programme['id']}/nom",
                            json={"nom": "Piraté"}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_planifier_un_lot(self):
        token, joueur_id = self._inscrire("PlanifLot")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        # Un doublon volontaire dans le lot (2026-09-01 déjà présent) : ignoré.
        self.client.post(f"/joueurs/{joueur_id}/planning",
                         json={"date": "2026-09-01", "programme_id": programme["id"]},
                         headers=self._en_tete(token))
        r = self.client.post(f"/joueurs/{joueur_id}/planning/lot",
                             json={"elements": [
                                 {"date": "2026-09-01", "programme_id": programme["id"]},
                                 {"date": "2026-09-03", "programme_id": programme["id"]},
                                 {"date": "2026-09-05", "programme_id": programme["id"]},
                             ]}, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.json()), 2)  # le doublon n'est pas recréé
        liste = self.client.get(f"/joueurs/{joueur_id}/planning").json()
        self.assertEqual(len(liste), 3)

    def test_planifier_un_lot_avec_programme_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("PlanifLotA")
        programme_a = self.client.post(f"/joueurs/{id_a}/programmes", json=self._programme_exemple(),
                                       headers=self._en_tete(token_a)).json()
        token_b, id_b = self._inscrire("PlanifLotB")
        r = self.client.post(f"/joueurs/{id_b}/planning/lot",
                             json={"elements": [
                                 {"date": "2026-09-01", "programme_id": programme_a["id"]},
                             ]}, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_deplanifier(self):
        token, joueur_id = self._inscrire("Deplanificateur")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        planif = self.client.post(f"/joueurs/{joueur_id}/planning",
                                  json={"date": "2026-08-22", "programme_id": programme["id"]},
                                  headers=self._en_tete(token)).json()
        r = self.client.delete(f"/planning/{planif['id']}", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(f"/joueurs/{joueur_id}/planning").json(), [])

    def test_lister_programmes_du_joueur(self):
        token, joueur_id = self._inscrire("Epsilon")
        self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                         headers=self._en_tete(token))
        self.client.post(f"/joueurs/{joueur_id}/programmes",
                         json={"nom": "Pull", "exercices": [
                             {"exercice": "Rowing barre", "series_cibles": 4, "reps_cibles": 10}
                         ]}, headers=self._en_tete(token))
        r = self.client.get(f"/joueurs/{joueur_id}/programmes")
        self.assertEqual(len(r.json()), 2)

    def test_supprimer_son_propre_programme(self):
        token, joueur_id = self._inscrire("Zeta")
        cree = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                headers=self._en_tete(token)).json()
        r = self.client.delete(f"/programmes/{cree['id']}", headers=self._en_tete(token))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(f"/programmes/{cree['id']}").status_code, 404)

    def test_supprimer_le_programme_dun_autre_refuse(self):
        token_a, id_a = self._inscrire("Eta")
        cree = self.client.post(f"/joueurs/{id_a}/programmes", json=self._programme_exemple(),
                                headers=self._en_tete(token_a)).json()
        token_b, _ = self._inscrire("Theta")
        r = self.client.delete(f"/programmes/{cree['id']}", headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    # ----- Journal de séance (workout log) -----

    def test_logger_une_seance_libre(self):
        token, joueur_id = self._inscrire("Iota")
        r = self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "date": "2026-07-20",
            "series": [
                {"exercice": "Squat", "numero_serie": 1, "reps": 8, "poids": 80},
                {"exercice": "Squat", "numero_serie": 2, "reps": 8, "poids": 82.5},
            ],
        }, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        corps = r.json()
        self.assertEqual(corps["date"], "2026-07-20")
        self.assertIsNone(corps["programme_id"])
        self.assertEqual(len(corps["series"]), 2)
        self.assertEqual(corps["series"][1]["poids"], 82.5)

    def test_logger_une_seance_depuis_un_programme(self):
        token, joueur_id = self._inscrire("Kappa")
        programme = self.client.post(f"/joueurs/{joueur_id}/programmes", json=self._programme_exemple(),
                                     headers=self._en_tete(token)).json()
        r = self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "programme_id": programme["id"],
            "series": [{"exercice": "Développé couché haltères", "numero_serie": 1, "reps": 8, "poids": 24}],
        }, headers=self._en_tete(token))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["programme_id"], programme["id"])

    def test_logger_pour_un_autre_refuse(self):
        token_a, id_a = self._inscrire("Lambda")
        token_b, _ = self._inscrire("Mu")
        r = self.client.post(f"/joueurs/{id_a}/entrainements", json={
            "series": [{"exercice": "Squat", "numero_serie": 1, "reps": 8, "poids": 80}],
        }, headers=self._en_tete(token_b))
        self.assertEqual(r.status_code, 403)

    def test_lister_entrainements_recents_dabord(self):
        token, joueur_id = self._inscrire("Nu")
        for jour in ("2026-07-01", "2026-07-15", "2026-07-10"):
            self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
                "date": jour,
                "series": [{"exercice": "Squat", "numero_serie": 1, "reps": 8, "poids": 80}],
            }, headers=self._en_tete(token))
        r = self.client.get(f"/joueurs/{joueur_id}/entrainements")
        dates = [e["date"] for e in r.json()]
        self.assertEqual(dates, ["2026-07-15", "2026-07-10", "2026-07-01"])

    # ----- Surcharge progressive -----

    def test_dernieres_series_avant_une_date(self):
        token, joueur_id = self._inscrire("Xi")
        self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "date": "2026-07-10",
            "series": [
                {"exercice": "Développé couché", "numero_serie": 1, "reps": 8, "poids": 80},
                {"exercice": "Développé couché", "numero_serie": 2, "reps": 7, "poids": 82.5},
            ],
        }, headers=self._en_tete(token))
        # Une séance plus récente qui NE contient PAS cet exercice ne doit pas interférer.
        self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "date": "2026-07-15",
            "series": [{"exercice": "Squat", "numero_serie": 1, "reps": 8, "poids": 100}],
        }, headers=self._en_tete(token))

        r = self.client.get(f"/joueurs/{joueur_id}/exercices/Développé couché/dernier?avant=2026-07-20")
        corps = r.json()
        self.assertEqual(corps["date"], "2026-07-10")
        self.assertEqual(len(corps["series"]), 2)
        self.assertEqual(corps["series"][1]["poids"], 82.5)

    def test_dernieres_series_exclut_la_date_donnee_et_apres(self):
        token, joueur_id = self._inscrire("Omicron")
        self.client.post(f"/joueurs/{joueur_id}/entrainements", json={
            "date": "2026-07-10",
            "series": [{"exercice": "Squat", "numero_serie": 1, "reps": 8, "poids": 80}],
        }, headers=self._en_tete(token))
        # "avant" = la même date que la séance -> ne doit PAS la voir (utile pour
        # comparer "aujourd'hui" à la fois précédente sans se comparer à soi-même).
        r = self.client.get(f"/joueurs/{joueur_id}/exercices/Squat/dernier?avant=2026-07-10")
        self.assertIsNone(r.json()["date"])

    def test_dernieres_series_exercice_jamais_fait(self):
        token, joueur_id = self._inscrire("Pi")
        r = self.client.get(f"/joueurs/{joueur_id}/exercices/Inconnu/dernier")
        self.assertIsNone(r.json()["date"])
        self.assertEqual(r.json()["series"], [])


if __name__ == "__main__":
    unittest.main()
