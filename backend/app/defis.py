"""Défis récurrents (journalier / hebdomadaire) — validés avec de VRAIES dates.

Fini la simulation du front : ici, le serveur vérifie les séances réellement
enregistrées avant de donner les points.
- Défi du jour     : une séance d'au moins 30 minutes AUJOURD'HUI  → +20 pts
- Défi de la semaine : 4 séances dans la semaine en cours          → +100 pts
                       + le titre « Guerrier de la semaine »
Chaque défi ne peut être validé qu'une fois par période (jour ou semaine ISO).
"""

from datetime import date

# La définition des défis (mêmes textes que le front).
DEFIS = {
    "jour": {
        "id": "jour",
        "titre": "Défi du jour",
        "description": "Fais une séance aujourd'hui (minimum 30 minutes).",
        "points": 20,
        "titre_recompense": None,
    },
    "semaine": {
        "id": "semaine",
        "titre": "Défi de la semaine",
        "description": "Cumule 4 séances cette semaine.",
        "points": 100,
        "titre_recompense": "Guerrier de la semaine",
    },
}

MINUTES_MINI_JOUR = 30   # durée minimale de la séance du défi du jour
SEANCES_MINI_SEMAINE = 4  # nombre de séances pour le défi de la semaine


def periode_jour(aujourdhui: date) -> str:
    """Identifiant du jour, ex. '2026-07-19' — sert à bloquer la double validation."""
    return aujourdhui.isoformat()


def periode_semaine(aujourdhui: date) -> str:
    """Identifiant de la semaine ISO, ex. '2026-S29'."""
    annee, semaine, _ = aujourdhui.isocalendar()
    return f"{annee}-S{semaine:02d}"


def meme_semaine(date_seance: str, aujourdhui: date) -> bool:
    """La séance (date 'AAAA-MM-JJ') est-elle dans la même semaine ISO qu'aujourd'hui ?"""
    try:
        d = date.fromisoformat(date_seance)
    except ValueError:
        return False
    return d.isocalendar()[:2] == aujourdhui.isocalendar()[:2]


def defi_jour_reussi(seances: list, aujourdhui: date) -> bool:
    """Vrai si une séance d'au moins 30 min a été enregistrée aujourd'hui."""
    return any(
        s["date"] == aujourdhui.isoformat() and s["minutes"] >= MINUTES_MINI_JOUR
        for s in seances
    )


def defi_semaine_reussi(seances: list, aujourdhui: date) -> bool:
    """Vrai si au moins 4 séances ont été enregistrées cette semaine."""
    cette_semaine = [s for s in seances if meme_semaine(s["date"], aujourdhui)]
    return len(cette_semaine) >= SEANCES_MINI_SEMAINE
