// Exécute la VRAIE règle de datation d'une séance (src/logic/dateSeance.js)
// sur des cas choisis, et rend le résultat en JSON pour test_date_seance.py.
//
// Le cas qui a motivé cette règle (bug de Hafiz du 21/09/2026) : séance faite
// lundi, « Terminer » touché mardi → elle doit rester datée de LUNDI.
import {
  jourDeLaSeance, joursTravailles, seriesSansJour,
} from '../../../src/logic/dateSeance.js';

const cas = [];
function verifier(nom, calcul, attendu) {
  try {
    cas.push({ nom, obtenu: calcul(), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

const LUNDI = '2026-09-21';
const MARDI = '2026-09-22';
const MERCREDI = '2026-09-23';

// Fabrique n séries faites le jour donné.
function series(jour, n) {
  return Array.from({ length: n }, (_, i) => ({
    exercice: 'développé couché', numero_serie: i + 1, reps: 8, poids: 100, jour,
  }));
}

// ---- LE CAS SIGNALÉ ----
verifier('séance faite lundi, enregistrée mardi → lundi',
  () => jourDeLaSeance(series(LUNDI, 4), { dateDebut: LUNDI, jourJ: MARDI }), LUNDI);

verifier('séance faite et enregistrée le même jour → ce jour',
  () => jourDeLaSeance(series(MARDI, 3), { dateDebut: MARDI, jourJ: MARDI }), MARDI);

// ---- Séance ouverte un jour, réellement faite le lendemain ----
// On ne date PAS une séance d'un jour où l'on n'a (presque) rien fait :
// c'est pour ça que la règle compte les séries au lieu de prendre la date de
// début. Ici 1 série lundi contre 5 mardi → mardi.
verifier('ouverte lundi mais travaillée mardi → mardi',
  () => jourDeLaSeance([...series(LUNDI, 1), ...series(MARDI, 5)],
    { dateDebut: LUNDI, jourJ: MARDI }), MARDI);

verifier('à égalité entre deux jours, on garde le plus ancien',
  () => jourDeLaSeance([...series(LUNDI, 3), ...series(MARDI, 3)],
    { dateDebut: LUNDI, jourJ: MERCREDI }), LUNDI);

verifier('trois jours : le plus fourni gagne, même au milieu',
  () => jourDeLaSeance([...series(LUNDI, 1), ...series(MARDI, 4), ...series(MERCREDI, 2)],
    { dateDebut: LUNDI, jourJ: MERCREDI }), MARDI);

// ---- Replis (séances commencées avant le 21/09/2026 : aucune série estampillée) ----
verifier('séries sans jour → la date de début',
  () => jourDeLaSeance([{ exercice: 'squat', reps: 5, poids: 120 }],
    { dateDebut: LUNDI, jourJ: MERCREDI }), LUNDI);

verifier('ni jour ni date de début → aujourd\'hui',
  () => jourDeLaSeance([{ exercice: 'squat', reps: 5, poids: 120 }], { jourJ: MERCREDI }), MERCREDI);

verifier('aucune série du tout → la date de début',
  () => jourDeLaSeance([], { dateDebut: LUNDI, jourJ: MARDI }), LUNDI);

// ---- Données abîmées : la règle se rabat, elle ne plante jamais ----
// (Leçon de l'audit du 06/09/2026 : ces fonctions tournent PENDANT une séance,
// une exception y remplacerait l'écran par l'écran d'erreur.)
verifier('un jour mal formé est ignoré',
  () => jourDeLaSeance([{ jour: '21/09/2026' }, { jour: 2026 }, ...series(LUNDI, 1)],
    { dateDebut: MARDI, jourJ: MERCREDI }), LUNDI);

verifier('série nulle dans la liste',
  () => jourDeLaSeance([null, undefined, ...series(MARDI, 2)], { jourJ: MERCREDI }), MARDI);

verifier('ce n\'est même pas une liste',
  () => jourDeLaSeance('lundi', { dateDebut: LUNDI, jourJ: MARDI }), LUNDI);

verifier('aucun paramètre du tout', () => jourDeLaSeance(undefined), null);

verifier('une date de début mal formée est ignorée',
  () => jourDeLaSeance([], { dateDebut: 'hier', jourJ: MARDI }), MARDI);

// ---- Ce qui part au serveur n'emporte jamais le jour d'une série ----
verifier('le jour est retiré avant l\'envoi',
  () => Object.keys(seriesSansJour(series(LUNDI, 1))[0]).sort(),
  ['exercice', 'numero_serie', 'poids', 'reps']);

verifier('les valeurs des séries sont intactes',
  () => seriesSansJour(series(LUNDI, 2)).map((s) => [s.numero_serie, s.reps, s.poids]),
  [[1, 8, 100], [2, 8, 100]]);

verifier('seriesSansJour sur des données abîmées',
  () => seriesSansJour([null, 'texte']), [null, 'texte']);

verifier('seriesSansJour sur autre chose qu\'une liste', () => seriesSansJour(null), []);

// ---- Les jours travaillés (pour prévenir « séance à cheval sur 2 jours ») ----
verifier('jours travaillés, triés et sans doublon',
  () => joursTravailles([...series(MARDI, 2), ...series(LUNDI, 1), ...series(MARDI, 1)]),
  [LUNDI, MARDI]);

verifier('jours travaillés sur des données abîmées',
  () => joursTravailles([null, { jour: 'demain' }, { reps: 5 }]), []);

process.stdout.write(JSON.stringify(cas, null, 2));
