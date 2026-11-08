// L'écran « Progrès » (08/11/2026) — exécute le VRAI code de l'app
// (src/logic/progres.js) et rend le résultat en JSON pour test_progres.py.
import {
  lundiISO, e1rm, exercicesSuivis, courbeExercice, variation,
  seancesParSemaine, statistiques, volumeLisible,
} from '../../../src/logic/progres.js';

const s = (exercice, poids, reps) => ({ exercice, poids, reps });
const seance = (date, ...series) => ({ id: date, date, series });

const historique = [
  seance('2026-10-06', s('Squat', 100, 8), s('Squat', 100, 7), s('Dips', 0, 12)),
  seance('2026-10-13', s('Squat', 105, 6), s('Tractions', 0, 8)),
  seance('2026-10-13', s('Squat', 110, 3)), // 2e séance le même jour
  seance('2026-10-20', s('Squat', 102.5, 8), s('Dips', 0, 15), s('Dips', 0, 10)),
  seance('2026-11-02', s('Curl', 20, 12)),
  seance('2026-11-05', s('Squat', 110, 5)),
];

const cas = [
  // ---- Les semaines ----
  ['lundi : un dimanche → le lundi d\'avant', () => lundiISO('2026-11-08'), '2026-11-02'],
  ['lundi : un lundi reste lui-même', () => lundiISO('2026-11-02'), '2026-11-02'],
  ['lundi : passage d\'année', () => lundiISO('2027-01-01'), '2026-12-28'],
  ['lundi : date illisible → null', () => lundiISO('demain'), null],

  // ---- Le 1RM estimé ----
  ['1RM : 100 kg × 10 → 133,5', () => e1rm(100, 10), 133.5],
  ['1RM : une seule rep = la charge', () => e1rm(140, 1), 140],
  ['1RM : poids du corps → 0', () => e1rm(0, 12), 0],
  ['1RM : valeurs abîmées → 0', () => e1rm('x', null), 0],

  // ---- Les exercices proposés ----
  ['exercices : les plus pratiqués d\'abord',
    () => exercicesSuivis(historique).map((e) => [e.exercice, e.nbSeances]),
    [['Squat', 5], ['Dips', 2], ['Curl', 1], ['Tractions', 1]]],
  ['exercices : rien → liste vide', () => exercicesSuivis(null), []],

  // ---- La courbe ----
  ['courbe : charge max, un point par JOUR (deux séances le 13 = un point)',
    () => courbeExercice(historique, 'Squat', 'charge').points.map((p) => [p.date, p.valeur]),
    [['2026-10-06', 100], ['2026-10-13', 110], ['2026-10-20', 102.5], ['2026-11-05', 110]]],
  ['courbe : le détail donne la meilleure série du jour',
    () => courbeExercice(historique, 'Squat', 'charge').points[1].detail, '110 kg × 3 · 2 séries'],
  ['courbe : 1RM estimé = le meilleur du jour',
    () => courbeExercice(historique, 'Squat', 'e1rm').points.map((p) => p.valeur),
    [126.5, 126, 130, 128.5]],
  ['courbe : volume = Σ charge × reps du jour',
    () => courbeExercice(historique, 'Squat', 'volume').points.map((p) => p.valeur),
    [1500, 960, 820, 550]],
  ['courbe : unité kg pour un exercice chargé',
    () => courbeExercice(historique, 'Squat').unite, 'kg'],
  ['courbe : poids du corps → les reps, pas une ligne à 0',
    () => {
      const c = courbeExercice(historique, 'Dips', 'charge');
      return [c.unite, c.points.map((p) => p.valeur)];
    },
    ['reps', [12, 15]]],
  ['courbe : poids du corps, volume = reps totales',
    () => courbeExercice(historique, 'Dips', 'volume').points.map((p) => p.valeur), [12, 25]],
  ['courbe : exercice inconnu → aucun point', () => courbeExercice(historique, 'Rien').points, []],
  ['courbe : données abîmées ne plantent pas',
    () => courbeExercice([null, { date: 'x', series: [] }, { date: '2026-01-01', series: [null, s('Squat', 'a', 5)] }], 'Squat').points.length,
    1],

  // ---- La variation ----
  ['variation : premier → dernier point',
    () => variation(courbeExercice(historique, 'Squat').points),
    { depuis: '2026-10-06', ecart: 10, pourcent: 10 }],
  ['variation : un seul point → rien à comparer', () => variation([{ date: 'a', valeur: 3 }]), null],
  ['variation : départ à 0 → pas de pourcentage',
    () => variation([{ date: 'a', valeur: 0 }, { date: 'b', valeur: 5 }]),
    { depuis: 'a', ecart: 5, pourcent: null }],

  // ---- L'activité par semaine ----
  ['activité : 6 semaines, jours entraînés (deux séances le 13 = un jour)',
    () => seancesParSemaine(historique, '2026-11-08', 6).map((w) => [w.lundi, w.nb]),
    [['2026-09-28', 0], ['2026-10-05', 1], ['2026-10-12', 1], ['2026-10-19', 1],
      ['2026-10-26', 0], ['2026-11-02', 2]]],
  ['activité : date du jour illisible → vide', () => seancesParSemaine(historique, 'x', 4), []],

  // ---- Les chiffres clés ----
  ['stats : chiffres clés',
    () => statistiques(historique, '2026-11-08'),
    { joursEntraines: 5, seriesTotal: 11, moyenneSemaine: 0.4, semainesDAffilee: 1, volumeMois: 790 }],
  ['stats : la semaine en cours vide ne casse pas la série',
    () => statistiques([seance('2026-10-27', s('Squat', 100, 5)), seance('2026-10-20', s('Squat', 100, 5))],
      '2026-11-03').semainesDAffilee,
    2],
  ['stats : aucun historique',
    () => statistiques([], '2026-11-08'),
    { joursEntraines: 0, seriesTotal: 0, moyenneSemaine: 0, semainesDAffilee: 0, volumeMois: 0 }],
  ['volume : en kg', () => volumeLisible(790), '790 kg'],
  ['volume : milliers séparés', () => volumeLisible(9500), '9 500 kg'],
  ['volume : en tonnes au-delà de 10 000', () => volumeLisible(12450), '12,5 t'],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
