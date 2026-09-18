"""Estimer les calories d'un repas à partir d'une photo (18/09/2026).

Demande de Hafiz : « intégrer une IA qui pourra estimer les calories des
aliments avec la caméra ». Décisions prises avec lui : un JOURNAL alimentaire
avec un OBJECTIF du jour, dans l'onglet Entraînement, analysé par Claude Opus 5
(le modèle le plus précis, ~3 centimes par photo).

COMMENT ÇA MARCHE : l'app envoie la photo AU SERVEUR (jamais directement à
l'IA) ; ce module la transmet à Claude avec un FORMAT DE RÉPONSE IMPOSÉ (liste
d'aliments, portion, kcal, macros) — l'IA est garantie de répondre dans cette
forme, il n'y a pas de texte libre à décortiquer.

⚠️ LA CLÉ D'API VIT UNIQUEMENT DANS LES VARIABLES D'ENVIRONNEMENT DE RENDER
(`ANTHROPIC_API_KEY`), comme `DATABASE_URL` : jamais dans le code, jamais dans
le dépôt, jamais dans l'app. Elle donne accès à un compte PAYANT. Sans elle,
l'analyse répond « pas configurée » (503) et tout le reste de l'app marche.

LA PHOTO N'EST PAS GARDÉE : elle sert à l'analyse puis disparaît (même
principe que les vidéos de perfs). Seul le résultat chiffré est enregistré, et
seulement si le joueur l'ajoute à son journal.

C'EST UNE ESTIMATION : une photo ne montre ni l'huile de cuisson, ni le sucre
caché, ni le poids exact. L'app le dit et laisse corriger les portions.
"""

import json
import os

# Choisi avec Hafiz le 18/09/2026 : le plus précis pour reconnaître les
# aliments et estimer les portions.
MODELE = "claude-opus-5"
# Opus 5 réfléchit toujours avant de répondre ; « medium » garde une bonne
# précision pour un temps d'attente raisonnable au téléphone et un coût
# modéré. À monter à "high" si les estimations paraissent trop grossières.
EFFORT = "medium"
# Garde-fou contre un bug ou un abus qui viderait le crédit : chaque photo
# analysée coûte de l'argent. Comptée AVANT l'appel (un appel raté peut coûter).
QUOTA_ANALYSES_PAR_JOUR = 15
TYPES_IMAGE = {"image/jpeg", "image/png", "image/webp"}
# ~5 Mo d'image une fois décodée (limite de l'API). L'app réduit la photo à
# 1024 px avant l'envoi (~200 Ko) : cette borne ne sert qu'aux envois anormaux.
TAILLE_MAX_BASE64 = 7_000_000


class AnalyseNonConfiguree(Exception):
    """Pas de clé d'API sur le serveur (ou clé refusée) : la fonction est
    indisponible, sans que ce soit la faute du joueur."""


class AnalyseImpossible(Exception):
    """L'analyse a échoué ; le message est lisible tel quel par le joueur."""


# Le format IMPOSÉ à l'IA (sorties structurées). Chaque valeur nutritionnelle
# porte sur la PORTION VISIBLE, pas pour 100 g.
SCHEMA_ANALYSE = {
    "type": "object",
    "properties": {
        "est_de_la_nourriture": {"type": "boolean"},
        "description": {"type": "string"},
        "aliments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nom": {"type": "string"},
                    "portion": {"type": "string"},
                    "grammes": {"type": "number"},
                    "kcal": {"type": "number"},
                    "proteines_g": {"type": "number"},
                    "glucides_g": {"type": "number"},
                    "lipides_g": {"type": "number"},
                },
                "required": ["nom", "portion", "grammes", "kcal",
                             "proteines_g", "glucides_g", "lipides_g"],
                "additionalProperties": False,
            },
        },
        "confiance": {"type": "string", "enum": ["faible", "moyenne", "elevee"]},
        "remarque": {"type": "string"},
    },
    "required": ["est_de_la_nourriture", "description", "aliments", "confiance", "remarque"],
    "additionalProperties": False,
}

CONSIGNES = """Tu es nutritionniste. On te montre la photo d'un repas prise par \
l'utilisateur d'une app de fitness, qui veut suivre ses calories et ses \
protéines. Estime ce qu'il y a dans l'assiette.

- Un élément par aliment distinct (ex. « riz basmati », « blanc de poulet \
grillé », « sauce crème »), noms en français.
- Estime la portion VISIBLE en grammes à partir des repères de la photo \
(taille de l'assiette, des couverts, d'une main), puis donne les calories et \
les macros (protéines, glucides, lipides, en grammes) POUR CETTE PORTION, \
d'après des valeurs nutritionnelles de référence (type table Ciqual).
- `portion` est une indication lisible (« 150 g », « 1 bol », « 2 tranches »).
- Compte une matière grasse de cuisson ou une sauce seulement si elle est \
visible ou typique du plat ; dis-le alors dans `remarque`.
- `confiance` : « faible » si des ingrédients sont cachés, si la photo est \
floue ou si les portions sont difficiles à juger.
- `description` : le nom du repas en quelques mots (ex. « Poulet riz \
brocolis »).
- Si la photo ne montre pas de nourriture : `est_de_la_nourriture` = false, \
`aliments` vide, et explique dans `remarque` ce que tu vois."""

_client = None


