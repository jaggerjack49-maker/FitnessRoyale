// Exécute le VRAI calcul de projection de l'app
// (src/logic/projectionProgramme.js) et rend le résultat en JSON pour
// test_projection.py.
//
// Demande de Hafiz du 04/10/2026 : « je veux qu'on puisse visualiser les
// programmes de cette façon » — une grille une ligne par exercice × une
// colonne par semaine (image `icones/IMG_1703.PNG`).
import {
  projeterExercice, projeterProgramme, cibleDeReps, libelleFourchette, decharge,
  SEMAINES_MAX, SEMAINES_PAR_DEFAUT,
} from '../../../src/logic/projectionProgramme.js';
import { suggererProchaineSerie } from '../../../src/logic/surchargeProgressive.js';

const cas = [];
function verifier(nom, calcul, attendu) {
  try {
    cas.push({ nom, obtenu: calcul(), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

// Une séance passée : `nb` séries de `reps` répétitions à `poids` kg.
function seance(exercice, nb, reps, poids, date = '2026-10-01') {
  return {
    id: 1, date,
    series: Array.from({ length: nb }, (_, i) => ({
      exercice, numero_serie: i + 1, reps, poids,
    })),
  };
}

// Ce qu'on retient d'une semaine projetée, pour comparer lisiblement.
const resume = (l) => [l.semaine, l.series, l.reps, l.poids];
const resumeToutes = (lignes) => lignes.map(resume);

const troisHuit = [seance('Squat', 3, 8, 100)];

// ---- LE CŒUR : la semaine 1 du tableau EST la prochaine séance ----
// Si ces deux-là divergent un jour, le tableau annoncera une charge et l'écran
// de séance en réclamera une autre. C'est le test à ne jamais laisser rougir.
verifier('la semaine 1 dit EXACTEMENT ce que dit « 🎯 Attendu »',
  () => {
    const sugg = suggererProchaineSerie(troisHuit, 'Squat', 8, {});
    const [semaine1] = projeterExercice(troisHuit, 'Squat', { repsCibles: 8, nbSemaines: 4 });
    return [semaine1.reps, semaine1.poids] === undefined
      ? null : [[semaine1.reps, semaine1.poids], [sugg.reps, sugg.poids]];
  },
  [[8, 102.5], [8, 102.5]]);

// ---- La progression s'accumule d'une semaine à l'autre ----
verifier('4 semaines : la charge monte à chaque semaine (objectif de reps déjà tenu)',
  () => resumeToutes(projeterExercice(troisHuit, 'Squat', { repsCibles: 8, nbSemaines: 4 })),
  [[1, 3, 8, 102.5], [2, 3, 8, 105], [3, 3, 8, 107.5], [4, 3, 8, 110]]);

// ---- LA FOURCHETTE DE REPS (demandée explicitement) ----
// « 5 - 10 » : on grimpe dans la fourchette à charge égale, et on ne charge
// qu'une fois le HAUT tenu. C'est ce qui rend le tableau lisible comme celui
// de l'image : des semaines de reps, puis un saut de charge.
verifier('fourchette 5-10 : on monte les reps jusqu\'à 10, PUIS la charge',
  () => resumeToutes(projeterExercice(troisHuit, 'Squat', {
    repsCibles: 5, repsCiblesMax: 10, nbSemaines: 4,
  })),
  [[1, 3, 9, 100], [2, 3, 10, 100], [3, 3, 10, 102.5], [4, 3, 10, 105]]);

verifier('l\'objectif d\'une fourchette est son HAUT',
  () => [cibleDeReps(5, 10), cibleDeReps(8, null), cibleDeReps(null, null)],
  [10, 8, null]);

verifier('la fourchette s\'écrit « 5 - 10 », un objectif simple s\'écrit « 8 »',
  () => [libelleFourchette(5, 10), libelleFourchette(8, null), libelleFourchette(8, 8),
         libelleFourchette(null, null)],
  ['5 - 10', '8', '8', null]);

// ---- L'AXE DES SÉRIES ----
verifier('axe séries : une série de plus par semaine, jusqu\'à l\'objectif',
  () => resumeToutes(projeterExercice(troisHuit, 'Squat', {
    repsCibles: 8, seriesCibles: 5, modes: ['series'], nbSemaines: 4,
  })),
  [[1, 4, 8, 100], [2, 5, 8, 100], [3, 5, 8, 100], [4, 5, 8, 100]]);

verifier('les trois axes : séries, puis reps, puis charge',
  () => resumeToutes(projeterExercice([seance('Squat', 3, 6, 100)], 'Squat', {
    repsCibles: 8, seriesCibles: 4, modes: ['series', 'reps', 'poids'], nbSemaines: 4,
  })),
  [[1, 4, 6, 100], [2, 4, 7, 100], [3, 4, 8, 100], [4, 4, 8, 102.5]]);

// ---- LA SEMAINE DE DÉCHARGE ----
verifier('décharge : moitié moins de séries, charge de la semaine 1',
  () => resumeToutes(projeterExercice([seance('Squat', 4, 8, 100)], 'Squat', {
    repsCibles: 8, nbSemaines: 4, avecDeload: true,
  })),
  [[1, 4, 8, 102.5], [2, 4, 8, 105], [3, 4, 8, 107.5], [4, 4, 8, 110],
   ['decharge', 2, 8, 102.5]]);

verifier('décharge : jamais moins d\'une série',
  () => decharge({ semaine: 1, series: 1, reps: 10, poids: 40 }).series, 1);

verifier('pas de décharge demandée = pas de colonne de décharge',
  () => projeterExercice(troisHuit, 'Squat', { repsCibles: 8, nbSemaines: 2 }).length, 2);

// ---- POIDS DU CORPS ----
verifier('poids du corps : ce sont les reps qui montent, semaine après semaine',
  () => resumeToutes(projeterExercice([seance('Traction', 3, 10, 0)], 'Traction', {
    repsCibles: 8, nbSemaines: 3,
  })),
  [[1, 3, 11, 0], [2, 3, 12, 0], [3, 3, 13, 0]]);

// ---- CE QU'ON N'INVENTE PAS ----
verifier('exercice jamais fait : aucune ligne, pas un chiffre inventé',
  () => projeterExercice([], 'Squat', { repsCibles: 8, nbSemaines: 4 }), []);

// ---- LES BORNES ----
// Une valeur absurde retombe sur le DÉFAUT (4) — « 0 semaine » ne veut rien
// dire, et un tableau d'une seule colonne n'aurait pas plus de sens. Au-delà
// du maximum, on plafonne : la projection suppose que chaque semaine est
// réussie exactement comme prévu, ce qui ne tient pas sur un an.
verifier('le nombre de semaines : 0 → le défaut, 99 → le maximum',
  () => [
    projeterExercice(troisHuit, 'Squat', { repsCibles: 8, nbSemaines: 0 }).length,
    projeterExercice(troisHuit, 'Squat', { repsCibles: 8, nbSemaines: -3 }).length,
    projeterExercice(troisHuit, 'Squat', { repsCibles: 8, nbSemaines: 99 }).length,
  ],
  [SEMAINES_PAR_DEFAUT, 1, SEMAINES_MAX]);

// ---- « L'APP PROPOSE, JE CORRIGE » ----
verifier('une case saisie à la main PRIME sur le calcul, et elle seule',
  () => {
    const seances = [{
      id: 7, nom: 'Push', jours: ['lundi'],
      exercices: [{ exercice: 'Squat', series_cibles: 3, reps_cibles: 8 }],
    }];
    const tableau = projeterProgramme(seances, troisHuit, {
      nbSemaines: 3,
      cibles: { '7|Squat|2': { series: 5, reps: 6, poids: 140 } },
    });
    return tableau[0].lignes[0].semaines.map((l) => [l.semaine, l.series, l.reps, l.poids, l.source]);
  },
  [[1, 3, 8, 102.5, 'calcul'], [2, 5, 6, 140, 'manuel'], [3, 3, 8, 107.5, 'calcul']]);

verifier('le tableau groupe les exercices PAR SÉANCE (donc par jour)',
  () => {
    const seances = [
      { id: 1, nom: 'Push', jours: ['lundi'], exercices: [{ exercice: 'Squat', series_cibles: 3, reps_cibles: 8 }] },
      { id: 2, nom: 'Pull', jours: ['jeudi'], exercices: [{ exercice: 'Traction', series_cibles: 3, reps_cibles: 8 }] },
    ];
    const histoire = [seance('Squat', 3, 8, 100), seance('Traction', 3, 10, 0, '2026-10-02')];
    const tableau = projeterProgramme(seances, histoire, { nbSemaines: 1 });
    return tableau.map((bloc) => [bloc.seance.nom, bloc.lignes.map((l) => l.exercice)]);
  },
  [['Push', ['Squat']], ['Pull', ['Traction']]]);

verifier('la fourchette remonte dans le tableau, prête à être affichée',
  () => {
    const seances = [{
      id: 3, nom: 'Push', jours: ['lundi'],
      exercices: [{ exercice: 'Squat', series_cibles: 3, reps_cibles: 5, reps_cibles_max: 10 }],
    }];
    return projeterProgramme(seances, troisHuit, { nbSemaines: 1 })[0].lignes[0].fourchette;
  },
  '5 - 10');

// ---- DONNÉES ABÎMÉES : le tableau se tait, il ne casse pas l'onglet ----
// (leçon de l'audit du 06/09/2026 : ces aides sont du CONFORT)
verifier('historique et programme abîmés → aucun plantage',
  () => [
    projeterExercice(null, 'Squat', { repsCibles: 8 }).length,
    projeterExercice([null, { date: '2026-10-01' }], 'Squat', {}).length,
    projeterExercice(troisHuit, 'Squat', null).length > 0,
    projeterProgramme(null, troisHuit, {}).length,
    projeterProgramme([{ id: 1, nom: 'X' }], troisHuit, {}).length,
    projeterProgramme([{ id: 1, nom: 'X', exercices: null }], troisHuit, {})[0].lignes.length,
  ],
  [0, 0, true, 0, 1, 0]);

process.stdout.write(JSON.stringify(cas, null, 2));
