// L'écran « Progrès » (08/11/2026) — exécute le VRAI code de l'app
// (src/logic/progres.js) et rend le résultat en JSON pour test_progres.py.
import {
  lundiISO, e1rm, exercicesSuivis, courbeExercice, variation,
  seancesParSemaine, statistiques, volumeLisible, dureeSeanceLisible,
  dernieresSeancesExercice, rangerExercicesParGroupe, resumeExercice, GROUPE_AUTRES,
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
    { joursEntraines: 5, seriesTotal: 11, moyenneSemaine: 0.4, semainesDAffilee: 1, volumeMois: 790,
      dureeMoyenne: null, nbChronometrees: 0 }],
  ['stats : la semaine en cours vide ne casse pas la série',
    () => statistiques([seance('2026-10-27', s('Squat', 100, 5)), seance('2026-10-20', s('Squat', 100, 5))],
      '2026-11-03').semainesDAffilee,
    2],
  ['stats : aucun historique',
    () => statistiques([], '2026-11-08'),
    { joursEntraines: 0, seriesTotal: 0, moyenneSemaine: 0, semainesDAffilee: 0, volumeMois: 0,
      dureeMoyenne: null, nbChronometrees: 0 }],

  // ---- La durée moyenne (10/11/2026) ----
  ['durée moyenne : seulement les séances chronométrées',
    () => {
      const st = statistiques([
        { ...seance('2026-11-03', s('Squat', 100, 5)), duree_minutes: 40 },
        { ...seance('2026-11-04', s('Squat', 100, 5)), duree_minutes: 61 },
        seance('2026-11-05', s('Squat', 100, 5)), // d'avant le chrono : ne compte pas
      ], '2026-11-08');
      return [st.dureeMoyenne, st.nbChronometrees];
    },
    [51, 2]],
  ['durée moyenne : valeurs abîmées ignorées',
    () => {
      const st = statistiques([
        { ...seance('2026-11-03', s('Squat', 100, 5)), duree_minutes: 30 },
        { ...seance('2026-11-04', s('Squat', 100, 5)), duree_minutes: 'abc' },
        { ...seance('2026-11-05', s('Squat', 100, 5)), duree_minutes: 0 },
        { ...seance('2026-11-06', s('Squat', 100, 5)), duree_minutes: -10 },
      ], '2026-11-08');
      return [st.dureeMoyenne, st.nbChronometrees];
    },
    [30, 1]],
  ['durée : 47 min', () => dureeSeanceLisible(47), '47 min'],
  ['durée : 1 h 05', () => dureeSeanceLisible(65), '1 h 05'],
  ['durée : 2 h 00', () => dureeSeanceLisible(120), '2 h 00'],
  ['durée : inconnue → vide, jamais « 0 min »', () => [dureeSeanceLisible(null),
    dureeSeanceLisible(0), dureeSeanceLisible('x')], ['', '', '']],
  ['volume : en kg', () => volumeLisible(790), '790 kg'],
  ['volume : milliers séparés', () => volumeLisible(9500), '9 500 kg'],
  ['volume : en tonnes au-delà de 10 000', () => volumeLisible(12450), '12,5 t'],

  // ---- Le journal d'un exercice pendant la séance (15/11/2026) ----
  ['journal : les séances du Squat, la plus récente en premier',
    () => dernieresSeancesExercice(historique, 'Squat').map((l) => l.date),
    ['2026-11-05', '2026-10-20', '2026-10-13', '2026-10-13', '2026-10-06']],
  ['journal : seulement les séries de CET exercice',
    () => dernieresSeancesExercice(historique, 'Dips')[0].series,
    [{ reps: 15, poids: 0, rir: null }, { reps: 10, poids: 0, rir: null }]],
  ['journal : limité au nombre demandé',
    () => dernieresSeancesExercice(historique, 'Squat', 2).length, 2],
  ['journal : deux séances le même jour → la plus récente (id) en premier',
    () => dernieresSeancesExercice([
      { id: 3, date: '2026-11-10', series: [s('Squat', 100, 5)] },
      { id: 9, date: '2026-11-10', series: [s('Squat', 120, 2)] },
    ], 'Squat').map((l) => l.id), [9, 3]],
  ['journal : une séance tout juste terminée (id local) passe devant',
    () => dernieresSeancesExercice([
      { id: 50, date: '2026-11-10', series: [s('Squat', 100, 5)] },
      { id: 'local-1', date: '2026-11-10', series: [s('Squat', 120, 2)] },
    ], 'Squat').map((l) => l.id), ['local-1', 50]],
  ['journal : le RIR noté est gardé',
    () => dernieresSeancesExercice([{ id: 1, date: '2026-11-10',
      series: [{ exercice: 'Squat', poids: 100, reps: 5, rir: 2 }] }], 'Squat')[0].series[0].rir, 2],
  ['journal : exercice jamais fait → vide', () => dernieresSeancesExercice(historique, 'Fentes'), []],
  ['journal : données abîmées → pas de plantage',
    () => dernieresSeancesExercice([null, 3, { date: 5 }, { date: '2026-11-01', series: [null, 'x'] },
      { id: 1, date: '2026-11-02', series: [s('Squat', 90, 5)] }], 'Squat').length, 1],
  // ---- Les progrès rangés par exercice (19/11/2026) ----
  ['par groupe : rangés dans l\'ordre des groupes, « Autres » à la fin',
    () => rangerExercicesParGroupe(historique,
      (n) => ({ Squat: 'Quadriceps', Dips: 'Pectoraux', Tractions: 'Dos' })[n] || null,
      ['Pectoraux', 'Dos', 'Quadriceps'])
      .map((g) => [g.groupe, g.exercices.map((e) => e.exercice)]),
    [['Pectoraux', ['Dips']], ['Dos', ['Tractions']], ['Quadriceps', ['Squat']],
      [GROUPE_AUTRES, ['Curl']]]],
  ['par groupe : un groupe hors de l\'ordre passe avant « Autres »',
    () => rangerExercicesParGroupe(historique, (n) => (n === 'Curl' ? 'Biceps' : null), ['Dos'])
      .map((g) => g.groupe), ['Biceps', GROUPE_AUTRES]],
  ['par groupe : une règle qui plante ne casse rien (tout en « Autres »)',
    () => rangerExercicesParGroupe(historique, () => { throw new Error('x'); }, [])
      .map((g) => g.groupe), [GROUPE_AUTRES]],
  ['par groupe : sans séance → vide', () => rangerExercicesParGroupe(null, () => 'Dos', []), []],
  ['exercice : nombre de séances, première et dernière fois',
    () => { const r = resumeExercice(historique, 'Squat');
      return [r.nbSeances, r.premiere, r.derniere]; }, [5, '2026-10-06', '2026-11-05']],
  ['exercice : le record est la série la plus lourde, à sa PREMIÈRE date',
    () => resumeExercice(historique, 'Squat').record, { poids: 110, reps: 5, date: '2026-11-05' }],
  ['exercice : à égalité, le record reste à la séance où il est né',
    () => { const r = resumeExercice([
      { id: 1, date: '2026-10-01', series: [s('Squat', 100, 5)] },
      { id: 2, date: '2026-10-08', series: [s('Squat', 100, 5)] }], 'Squat');
      return [r.record.date, r.seances.map((l) => l.estRecord)]; },
    ['2026-10-01', [false, true]]],
  ['exercice : chaque séance porte sa meilleure série',
    () => resumeExercice(historique, 'Squat').seances.map((l) => l.meilleure),
    [{ poids: 110, reps: 5 }, { poids: 102.5, reps: 8 }, { poids: 105, reps: 6 },
      { poids: 110, reps: 3 }, { poids: 100, reps: 8 }]],
  ['exercice : le meilleur 1RM estimé ne vient pas forcément de la série la plus lourde (102,5 × 8 bat 110 × 5)',
    () => resumeExercice(historique, 'Squat').meilleur1RM,
    { valeur: 130, date: '2026-10-20' }],
  ['exercice : au poids du corps, pas de 1RM et le drapeau levé',
    () => { const r = resumeExercice(historique, 'Dips');
      return [r.auPoidsDuCorps, r.meilleur1RM, r.record]; },
    [true, null, { poids: 0, reps: 15, date: '2026-10-20' }]],
  ['exercice : la séance d\'où il vient est gardée',
    () => resumeExercice([{ id: 4, date: '2026-11-01', programme_id: 7,
      series: [s('Squat', 90, 5)] }], 'Squat').seances[0].programme_id, 7],
  ['exercice : jamais fait ou données abîmées → null, pas de plantage',
    () => [resumeExercice(historique, 'Fentes'), resumeExercice(null, 'Squat'),
      resumeExercice([{ id: 1, date: '2026-11-01', series: [s('Squat', 90, 0)] }], 'Squat')],
    [null, null, null]],
  ['journal : entrées absurdes → vide',
    () => [dernieresSeancesExercice(null, 'Squat'), dernieresSeancesExercice(historique, null)], [[], []]],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
