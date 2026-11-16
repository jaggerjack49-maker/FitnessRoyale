// Exécute les VRAIES règles du « coach » (16/11/2026) et rend le résultat en
// JSON pour test_coach.py :
//  - le RIR noté pilote la montée de charge (src/logic/surchargeProgressive.js) ;
//  - un exercice bloqué propose une décharge (même fichier) ;
//  - une seule façon de lire les objectifs d'un exercice de programme
//    (`suggestionPourExercice`), partagée par la séance, les « Attendu » et le
//    tableau ;
//  - le bilan d'un bloc (src/logic/bloc.js).
//
// Demande de Hafiz : « le 3 » — utiliser le RIR qu'il note, proposer une
// décharge quand il cale, et un bilan de fin de bloc (ce qui a progressé, ce
// qui a calé, le bloc suivant proposé).
import {
  suggererProchaineSerie, suggestionPourExercice, reserveDerniereSeance, cibleDeReps,
} from '../../../src/logic/surchargeProgressive.js';
import { projeterProgramme, projeterExercice } from '../../../src/logic/projectionProgramme.js';
import { etatDuBloc, bilanDuBloc } from '../../../src/logic/bloc.js';

const cas = [];
function verifier(nom, calcul, attendu) {
  try {
    cas.push({ nom, obtenu: calcul(), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

// Une séance : `nb` séries de `reps` à `poids` kg, chacune avec son RIR
// (un nombre pour toutes, ou une liste série par série).
function seance(exercice, nb, reps, poids, date, rir = null, extra = {}) {
  return {
    id: `${exercice}-${date}`, date, ...extra,
    series: Array.from({ length: nb }, (_, i) => ({
      exercice, numero_serie: i + 1, reps, poids,
      rir: Array.isArray(rir) ? rir[i] : rir,
    })),
  };
}
const resume = (s) => (s ? [s.reps, s.poids] : null);
const sugg = (hist, cible = 8, options = {}) =>
  resume(suggererProchaineSerie(hist, 'Squat', cible, options));

// ---------------------------------------------------------------------------
// 1. LE RIR NOTÉ
// ---------------------------------------------------------------------------
verifier('sans RIR noté, rien ne change (objectif tenu → on charge)',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02')]), [8, 102.5]);
verifier('RIR 0 sur la dernière série, objectif tenu → on refait la charge',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02', [2, 1, 0])]), [8, 100]);
verifier('la raison dit pourquoi on ne charge pas',
  () => suggererProchaineSerie([seance('Squat', 3, 8, 100, '2026-11-02', 0)], 'Squat', 8)
    .raison.includes('RIR 0'), true);
verifier('RIR 1 (le seuil par défaut) → on charge',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02', 1)]), [8, 102.5]);
verifier('programme à RIR visé 0 : aller à l\'échec est le plan → on charge',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02', 0)], 8, { rirCible: 0 }), [8, 102.5]);
verifier('programme à RIR visé 2, noté 1 → on refait la charge',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02', 1)], 8, { rirCible: 2 }), [8, 100]);
verifier('grande réserve (RIR 4, visé 1) → deux crans d\'un coup',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02', 4)]), [8, 105]);
verifier('réserve d\'un cran seulement (RIR 3, visé 1) → un seul cran',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02', 3)]), [8, 102.5]);
verifier('objectif de reps pas tenu : RIR 0 ou pas, on vise une rep de plus',
  () => sugg([seance('Squat', 3, 6, 100, '2026-11-02', 0)]), [7, 100]);
verifier('un RIR noté seulement à l\'échauffement ne compte pas',
  () => {
    const s = seance('Squat', 3, 8, 100, '2026-11-02');
    s.series.unshift({ exercice: 'Squat', numero_serie: 0, reps: 10, poids: 60, rir: 0 });
    return sugg([s]);
  }, [8, 102.5]);
verifier('la série la plus DURE à la charge de travail décide',
  () => reserveDerniereSeance([
    { poids: 100, rir: 3 }, { poids: 100, rir: 0 }, { poids: 60, rir: 5 }], 100), 0);
verifier('RIR abîmés ignorés (texte, 11, -1, 2.5)',
  () => reserveDerniereSeance([
    { poids: 100, rir: 'x' }, { poids: 100, rir: 11 }, { poids: 100, rir: -1 },
    { poids: 100, rir: 2.5 }], 100), null);
verifier('un RIR visé abîmé retombe sur le seuil par défaut',
  () => sugg([seance('Squat', 3, 8, 100, '2026-11-02', 0)], 8, { rirCible: 'n' }), [8, 100]);

// ---------------------------------------------------------------------------
// 2. LA DÉCHARGE QUAND ON CALE
// ---------------------------------------------------------------------------
const bloque = [
  seance('Squat', 3, 6, 100, '2026-11-09'),
  seance('Squat', 3, 6, 100, '2026-11-05'),
  seance('Squat', 3, 6, 100, '2026-11-02'),
];
verifier('3 séances à 100 kg sans une rep gagnée → décharge à 90 kg',
  () => sugg(bloque), [8, 90]);
verifier('la décharge se signale',
  () => suggererProchaineSerie(bloque, 'Squat', 8).decharge, true);
verifier('une rep gagnée sur la dernière séance → pas bloqué',
  () => sugg([seance('Squat', 3, 7, 100, '2026-11-09'), ...bloque.slice(1)]), [8, 100]);
verifier('seulement 2 séances → pas assez de recul',
  () => sugg(bloque.slice(0, 2)), [7, 100]);
verifier('objectif tenu 3 fois sans RIR → ce n\'est pas un blocage, on charge',
  () => sugg([
    seance('Squat', 3, 8, 100, '2026-11-09'), seance('Squat', 3, 8, 100, '2026-11-05'),
    seance('Squat', 3, 8, 100, '2026-11-02')]), [8, 102.5]);
verifier('objectif tenu 3 fois mais toujours à l\'échec → décharge',
  () => sugg([
    seance('Squat', 3, 8, 100, '2026-11-09', 0), seance('Squat', 3, 8, 100, '2026-11-05', 0),
    seance('Squat', 3, 8, 100, '2026-11-02', 0)]), [8, 90]);
verifier('juste APRÈS une décharge : on repart, pas de deuxième décharge',
  () => sugg([seance('Squat', 3, 8, 90, '2026-11-12'), ...bloque]), [8, 92.5]);
verifier('revenu à 100 kg après la décharge : 2 séances ne suffisent pas à en reproposer une',
  () => sugg([seance('Squat', 3, 6, 100, '2026-11-19'), seance('Squat', 3, 6, 100, '2026-11-16'),
    seance('Squat', 3, 8, 90, '2026-11-12')]), [7, 100]);
verifier('au poids du corps : jamais de décharge, une rep de plus',
  () => resume(suggererProchaineSerie([
    seance('Tractions', 3, 6, 0, '2026-11-09'), seance('Tractions', 3, 6, 0, '2026-11-05'),
    seance('Tractions', 3, 6, 0, '2026-11-02')], 'Tractions', 8)), [7, 0]);
verifier('petite charge : allègement arrondi au kilo (15 → 14)',
  () => resume(suggererProchaineSerie([
    seance('Curl', 3, 6, 15, '2026-11-09'), seance('Curl', 3, 6, 15, '2026-11-05'),
    seance('Curl', 3, 6, 15, '2026-11-02')], 'Curl', 10)), [10, 14]);
verifier('allègement arrondi au cran de 2,5 (102,5 → 92,5)',
  () => sugg([
    seance('Squat', 3, 6, 102.5, '2026-11-09'), seance('Squat', 3, 6, 102.5, '2026-11-05'),
    seance('Squat', 3, 6, 102.5, '2026-11-02')]), [8, 92.5]);

// ---------------------------------------------------------------------------
// 3. UNE SEULE LECTURE DES OBJECTIFS — séance, « Attendu », tableau
// ---------------------------------------------------------------------------
const exoFourchette = { exercice: 'Squat', series_cibles: 3, reps_cibles: 8, reps_cibles_max: 12 };
verifier('une fourchette 8-12 vise le HAUT, partout',
  () => resume(suggestionPourExercice([seance('Squat', 3, 10, 100, '2026-11-02')], exoFourchette)),
  [11, 100]);
verifier('cibleDeReps est toujours réexportée par la projection',
  () => cibleDeReps(5, 10), 10);
verifier('le RIR visé du programme est lu (RIR 1 noté, visé 2 → on refait)',
  () => resume(suggestionPourExercice([seance('Squat', 3, 12, 100, '2026-11-02', 1)],
    { ...exoFourchette, rir_cible: 2 })), [12, 100]);
verifier('exercice abîmé → pas de suggestion, pas de plantage',
  () => [suggestionPourExercice([], null), suggestionPourExercice([], { exercice: 3 })],
  [null, null]);
{
  const histoire = [seance('Squat', 3, 12, 100, '2026-11-02', 4)];
  const exo = { ...exoFourchette, rir_cible: 1 };
  verifier('LA PROMESSE : semaine 1 du tableau = « Attendu » (fourchette + RIR)',
    () => {
      const ligne = projeterProgramme([{ id: 1, nom: 'Jambes', exercices: [exo] }], histoire)[0]
        .lignes[0].semaines[0];
      return [ligne.reps, ligne.poids];
    }, resume(suggestionPourExercice(histoire, exo)));
}
verifier('le tableau d\'un exercice bloqué : décharge, puis ça remonte (pas de spirale)',
  () => projeterExercice(bloque, 'Squat', { repsCibles: 8, nbSemaines: 4 })
    .map((l) => l.poids), [90, 92.5, 95, 97.5]);

// ---------------------------------------------------------------------------
// 4. L'ÉTAT ET LE BILAN D'UN BLOC
// ---------------------------------------------------------------------------
// 3 semaines à partir du lundi 2 novembre 2026, + décharge (23 → 29 nov).
const BLOC = { date_debut: '2026-11-02', duree_semaines: 3, avec_deload: 1 };
verifier('état : avant le début, pendant, après',
  () => [etatDuBloc(BLOC, '2026-10-30'), etatDuBloc(BLOC, '2026-11-02'),
    etatDuBloc(BLOC, '2026-11-29'), etatDuBloc(BLOC, '2026-11-30'),
    etatDuBloc(null, '2026-11-30'), etatDuBloc({ ...BLOC, date_debut: 'n' }, '2026-11-30')],
  ['a_venir', 'en_cours', 'en_cours', 'termine', null, null]);

const SEANCES = [
  { id: 1, nom: 'Push', exercices: [
    { exercice: 'Développé couché', reps_cibles: 8 },
    { exercice: 'Dips', reps_cibles: 10 },
    { exercice: 'Élévations', reps_cibles: 12 }] },
  { id: 2, nom: 'Push B', exercices: [
    { exercice: 'Développé couché', reps_cibles: 8 },
    { exercice: 'Écarté', reps_cibles: 12 }] },
];
const PROG = { programme_id: 1 };
const FAITES = [
  // Développé couché : 100 × 8 → 105 × 8 = progrès.
  seance('Développé couché', 3, 8, 100, '2026-11-03', null, PROG),
  seance('Développé couché', 3, 8, 105, '2026-11-17', null, { programme_id: 2 }),
  // Décharge : plus léger, ne doit RIEN changer au verdict.
  seance('Développé couché', 2, 8, 80, '2026-11-24', null, PROG),
  // Dips au poids du corps : 10 → 10 = stable.
  seance('Dips', 3, 10, 0, '2026-11-03', null, PROG),
  seance('Dips', 3, 10, 0, '2026-11-17', null, PROG),
  // Élévations : 10 kg × 12 → 10,5 × 6 = plus lourd, mais RECUL au 1RM.
  seance('Élévations', 3, 12, 10, '2026-11-03', null, PROG),
  seance('Élévations', 3, 6, 10.5, '2026-11-17', null, PROG),
  // Une séance LIBRE (sans programme) : ne compte pas.
  seance('Écarté', 3, 12, 20, '2026-11-10'),
];
const bilan = bilanDuBloc(BLOC, SEANCES, FAITES);
verifier('bilan : un verdict par exercice, sans doublon',
  () => bilan.exercices.map((l) => [l.exercice, l.verdict]),
  [['Développé couché', 'progres'], ['Dips', 'stable'], ['Élévations', 'recul'],
    ['Écarté', 'absent']]);
verifier('bilan : début et fin du développé couché (la décharge n\'est pas la fin)',
  () => [bilan.exercices[0].debut.poids, bilan.exercices[0].fin.poids], [100, 105]);
verifier('bilan : le compte des verdicts',
  () => bilan.compte, { progres: 1, stable: 1, recul: 1, une_seance: 0, absent: 1 });
verifier('bilan : semaines prévues / entraînées, séances faites',
  () => [bilan.semainesPrevues, bilan.semainesEntrainees, bilan.seancesFaites], [4, 3, 7]);
verifier('bilan : le départ proposé du bloc suivant = la suggestion habituelle',
  () => resume(bilan.exercices[0].suivant),
  resume(suggestionPourExercice(FAITES, SEANCES[0].exercices[0])));
verifier('bilan : une seule séance → « une_seance », pas de verdict inventé',
  () => bilanDuBloc(BLOC, SEANCES, [FAITES[0]]).exercices[0].verdict, 'une_seance');
verifier('bilan : séance hors du bloc ignorée',
  () => bilanDuBloc(BLOC, SEANCES, [
    seance('Développé couché', 3, 8, 100, '2026-10-20', null, PROG)]).compte.absent, 4);
verifier('bilan : bloc non démarré ou données abîmées → bilan vide, pas de plantage',
  () => [
    bilanDuBloc(null, SEANCES, FAITES).exercices.length,
    bilanDuBloc(BLOC, null, null).exercices.length,
    bilanDuBloc(BLOC, [null, { id: 1, exercices: [null, { exercice: 5 }] }],
      [null, { date: '2026-11-03', programme_id: 1 }, { programme_id: 1, series: [null] }])
      .exercices.length,
  ], [0, 0, 0]);

process.stdout.write(JSON.stringify(cas));
