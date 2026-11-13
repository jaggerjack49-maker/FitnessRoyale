// Le poids de corps tapé dans les Paramètres (13/11/2026) — exécute le VRAI
// code de l'app (src/logic/classement.js) et rend le résultat en JSON pour
// test_poids.py.
import { lirePoidsSaisi, categoriePoids } from '../../../src/logic/classement.js';

const cas = [
  ['entier', () => lirePoidsSaisi('82'), 82],
  ['virgule française', () => lirePoidsSaisi('78,5'), 78.5],
  ['point décimal', () => lirePoidsSaisi('78.5'), 78.5],
  ['espaces autour', () => lirePoidsSaisi('  90  '), 90],
  ['arrondi au dixième, comme le serveur', () => lirePoidsSaisi('80,04'), 80],
  ['déjà un nombre', () => lirePoidsSaisi(75), 75],
  ['bornes exclues : 30 et 300 refusés', () => [lirePoidsSaisi('30'), lirePoidsSaisi('300')], [null, null]],
  ['juste dans les bornes', () => [lirePoidsSaisi('30,1'), lirePoidsSaisi('299,9')], [30.1, 299.9]],
  ['vide', () => [lirePoidsSaisi(''), lirePoidsSaisi('   ')], [null, null]],
  ['texte, négatif, unité collée', () => [lirePoidsSaisi('lourd'), lirePoidsSaisi('-80'),
    lirePoidsSaisi('80kg')], [null, null, null]],
  ['deux virgules', () => lirePoidsSaisi('78,5,2'), null],
  ['données abîmées', () => [lirePoidsSaisi(null), lirePoidsSaisi(undefined), lirePoidsSaisi({}),
    lirePoidsSaisi(NaN)], [null, null, null, null]],
  ['la catégorie suit le poids lu', () => categoriePoids(lirePoidsSaisi('89,9')), '-90 kg'],
  ['limite incluse : 80 kg pile reste en -80', () => categoriePoids(lirePoidsSaisi('80')), '-80 kg'],
  ['limite incluse : 80,1 kg passe en -90', () => categoriePoids(lirePoidsSaisi('80,1')), '-90 kg'],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
