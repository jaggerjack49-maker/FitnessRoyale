// Carte affichant une statistique (valeur + libellé).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';

export default function CarteStat({ valeur, libelle, emoji }) {
  return (
    <View style={styles.carte}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.valeur}>{valeur}</Text>
      <Text style={styles.libelle}>{libelle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: espacement.xs,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  emoji: { fontSize: 22, marginBottom: espacement.xs },
  valeur: { color: colors.texte, fontSize: 20, fontWeight: '700' },
  libelle: { color: colors.texteGris, fontSize: 12, marginTop: 2, textAlign: 'center' },
});
