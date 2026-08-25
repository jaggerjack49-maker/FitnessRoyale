// LE LOSANGE — le motif de marque de la maquette Fitness Royale.
// Un simple carré tourné à 45°, décliné partout : de part et d'autre du nom
// d'arène, devant chaque exercice, dans la barre de navigation…
// Le répéter à toutes les échelles est ce qui donne son identité à l'écran.
import React from 'react';
import { View } from 'react-native';

export default function Losange({ couleur, taille = 12, opacite = 1, style }) {
  return (
    <View
      style={[
        {
          width: taille,
          height: taille,
          backgroundColor: couleur,
          borderRadius: Math.max(2, Math.round(taille / 6)),
          transform: [{ rotate: '45deg' }],
          opacity: opacite,
        },
        style,
      ]}
    />
  );
}
