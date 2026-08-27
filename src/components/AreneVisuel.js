// LE VISUEL DE L'ARÈNE — l'illustration qui change avec la ligue.
//
// DEPUIS LE 26/08/2026 : de VRAIES IMAGES, découpées dans la maquette fournie
// par Hafiz (`maquette-arène/`), et non plus un dessin SVG généré par le code.
// Raison : le SVG ne sait dessiner que des formes géométriques ; la direction
// artistique voulue (pierre texturée, ombres peintes, matières) demande une
// illustration. Les 6 arènes de la maquette correspondent une pour une aux
// arènes du jeu (voir src/data/arenes.js).
//
// LES IMAGES SONT GÉNÉRÉES PAR UN SCRIPT : `scripts/decouper_arenes.py`, à
// relancer si la maquette change. Il retire le fond, isole chaque arène et les
// pose TOUTES SUR UNE TOILE DE MÊME TAILLE (512 × 470), calées en bas. Ce
// dernier point est important : sans lui, `resizeMode="contain"` affichait
// chaque arène à une taille différente selon son rapport largeur/hauteur —
// une arène large paraissait plus petite qu'une arène haute, et seule celle
// dont le format collait au cadre remplissait bien (signalé en test le
// 27/08/2026).
//
// L'arène 0 (DÉBUT) n'existe pas dans la maquette : c'est INITIATION en
// version grise et assombrie — « l'arène n'est pas encore allumée ».
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
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
  const teinte = couleur || colors.texteGris;

  return (
    <View style={styles.cadre}>
      {/* Une lueur à la couleur de la ligue derrière l'arène : le décor reste
          le même pour tous, mais l'ambiance suit la progression (et ça relie
          l'image au reste de l'app, qui code déjà tout par cette couleur).
          C'est un DÉGRADÉ, pas un aplat : une simple `View` ronde et
          semi-transparente dessinait un cercle net, bien visible au milieu de
          l'image (signalé en test le 27/08/2026). Un dégradé radial s'éteint
          progressivement et ne laisse aucun contour. */}
      {niveau > 0 && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="lueur" cx="50%" cy="52%" r="55%">
              <Stop offset="0%" stopColor={teinte} stopOpacity="0.28" />
              <Stop offset="55%" stopColor={teinte} stopOpacity="0.10" />
              <Stop offset="100%" stopColor={teinte} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lueur)" />
        </Svg>
      )}
      <Image
        source={image}
        style={styles.image}
        // `contain` : l'arène est toujours entière, jamais rognée. Toutes les
        // images ayant la même taille de toile, elles s'affichent maintenant
        // exactement à la même échelle, sans saut d'une arène à l'autre.
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    width: '100%',
    maxWidth: 380,        // sur grand écran, on ne laisse pas l'image s'étirer
    aspectRatio: 512 / 470, // le format exact de la toile des images
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
});
