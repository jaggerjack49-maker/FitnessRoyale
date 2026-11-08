// LES GRAPHIQUES DE L'ÉCRAN « PROGRÈS » (08/11/2026).
//
// Deux graphiques, dessinés avec react-native-svg (déjà installé pour l'arène :
// aucune dépendance ajoutée) :
//   - CourbeProgres : l'évolution d'un exercice, un point par jour ;
//   - BarresActivite : les jours entraînés, semaine par semaine.
//
// Règles de lecture suivies (une seule série par graphique, donc une seule
// couleur : l'or de la marque, pas de légende — le titre nomme la série) :
//   - traits fins (2 px), points de 8 px, grille et axes discrets ;
//   - pas un chiffre sur chaque point : on TOUCHE un point (ou une barre) pour
//     lire sa valeur, affichée au-dessus du graphique ; par défaut c'est le
//     plus récent qui est lu ;
//   - la zone touchée est plus large que le point dessiné (au pouce, debout à
//     la salle, un point de 8 px ne se vise pas) ;
//   - les textes restent en couleurs de texte, jamais dans la couleur des
//     données.
// Les étiquettes sont des <Text> React Native posés par-dessus le dessin :
// même police que le reste de l'app, sur téléphone comme sur le web.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { colors } from '../theme';
import { monospace, largeurMaxContenu } from '../designSystem';

const HAUTEUR = 170;
const MARGE = { gauche: 44, droite: 14, haut: 14, bas: 24 };

const moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// « 2026-10-06 » → « 6 oct. »
export function dateCourte(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  return `${Number(m[3])} ${moisCourts[Number(m[2]) - 1]}`;
}

function enJours(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : 0;
}

function nombre(v) {
  const arrondi = Math.round(v * 10) / 10;
  return String(arrondi).replace('.', ',');
}

// Trois graduations « rondes » qui encadrent les valeurs. La courbe ne part
// PAS de zéro : on veut voir la progression, pas une ligne collée en haut.
function graduations(valeurs) {
  let min = Math.min(...valeurs);
  let max = Math.max(...valeurs);
  if (min === max) { min -= 1; max += 1; }
  const brut = (max - min) / 2;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * puissance).find((p) => p >= brut) || brut;
  const bas = Math.floor(min / pas) * pas;
  const haut = Math.max(bas + 2 * pas, Math.ceil(max / pas) * pas);
  const ticks = [];
  for (let t = bas; t <= haut + pas / 2; t += pas) ticks.push(Math.round(t * 100) / 100);
  return { bas, haut, ticks };
}

// La largeur du dessin. On part d'une ESTIMATION (la colonne de lecture moins
// les marges de l'écran et de la carte) que la vraie mesure (`onLayout`)
// corrige dès qu'elle arrive : si la mesure tarde ou ne vient pas (vu dans le
// volet de test, où le web ne la déclenche pas toujours), le graphique est
// quand même dessiné au lieu de rester vide.
function useLargeur() {
  const { width } = useWindowDimensions();
  const estimee = Math.max(200, Math.min(width, largeurMaxContenu) - 4 * 16 - 2);
  const [mesuree, setMesuree] = useState(0);
  return [mesuree || estimee, (e) => setMesuree(Math.round(e.nativeEvent.layout.width))];
}

