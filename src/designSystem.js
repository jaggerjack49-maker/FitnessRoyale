// DIRECTION ARTISTIQUE — reprise de la maquette « Fitness Royale.dc.html »
// (projet claude.ai/design importé le 12/08/2026).
//
// Utilisée pour l'instant par l'ÉCRAN D'ACCUEIL uniquement. Les autres écrans
// gardent `src/theme.js` — les deux palettes sont volontairement proches
// (mêmes noirs, même or) pour que la transition ne choque pas ; propager la DA
// au reste de l'app se fera écran par écran.
//
// Signes distinctifs de cette DA :
// - le LOSANGE (carré tourné à 45°) comme motif de marque, répété partout ;
// - des titres très gras, resserrés, avec un mot en or ;
// - les chiffres en chasse fixe (monospace) pour l'effet « tableau de bord » ;
// - un fond quasi noir et des cartes à peine plus claires.

export const da = {
  // Fonds
  fond: '#0c0b0f',
  fondHaut: '#111016',
  carte: '#17161d',
  carteHaute: '#1b1a22',
  carteBasse: '#141319',
  surface: '#26242e',
  surfaceAlt: '#1d1c24',

  // Or de la marque
  or: '#e8b23a',
  orClair: '#f2c95c',
  orSombre: '#141319', // texte posé SUR de l'or

  // Textes
  texte: '#f2f0ea',
  texteDoux: '#c9c5bb',
  texteGris: '#9a97a0',
  texteMuet: '#75727c',

  // Bordures
  bordure: 'rgba(255,255,255,.07)',
  bordureFine: 'rgba(255,255,255,.05)',
  bordureOr: 'rgba(232,178,58,.4)',
  bordureOrDouce: 'rgba(232,178,58,.35)',

  // Fonds d'accent
  orVoile: 'rgba(232,178,58,.08)',
  duelFond: '#2a1f10',
  duelFondBas: '#1c150c',
};

// Les chiffres en chasse fixe : sur téléphone comme sur web, on demande une
// police monospace système (aucune police à installer).
export const monospace = 'Courier New';

// Titre d'écran de la maquette : très gras, resserré, un mot en or.
// RN ne connaît pas `font-stretch` : on approche l'effet condensé avec un
// letterSpacing serré et un poids maximal.
export const titreEcran = {
  color: da.texte,
  fontSize: 24,
  fontWeight: '900',
  letterSpacing: 0.5,
};

export const sousTitreEcran = {
  color: da.texteGris,
  fontSize: 12,
  marginTop: 4,
};
