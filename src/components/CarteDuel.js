// Carte d'un duel BO3 : charge fixe, le plus de reps gagne, premier à 2 victoires.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { comptageVictoires } from '../logic/duels';

const QUI_CHOISIT = { moi: 'choisi par toi', lui: 'choisi par lui', ia: "choisi par l'IA" };

// LECTURE SEULE. Le bouton « Jouer le round de départage » (une simulation
// par l'IA) a été retiré le 26/09/2026 avec le mode hors-ligne : il ne servait
// qu'aux duels de démonstration, les seuls à rester « en cours ». Un duel en
// direct se joue jusqu'au bout sur le téléphone, un duel en ligne est arbitré
// par le serveur.
export default function CarteDuel({ duel }) {
  const { moi, lui } = comptageVictoires(duel);

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
  recompense: { color: colors.or, fontWeight: '700', fontSize: 13, marginTop: espacement.s },
});
