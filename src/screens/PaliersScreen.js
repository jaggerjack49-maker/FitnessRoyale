// Écran Paliers : LES ARÈNES (progression façon Clash Royale) + le barème
// Fitness Royale exercice par exercice.
// - En haut : ton arène actuelle, ta progression vers la suivante, et le
//   parcours complet des arènes (franchies / actuelle / verrouillées).
// - En bas : pour chaque exercice, ta perf, ton palier et l'échelle complète.
// L'arène n'introduit AUCUN nouveau score : c'est l'habillage du palier moyen
// déjà calculé par ligueJoueur() (voir src/data/arenes.js).
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { baremes, nomsLigues, couleursLigues } from '../data/clubSP';
import { palierExercice } from '../logic/classement';
import { estVerifiee, STATUTS } from '../data/statuts';
import CarteArene, { areneDuJoueur } from '../components/CarteArene';
import RouteArenes from '../components/RouteArenes';
import Losange from '../components/Losange';
import { da, monospace } from '../designSystem';

export default function PaliersScreen({ moi }) {
  const [exerciceOuvert, setExerciceOuvert] = useState(null);
  const bareme = baremes[moi.sexe];
  const exercices = Object.keys(bareme);

  // ----- Arènes : même calcul que le Profil (composant partagé) -----
  const { liste: mesArenes, actuelle: areneActuelle } = areneDuJoueur(moi);

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
      {/* Pas de titre d'écran ici : la carte porte déjà son surtitre « MON ARÈNE ». */}
      <CarteArene joueur={moi} />

      {/* ---- La route des arènes (composant partagé) ---- */}
      <Text style={styles.sectionTitre}>La route des arènes</Text>
      <RouteArenes
        arenes={mesArenes}
        indexActuel={areneActuelle.index}
        nbExercices={exercices.length}
      />

      <Text style={styles.sectionTitre}>
        MES <Text style={{ color: da.or }}>PALIERS</Text>
      </Text>
      <Text style={styles.sousTitre}>
        Barème Fitness Royale · {moi.sexe === 'femme' ? 'barème femmes' : 'barème hommes'} · touche un
        exercice pour voir le barème
      </Text>

      {exercices.map((exo) => {
        const infos = bareme[exo];
        const perf = moi.performances[exo]; // peut être undefined si pas encore saisie
        const palier = perf ? palierExercice(moi.sexe, exo, perf.valeur) : 0;
        const nomPalier = palier === 0 ? 'Aucun' : nomsLigues[palier - 1];
        const couleur = palier === 0 ? da.texteMuet : couleursLigues[nomPalier];
        const ouvert = exerciceOuvert === exo;
        const prochainIndex = palier < infos.paliers.length ? palier : null; // index du prochain seuil
        const formater = (seuil) =>
          infos.unite === 'kg' ? `${infos.reps} × ${seuil} kg` : `${seuil} reps`;

        return (
          <View key={exo} style={[styles.carte, ouvert && { borderColor: couleur }]}>
            {/* En-tête : losange de palier + nom + perf + palier (style maquette) */}
            <TouchableOpacity
              style={styles.entete}
              onPress={() => setExerciceOuvert(ouvert ? null : exo)}
            >
              <Losange couleur={couleur} taille={10} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nomExo}>{exo}</Text>
                <Text style={styles.perf}>
                  {perf
                    ? `Meilleure perf : ${infos.unite === 'kg' ? `${infos.reps} × ${perf.valeur} kg` : `${perf.valeur} reps`} ${STATUTS[perf.statut].emoji}`
                    : 'Aucune perf enregistrée'}
                </Text>
              </View>
              <Text style={[styles.badgePalier, { color: couleur }]}>
                {nomPalier.toUpperCase()}
              </Text>
              <Text style={styles.fleche}>{ouvert ? '▴' : '›'}</Text>
            </TouchableOpacity>

            {/* Échelle complète du barème */}
            {ouvert && (
              <View style={styles.echelle}>
                {infos.paliers.map((seuil, i) => {
                  const nom = nomsLigues[i];
                  const atteint = palier >= i + 1;
                  const prochain = prochainIndex === i;
                  return (
                    <View
                      key={nom}
                      style={[
                        styles.lignePalier,
                        prochain && {
                          backgroundColor: da.orVoile,
                          borderLeftColor: couleursLigues[nom],
                        },
                      ]}
                    >
                      <Losange
                        couleur={couleursLigues[nom]}
                        taille={11}
                        opacite={atteint ? 1 : 0.35}
                      />
                      <Text style={[styles.nomPalier, { color: couleursLigues[nom] }]}>
                        {nom.toUpperCase()}
                      </Text>
                      <Text style={[styles.seuil, atteint && styles.seuilAtteint]}>
                        {formater(seuil)}
                      </Text>
                      <Text style={styles.icone}>
                        {atteint ? '✓' : prochain ? '◎' : ''}
                      </Text>
                    </View>
                  );
                })}
                {prochainIndex !== null && perf && (
                  <Text style={styles.objectif}>
                    🎯 Prochain objectif : {nomsLigues[prochainIndex]} à {formater(infos.paliers[prochainIndex])}
                  </Text>
                )}
                {prochainIndex === null && (
                  <Text style={styles.objectif}>👑 Palier maximal atteint sur cet exercice !</Text>
                )}
                {perf && !estVerifiee(perf) && (
                  <Text style={styles.avertissement}>
                    ⚠️ Perf déclarée non vérifiée : elle ne compte pas au classement.
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: da.fond },
  titre: { color: da.texte, fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  sousTitre: { color: da.texteGris, fontSize: 12, marginTop: 4, marginBottom: espacement.m },
  sectionTitre: {
    color: da.texte, fontSize: 24, fontWeight: '900', letterSpacing: 0.5,
    marginTop: espacement.l, marginBottom: 2,
  },
  // (la carte de l'arène vit dans components/CarteArene.js et le parcours dans
  //  components/RouteArenes.js — tous deux partagés avec le Profil)
  carte: {
    backgroundColor: da.carte,
    borderRadius: 14,
    marginBottom: espacement.s,
    borderWidth: 1,
    borderColor: da.bordureFine,
    overflow: 'hidden',
  },
  entete: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 15,
  },
  nomExo: { color: da.texte, fontWeight: '700', fontSize: 14 },
  perf: { color: da.texteGris, fontSize: 11, marginTop: 2 },
  badgePalier: { fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  fleche: { color: da.texteMuet, fontSize: 14, fontWeight: '900' },
  echelle: {
    borderTopWidth: 1,
    borderTopColor: da.bordureFine,
    paddingVertical: 6,
  },
  lignePalier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  nomPalier: { flex: 1, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  seuil: { color: da.texteDoux, fontSize: 12, fontFamily: monospace },
  seuilAtteint: { color: da.texte, fontWeight: '700' },
  icone: { width: 18, textAlign: 'center', color: da.or, fontWeight: '900', fontSize: 13 },
  objectif: {
    color: da.or, fontWeight: '700', fontSize: 12,
    marginTop: espacement.s, paddingHorizontal: 16,
  },
  avertissement: {
    color: da.texteMuet, fontSize: 11, marginTop: 4, paddingHorizontal: 16, paddingBottom: 4,
  },
});
