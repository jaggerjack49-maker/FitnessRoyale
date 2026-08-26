// LE VISUEL DE L'ARÈNE — un dessin vectoriel (SVG) qui change avec la ligue.
//
// Pourquoi du SVG plutôt qu'une image : une image devrait être dessinée à la
// main pour chacune des 7 arènes, en plusieurs résolutions, et pèserait dans
// l'app. Ici tout est DESSINÉ PAR LE CODE à partir de la couleur de la ligue,
// donc c'est net sur tous les écrans, quasi gratuit en poids, et une nouvelle
// arène = quelques lignes.
//
// VUE ISOMÉTRIQUE (refonte du 25/08/2026, d'après la maquette de Hafiz) :
// on ne regarde plus l'arène de face, mais en 3/4 vu de dessus — un plateau
// de pierre posé dans le vide, avec ses murs d'enceinte, ses tours d'angle et
// le matériel posé dessus. C'est la mise en scène des arènes de Clash Royale.
// L'ancienne version (gradins + projecteurs de face) a été remplacée.
//
// Le décor s'enrichit au fur et à mesure de la progression :
//   niveau 0  DÉBUT      plateau nu et gris, une simple porte au fond
//   niveau 1+ INITIATION murs d'enceinte + premiers haltères
//   niveau 2+ FORGE      tours d'angle + kettlebell
//   niveau 3+ COLOSSE    bannières suspendues + barre olympique
//   niveau 4+ TITAN      blason au fond
//   niveau 5+ OLYMPE     braseros allumés à l'avant
//   niveau 6  ROYALE     couronne et rayons au-dessus de l'arène
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

// ----- Géométrie isométrique -----
// Le plateau est un LOSANGE (un rectangle vu en 3/4). Ses 4 coins :
//   gauche (0,0) · fond (1,0) · droite (1,1) · avant (0,1)
// `sol(s, t)` convertit une position SUR le plateau (s et t entre 0 et 1,
// comme deux coordonnées de damier) en un point de l'écran. Tout se place
// avec cette seule fonction : impossible qu'un élément « flotte » à côté.
const LARGEUR = 320;
const HAUTEUR = 180;
const CX = 158;   // centre du plateau à l'écran
const CY = 104;
const DX = 116;   // demi-largeur du losange
const DY = 52;    // demi-profondeur
const EP = 19;    // épaisseur du socle de pierre

function sol(s, t) {
  return [CX - DX + (s + t) * DX, CY + (t - s) * DY];
}

// Un point du plateau, remonté de `h` pixels (pour ce qui est debout dessus).
function haut(s, t, h) {
  const [x, y] = sol(s, t);
  return [x, y - h];
}

// "x,y x,y …" — le format attendu par <Polygon points=…>
function pts(liste) {
  return liste.map(([x, y]) => `${x},${y}`).join(' ');
}

