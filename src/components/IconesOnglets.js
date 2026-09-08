// LES ICÔNES DE LA BARRE D'ONGLETS — piste « Arène » (08/09/2026).
//
// ⚠️ FICHIER DE REMPLACEMENT. Il devait venir de
// `a-copier/src-components-IconesOnglets.js`, qui était introuvable sur ce
// poste au moment d'appliquer la piste. Le CONTRAT est celui décrit par les
// consignes et respecté à la lettre — App.js n'a rien à savoir de plus :
//   `ICONES_ONGLETS[cle]` = un composant qui prend { taille, couleur }.
// Pour remettre les icônes d'origine, il suffit d'écraser CE fichier : rien
// d'autre ne bouge dans l'app.
//
// PARTI PRIS DE DESSIN : des traits, pas des aplats. La barre est posée sur
// une carte sombre et l'onglet actif s'annonce déjà par sa couleur (or), son
// liseré et sa pastille voilée — une icône pleine ferait un troisième signal
// et alourdirait le bas de l'écran. Le trait garde aussi le même poids visuel
// que le reste de la DA (voir designSystem.js).
//
// Tout est dessiné dans un carré de 24 × 24 : un seul `viewBox` pour les six,
// donc des icônes qui font la même taille optique une fois côte à côte.
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// Le cadre commun. `couleur` pilote le trait — jamais de couleur en dur ici,
// c'est App.js qui décide (or si l'onglet est actif, gris sinon).
function Cadre({ taille, children }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

// Les réglages de trait, identiques partout : c'est ce qui fait que les six
// icônes se lisent comme une seule famille.
const trait = (couleur) => ({
  stroke: couleur,
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

// PROFIL — une tête et des épaules.
function IconeProfil({ taille = 20, couleur }) {
  return (
    <Cadre taille={taille}>
      <Circle cx="12" cy="8" r="3.6" {...trait(couleur)} />
      <Path d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8" {...trait(couleur)} />
    </Cadre>
  );
}

// PERFS — trois barres qui montent (le geste du progrès, pas un graphique
// complet : à 20 px, des axes ne seraient qu'une bouillie de traits).
function IconePerfs({ taille = 20, couleur }) {
  return (
    <Cadre taille={taille}>
      <Path d="M5.5 20v-5" {...trait(couleur)} />
      <Path d="M12 20V9.5" {...trait(couleur)} />
      <Path d="M18.5 20V4.5" {...trait(couleur)} />
    </Cadre>
  );
}

// PALIERS — un podium à marches. C'est exactement ce que le mot désigne dans
// l'app : des degrés qu'on gravit, pas une récompense.
function IconePaliers({ taille = 20, couleur }) {
  return (
    <Cadre taille={taille}>
      <Rect x="9.2" y="7" width="5.6" height="13" rx="1.2" {...trait(couleur)} />
      <Path d="M9.2 12.2H4.6a1.2 1.2 0 0 0-1.2 1.2V20h5.8" {...trait(couleur)} />
      <Path d="M14.8 15h4.6a1.2 1.2 0 0 1 1.2 1.2V20h-5.8" {...trait(couleur)} />
    </Cadre>
  );
}

// COMPÉTITION — deux épées croisées. Le duel est le cœur de cet onglet, et
// c'est déjà le vocabulaire de l'app (« ARÈNE — LANCER UN DUEL »).
//
// QUATRE TRAITS, PAS PLUS (corrigé après l'avoir vue dans la barre) : une
// première version dessinait les lames en polygones avec pointes et pommeaux
// séparés. À 20 px, ces traits se chevauchaient et l'icône ne se lisait plus
// que comme un gribouillis. Ici chaque épée est UNE diagonale (lame +
// poignée d'un seul trait) barrée d'une garde perpendiculaire près du bas.
function IconeCompetition({ taille = 20, couleur }) {
  return (
    <Cadre taille={taille}>
      <Path d="M4.6 4.6 18.5 18.5" {...trait(couleur)} />
      <Path d="M19.4 4.6 5.5 18.5" {...trait(couleur)} />
      <Path d="M13.2 17.4 17.4 13.2" {...trait(couleur)} />
      <Path d="M6.6 13.2 10.8 17.4" {...trait(couleur)} />
    </Cadre>
  );
}

// ENTRAÎNEMENT — un haltère, vu de côté : barre centrale, deux disques,
// deux embouts. La forme la plus reconnaissable à cette taille.
function IconeEntrainement({ taille = 20, couleur }) {
  return (
    <Cadre taille={taille}>
      <Path d="M9 12h6" {...trait(couleur)} />
      <Rect x="5.6" y="8.4" width="3.4" height="7.2" rx="1.2" {...trait(couleur)} />
      <Rect x="15" y="8.4" width="3.4" height="7.2" rx="1.2" {...trait(couleur)} />
      <Path d="M3.4 10.4v3.2M20.6 10.4v3.2" {...trait(couleur)} />
    </Cadre>
  );
}

// CLAN — un blason. L'onglet réunit la salle, ses membres et son chat : le
// blason dit l'appartenance, là où une bulle de dialogue ne dirait que le chat.
function IconeClan({ taille = 20, couleur }) {
  return (
    <Cadre taille={taille}>
      <Path d="M12 3.4 19.4 6v5.6c0 4-3.1 7.4-7.4 9-4.3-1.6-7.4-5-7.4-9V6L12 3.4z" {...trait(couleur)} />
      <Path d="M8.8 11.6 11.2 14l4-4.4" {...trait(couleur)} />
    </Cadre>
  );
}

// La table lue par App.js. Les clés sont celles du tableau ONGLETS —
// les deux doivent rester d'accord.
export const ICONES_ONGLETS = {
  profil: IconeProfil,
  perfs: IconePerfs,
  paliers: IconePaliers,
  competition: IconeCompetition,
  entrainement: IconeEntrainement,
  clan: IconeClan,
};

export default ICONES_ONGLETS;
