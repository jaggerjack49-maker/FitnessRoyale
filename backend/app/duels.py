"""Logique des duels BO3 — version Python (miroir de src/logic/duels.js).

Règles (identiques au front) :
- Charge fixe, le plus de répétitions gagne le round.
- Premier à 2 rounds gagnés remporte le duel (BO3 = best of 3).
- Round 1 : exercice choisi par le CHALLENGER (celui qui lance le duel).
- Round 2 : exercice choisi par l'ADVERSAIRE.
- Round 3 (départage) : exercice choisi par l'IA, au hasard parmi les
  exercices en kg, charge fixe = palier Bronze (accessible aux deux).
- Égalité de reps sur un round : personne ne marque, le round est rejoué.
"""

import random
import secrets

from .baremes import BAREMES

# Alphabet du code de duel : sans 0/O ni 1/I/L (trop ambigus à l'oral/à l'écrit).
ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generer_code(longueur: int = 6) -> str:
    """Code court à partager pour rejoindre un duel en ligne (ex. 'K7XPQR')."""
    return "".join(secrets.choice(ALPHABET_CODE) for _ in range(longueur))


def comptage_victoires(rounds: list) -> dict:
    """Compte les rounds gagnés par le challenger et par l'adversaire.

    Un round = {"reps_challenger": int|None, "reps_adversaire": int|None, ...}.
    Un round pas encore joué (reps à None) ne compte pas.
    """
    challenger = 0
    adversaire = 0
    for round_ in rounds:
        reps_c = round_.get("reps_challenger")
        reps_a = round_.get("reps_adversaire")
        if reps_c is None or reps_a is None:
            continue  # pas encore joué
        if reps_c > reps_a:
            challenger += 1
        elif reps_a > reps_c:
            adversaire += 1
        # Égalité : personne ne marque, le round sera rejoué.
    return {"challenger": challenger, "adversaire": adversaire}


def gagnant_duel(rounds: list) -> str | None:
    """Renvoie 'challenger' ou 'adversaire' si l'un a 2 victoires, sinon None."""
    score = comptage_victoires(rounds)
    if score["challenger"] >= 2:
        return "challenger"
    if score["adversaire"] >= 2:
        return "adversaire"
    return None


def exercice_aleatoire_ia(sexe: str) -> dict:
    """L'IA choisit un exercice en kg au hasard, charge = palier Bronze.

    (Le palier Bronze est accessible aux deux joueurs — duel équitable.)
    """
    exercices_kg = [
        (nom, bareme)
        for nom, bareme in BAREMES[sexe].items()
        if bareme["unite"] == "kg"
    ]
    nom, bareme = random.choice(exercices_kg)
    return {"exercice": nom, "charge": bareme["paliers"][0]}


def round_verrouille(round_: dict) -> bool:
    """Vrai si le round a un résultat DÉCISIF (reps différentes) — verrouillé,
    on ne peut plus le rejouer. Une égalité (mêmes reps) reste rejouable
    (le round « sera rejoué », voir comptage_victoires)."""
    reps_c, reps_a = round_.get("reps_challenger"), round_.get("reps_adversaire")
    return reps_c is not None and reps_a is not None and reps_c != reps_a
