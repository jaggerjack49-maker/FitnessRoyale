// Carte d'un duel BO3 : charge fixe, le plus de reps gagne, premier à 2 victoires.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { comptageVictoires } from '../logic/duels';

const QUI_CHOISIT = { moi: 'choisi par toi', lui: 'choisi par lui', ia: "choisi par l'IA" };

export default function CarteDuel({ duel, onJouerRoundIA }) {
  const { moi, lui } = comptageVictoires(duel);
  const roundEnAttente = duel.rounds.find((r) => r.exercice === null);

  return (
    <View style={styles.carte}>
      {/* En-tête : adversaire + score */}
      <View style={styles.ligneTitre}>
        <Text style={styles.titre}>⚔️ vs {duel.adversaire}</Text>
        <View
          style={[
            styles.badge,
            duel.statut === 'gagné' && styles.badgeGagne,
            duel.statut === 'perdu' && styles.badgePerdu,
          ]}
        >
          <Text style={styles.badgeTexte}>
            {duel.statut === 'gagné' ? '🏆 Gagné' : duel.statut === 'perdu' ? '💀 Perdu' : '⏳ En cours'}
          </Text>
        </View>
      </View>
      <Text style={styles.score}>
        {moi} — {lui}
      </Text>

      {/* Les rounds */}
      {duel.rounds.map((round, i) => {
        if (round.exercice === null) {
          return (
            <View key={i} style={styles.round}>
              <Text style={styles.roundNumero}>R{i + 1}</Text>
              <Text style={styles.roundAttente}>🤖 L'IA choisira l'exercice du départage…</Text>
            </View>
          );
        }
        const joue = round.mesReps != null;
        const gagne = joue && round.mesReps > round.sesReps;
        const egalite = joue && round.mesReps === round.sesReps;
        return (
          <View key={i} style={styles.round}>
            <Text style={styles.roundNumero}>R{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roundExercice}>
                {round.exercice} @ {round.charge} kg{' '}
                <Text style={styles.roundChoisiPar}>({QUI_CHOISIT[round.choisiPar]})</Text>
              </Text>
              {joue && (
                <Text style={styles.roundReps}>
                  {round.mesReps} reps vs {round.sesReps} reps
                </Text>
              )}
            </View>
            <Text style={styles.roundIssue}>{!joue ? '⏳' : egalite ? '🔁' : gagne ? '✅' : '❌'}</Text>
          </View>
        );
      })}

      {/* Bouton pour jouer le départage (simulation en attendant le backend) */}
      {duel.statut === 'en cours' && roundEnAttente && (
        <TouchableOpacity style={styles.boutonJouer} onPress={onJouerRoundIA}>
          <Text style={styles.boutonJouerTexte}>🎲 Jouer le round de départage</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.recompense}>Récompense : +{duel.recompense} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    marginBottom: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  ligneTitre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titre: { color: colors.texte, fontWeight: '800', fontSize: 16 },
  badge: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeGagne: { backgroundColor: colors.or },
  badgePerdu: { backgroundColor: colors.rouge },
  badgeTexte: { color: colors.texte, fontSize: 12, fontWeight: '700' },
  score: { color: colors.or, fontWeight: '800', fontSize: 22, marginVertical: espacement.s },
  round: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: espacement.s,
    marginBottom: 6,
  },
  roundNumero: { color: colors.texteGris, fontWeight: '800', width: 30 },
  roundExercice: { color: colors.texte, fontSize: 13, fontWeight: '600' },
  roundChoisiPar: { color: colors.texteGris, fontWeight: '400', fontSize: 12 },
  roundReps: { color: colors.texteGris, fontSize: 12, marginTop: 2 },
  roundAttente: { color: colors.texteGris, fontSize: 13, flex: 1 },
  roundIssue: { fontSize: 16, marginLeft: 6 },
  boutonJouer: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: espacement.s,
  },
  boutonJouerTexte: { color: colors.texte, fontWeight: '700' },
  recompense: { color: colors.or, fontWeight: '700', fontSize: 13, marginTop: espacement.s },
});
