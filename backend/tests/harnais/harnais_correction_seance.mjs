// Corriger une séance déjà enregistrée (14/11/2026) — exécute le VRAI code de
// l'app (src/logic/correctionSeance.js) et rend le résultat en JSON pour
// test_correction_seance.py.
import {
  brouillonDepuisSeance, correctionDepuisBrouillon,
} from '../../../src/logic/correctionSeance.js';

const seance = {
  id: 7, date: '2026-11-10', duree_minutes: 52,
  series: [
    { exercice: 'Squat', numero_serie: 1, reps: 8, poids: 100, rir: 2 },
    { exercice: 'Squat', numero_serie: 2, reps: 6, poids: 105, rir: null },
    { exercice: 'Dips', numero_serie: 1, reps: 12, poids: 0, rir: 0 },
  ],
};
const ligne = (exercice, reps, poids, rir = '') => ({ exercice, reps, poids, rir });
const erreur = (r) => (r && r.erreur ? 'ERREUR' : r);

const cas = [
  // ---- La séance -> le brouillon ----
  ['brouillon : tout devient texte, rien de « null »', () => brouillonDepuisSeance(seance), {
    series: [ligne('Squat', '8', '100', '2'), ligne('Squat', '6', '105', ''), ligne('Dips', '12', '0', '0')],
    duree: '52',
  }],
  ['brouillon : sans durée → champ vide', () => brouillonDepuisSeance({ series: [] }).duree, ''],
  ['brouillon : séance abîmée → vide sans planter', () => brouillonDepuisSeance(null), { series: [], duree: '' }],
  ['brouillon : séries nulles écartées', () => brouillonDepuisSeance({ series: [null, 3] }).series, []],

  // ---- L'aller-retour ne change rien ----
  ['aller-retour : identique à la séance',
    () => correctionDepuisBrouillon(brouillonDepuisSeance(seance)), {
      series: [
        { exercice: 'Squat', numero_serie: 1, reps: 8, poids: 100, rir: 2 },
        { exercice: 'Squat', numero_serie: 2, reps: 6, poids: 105, rir: null },
        { exercice: 'Dips', numero_serie: 1, reps: 12, poids: 0, rir: 0 },
      ],
      duree_minutes: 52,
    }],

  // ---- Corrections ----
  ['correction : virgule acceptée dans la charge',
    () => correctionDepuisBrouillon({ series: [ligne('Squat', '8', '102,5')], duree: '' }).series[0].poids, 102.5],
  ['correction : durée vide → null (estimation côté serveur)',
    () => correctionDepuisBrouillon({ series: [ligne('Squat', '8', '100')], duree: '' }).duree_minutes, null],
  ['correction : série retirée → numéros recalculés sans trou',
    () => correctionDepuisBrouillon({
      series: [ligne('Dips', '10', '0'), ligne('Curl', '12', '15'), ligne('Dips', '8', '0')], duree: '',
    }).series.map((s) => `${s.exercice} ${s.numero_serie}`),
    ['Dips 1', 'Curl 1', 'Dips 2']],

  // ---- Refus, avec la ligne fautive ----
  ['refus : plus aucune série',
    () => correctionDepuisBrouillon({ series: [], duree: '' }).erreur,
    'Il ne reste aucune série : supprime plutôt la séance.'],
  ['refus : reps vides', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '', '100')] })), 'ERREUR'],
  ['refus : reps à 0', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '0', '100')] })), 'ERREUR'],
  ['refus : reps décimales', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '8.5', '100')] })), 'ERREUR'],
  ['refus : reps au-delà de 200', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '201', '100')] })), 'ERREUR'],
  ['refus : charge vide', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '8', '')] })), 'ERREUR'],
  ['refus : charge négative', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '8', '-5')] })), 'ERREUR'],
  ['refus : charge au-delà de 500', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '8', '501')] })), 'ERREUR'],
  ['accepté : charge 0 (poids du corps)',
    () => correctionDepuisBrouillon({ series: [ligne('Dips', '8', '0')] }).series[0].poids, 0],
  ['refus : RIR 11', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '8', '100', '11')] })), 'ERREUR'],
  ['refus : durée 0', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '8', '100')], duree: '0' })), 'ERREUR'],
  ['refus : durée 301', () => erreur(correctionDepuisBrouillon({ series: [ligne('Squat', '8', '100')], duree: '301' })), 'ERREUR'],
  ['refus : le message nomme la ligne fautive',
    () => correctionDepuisBrouillon({ series: [ligne('Squat', '8', '100'), ligne('Squat', 'x', '100')] }).erreur
      .startsWith('Squat — série 2'), true],
  ['refus : brouillon abîmé → message, pas de plantage',
    () => erreur(correctionDepuisBrouillon(undefined)), 'ERREUR'],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
