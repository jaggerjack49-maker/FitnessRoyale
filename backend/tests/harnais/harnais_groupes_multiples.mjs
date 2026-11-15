// Un exercice compté dans PLUSIEURS groupes musculaires (15/11/2026) — exécute
// le VRAI code de l'app (src/data/groupesMusculaires.js). Lancé par
// test_groupes_multiples.py.
import {
  groupesDeLExercice, basculerGroupeEnPlus, compterSeriesParGroupe,
  exercicesDeLaPeriode, dernieresSeriesDuGroupe, totalSeriesFaites,
} from '../../../src/data/groupesMusculaires.js';

const s = (exercice, reps = 8, poids = 100) => ({ exercice, reps, poids });
const semaine = [
  { id: 1, date: '2026-11-10', series: [s('Développé couché'), s('Développé couché'), s('Curl barre', 10, 30)] },
  { id: 2, date: '2026-11-12', series: [s('Développé couché')] },
  { id: 3, date: '2026-11-02', series: [s('Développé couché')] }, // semaine d'avant
];
const D = '2026-11-09', F = '2026-11-15';
const enPlus = { 'Développé couché': ['Triceps', 'Épaules'] };

const cas = [
  // ---- Sans groupe en plus : RIEN ne change ----
  ['sans groupe en plus : un seul groupe, comme avant',
    () => groupesDeLExercice('Développé couché'), ['Pectoraux']],
  ['sans groupe en plus : le comptage est inchangé',
    () => compterSeriesParGroupe(semaine, {}, D, F), { Pectoraux: 3, Biceps: 1 }],

  // ---- Avec des groupes en plus ----
  ['principal d\u2019abord, puis les groupes en plus',
    () => groupesDeLExercice('Développé couché', {}, enPlus), ['Pectoraux', 'Triceps', 'Épaules']],
  ['chaque série compte en entier dans chacun de ses groupes',
    () => compterSeriesParGroupe(semaine, {}, D, F, enPlus),
    { Pectoraux: 3, Triceps: 3, Épaules: 3, Biceps: 1 }],
  ['la correction du principal est respectée',
    () => groupesDeLExercice('Développé couché', { 'Développé couché': 'Triceps' }, { 'Développé couché': ['Pectoraux'] }),
    ['Triceps', 'Pectoraux']],
  ['un groupe en plus identique au principal ne compte pas deux fois',
    () => compterSeriesParGroupe(semaine, {}, D, F, { 'Développé couché': ['Pectoraux'] }).Pectoraux, 3],
  ['un groupe inconnu est ignoré',
    () => groupesDeLExercice('Développé couché', {}, { 'Développé couché': ['Mollets', 'Pas un groupe'] }),
    ['Pectoraux', 'Mollets']],

  // ---- Le total de la semaine compte les VRAIES séries ----
  ['total : les séries réellement faites, pas la somme des groupes',
    () => totalSeriesFaites(semaine, D, F), 4],

  // ---- L'écran ----
  ['liste de la semaine : les groupes en plus sont donnés',
    () => exercicesDeLaPeriode(semaine, {}, D, F, enPlus).find((e) => e.exercice === 'Développé couché').groupesEnPlus,
    ['Triceps', 'Épaules']],
  ['dernières séries d\u2019un groupe : on y retrouve l\u2019exercice ajouté',
    () => dernieresSeriesDuGroupe(semaine, {}, 'Triceps', 8, enPlus).map((l) => l.date),
    ['2026-11-12', '2026-11-10', '2026-11-02']],
  ['dernières séries : sans groupe en plus, le Triceps est vide',
    () => dernieresSeriesDuGroupe(semaine, {}, 'Triceps'), []],

  // ---- Cocher / décocher ----
  ['cocher ajoute, dans l\u2019ordre des groupes de l\u2019app',
    () => basculerGroupeEnPlus(['Épaules'], 'Triceps', 'Pectoraux'), ['Épaules', 'Triceps']],
  ['décocher retire', () => basculerGroupeEnPlus(['Triceps', 'Épaules'], 'Triceps', 'Pectoraux'), ['Épaules']],
  ['le principal ne se coche jamais en plus',
    () => basculerGroupeEnPlus([], 'Pectoraux', 'Pectoraux'), []],
  ['liste abîmée → repartie de zéro', () => basculerGroupeEnPlus(null, 'Dos', 'Pectoraux'), ['Dos']],

  // ---- Données abîmées : jamais de plantage ----
  ['entrées abîmées → vide',
    () => [groupesDeLExercice('Inconnu xyz', null, null), totalSeriesFaites(null, D, F),
      compterSeriesParGroupe([null, { date: '2026-11-10' }], {}, D, F, { x: 'pas une liste' })],
    [[], 0, {}]],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
