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

export function estVerifiee(perf) {
  return perf.statut !== 'non_verifie';
}
