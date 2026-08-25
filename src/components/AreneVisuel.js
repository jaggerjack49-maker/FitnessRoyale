// LE VISUEL DE L'ARÈNE — un dessin vectoriel (SVG) qui change avec la ligue.
//
// Pourquoi du SVG plutôt qu'une image : une image devrait être dessinée à la
// main pour chacune des 7 arènes, en plusieurs résolutions, et pèserait dans
// l'app. Ici tout est DESSINÉ PAR LE CODE à partir de la couleur de la ligue,
// donc c'est net sur tous les écrans, quasi gratuit en poids, et une nouvelle
// arène = quelques lignes.
//
// L'arène s'enrichit au fur et à mesure de la progression (comme les arènes de
// Clash Royale qui se ressemblent mais montent en décor) :
//   niveau 0  Le Vestiaire        sol nu, tout est gris
//   niveau 1+ La Fosse de Bronze  gradins + couleur de ligue
//   niveau 2+ La Salle d'Argent   projecteurs
//   niveau 3+ L'Arène Dorée       bannières latérales
//   niveau 4+ Le Temple des Lég.  colonnes + fronton
//   niveau 5+ La Forge des Titans braseros allumés
//   niveau 6  Le Trône Royal      couronne + rayons
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop, Rect, Ellipse,
  Path, Circle, G, Polygon,
} from 'react-native-svg';
import { colors } from '../theme';

// Éclaircit/assombrit une couleur hexadécimale (#RRGGBB) — sert à fabriquer
// des dégradés cohérents à partir de la seule couleur de ligue.
function teinter(hex, facteur) {
  const propre = (hex || '#8A93A6').replace('#', '');
  const n = parseInt(propre.length === 3 ? propre.repeat(2) : propre, 16);
  const composantes = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = facteur >= 0 ? c + (255 - c) * facteur : c * (1 + facteur);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `rgb(${composantes.join(',')})`;
}

