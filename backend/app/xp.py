"""L'XP : la jauge d'ACTIVITÉ du joueur.

RÈGLE FONDATRICE (Hafiz, 12/08/2026) : l'XP ne détermine JAMAIS l'arène, la
ligue ni le classement. Ceux-là restent calculés sur les seules perfs
VÉRIFIÉES (voir logique.py). L'XP mesure l'ENGAGEMENT — séances, compétitions,
défis — et servira à alimenter l'Arena Pass (récompenses, badges, titres).
Voir docs/VISION_ARENA_PASS.md.

DÉCISION DE CONCEPTION — l'XP est RECALCULÉE à partir des données déjà en base
(séances, défis validés, duels gagnés), et non stockée dans un compteur qu'on
incrémenterait. Conséquences :
- impossible de double-compter (un même événement ne peut être compté 2 fois) ;
- impossible de désynchroniser (pas de compteur qui dérive de la réalité) ;
- changer le barème ci-dessous met à jour tout le monde instantanément ;
- si une donnée est supprimée, l'XP correspondante disparaît aussi (logique).
Le coût : un petit calcul à chaque lecture. Négligeable à cette échelle.
"""

from . import basededonnees as db

# Barème d'XP. Les perfs vérifiées n'en donnent PAS : elles font monter
# d'arène, ce qui est déjà leur récompense.
XP_PAR_SEANCE = 20
XP_DEFI_JOUR = 20
XP_DEFI_SEMAINE = 100
XP_DUEL_GAGNE = 50


def detail_xp(joueur_id: int) -> dict:
    """Le détail de l'XP d'un joueur, source par source (pour l'afficher)."""
    jours = db.nb_jours_actifs(joueur_id)
    defis = db.defis_valides_par_type(joueur_id)
    duels = db.nb_duels_gagnes(joueur_id)

    seances_xp = jours * XP_PAR_SEANCE
    defis_xp = (defis.get("jour", 0) * XP_DEFI_JOUR
                + defis.get("semaine", 0) * XP_DEFI_SEMAINE)
    duels_xp = duels * XP_DUEL_GAGNE

    return {
        "total": seances_xp + defis_xp + duels_xp,
        "sources": {
            "seances": {"nombre": jours, "xp": seances_xp},
            "defis": {
                "jour": defis.get("jour", 0),
                "semaine": defis.get("semaine", 0),
                "xp": defis_xp,
            },
            "duels_gagnes": {"nombre": duels, "xp": duels_xp},
        },
    }


def xp_totale(joueur_id: int) -> int:
    return detail_xp(joueur_id)["total"]
