"""MODE TEST — outils réservés aux comptes ADMINISTRATEUR.

À quoi ça sert : tester le système de RANKING demande plusieurs joueurs à des
niveaux variés, et remplir 15 exercices à la main pour chacun est infernal.
Ces fonctions peuplent tout ça en un appel.

SÉCURITÉ — deux garde-fous simples mais suffisants pour un projet perso :
1. Le drapeau `admin` ne s'active JAMAIS depuis l'app : il se met à la main en
   base (voir "Mode test" dans CLAUDE.md). Un joueur ne peut donc pas se
   l'accorder tout seul, même en bidouillant les requêtes.
2. Les joueurs créés ici sont marqués `est_test = 1` et n'ont PAS de mot de
   passe : personne ne peut s'y connecter, et on peut tous les supprimer d'un
   coup sans jamais toucher aux vrais comptes.
"""

import random

from . import basededonnees as db
from .baremes import BAREMES

# Prénoms neutres pour les joueurs factices — reconnaissables au premier coup
# d'œil grâce au préfixe, pour ne jamais les confondre avec de vrais joueurs.
PREFIXE_TEST = "TEST-"
_PRENOMS = [
    "Alex", "Sam", "Charlie", "Robin", "Camille", "Morgan", "Noa", "Eden",
    "Lou", "Sacha", "Andrea", "Maxime", "Jordan", "Yael", "Kim", "Ilan",
]


def valeur_pour_palier(bareme_exercice: dict, palier: int) -> float:
    """La valeur exacte qui fait atteindre ce palier (1 = Bronze, 2 = Silver…).

    palier 0 → None (aucune perf). Un palier au-delà du barème est ramené au
    maximum (les femmes ont 5 paliers, les hommes 6)."""
    paliers = bareme_exercice["paliers"]
    if palier <= 0:
        return None
    return paliers[min(palier, len(paliers)) - 1]


def remplir_performances(joueur_id: int, sexe: str, palier: int,
                         nb_exercices: int | None = None,
                         statut: str = "salle") -> int:
    """Donne au joueur des perfs VÉRIFIÉES au palier demandé.

    `nb_exercices` = sur combien d'exercices (None = tout le barème). C'est le
    levier clé pour tester le classement : depuis « la polyvalence
    récompensée », la moyenne se calcule sur TOUS les exercices du barème, donc
    10 exercices à Gold ne donnent pas la même position que 15.
    Renvoie le nombre de perfs écrites."""
    bareme = BAREMES.get(sexe, {})
    exercices = list(bareme.keys())
    if nb_exercices is not None:
        exercices = exercices[:max(0, nb_exercices)]
    ecrites = 0
    for exercice in exercices:
        valeur = valeur_pour_palier(bareme[exercice], palier)
        if valeur is None:
            continue
        db.enregistrer_performance(joueur_id, exercice, valeur, statut)
        ecrites += 1
    return ecrites


def generer_joueurs(nombre: int, palier_min: int = 1, palier_max: int = 6,
                    sexe: str = "homme", salle: str | None = None) -> list:
    """Crée `nombre` joueurs factices répartis entre les deux paliers donnés.

    On fait aussi varier le NOMBRE d'exercices vérifiés (60 % à 100 % du
    barème) : sans ça, tous les joueurs d'un même palier auraient exactement la
    même moyenne et le classement serait un paquet d'ex æquo — ce qui ne
    testerait rien."""
    crees = []
    nb_total_exos = len(BAREMES.get(sexe, {})) or 15
    for i in range(nombre):
        palier = random.randint(min(palier_min, palier_max), max(palier_min, palier_max))
        prenom = random.choice(_PRENOMS)
        pseudo = f"{PREFIXE_TEST}{prenom}{random.randint(100, 999)}"
        poids = round(random.uniform(55, 105), 1)
        points = random.randint(0, 600)
        joueur_id = db.creer_joueur_test(pseudo, sexe, poids, salle, points)
        nb_exos = random.randint(max(1, int(nb_total_exos * 0.6)), nb_total_exos)
        remplir_performances(joueur_id, sexe, palier, nb_exos)
        crees.append({"id": joueur_id, "pseudo": pseudo, "palier": palier,
                      "exercices": nb_exos, "points": points})
    return crees
