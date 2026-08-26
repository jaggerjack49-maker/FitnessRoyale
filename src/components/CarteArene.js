// La carte "Mon arène" : le visuel dessiné + le nom, la devise, et la
// progression vers l'arène suivante.
//
// UN SEUL composant partagé par l'écran Profil (dès l'entrée dans l'app) et
// l'écran Paliers — pour qu'ils affichent toujours exactement la même chose.
// `compacte` = version allégée (sans devise) pour le Profil.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { baremes, couleursLigues } from '../data/clubSP';
import { moyennePaliers, scoreSP, ligueJoueur } from '../logic/classement';
import { etatArene } from '../data/arenes';
import AreneVisuel from './AreneVisuel';

// Calcule l'état d'arène d'un joueur (exporté : les écrans en ont besoin pour
// afficher le parcours sans refaire le calcul).
export function areneDuJoueur(joueur) {
  const bareme = baremes[joueur.sexe] || {};
  return etatArene({
    moyenne: moyennePaliers(joueur),
    scoreSP: scoreSP(joueur),
    nbExercices: Object.keys(bareme).length,
    ligue: ligueJoueur(joueur),
    bareme,
  });
}

export default function CarteArene({ joueur, compacte = false }) {
  const { actuelle, suivante, manquants, progression } = areneDuJoueur(joueur);
  const couleur = couleursLigues[actuelle.ligue] || colors.texteGris;

  return (
    <View style={[styles.carte, { borderColor: couleur }]}>
      <AreneVisuel couleur={couleur} niveau={actuelle.index} />

      <View style={styles.contenu}>
        <Text style={styles.surtitre}>MON ARÈNE</Text>
        <Text style={[styles.nom, { color: couleur }]}>
          {actuelle.embleme} {actuelle.nom}
        </Text>
        {/* On n'affiche PLUS le nom de ligue interne (Bronze, Silver…) à côté
            du nom d'arène : les deux échelles sont décalées d'un cran, donc
            « OLYMPE · Ligue Titan » laissait croire à une incohérence.
            L'arène EST la ligue — un seul nom suffit à l'utilisateur. */}
        <Text style={styles.ligue}>
          {actuelle.index === 0
            ? 'Aucun palier vérifié'
            : `Titre « ${actuelle.titre} »`}
        </Text>

        {/* L'XP est une jauge d'ACTIVITÉ, séparée de l'arène : on l'affiche
            discrètement pour que personne ne croie qu'elle fait monter. */}
        {typeof joueur.xp === 'number' && (
          <Text style={styles.xp}>⚡ {joueur.xp.toLocaleString('fr-FR')} XP d'activité</Text>
        )}

        {!compacte && <Text style={styles.devise}>{actuelle.devise}</Text>}

        {suivante ? (
          <>
            <View style={styles.barreFond}>
              <View
                style={[
                  styles.barreRemplie,
                  { width: `${Math.round(progression * 100)}%`, backgroundColor: couleur },
                ]}
              />
            </View>
            <Text style={styles.prochaine}>
              Prochaine : {suivante.embleme} {suivante.nom}
            </Text>
            <Text style={styles.manquants}>
              Il te manque{' '}
              <Text style={styles.nombreManquants}>
                {manquants} palier{manquants > 1 ? 's' : ''}
              </Text>{' '}
              à faire vérifier.
            </Text>
          </>
        ) : (
          <Text style={styles.prochaine}>👑 Tu es au sommet de Fitness Royale !</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.carte,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: espacement.m,
  },
  contenu: { padding: espacement.m, alignItems: 'center' },
  surtitre: {
    color: colors.texteGris, fontSize: 10, fontWeight: '800', letterSpacing: 2,
  },
  nom: { fontSize: 19, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  ligue: { color: colors.texteGris, fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  xp: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 6 },
  devise: {
    color: colors.texteGris, fontSize: 12, fontStyle: 'italic',
    textAlign: 'center', marginTop: espacement.s, lineHeight: 17,
  },
  barreFond: {
    height: 10, borderRadius: 5, backgroundColor: colors.carteClaire,
    width: '100%', marginTop: espacement.m, overflow: 'hidden',
  },
  barreRemplie: { height: 10, borderRadius: 5 },
  prochaine: {
    color: colors.texte, fontSize: 13, fontWeight: '700',
    marginTop: espacement.s, textAlign: 'center',
  },
  manquants: {
    color: colors.texteGris, fontSize: 12, marginTop: 4,
    textAlign: 'center', lineHeight: 17,
  },
  nombreManquants: { color: colors.or, fontWeight: '800' },
});
