// UNE LIGNE D'EXERCICE DANS UN ÉDITEUR DE PROGRAMME (08/11/2026).
//
// Utilisée par les DEUX formulaires qui écrivent un programme : l'éditeur
// d'une séance et « Nouveau programme ». Ils avaient chacun leur ligne, et
// l'un ignorait la fourchette de reps que l'autre connaissait ; avec le repos
// et le RIR en plus, deux copies auraient forcément divergé.
//
// Deux rangées, pour tenir sur un téléphone :
//   1. l'ORDRE (▲ ▼ — demande de Hafiz : « l'ordre des exercices doit être
//      pris en compte »), le nom, et la croix pour retirer la ligne ;
//   2. les réglages, chacun avec son libellé : séries, reps (et le haut d'une
//      fourchette, facultatif), repos, RIR.
// La forme de la ligne et sa conversion vivent dans src/logic/lignesProgramme.js.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { Icone } from './Icones';

// La zone touchée déborde du dessin : les flèches restent petites à l'œil
// mais faciles à viser (on édite souvent un programme debout, à la salle).
const ZONE = { top: 6, bottom: 6, left: 4, right: 4 };

function Champ({ libelle, valeur, onChange, placeholder, large }) {
  return (
    <View style={[styles.colonne, large && styles.colonneLarge]}>
      <Text style={styles.libelle}>{libelle}</Text>
      <TextInput
        style={styles.champ}
        value={valeur}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        placeholder={placeholder}
        placeholderTextColor={colors.texteGris}
      />
    </View>
  );
}

export default function LigneExerciceEditable({
  ligne, index, total, onModifier, onDeplacer, onRetirer,
}) {
  const premier = index === 0;
  const dernier = index === total - 1;
  return (
    <View style={styles.carte}>
      <View style={styles.rangee}>
        <View style={styles.fleches}>
          <TouchableOpacity
            style={[styles.fleche, premier && styles.flecheInactive]}
            onPress={() => onDeplacer(-1)}
            disabled={premier}
            hitSlop={ZONE}
            accessibilityLabel="Monter cet exercice"
          >
            <Icone nom="chevron-haut" taille={14} couleur={premier ? colors.bordure : colors.texteDoux} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fleche, dernier && styles.flecheInactive]}
            onPress={() => onDeplacer(1)}
            disabled={dernier}
            hitSlop={ZONE}
            accessibilityLabel="Descendre cet exercice"
          >
            <Icone nom="chevron-bas" taille={14} couleur={dernier ? colors.bordure : colors.texteDoux} />
          </TouchableOpacity>
        </View>
        <Text style={styles.numero}>{index + 1}.</Text>
        <TextInput
          style={styles.champNom}
          value={ligne.exercice}
          onChangeText={(v) => onModifier('exercice', v)}
          placeholder="Nom de l'exercice"
          placeholderTextColor={colors.texteGris}
        />
        {onRetirer ? (
          <TouchableOpacity style={styles.retirer} onPress={onRetirer} hitSlop={ZONE}
            accessibilityLabel="Retirer cet exercice">
            <Icone nom="croix" taille={13} couleur={colors.rouge} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.rangeeReglages}>
        <Champ libelle="SÉRIES" valeur={ligne.series} onChange={(v) => onModifier('series', v)} />
        <Champ libelle="REPS" valeur={ligne.reps} onChange={(v) => onModifier('reps', v)} />
        <Champ libelle="→ MAX" valeur={ligne.repsMax} placeholder="—"
          onChange={(v) => onModifier('repsMax', v)} />
        <Champ libelle="REPOS" valeur={ligne.repos} placeholder="—" large
          onChange={(v) => onModifier('repos', v)} />
        <Champ libelle="RIR" valeur={ligne.rir} placeholder="—"
          onChange={(v) => onModifier('rir', v)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.carte, borderRadius: 10, borderWidth: 1,
    borderColor: colors.bordure, padding: 8, marginBottom: 6,
  },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fleches: { gap: 2 },
  fleche: {
    width: 28, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carteClaire,
  },
  flecheInactive: { opacity: 0.5 },
  numero: { color: colors.or, fontWeight: '800', fontSize: 13, minWidth: 18 },
  champNom: {
    flex: 1, backgroundColor: colors.carteClaire, borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 10, color: colors.texte, borderWidth: 1, borderColor: colors.bordure,
    fontSize: 13,
  },
  retirer: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.rouge,
  },
  rangeeReglages: { flexDirection: 'row', gap: 6, marginTop: espacement.s },
  colonne: { flex: 1 },
  colonneLarge: { flex: 1.3 },
  libelle: {
    color: colors.texteGris, fontSize: 9, fontWeight: '800', letterSpacing: 1,
    marginBottom: 3, textAlign: 'center',
  },
  champ: {
    backgroundColor: colors.carteClaire, borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 2, color: colors.texte, textAlign: 'center',
    borderWidth: 1, borderColor: colors.bordure, fontSize: 13, fontWeight: '700',
  },
});
