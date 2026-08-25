// Logique des duels : charge fixe, le plus de répétitions gagne.
// Format en 3 rounds — premier à 2 victoires :
//   Round 1 : le CHALLENGER (celui qui lance le duel) choisit l'exercice.
//   Round 2 : l'ADVERSAIRE choisit l'exercice.
//   Round 3 : l'IA choisit l'exercice de départage.
import { baremes } from '../data/clubSP';

// Compte les rounds gagnés par chacun.
export function comptageVictoires(duel) {
  let moi = 0;
  let lui = 0;
  duel.rounds.forEach((round) => {
    if (round.mesReps == null || round.sesReps == null) return; // pas encore joué
    if (round.mesReps > round.sesReps) moi++;
    else if (round.sesReps > round.mesReps) lui++;
    // Égalité de reps : personne ne marque, le round sera rejoué.
  });
  return { moi, lui };
}

// Statut d'un duel à partir de ses rounds.
export function statutDuel(duel) {
  const { moi, lui } = comptageVictoires(duel);
  if (moi >= 2) return 'gagné';
  if (lui >= 2) return 'perdu';
  return 'en cours';
}

// Joue le round de départage : l'IA choisit un exercice en kg au hasard,
// avec une charge fixe (le palier Bronze de l'exercice, accessible aux deux).
// Les répétitions sont SIMULÉES pour l'instant — le vrai duel viendra avec le backend.
// L'IA choisit un exercice en kg au hasard, charge fixe = palier Bronze (accessible aux deux).
export function exerciceAleatoireIA(sexe) {
  const exercicesKg = Object.entries(baremes[sexe]).filter(([, b]) => b.unite === 'kg');
  const [exercice, bareme] = exercicesKg[Math.floor(Math.random() * exercicesKg.length)];
  return { exercice, charge: bareme.paliers[0] };
}

export function jouerRoundIA(duel, sexe) {
  const { exercice, charge } = exerciceAleatoireIA(sexe);
  const rounds = duel.rounds.map((round) =>
    round.exercice === null
      ? {
          ...round,
          exercice,
          charge,
          mesReps: 6 + Math.floor(Math.random() * 10),
          sesReps: 6 + Math.floor(Math.random() * 10),
        }
      : round
  );
  const nouveau = { ...duel, rounds };
  nouveau.statut = statutDuel(nouveau);
  return nouveau;
}