def est_configuree() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _obtenir_client():
    """Le client Anthropic, créé au PREMIER besoin : sans clé, le serveur
    démarre quand même (et la suite de tests n'a jamais besoin du réseau)."""
    global _client
    if _client is None:
        if not est_configuree():
            raise AnalyseNonConfiguree(
                "L'analyse des repas n'est pas encore configurée sur le serveur."
            )
        import anthropic

        # 90 s : une analyse prend en général 10 à 30 s. Une seule nouvelle
        # tentative automatique, pour ne pas faire attendre le joueur trop longtemps.
        _client = anthropic.Anthropic(timeout=90.0, max_retries=1)
    return _client


def _nombre(valeur, maximum: float) -> float:
    """Un nombre >= 0, borné : une valeur absurde ou illisible devient 0 ou
    le maximum, jamais une exception."""
    try:
        n = float(valeur)
    except (TypeError, ValueError):
        return 0.0
    if n != n or n < 0:  # NaN ou négatif
        return 0.0
    return min(n, maximum)


def totaux(aliments: list) -> dict:
    """Les totaux d'une liste d'aliments. Toujours RECALCULÉS ici : on ne
    reprend jamais une addition faite par l'IA ou envoyée par l'app."""
    return {
        "kcal": round(sum(_nombre(a.get("kcal"), 10000) for a in aliments)),
        "proteines_g": round(sum(_nombre(a.get("proteines_g"), 1000) for a in aliments), 1),
        "glucides_g": round(sum(_nombre(a.get("glucides_g"), 1000) for a in aliments), 1),
        "lipides_g": round(sum(_nombre(a.get("lipides_g"), 1000) for a in aliments), 1),
    }


def normaliser_analyse(donnees) -> dict:
    """Remet la réponse de l'IA au propre : textes nettoyés et raccourcis,
    nombres positifs et bornés, aliments sans nom écartés, totaux recalculés.
    Ne plante sur aucune entrée (une réponse bancale donne une analyse vide)."""
    if not isinstance(donnees, dict):
        donnees = {}
    aliments = []
    for brut in donnees.get("aliments") or []:
        if not isinstance(brut, dict):
            continue
        nom = str(brut.get("nom") or "").strip()[:80]
        if not nom:
            continue
        aliments.append({
            "nom": nom,
            "portion": str(brut.get("portion") or "").strip()[:40],
            "grammes": round(_nombre(brut.get("grammes"), 5000)),
            "kcal": round(_nombre(brut.get("kcal"), 10000)),
            "proteines_g": round(_nombre(brut.get("proteines_g"), 1000), 1),
            "glucides_g": round(_nombre(brut.get("glucides_g"), 1000), 1),
            "lipides_g": round(_nombre(brut.get("lipides_g"), 1000), 1),
        })
    confiance = donnees.get("confiance")
    return {
        "est_de_la_nourriture": bool(donnees.get("est_de_la_nourriture")) and bool(aliments),
        "description": str(donnees.get("description") or "").strip()[:80] or "Repas",
        "aliments": aliments,
        "confiance": confiance if confiance in ("faible", "moyenne", "elevee") else "faible",
        "remarque": str(donnees.get("remarque") or "").strip()[:300],
        "totaux": totaux(aliments),
    }


def analyser_photo(image_base64: str, media_type: str, client=None) -> dict:
    """Envoie la photo à Claude et renvoie l'analyse normalisée.
    Lève AnalyseNonConfiguree ou AnalyseImpossible (messages en français)."""
    import anthropic

    client = client or _obtenir_client()
    try:
        reponse = client.beta.messages.create(
            model=MODELE,
            max_tokens=16000,
            # Reprise automatique en cas de REFUS (recommandée pour Opus 5) :
            # si le modèle décline la photo, l'API relance la même demande sur
            # un autre modèle, dans le même appel.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={
                "effort": EFFORT,
                "format": {"type": "json_schema", "schema": SCHEMA_ANALYSE},
            },
            system=CONSIGNES,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64", "media_type": media_type, "data": image_base64,
                    }},
                    {"type": "text", "text": "Analyse ce repas."},
                ],
            }],
        )
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as erreur:
        raise AnalyseNonConfiguree(
            "La clé de l'IA est refusée : vérifie ANTHROPIC_API_KEY sur Render."
        ) from erreur
    except anthropic.RateLimitError as erreur:
        raise AnalyseImpossible("L'IA est très sollicitée : réessaie dans une minute.") from erreur
    except anthropic.BadRequestError as erreur:
        raise AnalyseImpossible("L'IA n'a pas pu lire cette photo. Essaie une autre prise.") from erreur
    except anthropic.APITimeoutError as erreur:
        raise AnalyseImpossible("L'analyse a pris trop de temps. Réessaie.") from erreur
    except (anthropic.APIStatusError, anthropic.APIConnectionError) as erreur:
        raise AnalyseImpossible("Le service d'analyse ne répond pas. Réessaie plus tard.") from erreur

    if reponse.stop_reason == "refusal":
        raise AnalyseImpossible("L'IA a refusé d'analyser cette photo.")
    if reponse.stop_reason == "max_tokens":
        raise AnalyseImpossible("La réponse de l'IA était incomplète. Réessaie.")
    texte = next((b.text for b in reponse.content if getattr(b, "type", None) == "text"), None)
    try:
        donnees = json.loads(texte) if texte else None
    except json.JSONDecodeError:
        donnees = None
    if donnees is None:
        raise AnalyseImpossible("La réponse de l'IA était illisible. Réessaie.")
    return normaliser_analyse(donnees)
