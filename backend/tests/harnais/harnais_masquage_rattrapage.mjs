// Le bouton « Masquer » des séances à rattraper (08/11/2026) — exécute le VRAI
// code de l'app (src/logic/rattrapage.js) et rend le résultat en JSON pour
// test_rattrapage.py.
//
// Les cas sont écrits ICI plutôt que dans un fichier de données : ce sont de
// petits tableaux de clés, plus lisibles à côté de leur intention.
import { cleRattrapage, rattrapagesVisibles, masquesAGarder } from '../../../src/logic/rattrapage.js';

const push = { id: 7, nom: 'Push' };
const pull = { id: 8, nom: 'Pull' };
const lundiPush = { date: '2026-11-02', programme: push };
const mardiPull = { date: '2026-11-03', programme: pull };
const mercrediPush = { date: '2026-11-04', programme: push };

// Ce qu'on compare : les séances visibles, réduites à leur clé.
const cles = (liste) => liste.map(cleRattrapage);

const cas = [
  ['la clé porte la date ET le programme',
    () => cleRattrapage(lundiPush), '2026-11-02|7'],
  ['même jour, autre programme : autre clé',
    () => cleRattrapage({ date: '2026-11-02', programme: pull }) !== cleRattrapage(lundiPush), true],

  ['rien de masqué : tout reste visible',
    () => cles(rattrapagesVisibles([lundiPush, mardiPull], [])), ['2026-11-02|7', '2026-11-03|8']],
  ['masquer ce qui est affiché : la section se vide',
    () => cles(rattrapagesVisibles([lundiPush, mardiPull], ['2026-11-02|7', '2026-11-03|8'])), []],
  // LE CŒUR DE LA RÈGLE : une séance manquée APRÈS le masquage fait revenir
  // la section, avec elle seule.
  ['une NOUVELLE séance manquée réapparaît, seule',
    () => cles(rattrapagesVisibles([lundiPush, mardiPull, mercrediPush], ['2026-11-02|7', '2026-11-03|8'])),
    ['2026-11-04|7']],
  ['masquer le Push du lundi ne masque pas celui du mercredi',
    () => cles(rattrapagesVisibles([lundiPush, mercrediPush], ['2026-11-02|7'])), ['2026-11-04|7']],

  ['ménage : les clés d\'une semaine passée sont jetées',
    () => masquesAGarder(['2026-10-27|7', '2026-11-02|7', '2026-11-05|8'], '2026-11-02'),
    ['2026-11-02|7', '2026-11-05|8']],
  ['ménage : le lundi lui-même est gardé',
    () => masquesAGarder(['2026-11-02|7'], '2026-11-02'), ['2026-11-02|7']],

  // Données abîmées (mémoire locale corrompue, liste mal formée) : on se tait,
  // on ne plante jamais — l'accueil de l'onglet ne doit pas tomber pour un
  // simple réglage d'affichage.
  ['mémoire illisible (pas une liste) : tout reste visible',
    () => cles(rattrapagesVisibles([lundiPush], 'n\'importe quoi')), ['2026-11-02|7']],
  ['mémoire nulle : tout reste visible',
    () => cles(rattrapagesVisibles([lundiPush], null)), ['2026-11-02|7']],
  ['séances manquées absentes : rien à montrer',
    () => cles(rattrapagesVisibles(undefined, ['2026-11-02|7'])), []],
  ['séance sans programme ou nulle : écartée',
    () => cles(rattrapagesVisibles([null, { date: '2026-11-02' }, lundiPush], [])), ['2026-11-02|7']],
  ['clé d\'une séance abîmée : chaîne vide',
    () => [cleRattrapage(null), cleRattrapage({ date: '2026-11-02' })], ['', '']],
  ['ménage sur des clés abîmées : seules les chaînes survivent',
    () => masquesAGarder([42, null, '2026-11-03|8', { a: 1 }], '2026-11-02'), ['2026-11-03|8']],
  ['ménage sans liste : liste vide',
    () => masquesAGarder(undefined, '2026-11-02'), []],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
