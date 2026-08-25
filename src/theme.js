// Thème global de Fitness Royale : couleurs et espacements réutilisés partout.
//
// Depuis le 12/08/2026, ce fichier ne définit plus ses propres couleurs : il
// RÉEXPORTE la direction artistique importée du designer (src/designSystem.js).
// Une seule source de vérité — changer la DA change toute l'app.
//
// Les CLÉS sont inchangées (`colors.fond`, `colors.or`…) pour que les écrans
// existants continuent de fonctionner sans être réécrits ; seules les VALEURS
// suivent désormais la maquette.
import { da } from './designSystem';

export const colors = {
  fond: da.fond,             // fond sombre principal
  carte: da.carte,           // fond des cartes
  carteClaire: da.surface,   // cartes secondaires
  or: da.or,                 // couleur "Royale" — l'accent de marque
  accent: '#55c8f0',         // bleu clair de la maquette (statut « vérifié communauté »)
  vert: '#3DDC84',           // progression positive
  rouge: '#ff5470',          // défaite / négatif (rouge de la maquette)
  texte: da.texte,           // blanc cassé, plus doux qu'un blanc pur
  texteGris: da.texteGris,
  bordure: da.bordure,
};

export const espacement = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };
