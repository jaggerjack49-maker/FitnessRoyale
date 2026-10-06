// Exécute les VRAIES règles du bloc d'entraînement (src/logic/bloc.js) et rend
// le résultat en JSON pour test_bloc.py.
//
// Demande de Hafiz du 05/10/2026 : « il faut qu'on puisse maintenant créer des
// cycles… un cycle sur un mois… à partir du programme, on peut faire le cycle
// qui sera visualisé en tableau », avec le choix « le plan, mais qui se
// rattrape » : le bloc est daté et suivi semaine par semaine, et si on s'en
// écarte, l'app le DIT et propose de recalculer la suite.
//
// POURQUOI CES RÈGLES VIVENT DANS src/logic/ : elles dépendent de la DATE DU
// JOUR. On ne peut pas les éprouver depuis l'écran sans mentir à l'horloge —
// même raison que `src/logic/rattrapage.js` (CLAUDE.md, 07/09/2026).
import {
  semaineDuBloc, blocEnCours, finDuBloc, ciblePrevue,
  ecartsDuBloc, ecartsDuBlocComplet, ciblePrevueDansBloc,
  blocADerive, semainesARecalculer, cleCase,
} from '../../../src/logic/bloc.js';

const cas = [];
function verifier(nom, calcul, attendu) {
  try {
    cas.push({ nom, obtenu: calcul(), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

// Un bloc de 4 semaines qui démarre le lundi 5 octobre 2026.
//   semaine 1 : 05 → 11 oct    semaine 3 : 19 → 25 oct
//   semaine 2 : 12 → 18 oct    semaine 4 : 26 oct → 1er nov
//   décharge  : 02 → 08 nov  (seulement si avec_deload)
const BLOC = { id: 7, date_debut: '2026-10-05', duree_semaines: 4, avec_deload: 0 };
const BLOC_D = { ...BLOC, avec_deload: 1 };

// LE PLAN FIGÉ au démarrage du bloc : 3 × 8, la charge monte de 2,5 kg.
const PLAN = {};
[[1, 100], [2, 102.5], [3, 105], [4, 107.5]].forEach(([s, poids]) => {
  PLAN[cleCase(7, 'Squat', s)] = { series: 3, reps: 8, poids };
});
PLAN[cleCase(7, 'Squat', 'decharge')] = { series: 1, reps: 8, poids: 100 };

// Une séance réellement faite : `nb` séries à `poids` kg, ce jour-là.
function seance(date, nb, poids, programmeId = 7, exercice = 'Squat') {
  return {
    id: date, date, programme_id: programmeId,
    series: Array.from({ length: nb }, (_, i) => ({
      exercice, numero_serie: i + 1, reps: 8, poids,
    })),
  };
}

// ---------------------------------------------------------------- la semaine
verifier("la veille du début : on n'est pas dans le bloc",
  () => semaineDuBloc(BLOC, '2026-10-04'), null);

verifier("le premier jour, c'est la semaine 1",
  () => semaineDuBloc(BLOC, '2026-10-05'), 1);

verifier('le dernier jour de la semaine 1 est encore la semaine 1',
  () => semaineDuBloc(BLOC, '2026-10-11'), 1);

verifier('le lendemain passe en semaine 2',
  () => semaineDuBloc(BLOC, '2026-10-12'), 2);

verifier('le dernier jour du bloc est la semaine 4',
  () => semaineDuBloc(BLOC, '2026-11-01'), 4);

verifier('après la 4e semaine, sans décharge, le bloc est fini',
  () => semaineDuBloc(BLOC, '2026-11-02'), null);

verifier('avec décharge, la semaine qui suit EST la décharge',
  () => semaineDuBloc(BLOC_D, '2026-11-02'), 'decharge');

verifier('après la décharge, le bloc est fini',
  () => semaineDuBloc(BLOC_D, '2026-11-09'), null);

// Le changement d'heure de printemps (29 mars 2026 en Europe) raccourcit
// l'intervalle d'une heure : un calcul en heure LOCALE renverrait la semaine 3
// au lieu de la 4. En UTC, un jour fait toujours 24 h.
// ⚠️ CE CAS NE PROUVE RIEN TOUT SEUL : sur une machine en UTC+0 sans
// changement d'heure — celle de dev, Africa/Ouagadougou — les deux calculs
// donnent la même réponse. C'est pour ça que `test_bloc.py` relance ce harnais
// sous plusieurs fuseaux (Europe/Paris, Pacific/Auckland).
verifier("le changement d'heure ne décale pas la semaine",
  () => semaineDuBloc(
    { id: 1, date_debut: '2026-03-23', duree_semaines: 6 }, '2026-04-13'), 4);

verifier('le bloc est en cours pendant ses semaines',
  () => [blocEnCours(BLOC, '2026-10-20'), blocEnCours(BLOC, '2026-11-20')],
  [true, false]);

verifier('la fin du bloc : 4 semaines pleines',
  () => finDuBloc(BLOC), '2026-11-01');

verifier('la décharge ajoute une semaine à la fin',
  () => finDuBloc(BLOC_D), '2026-11-08');

// ------------------------------------------------- la séance LIT le plan
// C'est le cœur du « plan figé » : l'écran de séance ne recalcule plus rien,
// il lit la case de la semaine où l'on est.
verifier('la séance lit la case de SA semaine (14 oct = semaine 2)',
  () => {
    const c = ciblePrevue(BLOC, 'Squat', '2026-10-14', PLAN);
    return [c.semaine, c.series, c.reps, c.poids];
  },
  [2, 3, 8, 102.5]);

verifier("un exercice absent du plan n'a pas de cible",
  () => ciblePrevue(BLOC, 'Rowing', '2026-10-14', PLAN), null);

verifier('hors du bloc, aucune cible',
  () => ciblePrevue(BLOC, 'Squat', '2026-12-01', PLAN), null);

// La séance doit savoir si la cible vient du plan ou de la main de Hafiz :
// sans ça, elle présenterait sa propre correction comme une proposition.
verifier('la séance sait si la cible a été corrigée à la main',
  () => {
    const plan = {
      [cleCase(7, 'Squat', 1)]: { series: 3, reps: 8, poids: 100, origine: 'plan' },
      [cleCase(7, 'Squat', 2)]: { series: 3, reps: 8, poids: 140, origine: 'manuel' },
    };
    return [
      ciblePrevue(BLOC, 'Squat', '2026-10-06', plan).corrigee,
      ciblePrevue(BLOC, 'Squat', '2026-10-14', plan).corrigee,
    ];
  },
  [false, true]);

// ------------------------------------------------------------- les écarts
verifier('bloc respecté : aucun écart',
  () => ecartsDuBloc(
    BLOC, [seance('2026-10-06', 3, 100), seance('2026-10-13', 3, 102.5)],
    PLAN, '2026-10-14'),
  { semainesSautees: [], chargesDifferentes: [] });

verifier('une semaine passée sans séance est signalée',
  () => ecartsDuBloc(
    BLOC, [seance('2026-10-06', 3, 100)], PLAN, '2026-10-20').semainesSautees,
  [2]);

verifier("la semaine EN COURS n'est jamais signalée comme sautée",
  () => ecartsDuBloc(
    BLOC, [seance('2026-10-06', 3, 100)], PLAN, '2026-10-14').semainesSautees,
  []);

verifier('deux semaines sautées sont toutes les deux signalées',
  () => ecartsDuBloc(BLOC, [], PLAN, '2026-10-20').semainesSautees, [1, 2]);

verifier('plus lourd que prévu : signalé',
  () => ecartsDuBloc(
    BLOC, [seance('2026-10-06', 3, 110)], PLAN, '2026-10-07').chargesDifferentes,
  [{ exercice: 'Squat', semaine: 1, prevu: 100, fait: 110 }]);

verifier('plus LÉGER que prévu : signalé aussi (la suite du plan est fausse pareil)',
  () => ecartsDuBloc(
    BLOC, [seance('2026-10-06', 3, 90)], PLAN, '2026-10-07').chargesDifferentes,
  [{ exercice: 'Squat', semaine: 1, prevu: 100, fait: 90 }]);

verifier('4 séries hors plan = UN seul écart, pas quatre',
  () => ecartsDuBloc(
    BLOC, [seance('2026-10-06', 4, 110)], PLAN, '2026-10-07')
    .chargesDifferentes.length,
  1);

verifier("une séance d'un AUTRE programme ne compte pas",
  () => {
    const e = ecartsDuBloc(
      BLOC, [seance('2026-10-06', 3, 110, 99)], PLAN, '2026-10-14');
    return [e.semainesSautees, e.chargesDifferentes.length];
  },
  [[1], 0]);

verifier('pas de case au plan : aucun écart de charge à constater',
  () => ecartsDuBloc(
    BLOC, [seance('2026-10-06', 3, 110, 7, 'Rowing')], PLAN, '2026-10-07')
    .chargesDifferentes,
  []);

verifier('bloc pas encore commencé : rien à dire',
  () => ecartsDuBloc(BLOC, [], PLAN, '2026-09-01'),
  { semainesSautees: [], chargesDifferentes: [] });

verifier('bloc terminé : rien à dire',
  () => ecartsDuBloc(BLOC, [], PLAN, '2026-12-01'),
  { semainesSautees: [], chargesDifferentes: [] });

verifier("blocADerive résume les deux sortes d'écart",
  () => [
    blocADerive(ecartsDuBloc(BLOC, [seance('2026-10-06', 3, 100)], PLAN, '2026-10-07')),
    blocADerive(ecartsDuBloc(BLOC, [seance('2026-10-06', 3, 110)], PLAN, '2026-10-07')),
    blocADerive(ecartsDuBloc(BLOC, [], PLAN, '2026-10-20')),
  ],
  [false, true, true]);

// ------------------------------- UN PROGRAMME COMPLET (plusieurs séances)
// C'est le cas NORMAL du tableau : « Mon PPL » est un bloc, mais Push, Pull et
// Legs sont trois séances portant trois numéros différents — et ce sont ces
// numéros qui identifient les cases du plan. Le bloc, lui, porte la date.
const BLOC_PPL = { id: 50, date_debut: '2026-10-05', duree_semaines: 4, avec_deload: 0 };
const PLAN_PPL = {
  [cleCase(11, 'Squat', 1)]: { series: 3, reps: 8, poids: 100 },
  [cleCase(12, 'Traction', 1)]: { series: 3, reps: 8, poids: 0 },
  [cleCase(11, 'Squat', 2)]: { series: 3, reps: 8, poids: 102.5 },
};

verifier('une seule séance faite dans la semaine suffit : rien de sauté',
  () => ecartsDuBlocComplet(
    BLOC_PPL, [11, 12],
    [seance('2026-10-06', 3, 100, 11, 'Squat')], PLAN_PPL, '2026-10-14')
    .semainesSautees,
  []);

verifier('la charge se compare sous le numéro de LA SÉANCE, pas du bloc',
  () => ecartsDuBlocComplet(
    BLOC_PPL, [11, 12],
    [seance('2026-10-06', 3, 125, 11, 'Squat')], PLAN_PPL, '2026-10-07')
    .chargesDifferentes,
  [{ exercice: 'Squat', semaine: 1, prevu: 100, fait: 125 }]);

verifier('une séance qui n\'appartient pas au bloc est ignorée',
  () => ecartsDuBlocComplet(
    BLOC_PPL, [11, 12],
    [seance('2026-10-06', 3, 125, 99, 'Squat')], PLAN_PPL, '2026-10-14')
    .semainesSautees,
  [1]);

verifier('la séance d\'un cycle lit SA case, avec la semaine du bloc',
  () => {
    // Le bloc n°50 porte la date ; la séance « Push » porte le n°11, et c'est
    // sous ce numéro que vit sa case.
    const c = ciblePrevueDansBloc(BLOC_PPL, 11, 'Squat', '2026-10-14', PLAN_PPL);
    return [c.semaine, c.poids];
  },
  [2, 102.5]);

verifier('ecartsDuBloc est le cas particulier d\'UNE séance',
  () => {
    const seances = [seance('2026-10-06', 3, 110)];
    const a = ecartsDuBloc(BLOC, seances, PLAN, '2026-10-07');
    const b = ecartsDuBlocComplet(BLOC, [7], seances, PLAN, '2026-10-07');
    return JSON.stringify(a) === JSON.stringify(b);
  },
  true);

// --------------------------------------------- recalculer la SUITE seulement
verifier('recalculer depuis la semaine 2 ne touche pas la semaine 1',
  () => semainesARecalculer(BLOC, [7], [], '2026-10-14'), [2, 3, 4]);

verifier('la décharge fait partie de la suite à recalculer',
  () => semainesARecalculer(BLOC_D, [7], [], '2026-10-14'), [2, 3, 4, 'decharge']);

verifier("en décharge, il ne reste que la décharge",
  () => semainesARecalculer(BLOC_D, [7], [], '2026-11-03'), ['decharge']);

verifier("hors du bloc, il n'y a rien à recalculer",
  () => semainesARecalculer(BLOC, [7], [], '2026-12-01'), []);

// ⚠️ LE DÉFAUT TROUVÉ À L'ÉCRAN LE 06/10/2026 — le cas qui compte vraiment.
// Séance faite en semaine 1 à une autre charge que prévu, puis « recalculer » :
// si la semaine 1 est réécrite, l'app signale aussitôt un écart insoluble
// entre ce qui est fait et ce qu'elle vient d'écrire.
verifier('la semaine EN COURS déjà entraînée n\'est PAS recalculée',
  () => semainesARecalculer(
    BLOC, [7], [seance('2026-10-06', 2, 120)], '2026-10-06'),
  [2, 3, 4]);

verifier('une semaine en cours PAS encore entraînée est bien recalculée',
  () => semainesARecalculer(BLOC, [7], [], '2026-10-06'), [1, 2, 3, 4]);

verifier('une semaine future déjà entraînée (séance d\'avance) est épargnée',
  () => semainesARecalculer(
    BLOC, [7], [seance('2026-10-20', 2, 110)], '2026-10-14'),
  [2, 4]);

verifier('une décharge déjà faite n\'est pas réécrite',
  () => semainesARecalculer(
    BLOC_D, [7], [seance('2026-11-03', 1, 100)], '2026-11-03'), []);

// -------------------------------------------------------- données abîmées
// Ces fonctions tournent PENDANT une séance et dans le calendrier : une
// exception y remplacerait l'onglet par l'écran d'erreur (leçon de l'audit du
// 06/09/2026). Elles doivent se taire, jamais planter.
verifier('programme absent',
  () => [semaineDuBloc(null, '2026-10-06'), finDuBloc(undefined),
    ciblePrevue(null, 'Squat', '2026-10-06', PLAN)],
  [null, null, null]);

verifier('programme sans date de début ni durée',
  () => [semaineDuBloc({ id: 1 }, '2026-10-06'),
    semaineDuBloc({ id: 1, date_debut: '2026-10-05' }, '2026-10-06')],
  [null, null]);

verifier('date mal formée',
  () => [semaineDuBloc(BLOC, 'hier'), semaineDuBloc(BLOC, null),
    semaineDuBloc({ ...BLOC, date_debut: 'pas une date' }, '2026-10-06')],
  [null, null, null]);

verifier('entraînements : pas une liste, ou des entrées nulles',
  () => [
    ecartsDuBloc(BLOC, null, PLAN, '2026-10-07').chargesDifferentes.length,
    ecartsDuBloc(BLOC, 'bonjour', PLAN, '2026-10-07').chargesDifferentes.length,
    ecartsDuBloc(BLOC, [null, {}, { date: '2026-10-06', programme_id: 7 }],
      PLAN, '2026-10-14').semainesSautees.length,
  ],
  [0, 0, 0]);

verifier('séries manquantes ou nulles dans une séance',
  () => ecartsDuBloc(BLOC, [
    { id: 1, date: '2026-10-06', programme_id: 7, series: null },
    { id: 2, date: '2026-10-07', programme_id: 7, series: [null, { exercice: null }] },
  ], PLAN, '2026-10-07').chargesDifferentes,
  []);

verifier("plan absent : on ne constate aucun écart de charge",
  () => ecartsDuBloc(BLOC, [seance('2026-10-06', 3, 110)], null, '2026-10-07')
    .chargesDifferentes,
  []);

process.stdout.write(JSON.stringify(cas, null, 2));
