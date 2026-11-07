// Avatar évolutif : l'apparence change selon la ligue (palier moyen), du gris
// terne (Aucune) jusqu'à l'aura violette du Royal. Pas de vraies illustrations
// (physique/équipement) pour l'instant — l'évolution se joue sur la couleur,
// l'anneau et l'emblème, en attendant de vrais visuels sur mesure.
//
// DEPUIS LE 08/11/2026 (DA des onglets, sur le modèle de l'Entraînement) :
// - l'EMBLÈME n'est plus un emoji (🥉🥈🥇⭐⚡👑) mais l'icône de l'ARÈNE de la
//   ligue, teintée à sa couleur. Un emblème = une arène, partout dans l'app :
//   la route des arènes, la carte d'arène et l'avatar montrent le même dessin ;
// - le disque n'est plus CYAN (`colors.accent`) : c'était la couleur la plus
//   criarde de l'accueil, et elle ne disait rien. Il prend une surface sombre,
//   et c'est l'INITIALE qui porte la couleur de la ligue — avec l'anneau,
//   le joueur se reconnaît à sa couleur d'un coup d'œil.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { da } from '../designSystem';
import { couleursLigues } from '../data/clubSP';
import { areneDeLaLigue } from '../data/arenes';
import { Icone } from './Icones';

// Chaque ligue a un anneau de plus en plus marqué (l'emblème vient de l'arène).
const CONFIG_LIGUE = {
  Aucune: { epaisseurAnneau: 0, halo: false },
  Bronze: { epaisseurAnneau: 2, halo: false },
  Silver: { epaisseurAnneau: 3, halo: false },
  Gold: { epaisseurAnneau: 3, halo: true },
  Legend: { epaisseurAnneau: 4, halo: true },
  Titan: { epaisseurAnneau: 4, halo: true },
  Royal: { epaisseurAnneau: 5, halo: true },
};

export default function AvatarJoueur({ pseudo, ligue, taille = 64 }) {
  const config = CONFIG_LIGUE[ligue] || CONFIG_LIGUE.Aucune;
  const couleurLigue = couleursLigues[ligue] || couleursLigues.Aucune;
  const arene = areneDeLaLigue(ligue);
  // Pas d'emblème au départ (aucune perf vérifiée) : il se GAGNE.
  const aUnEmbleme = ligue && ligue !== 'Aucune' && arene && arene.icone;
  const tailleEmblem = Math.max(10, Math.round(taille * 0.3));
  const couleurInitiale = ligue && ligue !== 'Aucune' ? couleurLigue : colors.texte;

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
        <Text style={[styles.avatarTexte, { fontSize: taille * 0.4, color: couleurInitiale }]}>
          {pseudo ? pseudo[0].toUpperCase() : '?'}
        </Text>
      </View>
      {aUnEmbleme ? (
        <View style={[styles.badgeEmblem, { borderColor: couleurLigue }]}>
          <Icone nom={arene.icone} taille={tailleEmblem} couleur={couleurLigue} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: da.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarTexte: { fontWeight: '900' },
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
