// DUEL EN DIRECT (pass-and-play) : vous êtes deux dans la salle, UN téléphone.
// Le téléphone sert d'arbitre : charge fixe, le plus de reps gagne.
// R1 : le challenger (toi) choisit l'exercice. R2 : l'adversaire. R3 : l'IA départage.
// Premier à 2 victoires. Égalité de reps → le round est rejoué.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { baremes } from '../data/clubSP';
import { comptageVictoires, exerciceAleatoireIA } from '../logic/duels';

const RECOMPENSE = 150;

export default function DuelDirect({ moi, onTerminer, onAnnuler }) {
  const [etape, setEtape] = useState('config'); // 'config' | 'round' | 'fini'
  const [adversaire, setAdversaire] = useState('');
  const [rounds, setRounds] = useState([]);
  const [numRound, setNumRound] = useState(1);
  const [message, setMessage] = useState('');

  // Champs du round en cours
  const [exercice, setExercice] = useState(null);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [charge, setCharge] = useState('');
  const [mesReps, setMesReps] = useState('');
  const [sesReps, setSesReps] = useState('');

  const exercicesKg = Object.keys(baremes[moi.sexe]).filter(
    (exo) => baremes[moi.sexe][exo].unite === 'kg'
  );
  const victoires = comptageVictoires({ rounds });
  const roundIA = numRound === 3;

  function commencer() {
    if (!adversaire.trim()) return;
    setEtape('round');
  }

  function viderChampsRound() {
    setExercice(null);
    setCharge('');
    setMesReps('');
    setSesReps('');
    setListeOuverte(false);
  }

  function lancerRoundIA() {
    const choix = exerciceAleatoireIA(moi.sexe);
    setExercice(choix.exercice);
    setCharge(String(choix.charge));
  }

  function validerRound() {
    const chargeNombre = parseFloat(charge.replace(',', '.'));
    const m = parseInt(mesReps, 10);
    const l = parseInt(sesReps, 10);
    if (!exercice || isNaN(chargeNombre) || isNaN(m) || isNaN(l)) {
      setMessage('Remplis l’exercice, la charge et les reps des deux joueurs.');
      return;
    }
    if (m === l) {
      setMessage('Égalité ! Personne ne marque : rejouez ce round. 💪');
      setMesReps('');
      setSesReps('');
      return;
    }
    setMessage('');
    const nouveaux = [
      ...rounds,
      {
        exercice,
        charge: chargeNombre,
        choisiPar: numRound === 1 ? 'moi' : numRound === 2 ? 'lui' : 'ia',
        mesReps: m,
        sesReps: l,
      },
    ];
    setRounds(nouveaux);
    const v = comptageVictoires({ rounds: nouveaux });
    if (v.moi >= 2 || v.lui >= 2) {
      setEtape('fini');
    } else {
      setNumRound(numRound + 1);
      viderChampsRound();
    }
  }

  function enregistrer() {
    const statut = victoires.moi >= 2 ? 'gagné' : 'perdu';
    onTerminer({
      id: Date.now(),
      adversaire: adversaire.trim(),
      recompense: RECOMPENSE,
      statut,
      rounds,
    });
  }

  // ----- Étape 1 : configuration -----
  if (etape === 'config') {
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>⚡ Duel en direct</Text>
        <Text style={styles.explication}>
          Vous êtes deux dans la salle, un seul téléphone : il sert d'arbitre.
          Charge fixe, le plus de répétitions gagne, premier à 2 victoires.
        </Text>
        <Text style={styles.libelle}>Contre qui ?</Text>
        <TextInput
          style={styles.champ}
          value={adversaire}
          onChangeText={setAdversaire}
          placeholder="Pseudo de ton adversaire…"
          placeholderTextColor={colors.texteGris}
        />
        <TouchableOpacity style={styles.boutonPrincipal} onPress={commencer}>
          <Text style={styles.boutonPrincipalTexte}>Commencer le duel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onAnnuler}>
          <Text style={styles.lienAnnuler}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ----- Étape 3 : résultat -----
  if (etape === 'fini') {
    const gagne = victoires.moi >= 2;
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>{gagne ? '🏆 Victoire !' : '💀 Défaite…'}</Text>
        <Text style={styles.scoreFinal}>
          {moi.pseudo} {victoires.moi} — {victoires.lui} {adversaire}
        </Text>
        {rounds.map((r, i) => (
          <Text key={i} style={styles.resumeRound}>
            R{i + 1} · {r.exercice} @ {r.charge} kg : {r.mesReps} vs {r.sesReps}{' '}
            {r.mesReps > r.sesReps ? '✅' : '❌'}
          </Text>
        ))}
        <Text style={styles.explication}>
          {gagne ? `+${RECOMPENSE} points pour toi !` : 'Pas de points cette fois — entraîne-toi et prends ta revanche !'}
        </Text>
        <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrer}>
          <Text style={styles.boutonPrincipalTexte}>Enregistrer le duel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ----- Étape 2 : jouer un round -----
  const quiChoisit =
    numRound === 1 ? `${moi.pseudo}, choisis l'exercice` :
    numRound === 2 ? `${adversaire}, choisis l'exercice` :
    "Départage : l'IA choisit l'exercice";

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>Round {numRound} / 3</Text>
      <Text style={styles.score}>
        {moi.pseudo} {victoires.moi} — {victoires.lui} {adversaire}
      </Text>
      <Text style={styles.libelle}>{quiChoisit}</Text>

      {roundIA ? (
        exercice ? (
          <Text style={styles.choixIA}>🤖 {exercice} @ {charge} kg</Text>
        ) : (
          <TouchableOpacity style={styles.boutonSecondaire} onPress={lancerRoundIA}>
            <Text style={styles.boutonSecondaireTexte}>🎲 Tirer l'exercice au sort</Text>
          </TouchableOpacity>
        )
      ) : (
        <>
          <TouchableOpacity style={styles.selecteurExo} onPress={() => setListeOuverte(!listeOuverte)}>
            <Text style={{ color: exercice ? colors.texte : colors.texteGris }}>
              {exercice || 'Choisir un exercice…'}
            </Text>
            <Text style={{ color: colors.texteGris }}>{listeOuverte ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {listeOuverte &&
            exercicesKg.map((exo) => (
              <TouchableOpacity
                key={exo}
                style={styles.choixExo}
                onPress={() => { setExercice(exo); setListeOuverte(false); }}
              >
                <Text style={{ color: colors.texte }}>{exo}</Text>
              </TouchableOpacity>
            ))}
          <Text style={styles.libelle}>Charge fixe (kg) — la même pour les deux</Text>
          <TextInput
            style={styles.champ}
            value={charge}
            onChangeText={setCharge}
            keyboardType="numeric"
            placeholder="Ex. : 80"
            placeholderTextColor={colors.texteGris}
          />
        </>
      )}

      {exercice !== null && (
        <>
          <Text style={styles.explication}>
            💪 À vous de jouer ! Faites votre série chacun votre tour, puis entrez les reps.
          </Text>
          <View style={styles.ligneReps}>
            <View style={{ flex: 1 }}>
              <Text style={styles.libelle}>{moi.pseudo}</Text>
              <TextInput
                style={styles.champ}
                value={mesReps}
                onChangeText={setMesReps}
                keyboardType="numeric"
                placeholder="Reps"
                placeholderTextColor={colors.texteGris}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.libelle}>{adversaire}</Text>
              <TextInput
                style={styles.champ}
                value={sesReps}
                onChangeText={setSesReps}
                keyboardType="numeric"
                placeholder="Reps"
                placeholderTextColor={colors.texteGris}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={validerRound}>
            <Text style={styles.boutonPrincipalTexte}>Valider le round</Text>
          </TouchableOpacity>
        </>
      )}

      {message !== '' && <Text style={styles.message}>{message}</Text>}
      <TouchableOpacity onPress={onAnnuler}>
        <Text style={styles.lienAnnuler}>Abandonner le duel</Text>
      </TouchableOpacity>
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
    borderColor: colors.or,
  },
  titre: { color: colors.texte, fontSize: 20, fontWeight: '800' },
  score: { color: colors.or, fontWeight: '800', fontSize: 18, marginVertical: espacement.s },
  scoreFinal: { color: colors.or, fontWeight: '800', fontSize: 22, marginVertical: espacement.s },
  explication: { color: colors.texteGris, fontSize: 13, marginVertical: espacement.s },
  libelle: { color: colors.texte, fontWeight: '600', marginTop: espacement.s, marginBottom: 6 },
  champ: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: 12,
    color: colors.texte,
  },
  selecteurExo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: 12,
  },
  choixExo: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
    backgroundColor: colors.carteClaire,
  },
  choixIA: { color: colors.accent, fontWeight: '800', fontSize: 16, marginVertical: espacement.s },
  ligneReps: { flexDirection: 'row', gap: 10 },
  resumeRound: { color: colors.texteGris, fontSize: 13, marginTop: 4 },
  boutonPrincipal: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: espacement.m,
  },
  boutonPrincipalTexte: { color: colors.texte, fontWeight: '700' },
  boutonSecondaire: {
    backgroundColor: colors.carteClaire,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  boutonSecondaireTexte: { color: colors.accent, fontWeight: '700' },
  message: { color: colors.or, fontWeight: '700', marginTop: espacement.s, textAlign: 'center' },
  lienAnnuler: { color: colors.texteGris, textAlign: 'center', marginTop: espacement.m, fontSize: 13 },
});
