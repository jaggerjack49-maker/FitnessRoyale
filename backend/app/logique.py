"""Logique de classement Fitness Royale — version Python (miroir de src/logic/classement.js).

Règles :
- Seules les performances VÉRIFIÉES (communauté ou salle) comptent.
- Palier moyen = score de classement (jamais affiché, on affiche le RANG).
- Égalité de palier moyen -> départage aux points de compétition.
"""

from .baremes import BAREMES, NOMS_LIGUES

STATUTS_VERIFIES = ("communaute", "salle")


def est_verifiee(perf: dict) -> bool:
    """Une perf 'declare' (déclarée) ne compte pas au classement."""
    return perf["statut"] in STATUTS_VERIFIES


def palier_exercice(sexe: str, exercice: str, valeur: float) -> int:
    """Palier atteint sur UN exercice : 0 = aucun, 1 = Bronze, 2 = Silver, etc."""
    bareme = BAREMES[sexe].get(exercice)
    if bareme is None:
        return 0
    palier = 0
    for i, seuil in enumerate(bareme["paliers"]):
        if valeur >= seuil:
            palier = i + 1
    return palier


def perfs_verifiees(joueur: dict) -> list:
    """Liste des perfs vérifiées d'un joueur : [(exercice, perf), ...]."""
    return [(exo, perf) for exo, perf in joueur["performances"].items() if est_verifiee(perf)]


def moyenne_paliers(joueur: dict) -> float:
    """Palier moyen (2 décimales) -- le vrai score de classement.

    IMPORTANT : la moyenne se calcule sur TOUS les exercices du barème, pas
    seulement ceux vérifiés -- un exercice sans perf vérifiée compte pour 0.
    Ça récompense la polyvalence (voir la même règle dans classement.js).
    """
    nb_exercices = len(BAREMES.get(joueur["sexe"], {}))
    if nb_exercices == 0:
        return 0.0
    verifiees = perfs_verifiees(joueur)
    total = sum(palier_exercice(joueur["sexe"], exo, perf["valeur"]) for exo, perf in verifiees)
    return round(total / nb_exercices, 2)


def ligue_joueur(joueur: dict) -> str:
    """Ligue = palier moyen arrondi. 'Aucune' si aucune perf vérifiée."""
    moyenne = moyenne_paliers(joueur)
    if moyenne == 0:
        return "Aucune"
    index = min(round(moyenne), len(NOMS_LIGUES))
    if index == 0:
        return "Aucune"
    return NOMS_LIGUES[index - 1]


def categorie_poids(poids: float) -> str:
    """Catégorie de poids pour le classement relatif."""
    if poids < 60:
        return "-60 kg"
    if poids < 70:
        return "-70 kg"
    if poids < 80:
        return "-80 kg"
    if poids < 90:
        return "-90 kg"
    return "+90 kg"


ORDRE_CATEGORIES = ["-60 kg", "-70 kg", "-80 kg", "-90 kg", "+90 kg"]


def _enrichir(joueur: dict) -> dict:
    """Ajoute ligue et moyenne (calcul interne) à un joueur."""
    return {
        **joueur,
        "ligue": ligue_joueur(joueur),
        "_moyenne": moyenne_paliers(joueur),
    }


def classer_global(joueurs: list) -> list:
    """Classement global : palier moyen décroissant, départage aux points.

    Renvoie la liste avec le champ 'rang' (1 = premier). La moyenne reste interne.
    """
    enrichis = [_enrichir(j) for j in joueurs]
    enrichis.sort(key=lambda j: (-j["_moyenne"], -j.get("points", 0)))
    resultat = []
    for rang, joueur in enumerate(enrichis, start=1):
        joueur = dict(joueur)
        joueur["rang"] = rang
        del joueur["_moyenne"]  # jamais exposée : on affiche le rang, c'est tout
        resultat.append(joueur)
    return resultat


def classer_par_categories(joueurs: list) -> list:
    """Classement par catégories de poids : [{categorie, joueurs classés}, ...]."""
    classes = classer_global(joueurs)
    groupes = []
    for categorie in ORDRE_CATEGORIES:
        membres = [j for j in classes if categorie_poids(j["poids"]) == categorie]
        if not membres:
            continue
        for rang, joueur in enumerate(membres, start=1):
            joueur["rang"] = rang  # rang DANS la catégorie
        groupes.append({"categorie": categorie, "joueurs": membres})
    return groupes


def cle_salle(salle) -> str:
    """La forme COMPARABLE d'un nom de salle : espaces normalisés, minuscules.

    POURQUOI (correctif du 04/09/2026) : la salle sert d'identifiant de clan —
    elle regroupe le classement par salle ET donne accès au chat. Comparée
    telle quelle, « Iron Temple », « iron temple » et « Iron Temple » (espace
    final) étaient TROIS clans distincts : deux membres de la même salle ne se
    voyaient jamais.

    On ne touche PAS aux accents, volontairement : ils distinguent des noms
    réellement différents bien plus souvent qu'ils ne créent de doublons.
    Portage identique de `cleSalle()` dans src/logic/classement.js.
    """
    return " ".join(str(salle or "").split()).lower()


def nom_salle_affiche(salle) -> str:
    """L'orthographe GARDÉE POUR L'AFFICHAGE : espaces normalisés, casse
    laissée telle que l'utilisateur l'a écrite."""
    return " ".join(str(salle or "").split())


def classer_salles(joueurs: list) -> list:
    """Classement des salles (clans) : palier moyen des membres, départage aux points cumulés."""
    # On REGROUPE sur la clé normalisée mais on AFFICHE l'orthographe du
    # premier membre rencontré — sinon le classement montrerait « iron temple ».
    par_salle = {}
    noms_affiches = {}
    for joueur in joueurs:
        salle = joueur.get("salle")
        if not salle or not cle_salle(salle):
            continue
        cle = cle_salle(salle)
        noms_affiches.setdefault(cle, nom_salle_affiche(salle))
        par_salle.setdefault(cle, []).append(joueur)
    salles = []
    for cle, membres in par_salle.items():
        salle = noms_affiches[cle]
        moyenne = round(sum(moyenne_paliers(m) for m in membres) / len(membres), 2)
        salles.append({
            "salle": salle,
            "nb_membres": len(membres),
            "_moyenne": moyenne,
            "_points": sum(m.get("points", 0) for m in membres),
        })
    salles.sort(key=lambda s: (-s["_moyenne"], -s["_points"]))
    resultat = []
    for rang, s in enumerate(salles, start=1):
        resultat.append({"rang": rang, "salle": s["salle"], "nb_membres": s["nb_membres"]})
    return resultat


# ----- Classement par exercice -----
# Même liste d'exercices pour les deux sexes (mêmes noms, seuils différents).
LISTE_EXERCICES_CLASSEMENT = list(BAREMES["homme"].keys())


def classer_par_exercice(joueurs: list, exercice: str) -> list:
    """Classe les joueurs ayant une perf VÉRIFIÉE sur CET exercice, par palier
    atteint. Départage aux points (PAS à la valeur brute : comparer des kg
    entre hommes et femmes serait injuste, les barèmes n'ont pas la même
    échelle -- le palier normalise déjà ça, comme partout ailleurs)."""
    participants = []
    for j in joueurs:
        perf = j["performances"].get(exercice)
        if perf is None or not est_verifiee(perf):
            continue
        participants.append({
            **j,
            "palier_exo": palier_exercice(j["sexe"], exercice, perf["valeur"]),
            "valeur_exo": perf["valeur"],
        })
    participants.sort(key=lambda j: (-j["palier_exo"], -j.get("points", 0)))
    return participants
