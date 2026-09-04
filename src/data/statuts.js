// Les 3 statuts d'une performance (preuve de performance).
// - declare    : auto-reporté → suivi perso uniquement, NE COMPTE PAS au classement
// - communaute : vidéo validée par la communauté → compte au classement
// - salle      : validé par une salle partenaire → badge officiel, compte au classement
// (Clé technique conservée : 'non_verifie' = statut "Déclaré".)
export const STATUTS = {
  non_verifie: { libelle: 'Déclaré', emoji: '📝', couleur: '#8A93A6' },
  communaute: { libelle: 'Vérifié communauté', emoji: '👥', couleur: '#4F8DFD' },
  salle: { libelle: 'Vérifié salle', emoji: '🏋️', couleur: '#3DDC84' },
};

// Les seuls statuts qui COMPTENT au classement. Miroir exact de
// `STATUTS_VERIFIES` dans backend/app/logique.py.
export const STATUTS_VERIFIES = ['communaute', 'salle'];

// BUG LATENT CORRIGÉ (04/09/2026, trouvé par le test de parité front/back) :
// cette fonction était écrite « à l'envers » — elle acceptait TOUT SAUF
// 'non_verifie'. Or le serveur n'emploie PAS ce mot : sa base n'autorise que
// 'declare', 'communaute' et 'salle'. Une perf DÉCLARÉE arrivant du serveur
// était donc comptée comme VÉRIFIÉE, en contradiction directe avec la règle
// fondatrice du projet (« seul le vérifié compte »).
// En pratique l'app était sauvée par `statutDepuisAPI()` (src/api.js), qui
// traduit 'declare' en 'non_verifie' à l'entrée — mais il suffisait d'un seul
// chemin oubliant cette traduction pour fausser ligue, classement et arène,
// sans aucun signal. On énumère donc ce qui compte, au lieu d'exclure ce qui
// ne compte pas : les deux vocabulaires sont désormais gérés correctement.
export function estVerifiee(perf) {
  return STATUTS_VERIFIES.includes(perf && perf.statut);
}
