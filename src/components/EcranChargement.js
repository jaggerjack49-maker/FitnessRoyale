// L'ÉCRAN D'ATTENTE DU DÉMARRAGE — le tout premier écran de l'app.
//
// Il couvre deux moments (voir App.js) :
//  - « Connexion au serveur… » : le cas normal, une seconde ou deux ;
//  - « Réveil du serveur… » : l'hébergement gratuit (Render) met le service
//    en veille après 15 min d'inactivité et peut mettre jusqu'à une minute à
//    répondre. Ce second message existe POUR ÉVITER DE CROIRE À UNE PANNE —
//    c'est la raison d'être de cet écran, pas une décoration.
//
// LE FOND est l'illustration fournie par Hafiz (06/09/2026), préparée par
// `scripts/preparer_fond_chargement.py`. Ce script COUPE le bandeau peint
// qu'elle contenait (« INITIALISATION DU SERVEUR… » + barre + devise) :
//  - le message doit CHANGER selon l'état, un texte peint ne le peut pas ;
//  - une barre FIGÉE pendant une minute d'attente donne exactement
//    l'impression de blocage qu'on veut éviter. Celle d'ici est animée, et
//    volontairement INDÉTERMINÉE : on ne connaît pas la durée du réveil, donc
//    on ne prétend pas afficher un pourcentage.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ImageBackground, Animated, Easing, Dimensions, Platform,
} from 'react-native';
import { colors } from '../theme';
import { da } from '../designSystem';

const FOND = require('../../assets/fond-chargement.jpg');

// Barre de progression INDÉTERMINÉE : un reflet doré qui balaie la piste, en
// boucle. Elle dit « ça travaille », jamais « on en est à 65 % ».
function BarreIndeterminee() {
  const avancee = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ALLER-RETOUR (0 -> 1 -> 0) plutôt qu'une boucle qui se remet à zéro :
    // c'est le motif déjà éprouvé dans ce projet, celui de l'aura pulsante de
    // `CarteArenAccueil`. On ne dépend ainsi d'aucune remise à zéro implicite
    // entre deux passages.
    //
    // `useNativeDriver` sur TÉLÉPHONE : l'animation tourne hors du fil
    // JavaScript, donc elle reste fluide pendant que l'app attend le serveur —
    // ce qui est précisément la situation ici. Sur le WEB ce moteur n'existe
    // pas : React Native Web affiche un avertissement à chaque rendu et
    // retombe de toute façon sur une animation JavaScript. On le dit
    // explicitement plutôt que de laisser la bibliothèque se plaindre.
    const natif = Platform.OS !== 'web';
    const balayage = (versLaDroite) => Animated.timing(avancee, {
      toValue: versLaDroite ? 1 : 0,
      duration: 1100,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: natif,
    });
    const boucle = Animated.loop(
      Animated.sequence([balayage(true), balayage(false)])
    );
    boucle.start();
    return () => boucle.stop();
  }, [avancee]);

  const largeurPiste = Math.min(Dimensions.get('window').width - 64, 320);
  const largeurReflet = largeurPiste * 0.4;

  return (
    <View style={[styles.piste, { width: largeurPiste }]}>
      <Animated.View
        style={[
          styles.reflet,
          {
            width: largeurReflet,
            transform: [{
              translateX: avancee.interpolate({
                inputRange: [0, 1],
                outputRange: [-largeurReflet, largeurPiste],
              }),
            }],
          },
        ]}
      />
    </View>
  );
}

export default function EcranChargement({ reveil }) {
  return (
    <ImageBackground
      source={FOND}
      // `cover` : l'image remplit toujours l'écran quelle que soit sa forme.
      // Le château est cadré haut dans l'illustration, donc le recadrage
      // mange du décor en bas plutôt que le logo.
      resizeMode="cover"
      style={styles.fond}
    >
      {/* Un voile sombre du milieu vers le bas : le texte doit rester lisible
          par-dessus une image très chargée, sans masquer le logo du haut. */}
      <View style={styles.voile} />

      <View style={styles.bandeau}>
        <Text style={styles.message}>
          {reveil ? 'RÉVEIL DU SERVEUR…' : 'CONNEXION AU SERVEUR…'}
        </Text>
        <BarreIndeterminee />
        <Text style={styles.precision}>
          {reveil
            ? 'Il dormait — jusqu\'à 1 minute, c\'est normal'
            : '— PLUS FORTS ENSEMBLE —'}
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // `width/height: '100%'` EN PLUS de `flex: 1` : sur le WEB, `ImageBackground`
  // ne s'étire pas au conteneur avec le seul `flex`. Vérifié en retirant ces
  // deux lignes le 06/09/2026 : le bas de l'écran redevient noir et le texte
  // remonte au milieu. Ne pas les supprimer en croyant à du superflu.
  fond: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: colors.fond,
  },
  voile: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 7, 8, 0.35)',
  },
  bandeau: {
    alignItems: 'center',
    paddingBottom: 56,
    paddingHorizontal: 24,
  },
  message: {
    color: colors.texte,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 14,
    textAlign: 'center',
    // Une ombre portée plutôt qu'un fond opaque : le texte reste lisible sur
    // l'illustration sans poser un rectangle par-dessus.
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  piste: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(6, 7, 8, 0.65)',
    borderWidth: 2,
    borderColor: da.or,
    overflow: 'hidden',
  },
  reflet: { height: '100%', backgroundColor: da.or },
  precision: {
    color: colors.texteGris,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
