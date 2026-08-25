// Petite barre de progression réutilisable.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function BarreProgression({ pourcentage, couleur = colors.accent, hauteur = 8 }) {
  return (
    <View style={[styles.fond, { height: hauteur }]}>
      <View
        style={[
          styles.remplissage,
          { width: `${Math.min(pourcentage, 100)}%`, backgroundColor: couleur, height: hauteur },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fond: {
    backgroundColor: colors.carteClaire,
    borderRadius: 99,
    overflow: 'hidden',
    flex: 1,
  },
  remplissage: { borderRadius: 99 },
});