export default function AreneVisuel({ couleur, niveau = 0 }) {
  const teinte = niveau === 0 ? colors.texteGris : couleur;
  const clair = teinter(teinte, 0.45);
  const sombre = teinter(teinte, -0.55);
  const tresSombre = teinter(teinte, -0.75);
  const largeur = 320;

  // La hauteur suit la largeur (aspectRatio) : le dessin remplit toujours le
  // cadre sans bandes vides, sur téléphone comme sur grand écran.
  return (
    <View style={styles.cadre}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${largeur} 180`}>
        <Defs>
          {/* Ciel/fond : plus lumineux au centre, façon projecteur d'arène */}
          <RadialGradient id="fond" cx="50%" cy="62%" r="72%">
            <Stop offset="0%" stopColor={sombre} stopOpacity="0.95" />
            <Stop offset="100%" stopColor={colors.fond} stopOpacity="1" />
          </RadialGradient>
          <LinearGradient id="sol" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={clair} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={sombre} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="gradins" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={teinte} stopOpacity="0.55" />
            <Stop offset="100%" stopColor={tresSombre} stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id="faisceau" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={clair} stopOpacity="0.55" />
            <Stop offset="100%" stopColor={clair} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Fond */}
        <Rect x="0" y="0" width={largeur} height="180" fill="url(#fond)" />

        {/* --- Niveau 4+ : colonnes et fronton de temple, en arrière-plan --- */}
        {niveau >= 4 && (
          <G opacity="0.85">
            <Polygon points="60,52 160,22 260,52" fill={sombre} />
            <Rect x="62" y="52" width="196" height="8" fill={teinte} opacity="0.5" />
            {[70, 108, 146, 184, 222].map((x) => (
              <Rect key={x} x={x} y="60" width="16" height="52" fill={sombre} rx="2" />
            ))}
          </G>
        )}

        {/* --- Niveau 2+ : projecteurs qui balaient l'arène --- */}
        {niveau >= 2 && (
          <G>
            <Path d="M40 20 L14 128 L86 128 Z" fill="url(#faisceau)" />
            <Path d="M280 20 L234 128 L306 128 Z" fill="url(#faisceau)" />
            <Circle cx="40" cy="18" r="7" fill={clair} />
            <Circle cx="280" cy="18" r="7" fill={clair} />
          </G>
        )}

        {/* --- Niveau 1+ : les gradins qui entourent l'arène --- */}
        {niveau >= 1 && (
          <G>
            <Path
              d={`M8 150 Q${largeur / 2} 74 ${largeur - 8} 150 L${largeur - 8} 180 L8 180 Z`}
              fill="url(#gradins)"
            />
            {/* Rangées de spectateurs stylisées */}
            {[0, 1, 2].map((rangee) => (
              <Path
                key={rangee}
                d={`M${22 + rangee * 12} ${150 - rangee * 2} Q${largeur / 2} ${92 + rangee * 15} ${largeur - 22 - rangee * 12} ${150 - rangee * 2}`}
                stroke={clair}
                strokeWidth="2"
                strokeDasharray="4 7"
                fill="none"
                opacity={0.5 - rangee * 0.12}
              />
            ))}
          </G>
        )}

        {/* --- Niveau 3+ : bannières suspendues de chaque côté --- */}
        {niveau >= 3 && (
          <G>
            {[[26, 62], [largeur - 44, 62]].map(([x, y]) => (
              <G key={x}>
                <Path d={`M${x} ${y} h18 v40 l-9 -8 -9 8 Z`} fill={teinte} opacity="0.9" />
                <Rect x={x + 7} y={y + 10} width="4" height="14" fill={clair} rx="1" />
              </G>
            ))}
          </G>
        )}

        {/* --- Le plateau central : là où on se bat --- */}
        <Ellipse cx={largeur / 2} cy="152" rx="104" ry="26" fill="url(#sol)" />
        <Ellipse
          cx={largeur / 2} cy="152" rx="104" ry="26"
          fill="none" stroke={clair} strokeWidth="2" opacity="0.75"
        />
        <Ellipse
          cx={largeur / 2} cy="152" rx="66" ry="16"
          fill="none" stroke={clair} strokeWidth="1" opacity="0.4"
        />

        {/* --- Niveau 5+ : braseros allumés de part et d'autre --- */}
        {niveau >= 5 && (
          <G>
            {[74, largeur - 74].map((x) => (
              <G key={x}>
                <Rect x={x - 5} y="132" width="10" height="24" fill={tresSombre} rx="2" />
                <Ellipse cx={x} cy="130" rx="11" ry="5" fill={sombre} />
                <Path
                  d={`M${x} 108 Q${x + 9} 122 ${x} 129 Q${x - 9} 122 ${x} 108 Z`}
                  fill={clair}
                  opacity="0.95"
                />
              </G>
            ))}
          </G>
        )}

        {/* --- Niveau 6 : la couronne et ses rayons --- */}
        {niveau >= 6 && (
          <G>
            {[-52, -26, 0, 26, 52].map((decalage) => (
              <Path
                key={decalage}
                d={`M${largeur / 2 + decalage} 16 L${largeur / 2 + decalage * 1.7} 70`}
                stroke={clair}
                strokeWidth="2"
                opacity="0.35"
              />
            ))}
            <Path
              d={`M${largeur / 2 - 26} 46 L${largeur / 2 - 26} 24 L${largeur / 2 - 13} 36
                  L${largeur / 2} 18 L${largeur / 2 + 13} 36 L${largeur / 2 + 26} 24
                  L${largeur / 2 + 26} 46 Z`}
              fill={clair}
            />
            <Rect x={largeur / 2 - 26} y="46" width="52" height="7" fill={teinte} rx="2" />
          </G>
        )}

        {/* --- Niveau 0 : arène vide, juste une porte (le vestiaire) --- */}
        {niveau === 0 && (
          <G opacity="0.9">
            <Rect x={largeur / 2 - 22} y="78" width="44" height="60" rx="4" fill={sombre} />
            <Rect
              x={largeur / 2 - 22} y="78" width="44" height="60" rx="4"
              fill="none" stroke={clair} strokeWidth="2"
            />
            <Circle cx={largeur / 2 + 12} cy="110" r="3" fill={clair} />
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    width: '100%',
    maxWidth: 380,       // sur grand écran, on ne laisse pas le dessin s'étirer
    aspectRatio: 320 / 180, // même ratio que le viewBox : aucune bande vide
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.fond,
  },
});
