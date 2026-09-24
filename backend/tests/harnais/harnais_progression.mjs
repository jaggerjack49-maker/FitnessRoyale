// Exécute la VRAIE suggestion de charge de l'app
// (src/logic/surchargeProgressive.js) avec les axes de progression choisis,
// et rend le résultat en JSON pour test_progression.py.
//
// Demande de Hafiz du 24/09/2026 : « les perfs attendues à la prochaine séance
// devront être cohérentes avec le type de progressive overload qu'on a choisi
// pour les exercices : les séries, les reps ou le poids. On peut choisir un ou
// un mélange des 3. »
import {
  suggererProchaineSerie, AXES_PAR_DEFAUT,
} from '../../../src/logic/surchargeProgressive.js';

const cas = [];
function verifier(nom, calcul, attendu) {
  try {
    cas.push({ nom, obtenu: calcul(), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

// Une séance passée : `nb` séries de `reps` répétitions à `poids` kg.
function seance(exercice, nb, reps, poids, date = '2026-09-20') {
  return {
    id: 1, date,
    series: Array.from({ length: nb }, (_, i) => ({
      exercice, numero_serie: i + 1, reps, poids,
    })),
  };
}

// Ce qu'on retient d'une suggestion, pour comparer lisiblement.
const resume = (s) => (s ? [s.series, s.reps, s.poids] : null);

// ---- LE COMPORTEMENT D'ORIGINE reste celui par défaut ----
// (un exercice sans réglage ne doit pas changer du jour au lendemain)
const troisHuit = [seance('Squat', 3, 8, 100)];
verifier('par défaut : objectif de reps atteint → plus lourd',
  () => resume(suggererProchaineSerie(troisHuit, 'Squat', 8)), [null, 8, 102.5]);
verifier('par défaut : objectif pas atteint → une rep de plus',
  () => resume(suggererProchaineSerie([seance('Squat', 3, 6, 100)], 'Squat', 8)), [null, 7, 100]);
verifier('les axes par défaut sont bien reps puis poids',
  () => AXES_PAR_DEFAUT, ['reps', 'poids']);

// Le nombre de séries n'est annoncé QUE si on fait progresser les séries :
// sinon ce serait une consigne qu'on n'a pas demandée.
verifier("sans l'axe des séries, aucune consigne de séries",
  () => suggererProchaineSerie(troisHuit, 'Squat', 8, { modes: ['poids'] }).series, null);

// ---- UN SEUL AXE ----
verifier('POIDS seul : on charge, les reps ne bougent pas',
  () => resume(suggererProchaineSerie([seance('Squat', 3, 6, 100)], 'Squat', 8,
    { modes: ['poids'] })), [null, 6, 102.5]);
verifier('REPS seul : on ajoute une rep, la charge ne bouge jamais',
  () => resume(suggererProchaineSerie(troisHuit, 'Squat', 8, { modes: ['reps'] })),
  [null, 9, 100]);
verifier('SÉRIES seul : une série de plus, à charge et reps égales',
  () => resume(suggererProchaineSerie(troisHuit, 'Squat', 8,
    { modes: ['series'], seriesCibles: 5 })), [4, 8, 100]);
verifier('SÉRIES seul, objectif de séries atteint : plus rien ne bouge',
  () => resume(suggererProchaineSerie(troisHuit, 'Squat', 8,
    { modes: ['series'], seriesCibles: 3 })), [3, 8, 100]);

// ---- MÉLANGES : un seul axe avance à la fois, séries → reps → poids ----
verifier('séries+poids : la série d\'abord',
  () => resume(suggererProchaineSerie(troisHuit, 'Squat', 8,
    { modes: ['series', 'poids'], seriesCibles: 4 })), [4, 8, 100]);
verifier('séries+poids : séries au max → on charge',
  () => resume(suggererProchaineSerie([seance('Squat', 4, 8, 100)], 'Squat', 8,
    { modes: ['series', 'poids'], seriesCibles: 4 })), [4, 8, 102.5]);
verifier('les trois : séries, puis reps, puis poids',
  () => [
    resume(suggererProchaineSerie([seance('Squat', 3, 6, 100)], 'Squat', 8,
      { modes: ['series', 'reps', 'poids'], seriesCibles: 4 })),
    resume(suggererProchaineSerie([seance('Squat', 4, 6, 100)], 'Squat', 8,
      { modes: ['series', 'reps', 'poids'], seriesCibles: 4 })),
    resume(suggererProchaineSerie([seance('Squat', 4, 8, 100)], 'Squat', 8,
      { modes: ['series', 'reps', 'poids'], seriesCibles: 4 })),
  ],
  [[4, 6, 100], [4, 7, 100], [4, 8, 102.5]]);
verifier('en chargeant, on repart de l\'objectif de reps et de séries',
  () => resume(suggererProchaineSerie([seance('Squat', 5, 10, 100)], 'Squat', 8,
    { modes: ['series', 'reps', 'poids'], seriesCibles: 4 })), [4, 8, 102.5]);

// ---- POIDS DU CORPS : la charge ne peut pas monter, quoi qu'on coche ----
verifier('poids du corps avec « poids » coché : ce sont les reps qui montent',
  () => resume(suggererProchaineSerie([seance('Traction', 3, 10, 0)], 'Traction', 8,
    { modes: ['poids', 'reps'] })), [null, 11, 0]);
verifier('poids du corps, POIDS seul : on ne promet pas une charge impossible',
  () => resume(suggererProchaineSerie([seance('Traction', 3, 10, 0)], 'Traction', 8,
    { modes: ['poids'] })), [null, 10, 0]);

// ---- L'incrément suit la charge (règle d'origine, inchangée) ----
verifier('sous 20 kg on monte de 1 kg, au-dessus de 2,5 kg',
  () => [
    resume(suggererProchaineSerie([seance('Curl', 3, 8, 12)], 'Curl', 8, { modes: ['poids'] })),
    resume(suggererProchaineSerie([seance('Curl', 3, 8, 40)], 'Curl', 8, { modes: ['poids'] })),
  ],
  [[null, 8, 13], [null, 8, 42.5]]);

// ---- Données abîmées : ça tourne PENDANT une séance, ça ne plante jamais ----
verifier('réglages absurdes → on retombe sur le comportement par défaut',
  () => [
    resume(suggererProchaineSerie(troisHuit, 'Squat', 8, { modes: [] })),
    resume(suggererProchaineSerie(troisHuit, 'Squat', 8, { modes: ['nimporte quoi'] })),
    resume(suggererProchaineSerie(troisHuit, 'Squat', 8, { modes: 'reps' })),
    resume(suggererProchaineSerie(troisHuit, 'Squat', 8, null)),
  ],
  [[null, 8, 102.5], [null, 8, 102.5], [null, 8, 102.5], [null, 8, 102.5]]);
verifier('aucun historique → aucune suggestion',
  () => suggererProchaineSerie([], 'Squat', 8, { modes: ['poids'] }), null);
verifier('historique abîmé → aucun plantage',
  () => [
    suggererProchaineSerie(null, 'Squat', 8, { modes: ['reps'] }),
    suggererProchaineSerie([{ date: '2026-09-20' }], 'Squat', 8, { modes: ['reps'] }),
    suggererProchaineSerie([null], 'Squat', 8, { modes: ['reps'] }),
  ], [null, null, null]);

// La raison affichée doit parler de l'axe qui bouge (elle s'affiche à l'écran).
verifier('la raison parle de la série quand c\'est la série qui monte',
  () => suggererProchaineSerie(troisHuit, 'Squat', 8,
    { modes: ['series'], seriesCibles: 5 }).raison.includes('série'), true);

process.stdout.write(JSON.stringify(cas, null, 2));
