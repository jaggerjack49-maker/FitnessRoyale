"""La durée d'une séance loggée — estimée, faute de chronomètre (24/09/2026).

POURQUOI CETTE RÈGLE EXISTE : le journal d'entraînement note les séries, pas le
temps passé. Or deux choses ont besoin d'une DURÉE :
  - le compteur « Cette semaine » du Profil (séances, minutes, calories) ;
  - le défi du jour, qui demande une séance d'au moins 30 minutes.

L'app faisait déjà cette estimation dans son coin (≈3 min par série, 20 min
minimum) pour son compteur local. Elle vit maintenant ICI, côté serveur, à
l'endroit où la séance est enregistrée — sinon la même règle existerait à deux
endroits, et le projet a déjà payé ce genre de division (voir CLAUDE.md :
« UNE SEULE DÉFINITION »).

⚠️ C'est une ESTIMATION, pas une mesure. Un champ « durée réelle » reste noté
dans « À faire » ; le jour où il existera, il remplacera simplement cet appel.
"""

MINUTES_PAR_SERIE = 3   # une série + sa récupération
MINUTES_MINIMUM = 20    # même une séance courte occupe l'échauffement et le rangement


def duree_estimee(nb_series: int) -> int:
    """Minutes estimées pour une séance de `nb_series` séries."""
    if not isinstance(nb_series, int) or nb_series <= 0:
        return 0
    return max(MINUTES_MINIMUM, nb_series * MINUTES_PAR_SERIE)