export default function AreneVisuel({ couleur, niveau = 0 }) {
  const teinte = niveau === 0 ? colors.texteGris : couleur;
  const clair = teinter(teinte, 0.45);
  const tresClair = teinter(teinte, 0.7);
  const sombre = teinter(teinte, -0.55);
  const tresSombre = teinter(teinte, -0.78);

  // Les 4 coins du plateau, calculés une fois.
  const coinGauche = sol(0, 0);
  const coinFond = sol(1, 0);
  const coinDroite = sol(1, 1);
  const coinAvant = sol(0, 1);

  // Un haltère posé au sol, en (s,t) — deux disques et une barre.
  function Haltere({ s, t }) {
    const [x, y] = sol(s, t);
    return (
      <G>
        <Ellipse cx={x} cy={y + 2} rx="14" ry="4" fill={tresSombre} opacity="0.45" />
        <Rect x={x - 7} y={y - 5} width="14" height="4" rx="2" fill={clair} />
        <Ellipse cx={x - 8} cy={y - 3} rx="4.5" ry="6" fill={tresSombre} />
        <Ellipse cx={x + 8} cy={y - 3} rx="4.5" ry="6" fill={tresSombre} />
      </G>
    );
  }

  // Une kettlebell : une cloche et son anse.
  function Kettlebell({ s, t }) {
    const [x, y] = sol(s, t);
    return (
      <G>
        <Ellipse cx={x} cy={y + 1} rx="10" ry="3.5" fill={tresSombre} opacity="0.45" />
        <Path
          d={`M${x - 4} ${y - 14} a4 4 0 0 1 8 0`}
          stroke={clair} strokeWidth="2.5" fill="none"
        />
        <Circle cx={x} cy={y - 6} r="7" fill={tresSombre} />
        <Circle cx={x - 2} cy={y - 8} r="2.5" fill={sombre} />
      </G>
    );
  }

  // Une barre olympique chargée, posée en travers.
  function Barre({ s, t }) {
    const [x, y] = sol(s, t);
    return (
      <G>
        <Ellipse cx={x} cy={y + 2} rx="26" ry="4" fill={tresSombre} opacity="0.4" />
        <Rect x={x - 24} y={y - 4} width="48" height="3" rx="1.5" fill={clair} />
        {[-20, -15, 15, 20].map((decalage) => (
          <Ellipse
            key={decalage}
            cx={x + decalage} cy={y - 3}
            rx="3" ry={Math.abs(decalage) > 17 ? 7 : 9}
            fill={tresSombre}
          />
        ))}
      </G>
    );
  }

  // Une tour d'angle : un bloc de pierre posé sur un coin du plateau.
  function Tour({ point, hauteur = 40 }) {
    const [x, y] = point;
    const l = 11; // demi-largeur
    return (
      <G>
        {/* Face avant-gauche et avant-droite (deux tons, pour le relief) */}
        <Polygon
          points={pts([[x - l, y - 6], [x, y], [x, y - hauteur], [x - l, y - hauteur - 6]])}
          fill={sombre}
        />
        <Polygon
          points={pts([[x, y], [x + l, y - 6], [x + l, y - hauteur - 6], [x, y - hauteur]])}
          fill={tresSombre}
        />
        {/* Le sommet, éclairé */}
        <Polygon
          points={pts([
            [x - l, y - hauteur - 6], [x, y - hauteur], [x + l, y - hauteur - 6], [x, y - hauteur - 12],
          ])}
          fill={clair}
          opacity="0.9"
        />
      </G>
    );
  }

  // Une bannière suspendue à une tour.
  function Banniere({ point, hauteur }) {
    const [x, y] = point;
    const sommet = y - hauteur + 2;
    return (
      <G>
        <Path
          d={`M${x - 7} ${sommet} h14 v26 l-7 -6 -7 6 Z`}
          fill={teinte}
          opacity="0.95"
        />
        <Rect x={x - 2} y={sommet + 7} width="4" height="9" rx="1" fill={tresClair} opacity="0.9" />
      </G>
    );
  }

  return (
    <View style={styles.cadre}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}>
        <Defs>
          {/* Halo lumineux derrière l'arène, façon projecteur */}
          <RadialGradient id="fond" cx="50%" cy="55%" r="70%">
            <Stop offset="0%" stopColor={sombre} stopOpacity="0.85" />
            <Stop offset="100%" stopColor={colors.fond} stopOpacity="1" />
          </RadialGradient>
          {/* Le dessus du plateau : plus clair au fond, plus sombre devant */}
          <LinearGradient id="dessus" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={teinter(teinte, -0.35)} stopOpacity="1" />
            <Stop offset="100%" stopColor={tresSombre} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="parquet" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={clair} stopOpacity="0.55" />
            <Stop offset="100%" stopColor={teinte} stopOpacity="0.25" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={LARGEUR} height={HAUTEUR} fill="url(#fond)" />

        {/* --- Niveau 6 : rayons et couronne, tout au fond du décor --- */}
        {niveau >= 6 && (
          <G>
            {[-58, -30, 0, 30, 58].map((decalage) => (
              <Path
                key={decalage}
                d={`M${CX + decalage * 0.5} 8 L${CX + decalage * 1.6} 62`}
                stroke={tresClair}
                strokeWidth="2"
                opacity="0.3"
              />
            ))}
            <Path
              d={`M${CX - 22} 30 L${CX - 22} 12 L${CX - 11} 22 L${CX} 6
                  L${CX + 11} 22 L${CX + 22} 12 L${CX + 22} 30 Z`}
              fill={tresClair}
            />
            <Rect x={CX - 22} y="30" width="44" height="6" rx="2" fill={teinte} />
          </G>
        )}

        {/* --- Le SOCLE : les deux faces visibles, devant --- */}
        <Polygon
          points={pts([
            coinGauche, coinAvant,
            [coinAvant[0], coinAvant[1] + EP], [coinGauche[0], coinGauche[1] + EP],
          ])}
          fill={tresSombre}
        />
        <Polygon
          points={pts([
            coinAvant, coinDroite,
            [coinDroite[0], coinDroite[1] + EP], [coinAvant[0], coinAvant[1] + EP],
          ])}
          fill={teinter(teinte, -0.86)}
        />

        {/* --- Le DESSUS du plateau --- */}
        <Polygon
          points={pts([coinGauche, coinFond, coinDroite, coinAvant])}
          fill="url(#dessus)"
        />
        {/* Liseré lumineux sur l'arête du plateau */}
        <Polygon
          points={pts([coinGauche, coinFond, coinDroite, coinAvant])}
          fill="none"
          stroke={clair}
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* --- L'aire de combat, en creux au centre --- */}
        <Polygon
          points={pts([sol(0.16, 0.16), sol(0.84, 0.16), sol(0.84, 0.84), sol(0.16, 0.84)])}
          fill="url(#parquet)"
        />
        <Polygon
          points={pts([sol(0.16, 0.16), sol(0.84, 0.16), sol(0.84, 0.84), sol(0.16, 0.84)])}
          fill="none" stroke={clair} strokeWidth="1" opacity="0.5"
        />
        {/* Le losange central — le motif de marque du projet */}
        <Polygon
          points={pts([sol(0.42, 0.42), sol(0.58, 0.42), sol(0.58, 0.58), sol(0.42, 0.58)])}
          fill={clair}
          opacity={niveau === 0 ? 0.25 : 0.75}
        />

        {/* --- Niveau 1+ : les murs d'enceinte, sur les deux arêtes du fond --- */}
        {niveau >= 1 && (
          <G>
            {/* Mur arrière-gauche (de la gauche vers le fond) */}
            <Polygon
              points={pts([
                coinGauche, coinFond, haut(1, 0, 15), haut(0, 0, 15),
              ])}
              fill={sombre}
            />
            <Polygon
              points={pts([haut(0, 0, 15), haut(1, 0, 15), haut(1, 0, 19), haut(0, 0, 19)])}
              fill={clair}
              opacity="0.55"
            />
            {/* Mur arrière-droit (du fond vers la droite) */}
            <Polygon
              points={pts([
                coinFond, coinDroite, haut(1, 1, 15), haut(1, 0, 15),
              ])}
              fill={tresSombre}
            />
            <Polygon
              points={pts([haut(1, 0, 15), haut(1, 1, 15), haut(1, 1, 19), haut(1, 0, 19)])}
              fill={clair}
              opacity="0.4"
            />
          </G>
        )}

        {/* --- Niveau 2+ : les tours d'angle --- */}
        {niveau >= 2 && (
          <G>
            <Tour point={coinGauche} hauteur={38} />
            <Tour point={coinFond} hauteur={46} />
            <Tour point={coinDroite} hauteur={38} />
          </G>
        )}

        {/* --- Niveau 3+ : les bannières suspendues aux tours --- */}
        {niveau >= 3 && (
          <G>
            <Banniere point={coinGauche} hauteur={38} />
            <Banniere point={coinDroite} hauteur={38} />
          </G>
        )}

        {/* --- Niveau 4+ : le blason, au sommet de la tour du fond --- */}
        {niveau >= 4 && (
          <G>
            <Path
              d={`M${coinFond[0] - 13} ${coinFond[1] - 74}
                  h26 v14 q0 12 -13 18 q-13 -6 -13 -18 Z`}
              fill={teinte}
            />
            <Path
              d={`M${coinFond[0] - 13} ${coinFond[1] - 74}
                  h26 v14 q0 12 -13 18 q-13 -6 -13 -18 Z`}
              fill="none" stroke={tresClair} strokeWidth="1.5"
            />
            <Circle cx={coinFond[0]} cy={coinFond[1] - 62} r="4" fill={tresClair} />
          </G>
        )}

        {/* --- Le matériel posé sur le plateau --- */}
        {niveau >= 1 && <Haltere s={0.27} t={0.70} />}
        {niveau >= 1 && <Haltere s={0.72} t={0.32} />}
        {niveau >= 2 && <Kettlebell s={0.74} t={0.74} />}
        {niveau >= 3 && <Barre s={0.30} t={0.28} />}

        {/* --- Niveau 5+ : les braseros allumés, aux angles avant --- */}
        {niveau >= 5 && (
          <G>
            {[sol(0.06, 0.5), sol(0.5, 0.06)].map(([x, y], i) => (
              <G key={i}>
                <Rect x={x - 4} y={y - 16} width="8" height="16" rx="2" fill={tresSombre} />
                <Ellipse cx={x} cy={y - 17} rx="9" ry="4" fill={sombre} />
                <Path
                  d={`M${x} ${y - 36} Q${x + 8} ${y - 23} ${x} ${y - 17}
                      Q${x - 8} ${y - 23} ${x} ${y - 36} Z`}
                  fill={tresClair}
                  opacity="0.95"
                />
              </G>
            ))}
          </G>
        )}

        {/* --- Niveau 0 : l'arène est vide, il n'y a qu'une porte au fond --- */}
        {niveau === 0 && (
          <G opacity="0.9">
            <Polygon
              points={pts([
                haut(1, 0, 0), haut(1, 0, 44),
                [coinFond[0] + 26, coinFond[1] - 56], [coinFond[0] + 26, coinFond[1] - 12],
              ])}
              fill={sombre}
            />
            <Polygon
              points={pts([
                haut(1, 0, 0), haut(1, 0, 44),
                [coinFond[0] + 26, coinFond[1] - 56], [coinFond[0] + 26, coinFond[1] - 12],
              ])}
              fill="none" stroke={clair} strokeWidth="1.5"
            />
            <Circle cx={coinFond[0] + 8} cy={coinFond[1] - 28} r="2.5" fill={clair} />
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    width: '100%',
    maxWidth: 380,             // sur grand écran, on ne laisse pas le dessin s'étirer
    aspectRatio: LARGEUR / HAUTEUR, // même ratio que le viewBox : aucune bande vide
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.fond,
  },
});
