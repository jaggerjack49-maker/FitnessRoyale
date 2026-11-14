"""Corriger ou supprimer une séance DÉJÀ ENREGISTRÉE (14/11/2026).

Avant, une séance enregistrée était figée : une charge mal tapée restait à vie
dans l'historique, les records et les suggestions. `PUT /entrainements/{id}`
remplace ses séries (et sa durée), `DELETE /entrainements/{id}` la supprime ;
dans les deux cas la séance du jour (compteur du Profil, défis) suit.
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import basededonnees as db
from fastapi.testclient import TestClient

from app.main import app

_FICHIER_TEMP = Path(tempfile.gettempdir()) / "test_api_corriger_seance_fitness_royale.db"


def _serie(exo, n, reps=8, poids=100, rir=None):
    return {"exercice": exo, "numero_serie": n, "reps": reps, "poids": poids, "rir": rir}


class TestCorrigerSeance(unittest.TestCase):
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

    def _inscrire(self, pseudo):
        r = self.client.post("/auth/inscription", json={
            "pseudo": pseudo, "mot_de_passe": "motdepasse123",
            "sexe": "homme", "poids": 78,
        })
        return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["joueur"]["id"]

    def _logger(self, h, jid, series, jour="2026-11-10", duree=None):
        corps = {"date": jour, "series": series}
        if duree is not None:
            corps["duree_minutes"] = duree
        return self.client.post(f"/joueurs/{jid}/entrainements", json=corps, headers=h).json()

    def _minutes_du_jour(self, h, jid, jour="2026-11-10"):
        for s in self.client.get(f"/joueurs/{jid}/seances", headers=h).json():
            if s["date"] == jour:
                return s["minutes"]
        return None

    def _relire(self, h, jid, eid):
        return next(e for e in self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json()
                    if e["id"] == eid)

    # ------------------------------------------------------------ corriger

    def test_une_charge_mal_tapee_se_corrige(self):
        h, jid = self._inscrire("CorrCharge")
        # 500 kg au lieu de 105 : un zéro et un chiffre de travers.
        e = self._logger(h, jid, [_serie("squat", 1, poids=100), _serie("squat", 2, poids=500)])
        r = self.client.put(f"/entrainements/{e['id']}", json={
            "series": [_serie("squat", 1, poids=100), _serie("squat", 2, poids=105, rir=1)],
        }, headers=h)
        self.assertEqual(r.status_code, 200)
        relu = self._relire(h, jid, e["id"])
        self.assertEqual([s["poids"] for s in relu["series"]], [100, 105])
        self.assertEqual(relu["series"][1]["rir"], 1)
        self.assertEqual(relu["date"], "2026-11-10")  # la date ne bouge pas

    def test_une_serie_retiree_ne_laisse_pas_de_trou(self):
        h, jid = self._inscrire("CorrTrou")
        e = self._logger(h, jid, [_serie("dips", 1), _serie("dips", 2), _serie("dips", 3),
                                  _serie("curl", 1)])
        # On retire la série 2 de dips : l'app envoie 1 et 3.
        r = self.client.put(f"/entrainements/{e['id']}", json={
            "series": [_serie("dips", 1), _serie("dips", 3), _serie("curl", 1)],
        }, headers=h)
        self.assertEqual([(s["exercice"], s["numero_serie"]) for s in r.json()["series"]],
                         [("dips", 1), ("dips", 2), ("curl", 1)])

    def test_la_duree_corrigee_met_a_jour_la_seance_du_jour(self):
        h, jid = self._inscrire("CorrDuree")
        e = self._logger(h, jid, [_serie("squat", 1)], duree=40)
        self.assertEqual(self._minutes_du_jour(h, jid), 40)
        self.client.put(f"/entrainements/{e['id']}", json={
            "series": [_serie("squat", 1)], "duree_minutes": 65}, headers=h)
        self.assertEqual(self._minutes_du_jour(h, jid), 65)
        self.assertEqual(self._relire(h, jid, e["id"])["duree_minutes"], 65)

    def test_sans_duree_la_seance_du_jour_reprend_l_estimation(self):
        h, jid = self._inscrire("CorrEstim")
        e = self._logger(h, jid, [_serie("squat", 1)], duree=50)
        # 10 séries sans durée : estimation 10 × 3 = 30 min.
        self.client.put(f"/entrainements/{e['id']}", json={
            "series": [_serie("squat", i) for i in range(1, 11)]}, headers=h)
        self.assertEqual(self._minutes_du_jour(h, jid), 30)

    def test_corriger_une_seance_n_ecrase_pas_l_autre_du_meme_jour(self):
        h, jid = self._inscrire("CorrDeux")
        e1 = self._logger(h, jid, [_serie("squat", 1)], duree=40)
        self._logger(h, jid, [_serie("dips", 1)], duree=30)
        self.assertEqual(self._minutes_du_jour(h, jid), 70)
        self.client.put(f"/entrainements/{e1['id']}", json={
            "series": [_serie("squat", 1)], "duree_minutes": 50}, headers=h)
        self.assertEqual(self._minutes_du_jour(h, jid), 80)

    def test_valeurs_absurdes_et_liste_vide_refusees(self):
        h, jid = self._inscrire("CorrAbsurde")
        e = self._logger(h, jid, [_serie("squat", 1)])
        for corps in ({"series": []}, {"series": [_serie("squat", 1, reps=0)]},
                      {"series": [_serie("squat", 1, poids=-5)]},
                      {"series": [_serie("squat", 1)], "duree_minutes": 0}):
            self.assertEqual(self.client.put(f"/entrainements/{e['id']}", json=corps,
                                             headers=h).status_code, 422, corps)
        self.assertEqual(self._relire(h, jid, e["id"])["series"][0]["poids"], 100)

    # ------------------------------------------------------------ supprimer

    def test_supprimer_la_seule_seance_du_jour_efface_la_seance_du_jour(self):
        h, jid = self._inscrire("SupprSeule")
        e = self._logger(h, jid, [_serie("squat", 1)], duree=40)
        r = self.client.delete(f"/entrainements/{e['id']}", headers=h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json(), [])
        self.assertIsNone(self._minutes_du_jour(h, jid))

    def test_supprimer_une_des_deux_seances_garde_l_autre(self):
        h, jid = self._inscrire("SupprUne")
        e1 = self._logger(h, jid, [_serie("squat", 1)], duree=40)
        self._logger(h, jid, [_serie("dips", 1)], duree=30)
        self.client.delete(f"/entrainements/{e1['id']}", headers=h)
        self.assertEqual(self._minutes_du_jour(h, jid), 30)
        restantes = self.client.get(f"/joueurs/{jid}/entrainements", headers=h).json()
        self.assertEqual([e["series"][0]["exercice"] for e in restantes], ["dips"])

    # ------------------------------------------------------------ propriété

    def test_on_ne_touche_pas_la_seance_d_un_autre(self):
        h, jid = self._inscrire("CorrProprio")
        h2, _ = self._inscrire("CorrIntrus")
        e = self._logger(h, jid, [_serie("squat", 1)])
        corps = {"series": [_serie("squat", 1, poids=1)]}
        self.assertEqual(self.client.put(f"/entrainements/{e['id']}", json=corps, headers=h2).status_code, 403)
        self.assertEqual(self.client.delete(f"/entrainements/{e['id']}", headers=h2).status_code, 403)
        self.assertEqual(self.client.put(f"/entrainements/{e['id']}", json=corps).status_code, 401)
        self.assertEqual(self.client.delete(f"/entrainements/{e['id']}").status_code, 401)
        self.assertEqual(self._relire(h, jid, e["id"])["series"][0]["poids"], 100)

    def test_seance_inexistante(self):
        h, _ = self._inscrire("CorrAbsente")
        self.assertEqual(self.client.put("/entrainements/999999", json={
            "series": [_serie("squat", 1)]}, headers=h).status_code, 404)
        self.assertEqual(self.client.delete("/entrainements/999999", headers=h).status_code, 404)


if __name__ == "__main__":
    unittest.main()
