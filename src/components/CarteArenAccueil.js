// La carte d'arène de l'ACCUEIL, au style de la maquette :
// une aura qui pulse derrière l'avatar, le nom d'arène encadré de deux
// losanges, et la barre de progression vers l'arène suivante.
//
// Différente de `CarteArene.js` (utilisée par l'écran Paliers) : celle-ci suit
// la direction artistique importée du designer et met en scène le palier
// plutôt que de le décrire.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { da, monospace } from '../designSystem';
import { couleursLigues } from '../data/clubSP';
import Losange from './Losange';
import AvatarJoueur from './AvatarJoueur';

export default function CarteArenAccueil({ joueur, arene, salle }) {
  const { actuelle, suivante, manquants, progression } = arene;
  const couleur = couleursLigues[actuelle.ligue] || da.texteGris;
  const couleurSuivante = suivante
    ? couleursLigues[suivante.ligue] || da.or
    : couleur;
  const pourcent = Math.round(progression * 100);

  // L'aura : une pulsation lente et continue derrière l'avatar.
  // useNativeDriver pour que l'animation tourne hors du fil JS (fluide même
  // pendant un rendu).
  const pulsation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulsation, {
          toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulsation, {
          toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [pulsation]);

  const opaciteAura = pulsation.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });
  const echelleAura = pulsation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.carte}>
      <View style={styles.zoneAvatar}>
        <Animated.View
          style={[
            styles.aura,
            { backgroundColor: couleur, opacity: opaciteAura, transform: [{ scale: echelleAura }] },
          ]}
        />
        <View style={[styles.anneau, { borderColor: couleur }]}>
          <AvatarJoueur pseudo={joueur.pseudo} ligue={actuelle.ligue} taille={102} />
        </View>
      </View>

      <Text style={styles.identite}>
        {joueur.pseudo}
        {salle ? ` · ${salle}` : ''}
      </Text>

      <View style={styles.ligneArene}>
        <Losange couleur={couleur} taille={12} />
        <Text style={[styles.nomArene, { color: couleur }]}>{actuelle.nom}</Text>
        <Losange couleur={couleur} taille={12} />
      </View>

      <Text style={styles.mention}>Palier global · perfs vérifiées uniquement</Text>

      {suivante ? (
        <View style={styles.blocProgression}>
          <View style={styles.ligneLibelles}>
            <Text style={styles.libelleProgression}>
              Progression vers <Text style={{ color: couleurSuivante }}>{suivante.nom}</Text>
            </Text>
            <Text style={[styles.pourcent, { color: couleur }]}>{pourcent}%</Text>
          </View>
          <View style={styles.rail}>
            <View style={[styles.remplissage, { width: `${pourcent}%`, backgroundColor: couleurSuivante }]} />
          </View>
          <Text style={styles.manquants}>
            Encore <Text style={styles.nbManquants}>{manquants} palier{manquants > 1 ? 's' : ''}</Text> à faire vérifier
          </Text>
        </View>
      ) : (
        <Text style={[styles.sommet, { color: couleur }]}>👑 Sommet de Fitness Royale atteint</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: da.carteHaute,
    borderWidth: 1,
    borderColor: da.bordure,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 12,
  },
  zoneAvatar: {
    width: 150, height: 150, alignItems: 'center', justifyContent: 'center',
  },
  aura: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
  },
  anneau: {
    width: 126, height: 126, borderRadius: 63,
    borderWidth: 2, borderStyle: 'dashed',
    backgroundColor: da.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  identite: { color: da.texteGris, fontSize: 13, fontWeight: '600' },
  ligneArene: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nomArene: { fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  mention: { color: da.texteGris, fontSize: 11, marginTop: -4 },
  blocProgression: { width: '100%', gap: 5 },
  ligneLibelles: { flexDirection: 'row', justifyContent: 'space-between' },
  libelleProgression: { color: da.texteGris, fontSize: 11, fontWeight: '600' },
  pourcent: { fontSize: 11, fontWeight: '700' },
  rail: { height: 8, borderRadius: 4, backgroundColor: da.surface, overflow: 'hidden' },
  remplissage: { height: 8, borderRadius: 4 },
  manquants: { color: da.texteMuet, fontSize: 11, marginTop: 2 },
  nbManquants: { color: da.or, fontWeight: '800', fontFamily: monospace },
  sommet: { fontSize: 13, fontWeight: '800' },
});
