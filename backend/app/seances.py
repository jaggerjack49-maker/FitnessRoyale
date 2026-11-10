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

⚠️ C'est une ESTIMATION, pas une mesure. Depuis le 10/11/2026 l'app envoie la
durée RÉELLE (mesurée par son chrono) quand elle le peut, et c'est elle qui
prime (voir `creer_entrainement` dans main.py). Cette estimation ne sert plus
que de repli : séance d'avant le chrono, ou durée impossible à mesurer
honnêtement (séance oubliée ouverte, voir src/logic/seanceLibre.js).
"""

MINUTES_PAR_SERIE = 3   # une série + sa récupération
MINUTES_MINIMUM = 20    # même une séance courte occupe l'échauffement et le rangement


def duree_estimee(nb_series: int) -> int:
    """Minutes estimées pour une séance de `nb_series` séries."""
    if not isinstance(nb_series, int) or nb_series <= 0:
        return 0
    return max(MINUTES_MINIMUM, nb_series * MINUTES_PAR_SERIE)
