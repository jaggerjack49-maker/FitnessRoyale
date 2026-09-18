"""L'analyse d'une photo de repas par l'IA — SANS jamais appeler la vraie IA.

Chaque appel à Claude coûte de l'argent et demande une clé : ces tests
remplacent donc le client Anthropic par un FAUX client qui renvoie une
réponse choisie. Ils vérifient tout ce que NOTRE code fait de cette réponse :
nettoyage, bornes, totaux recalculés, et les cas où l'IA refuse, coupe sa
réponse ou répond n'importe quoi.
"""

import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import nutrition


def faux_client(donnees=None, stop_reason="end_turn", texte=None, erreur=None):
    """Un faux client : `client.beta.messages.create(...)` renvoie une réponse
    fabriquée (ou lève `erreur`), et garde les paramètres reçus."""
    appels = []

    def create(**parametres):
        appels.append(parametres)
        if erreur is not None:
            raise erreur
        contenu = texte if texte is not None else json.dumps(donnees)
        return SimpleNamespace(
            stop_reason=stop_reason,
            content=[SimpleNamespace(type="thinking", thinking=""),
                     SimpleNamespace(type="text", text=contenu)],
        )

    client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
    return client, appels


REPAS = {
    "est_de_la_nourriture": True,
    "description": "Poulet riz brocolis",
    "aliments": [
        {"nom": "Blanc de poulet grillé", "portion": "150 g", "grammes": 150,
         "kcal": 248, "proteines_g": 46.5, "glucides_g": 0, "lipides_g": 5.4},
        {"nom": "Riz basmati", "portion": "1 bol", "grammes": 180,
         "kcal": 234, "proteines_g": 4.9, "glucides_g": 50.4, "lipides_g": 0.5},
    ],
    "confiance": "moyenne",
    "remarque": "Huile de cuisson non visible.",
}


class TestNormalisation(unittest.TestCase):
    def test_totaux_recalcules(self):
        analyse = nutrition.normaliser_analyse(REPAS)
        self.assertEqual(analyse["totaux"], {
            "kcal": 482, "proteines_g": 51.4, "glucides_g": 50.4, "lipides_g": 5.9,
        })
        self.assertTrue(analyse["est_de_la_nourriture"])

    def test_valeurs_absurdes_bornees_et_nettoyees(self):
        analyse = nutrition.normaliser_analyse({
            "est_de_la_nourriture": True, "description": "  x  ",
            "aliments": [
                {"nom": "  Pâtes  ", "portion": "p" * 99, "grammes": -20, "kcal": 99999,
                 "proteines_g": "12", "glucides_g": None, "lipides_g": float("nan")},
                {"nom": "   ", "kcal": 500},  # sans nom : écarté
                "pas un aliment",               # pas un objet : écarté
            ],
            "confiance": "certaine",            # hors liste : ramenée à « faible »
            "remarque": "",
        })
        self.assertEqual(len(analyse["aliments"]), 1)
        a = analyse["aliments"][0]
        self.assertEqual(a["nom"], "Pâtes")
        self.assertEqual(len(a["portion"]), 40)
        self.assertEqual(a["grammes"], 0)
        self.assertEqual(a["kcal"], 10000)
        self.assertEqual(a["proteines_g"], 12.0)
        self.assertEqual(a["glucides_g"], 0.0)
        self.assertEqual(a["lipides_g"], 0.0)
        self.assertEqual(analyse["confiance"], "faible")

    def test_nourriture_sans_aliment_nest_pas_un_repas(self):
        analyse = nutrition.normaliser_analyse(
            {"est_de_la_nourriture": True, "aliments": [], "remarque": "Assiette vide."})
        self.assertFalse(analyse["est_de_la_nourriture"])

    def test_entrees_abimees_ne_plantent_jamais(self):
        for entree in (None, [], "texte", 42, {"aliments": "pas une liste"}):
            with self.subTest(entree=entree):
                analyse = nutrition.normaliser_analyse(entree)
                self.assertFalse(analyse["est_de_la_nourriture"])
                self.assertEqual(analyse["totaux"]["kcal"], 0)


class TestAnalyserPhoto(unittest.TestCase):
    def test_reponse_normale(self):
        client, appels = faux_client(REPAS)
        analyse = nutrition.analyser_photo("QUJD", "image/jpeg", client=client)
        self.assertEqual(analyse["description"], "Poulet riz brocolis")
        self.assertEqual(analyse["totaux"]["kcal"], 482)
        # Ce qui part à l'IA : le bon modèle, le format imposé, la photo en base64.
        p = appels[0]
        self.assertEqual(p["model"], "claude-opus-5")
        self.assertEqual(p["output_config"]["format"]["schema"], nutrition.SCHEMA_ANALYSE)
        image = p["messages"][0]["content"][0]
        self.assertEqual(image["source"], {"type": "base64", "media_type": "image/jpeg", "data": "QUJD"})

    def test_refus_de_l_ia(self):
        client, _ = faux_client(REPAS, stop_reason="refusal")
        with self.assertRaises(nutrition.AnalyseImpossible):
            nutrition.analyser_photo("QUJD", "image/jpeg", client=client)

    def test_reponse_coupee(self):
        client, _ = faux_client(REPAS, stop_reason="max_tokens")
        with self.assertRaises(nutrition.AnalyseImpossible):
            nutrition.analyser_photo("QUJD", "image/jpeg", client=client)

    def test_reponse_illisible(self):
        client, _ = faux_client(texte="{pas du json")
        with self.assertRaises(nutrition.AnalyseImpossible):
            nutrition.analyser_photo("QUJD", "image/jpeg", client=client)

    def test_erreurs_de_l_api_traduites(self):
        import anthropic
        import httpx2

        requete = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")

        def reponse(code):
            return httpx2.Response(code, request=requete)

        cas = [
            (anthropic.AuthenticationError("cle", response=reponse(401), body=None),
             nutrition.AnalyseNonConfiguree),
            (anthropic.RateLimitError("trop", response=reponse(429), body=None),
             nutrition.AnalyseImpossible),
            (anthropic.InternalServerError("panne", response=reponse(500), body=None),
             nutrition.AnalyseImpossible),
            (anthropic.APIConnectionError(request=requete), nutrition.AnalyseImpossible),
        ]
        for erreur, attendue in cas:
            with self.subTest(erreur=type(erreur).__name__):
                client, _ = faux_client(erreur=erreur)
                with self.assertRaises(attendue):
                    nutrition.analyser_photo("QUJD", "image/jpeg", client=client)

    def test_sans_cle_pas_de_client(self):
        import os
        ancienne = os.environ.pop("ANTHROPIC_API_KEY", None)
        nutrition._client = None
        try:
            self.assertFalse(nutrition.est_configuree())
            with self.assertRaises(nutrition.AnalyseNonConfiguree):
                nutrition.analyser_photo("QUJD", "image/jpeg")
        finally:
            if ancienne is not None:
                os.environ["ANTHROPIC_API_KEY"] = ancienne


if __name__ == "__main__":
    unittest.main()
