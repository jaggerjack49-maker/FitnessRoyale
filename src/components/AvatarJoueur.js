// Avatar évolutif : l'apparence change selon la ligue (palier moyen), du gris
// terne (Aucune) jusqu'à l'aura violette du Royal. Pas de vraies illustrations
// (physique/équipement) pour l'instant — l'évolution se joue sur la couleur,
// l'anneau et l'emblème, en attendant de vrais visuels sur mesure.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { couleursLigues } from '../data/clubSP';

// Chaque ligue a un emblème et un anneau de plus en plus marqué.
const CONFIG_LIGUE = {
  Aucune: { emblem: null, epaisseurAnneau: 0, halo: false },
  Bronze: { emblem: '🥉', epaisseurAnneau: 2, halo: false },
  Silver: { emblem: '🥈', epaisseurAnneau: 3, halo: false },
  Gold: { emblem: '🥇', epaisseurAnneau: 3, halo: true },
  Legend: { emblem: '⭐', epaisseurAnneau: 4, halo: true },
  Titan: { emblem: '⚡', epaisseurAnneau: 4, halo: true },
  Royal: { emblem: '👑', epaisseurAnneau: 5, halo: true },
};

export default function AvatarJoueur({ pseudo, ligue, taille = 64 }) {
  const config = CONFIG_LIGUE[ligue] || CONFIG_LIGUE.Aucune;
  const couleurLigue = couleursLigues[ligue] || couleursLigues.Aucune;
  const tailleEmblem = Math.round(taille * 0.34);

  return (
    <View style={{ width: taille, height: taille }}>
      <View
        style={[
          styles.avatar,
          {
            width: taille,
            height: taille,
            borderRadius: taille / 2,
            borderWidth: config.epaisseurAnneau,
            borderColor: couleurLigue,
          },
          config.halo && [styles.halo, { shadowColor: couleurLigue }],
        ]}
      >
        <Text style={[styles.avatarTexte, { fontSize: taille * 0.4 }]}>
          {pseudo ? pseudo[0].toUpperCase() : '?'}
        </Text>
      </View>
      {config.emblem && (
        <View style={[styles.badgeEmblem, { borderColor: couleurLigue }]}>
          <Text style={{ fontSize: tailleEmblem }}>{config.emblem}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarTexte: { color: colors.texte, fontWeight: '800' },
  badgeEmblem: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.carte,
    borderRadius: 12,
    borderWidth: 2,
    padding: 2,
  },
});