// ---------------------------------------------------------------------------
// LA COURBE D'UN EXERCICE
// ---------------------------------------------------------------------------
// `points` = [{ date, valeur, detail }], du plus ancien au plus récent.
// `libelleDate(iso)` met la date en toutes lettres dans la bulle de lecture.
export function CourbeProgres({ points, unite, libelleDate }) {
  const [largeur, surMesure] = useLargeur();
  const [choisi, setChoisi] = useState(points.length - 1);
  // Nouvelle courbe (autre exercice, autre mesure) : on relit le plus récent.
  const cle = points.map((p) => `${p.date}:${p.valeur}`).join('|');
  useEffect(() => { setChoisi(points.length - 1); }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (points.length === 0) return null;
  const { bas, haut, ticks } = graduations(points.map((p) => p.valeur));
  const zoneL = Math.max(1, largeur - MARGE.gauche - MARGE.droite);
  const zoneH = HAUTEUR - MARGE.haut - MARGE.bas;
  // Les points sont placés selon le VRAI CALENDRIER : trois semaines sans
  // séance prennent trois fois plus de place qu'une. Espacés régulièrement,
  // une pause se serait vue comme une progression ininterrompue.
  const jours = points.map((p) => enJours(p.date));
  const premier = jours[0];
  const etendue = jours[jours.length - 1] - premier;
  const x = (i) => MARGE.gauche + (etendue > 0 ? ((jours[i] - premier) / etendue) * zoneL : zoneL / 2);
  const y = (v) => MARGE.haut + (1 - (v - bas) / (haut - bas)) * zoneH;
  const trace = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(' ');
  const lu = points[Math.min(Math.max(choisi, 0), points.length - 1)];
  const iLu = points.indexOf(lu);
  // Toucher n'importe où sur le graphique lit le point LE PLUS PROCHE : la
  // zone de chaque point va du milieu avec son voisin de gauche au milieu avec
  // son voisin de droite. Pas de chevauchement, et même deux séances à un jour
  // d'écart restent lisibles.
  const bornes = points.map((_, i) => [
    i === 0 ? 0 : (x(i - 1) + x(i)) / 2,
    i === points.length - 1 ? largeur : (x(i) + x(i + 1)) / 2,
  ]);

  return (
    <View>
      <View style={styles.bulle}>
        <Text style={styles.bulleValeur}>
          {nombre(lu.valeur)} {unite}
          <Text style={styles.bulleDate}>{`  ·  ${libelleDate ? libelleDate(lu.date) : dateCourte(lu.date)}`}</Text>
        </Text>
        <Text style={styles.bulleDetail}>{lu.detail}</Text>
      </View>
      <View style={{ height: HAUTEUR }} onLayout={surMesure}>
        {largeur > 0 && (
          <>
            <Svg width={largeur} height={HAUTEUR}>
              {ticks.map((t) => (
                <Line key={t} x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(t)} y2={y(t)}
                  stroke={colors.bordure} strokeWidth={1} />
              ))}
              <Line x1={x(iLu)} x2={x(iLu)} y1={MARGE.haut} y2={HAUTEUR - MARGE.bas}
                stroke={colors.texteGris} strokeWidth={1} strokeDasharray="3,3" />
              <Path d={trace} stroke={colors.or} strokeWidth={2} fill="none"
                strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <Circle key={p.date} cx={x(i)} cy={y(p.valeur)} r={i === iLu ? 6 : 4}
                  fill={colors.or} stroke={colors.carte} strokeWidth={2} />
              ))}
            </Svg>
            {ticks.map((t) => (
              <Text key={t} style={[styles.graduation, { top: y(t) - 7 }]}>{nombre(t)}</Text>
            ))}
            <Text style={[styles.axeX, { left: MARGE.gauche }]}>{dateCourte(points[0].date)}</Text>
            {points.length > 1 && (
              <Text style={[styles.axeX, { right: MARGE.droite, textAlign: 'right' }]}>
                {dateCourte(points[points.length - 1].date)}
              </Text>
            )}
            {points.map((p, i) => (
              <TouchableOpacity
                key={p.date}
                activeOpacity={1}
                onPress={() => setChoisi(i)}
                accessibilityLabel={`${dateCourte(p.date)} : ${nombre(p.valeur)} ${unite}`}
                style={[styles.zoneTouche, {
                  left: bornes[i][0], width: Math.max(1, bornes[i][1] - bornes[i][0]),
                  height: HAUTEUR - MARGE.bas,
                }]}
              />
            ))}
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// L'ACTIVITÉ, SEMAINE PAR SEMAINE
// ---------------------------------------------------------------------------
// `semaines` = [{ lundi, nb }], la semaine en cours en dernier.
export function BarresActivite({ semaines, libelleDate }) {
  const [largeur, surMesure] = useLargeur();
  const [choisie, setChoisie] = useState(semaines.length - 1);
  const cle = semaines.map((s) => `${s.lundi}:${s.nb}`).join('|');
  useEffect(() => { setChoisie(semaines.length - 1); }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps

  if (semaines.length === 0) return null;
  const haut = Math.max(3, ...semaines.map((s) => s.nb));
  const zoneL = Math.max(1, largeur - MARGE.gauche - MARGE.droite);
  const zoneH = HAUTEUR - MARGE.haut - MARGE.bas;
  const colonne = zoneL / semaines.length;
  const barre = Math.max(4, colonne - 4); // 2 px de vide de chaque côté
  const y = (v) => MARGE.haut + (1 - v / haut) * zoneH;
  const lue = semaines[Math.min(Math.max(choisie, 0), semaines.length - 1)];
  const derniere = semaines.length - 1;
  // Une barre arrondie EN HAUT seulement (4 px), posée à plat sur la ligne de base.
  const formeBarre = (gauche, hauteur) => {
    const r = Math.min(4, hauteur, barre / 2);
    const base = y(0);
    const sommet = base - hauteur;
    return `M${gauche},${base} L${gauche},${sommet + r} Q${gauche},${sommet} ${gauche + r},${sommet}`
      + ` L${gauche + barre - r},${sommet} Q${gauche + barre},${sommet} ${gauche + barre},${sommet + r}`
      + ` L${gauche + barre},${base} Z`;
  };
  const graduationsY = [0, Math.round(haut / 2), haut].filter((v, i, l) => l.indexOf(v) === i);

  return (
    <View>
      <View style={styles.bulle}>
        <Text style={styles.bulleValeur}>
          {lue.nb} jour{lue.nb > 1 ? 's' : ''} d'entraînement
        </Text>
        <Text style={styles.bulleDetail}>
          {choisie === derniere ? 'Cette semaine' : `Semaine du ${libelleDate ? libelleDate(lue.lundi) : dateCourte(lue.lundi)}`}
        </Text>
      </View>
      <View style={{ height: HAUTEUR }} onLayout={surMesure}>
        {largeur > 0 && (
          <>
            <Svg width={largeur} height={HAUTEUR}>
              {graduationsY.map((t) => (
                <Line key={t} x1={MARGE.gauche} x2={largeur - MARGE.droite} y1={y(t)} y2={y(t)}
                  stroke={colors.bordure} strokeWidth={1} />
              ))}
              {semaines.map((s, i) => (s.nb > 0 ? (
                <Path key={s.lundi}
                  d={formeBarre(MARGE.gauche + i * colonne + 2, zoneH * (s.nb / haut))}
                  fill={colors.or} opacity={i === choisie ? 1 : 0.55} />
              ) : null))}
            </Svg>
            {graduationsY.map((t) => (
              <Text key={t} style={[styles.graduation, { top: y(t) - 7 }]}>{t}</Text>
            ))}
            <Text style={[styles.axeX, { left: MARGE.gauche }]}>{dateCourte(semaines[0].lundi)}</Text>
            <Text style={[styles.axeX, { right: MARGE.droite, textAlign: 'right' }]}>cette sem.</Text>
            {semaines.map((s, i) => (
              <TouchableOpacity
                key={s.lundi}
                activeOpacity={1}
                onPress={() => setChoisie(i)}
                accessibilityLabel={`Semaine du ${dateCourte(s.lundi)} : ${s.nb} jours`}
                style={[styles.zoneTouche, {
                  left: MARGE.gauche + i * colonne, width: colonne, height: HAUTEUR - MARGE.bas,
                }]}
              />
            ))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bulle: { minHeight: 44, marginBottom: 6 },
  bulleValeur: { color: colors.texte, fontWeight: '900', fontSize: 20 },
  bulleDate: { color: colors.texteGris, fontWeight: '600', fontSize: 12 },
  bulleDetail: { color: colors.texteDoux, fontSize: 12, marginTop: 2 },
  graduation: {
    position: 'absolute', left: 0, width: MARGE.gauche - 8, textAlign: 'right',
    color: colors.texteGris, fontSize: 10, fontFamily: monospace,
  },
  axeX: { position: 'absolute', bottom: 2, color: colors.texteGris, fontSize: 10 },
  zoneTouche: { position: 'absolute', top: 0 },
});
