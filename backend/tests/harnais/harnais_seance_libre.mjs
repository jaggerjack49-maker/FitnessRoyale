// Le chrono de séance et « une séance libre devient un programme »
// (08/11/2026) — exécute le VRAI code de l'app (src/logic/seanceLibre.js) et
// rend le résultat en JSON pour test_seance_libre.py.
import {
  secondesEcoulees, chronoLisible, objectifDepuisSeries, exercicesPourProgramme,
} from '../../../src/logic/seanceLibre.js';

const s = (exercice, reps, poids = 50) => ({ exercice, reps, poids });

const cas = [
  // ---- Le chrono ----
  ['écoulé : 2 min 5 s', () => secondesEcoulees(1_000_000, 1_125_000), 125],
  ['écoulé : jamais négatif (horloge reculée)', () => secondesEcoulees(2_000_000, 1_000_000), 0],
  ['écoulé : début absent → 0', () => secondesEcoulees(null, 1_000_000), 0],
  ['écoulé : début illisible → 0', () => secondesEcoulees('abc', 1_000_000), 0],
  ['affichage : 0:00', () => chronoLisible(0), '0:00'],
  ['affichage : 4:07', () => chronoLisible(247), '4:07'],
  ['affichage : 59:59', () => chronoLisible(3599), '59:59'],
  ['affichage : passe aux heures', () => chronoLisible(3725), '1:02:05'],
  ['affichage : valeur abîmée → 0:00', () => chronoLisible(NaN), '0:00'],

  // ---- L'objectif déduit ----
  ['objectif : séries faites + reps de la dernière',
    () => objectifDepuisSeries([s('Squat', 10), s('Squat', 8), s('Squat', 7)]),
    { series_cibles: 3, reps_cibles: 7 }],
  ['objectif : jamais fait → 3 × 10', () => objectifDepuisSeries([]), { series_cibles: 3, reps_cibles: 10 }],
  ['objectif : reps illisibles → 10', () => objectifDepuisSeries([s('Squat', '')]),
    { series_cibles: 1, reps_cibles: 10 }],
  ['objectif : pas une liste → 3 × 10', () => objectifDepuisSeries('n\'importe quoi'),
    { series_cibles: 3, reps_cibles: 10 }],

  // ---- Les exercices du programme ----
  ['programme : ordre de la séance, objectifs déduits',
    () => exercicesPourProgramme(['Tractions', 'Rowing'],
      [s('Rowing', 12), s('Tractions', 8), s('Tractions', 6), s('Rowing', 10)]),
    [{ exercice: 'Tractions', series_cibles: 2, reps_cibles: 6 },
      { exercice: 'Rowing', series_cibles: 2, reps_cibles: 10 }]],
  ['programme : exercice ajouté mais pas fait → gardé en 3 × 10',
    () => exercicesPourProgramme(['Dips'], []),
    [{ exercice: 'Dips', series_cibles: 3, reps_cibles: 10 }]],
  ['programme : sans liste de noms, ordre d\'apparition des séries',
    () => exercicesPourProgramme(null, [s('Curl', 12), s('Squat', 5)]).map((e) => e.exercice),
    ['Curl', 'Squat']],
  ['programme : même exercice écrit deux fois = une ligne',
    () => exercicesPourProgramme(['Squat', ' squat '], [s('Squat', 5), s('squat', 4)]),
    [{ exercice: 'Squat', series_cibles: 2, reps_cibles: 4 }]],
  ['programme : noms vides et séries nulles écartés',
    () => exercicesPourProgramme(['', '  ', 'Squat'], [null, { reps: 5 }, s('Squat', 5)]),
    [{ exercice: 'Squat', series_cibles: 1, reps_cibles: 5 }]],
  ['programme : rien du tout → liste vide', () => exercicesPourProgramme(undefined, undefined), []],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
