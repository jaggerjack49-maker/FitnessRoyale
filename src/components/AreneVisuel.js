// LE VISUEL DE L'ARÈNE — l'illustration qui change avec la ligue.
//
// DEPUIS LE 26/08/2026 : de VRAIES IMAGES, découpées dans la maquette fournie
// par Hafiz (`maquette-arène/`), et non plus un dessin SVG généré par le code.
// Raison : le SVG ne sait dessiner que des formes géométriques ; la direction
// artistique voulue (pierre texturée, ombres peintes, matières) demande une
// illustration. Les 6 arènes de la maquette correspondent une pour une aux
// arènes du jeu (voir src/data/arenes.js).
//
// PRÉPARATION DES IMAGES (pour pouvoir refaire l'opération si la maquette
// change) : chaque case de la grille a été découpée, le bandeau de titre et la
// ligne de trophées effacés par diffusion (ils étaient peints PAR-DESSUS le
// décor — nuages, cristaux —, un simple découpage arrachait l'illustration),
// puis le fond bleu nuit rendu TRANSPARENT en ne gardant que le plus gros bloc
// d'un seul tenant. Le fond transparent est important : la carte de l'arène
// pose l'image sur SA propre couleur, donc aucun raccord n'est visible.
// Enfin les images sont réduites à une palette de 200 couleurs (2,2 Mo -> 0,36 Mo).
//
// L'arène 0 (DÉBUT) n'existe pas dans la maquette : c'est INITIATION en
// version grise et assombrie — « l'arène n'est pas encore allumée ».
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

// React Native exige des `require` ÉCRITS EN DUR (le chemin ne peut pas être
// calculé), d'où ce tableau explicite plutôt qu'un `require(...)` dynamique.
const IMAGES = [
  require('../../assets/arenes/0-debut.png'),
  require('../../assets/arenes/1-initiation.png'),
  require('../../assets/arenes/2-forge.png'),
  require('../../assets/arenes/3-colosse.png'),
  require('../../assets/arenes/4-titan.png'),
  require('../../assets/arenes/5-olympe.png'),
  require('../../assets/arenes/6-royale.png'),
];

export default function AreneVisuel({ couleur, niveau = 0 }) {
  const image = IMAGES[niveau] || IMAGES[0];

  return (
    <View style={styles.cadre}>
      {/* Une lueur à la couleur de la ligue derrière l'arène : le décor reste
          le même pour tous, mais l'ambiance suit la progression (et ça relie
          l'image au reste de l'app, qui code déjà tout par cette couleur). */}
      {niveau > 0 && (
        <View style={[styles.lueur, { backgroundColor: couleur || colors.texteGris }]} />
      )}
      <Image
        source={image}
        style={styles.image}
        // `contain` : l'arène est toujours entière, jamais rognée. Les images
        // n'ont pas toutes exactement le même rapport largeur/hauteur, mais
        // leur fond est transparent — les marges ne se voient donc pas.
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    width: '100%',
    maxWidth: 380,        // sur grand écran, on ne laisse pas l'image s'étirer
    aspectRatio: 480 / 400,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lueur: {
    position: 'absolute',
    width: '78%',
    aspectRatio: 1,
    borderRadius: 999,
    opacity: 0.16,
    // Le flou n'existe pas partout en React Native : un cercle très
    // transparent suffit à suggérer la lumière sans dépendre d'un effet natif.
  },
  image: { width: '100%', height: '100%' },
});
