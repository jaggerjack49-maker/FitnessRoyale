// L'ordre de la liste « Enregistrées » (15/11/2026) — exécute le VRAI code de
// l'app (src/logic/classement.js) et rend le résultat en JSON pour
// test_ordre_perfs.py.
import { ordrePerfs } from '../../../src/logic/classement.js';

const bareme = ['Développé couché', 'Squat', 'Dips', 'Curl barre'];
const perfs = (...noms) => Object.fromEntries(noms.map((n) => [n, { valeur: 1, statut: 'declare' }]));

const cas = [
  ['ordre du barème, quel que soit l\u2019ordre reçu',
    () => ordrePerfs(perfs('Curl barre', 'Squat', 'Développé couché'), bareme),
    ['Développé couché', 'Squat', 'Curl barre']],
  ['la perf modifiée en dernier par le serveur ne glisse PAS en bas',
    () => ordrePerfs(perfs('Squat', 'Dips', 'Développé couché'), bareme),
    ['Développé couché', 'Squat', 'Dips']],
  ['la perf qu\u2019on vient d\u2019enregistrer passe en tête',
    () => ordrePerfs(perfs('Développé couché', 'Squat', 'Dips'), bareme, 'Dips'),
    ['Dips', 'Développé couché', 'Squat']],
  ['une « dernière » absente de la liste ne change rien',
    () => ordrePerfs(perfs('Squat', 'Dips'), bareme, 'Curl barre'),
    ['Squat', 'Dips']],
  ['un exercice hors barème va à la fin, par ordre alphabétique',
    () => ordrePerfs(perfs('Zercher', 'Squat', 'Ancien nom'), bareme),
    ['Squat', 'Ancien nom', 'Zercher']],
  ['entrées abîmées → liste vide, pas de plantage',
    () => [ordrePerfs(null, bareme), ordrePerfs(undefined, null), ordrePerfs('x', bareme)],
    [[], [], []]],
  ['barème absent → ordre alphabétique',
    () => ordrePerfs(perfs('Squat', 'Dips'), null), ['Dips', 'Squat']],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
