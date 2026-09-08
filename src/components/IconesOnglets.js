// ICÔNES DE LA BARRE D'ONGLETS — piste « Arène » (validée le 08/09/2026).
//
// Les tracés viennent de Lucide (ISC, https://lucide.dev). On les redessine
// ici avec react-native-svg (déjà dans package.json) plutôt que d'ajouter
// la dépendance lucide-react-native : six icônes, autant les figer.
//
// Toutes les icônes partagent la même grille 24x24 et le même trait, donc
// elles s'alignent optiquement sans réglage au cas par cas.

import React from 'react';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';

// Enveloppe commune : taille, couleur et épaisseur de trait au même endroit.
function Cadre({ taille = 20, couleur, epaisseur = 2.25, children }) {
  return (
    <Svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

// Profil — buste (lucide « user-round »)
export function IconeProfil(props) {
  return (
    <Cadre {...props}>
      <Circle cx="12" cy="8" r="5" />
      <Path d="M20 21a8 8 0 0 0-16 0" />
    </Cadre>
  );
}

// Perfs — courbe qui monte (lucide « trending-up »)
export function IconePerfs(props) {
  return (
    <Cadre {...props}>
      <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <Polyline points="16 7 22 7 22 13" />
    </Cadre>
  );
}

// Paliers — couronne (lucide « crown »)
export function IconePaliers(props) {
  return (
    <Cadre {...props}>
      <Path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <Path d="M5 21h14" />
    </Cadre>
  );
}

// Compétition — trophée (lucide « trophy »)
export function IconeCompetition(props) {
  return (
    <Cadre {...props}>
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <Path d="M4 22h16" />
      <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Cadre>
  );
}

// Entraînement — haltère (lucide « dumbbell »)
export function IconeEntrainement(props) {
  return (
    <Cadre {...props}>
      <Path d="m6.5 6.5 11 11" />
      <Path d="m21 21-1-1" />
      <Path d="m3 3 1 1" />
      <Path d="m18 22 4-4" />
      <Path d="m2 6 4-4" />
      <Path d="m3 10 7-7" />
      <Path d="m14 21 7-7" />
    </Cadre>
  );
}

// Clan — groupe (lucide « users-round »)
export function IconeClan(props) {
  return (
    <Cadre {...props}>
      <Path d="M18 21a8 8 0 0 0-16 0" />
      <Circle cx="10" cy="8" r="5" />
      <Path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </Cadre>
  );
}

// Une clé d'onglet -> son icône. C'est la seule table à toucher si l'ordre
// des onglets change dans App.js.
export const ICONES_ONGLETS = {
  profil: IconeProfil,
  perfs: IconePerfs,
  paliers: IconePaliers,
  competition: IconeCompetition,
  entrainement: IconeEntrainement,
  clan: IconeClan,
};
