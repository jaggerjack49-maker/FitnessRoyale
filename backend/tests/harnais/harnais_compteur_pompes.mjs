// Exécute le VRAI compteur de pompes de l'app (src/logic/compteurPompes.js) sur
// des mouvements SIMULÉS, et rend le résultat en JSON pour
// test_compteur_pompes.py.
//
// Pourquoi simuler : la vraie détection demande une caméra et quelqu'un qui fait
// des pompes. Ici on fabrique directement la suite d'angles des coudes qu'une
// pompe produit (170° → 80° → 170°), image par image, pour vérifier la RÈGLE de
// comptage et ses garde-fous sur des cas choisis.
//
// Lancé par test_compteur_pompes.py.
import {
  REGLAGES_POMPES, angleCoudes, angleEntre, avancerCompteur, descenteBras,
  mesureDepuisPoints, nouvelEtatCompteur,
} from '../../../src/logic/compteurPompes.js';

const IMAGE_MS = 33; // ~30 images par seconde, comme une caméra de téléphone

// Fabrique une suite de mesures à partir de segments :
// { de, a, ms } = l'angle passe de `de` à `a` en `ms` millisecondes ;
// { perdu: ms } = personne détectée pendant `ms`.
function mouvement(segments) {
  const mesures = [];
  let t = 0;
  for (const s of segments) {
    const nb = Math.max(1, Math.round(s.ms / IMAGE_MS));
    for (let i = 0; i < nb; i++) {
      const angle = s.perdu !== undefined ? null : s.de + ((s.a - s.de) * (i + 1)) / nb;
      mesures.push({ angle, t });
      t += IMAGE_MS;
    }
  }
  return mesures;
}

const tenir = (angle, ms) => ({ de: angle, a: angle, ms });
const pompe = (msDescente = 600, msBas = 200, msMontee = 600, msHaut = 300) => [
  { de: 170, a: 80, ms: msDescente }, tenir(80, msBas), { de: 80, a: 170, ms: msMontee }, tenir(170, msHaut),
];

function compter(mesures, reglages = REGLAGES_POMPES) {
  return etatApres(mesures, reglages).reps;
}

function etatApres(mesures, reglages = REGLAGES_POMPES) {
  let etat = nouvelEtatCompteur();
  for (const m of mesures) etat = avancerCompteur(etat, m, reglages);
  return etat;
}

// Les réglages d'AVANT le 21/09/2026 : seuils fixes, aucun étalonnage.
// Ils servent à prouver que les nouveaux cas échouaient bien avec l'ancienne règle.
const SEUILS_FIXES = {
  ...REGLAGES_POMPES, amplitudeAngleMin: Infinity, amplitudeDescenteMin: Infinity,
};

// Un mouvement où l'angle du coude n'oscille qu'entre `bas` et `haut` — ce que
// donne une vraie pompe vue DE FACE, écrasée par la perspective.
function pompeEcrasee(haut, bas) {
  return [{ de: haut, a: bas, ms: 600 }, tenir(bas, 200), { de: bas, a: haut, ms: 600 }, tenir(haut, 300)];
}

// Mesures où l'angle NE BOUGE PAS (perspective) mais où la descente, elle, varie.
function mouvementDescente(cycles) {
  const mesures = [];
  let t = 0;
  const seg = (de, a, ms) => {
    const nb = Math.max(1, Math.round(ms / IMAGE_MS));
    for (let i = 0; i < nb; i++) {
      mesures.push({ angle: 140, descente: de + ((a - de) * (i + 1)) / nb, t });
      t += IMAGE_MS;
    }
  };
  seg(0.95, 0.95, 500);
  for (let i = 0; i < cycles; i++) {
    seg(0.95, 0.45, 600); seg(0.45, 0.45, 200); seg(0.45, 0.95, 600); seg(0.95, 0.95, 300);
  }
  return mesures;
}

const cas = [];
function verifier(nom, calcul, attendu) {
  try {
    cas.push({ nom, obtenu: calcul(), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

// ---- La règle de comptage ----
verifier('trois pompes propres', () => compter(mouvement([tenir(170, 500), ...pompe(), ...pompe(), ...pompe()])), 3);
verifier('une pompe lente (3 s)', () => compter(mouvement([tenir(170, 500), ...pompe(1400, 400, 1400, 400)])), 1);
// ⚠️ CHAQUE GARDE-FOU A SON CAS, et chaque cas a été vérifié en DÉSACTIVANT
// son garde-fou : le compteur doit alors se tromper. Une première version
// passait pour de mauvaises raisons (une image isolée ne peut jamais confirmer
// une phase, quel que soit le réglage ; des « bas » de 132 ms étaient bloqués
// par la règle des 150 ms et non par celle des 500 ms). Ne pas raccourcir ces
// durées sans refaire cette vérification.
// Garde-fou 2 — 3 images (~100 ms) mal détectées : 0, et 1 sans la règle des 150 ms.
verifier('trois images mal détectées en bas ne comptent pas',
  () => compter(mouvement([tenir(170, 1000), tenir(80, 100), tenir(170, 1000)])), 0);
// Garde-fou 1 — un angle qui oscille lentement entre 110° et 140° : 0, et des
// pompes fantômes avec un seuil unique à 125°.
verifier('un angle qui tremble dans la zone neutre ne compte pas',
  () => compter(mouvement([tenir(170, 500),
    ...Array.from({ length: 6 }, () => [{ de: 140, a: 110, ms: 400 }, { de: 110, a: 140, ms: 400 }]).flat()])), 0);
verifier('descendre sans jamais remonter ne compte pas',
  () => compter(mouvement([tenir(170, 500), { de: 170, a: 80, ms: 600 }, tenir(80, 2000)])), 0);
verifier('commencer allongé ne donne pas de pompe gratuite, la suivante compte',
  () => compter(mouvement([tenir(80, 500), { de: 80, a: 170, ms: 600 }, tenir(170, 300), ...pompe()])), 1);
// Garde-fou 3 — après une vraie pompe, des « pompes » de ~460 ms (chaque phase
// tenue 230 ms, donc bien confirmée, mais le tour complet sous 500 ms) ne sont
// pas humaines : 1, et 4 sans la règle des 500 ms. La vraie pompe finit SANS
// pause en haut : avec une pause, le premier cycle rapide dépasserait 500 ms
// et compterait, à juste titre.
verifier('des cycles trop rapides après une vraie pompe ne comptent pas',
  () => compter(mouvement([tenir(170, 500), ...pompe(600, 200, 600, 0),
    ...Array.from({ length: 3 }, () => [tenir(80, 230), tenir(170, 230)]).flat()])), 1);
verifier('perdu un instant tout en bas : la pompe compte quand même',
  () => compter(mouvement([tenir(170, 500), { de: 170, a: 80, ms: 600 }, tenir(80, 200), { perdu: 500 },
    { de: 80, a: 170, ms: 600 }, tenir(170, 300)])), 1);
verifier('une minute à une pompe toutes les 2 s = 30 pompes',
  () => compter(mouvement([tenir(170, 300), ...Array.from({ length: 30 }, () => pompe(700, 200, 700, 400)).flat()])), 30);

// ---- L'ÉTALONNAGE AUTOMATIQUE (21/09/2026) ----
// LE BUG DE HAFIZ : « tout apparaissait mais le compteur ne marchait pas ».
// Vu de face, l'angle du coude est écrasé et ne franchit jamais les anciens
// seuils fixes (100° / 150°) : le compteur restait à 0. Chaque cas ci-dessous
// est donc DOUBLÉ de sa version « seuils fixes », qui doit échouer — c'est la
// preuve que l'étalonnage porte vraiment le résultat.
verifier('mouvement écrasé de face (120°-155°) : trois pompes comptées',
  () => compter(mouvement([tenir(155, 500), ...pompeEcrasee(155, 120), ...pompeEcrasee(155, 120), ...pompeEcrasee(155, 120)])), 3);
verifier('le même mouvement avec les anciens seuils fixes : zéro (le bug)',
  () => compter(mouvement([tenir(155, 500), ...pompeEcrasee(155, 120), ...pompeEcrasee(155, 120), ...pompeEcrasee(155, 120)]), SEUILS_FIXES), 0);
verifier('mouvement très écrasé (135°-165°) : compté aussi',
  () => compter(mouvement([tenir(165, 500), ...pompeEcrasee(165, 135), ...pompeEcrasee(165, 135)])), 2);
verifier('un mouvement AMPLE reste compté comme avant',
  () => compter(mouvement([tenir(170, 500), ...pompe(), ...pompe(), ...pompe()])), 3);

// Le second signal : quand l'angle ne bouge pas du tout, la descente prend le relais.
verifier('angle figé, descente qui bouge : la descente prend le relais',
  () => { const e = etatApres(mouvementDescente(3)); return [e.signal, e.reps]; }, ['descente', 2]);
verifier('avec les seuils fixes, ce même mouvement ne compte rien',
  () => compter(mouvementDescente(3), SEUILS_FIXES), 0);

// Les garde-fous tiennent malgré des seuils plus serrés.
verifier('un petit tremblement (8°) ne compte toujours rien',
  () => compter(mouvement([tenir(150, 500),
    ...Array.from({ length: 8 }, () => [{ de: 150, a: 142, ms: 400 }, { de: 142, a: 150, ms: 400 }]).flat()])), 0);
// ⚠️ LIMITE ASSUMÉE : un balancement RÉGULIER de 30°, tenu plus longtemps que la
// fenêtre d'étalonnage (8 s), FINIT par être compté — sans repère absolu, il est
// indiscernable de pompes peu profondes. Les durées minimales (150 ms par phase,
// 500 ms par pompe) rendent l'accident improbable pendant un duel, mais le cas
// est écrit noir sur blanc pour qu'il ne change pas en silence.
verifier('limite connue : un balancement régulier de 30° tenu 16 s finit par compter',
  () => compter(mouvement([tenir(170, 500),
    ...Array.from({ length: 20 }, () => [{ de: 140, a: 110, ms: 400 }, { de: 110, a: 140, ms: 400 }]).flat()])) > 0, true);

// La mémoire ne grossit pas indéfiniment pendant une minute de duel.
verifier("la fenêtre d'étalonnage reste bornée",
  () => etatApres(mouvement([tenir(170, 300), ...Array.from({ length: 30 }, () => pompe(700, 200, 700, 400)).flat()]))
    .fenetre.length <= REGLAGES_POMPES.mesuresMaxFenetre, true);

// ---- La descente (second signal), sur deux poses nettes ----
// épaule au-dessus du poignet, bras tendu à la verticale → 1 ; poitrine au sol → presque 0.
verifier('descente : bras tendu = 1, poitrine au sol ≈ 0.09', () => {
  const v = (p) => [p[0], p[1], p[2], 1];
  const debout = [v([0, 2, 0]), v([0, 2, 0]), v([0, 1, 0]), v([0, 1, 0]), v([0, 0, 0]), v([0, 0, 0])];
  const auSol = [v([0, 0.2, 0]), v([0, 0.2, 0]), v([1, 0.6, 0]), v([1, 0.6, 0]), v([0, 0, 0]), v([0, 0, 0])];
  return [Number(descenteBras(debout).toFixed(2)), Number(descenteBras(auSol).toFixed(2))];
}, [1, 0.09]);

// ---- La géométrie ----
verifier('angle bras tendu = 180°', () => Math.round(angleEntre([0, 0, 0], [1, 0, 0], [2, 0, 0])), 180);
verifier('angle en équerre = 90°', () => Math.round(angleEntre([0, 1, 0], [0, 0, 0], [1, 0, 0])), 90);
verifier('angle en 3D : la profondeur compte', () => Math.round(angleEntre([0, 0, 1], [0, 0, 0], [1, 0, 0])), 90);

// Points dans l'ordre envoyé par la page : épauleG, épauleD, coudeG, coudeD, poignetG, poignetD.
const brasTendus = [[0, 0, 0, 1], [1, 0, 0, 1], [0, 1, 0, 1], [1, 1, 0, 1], [0, 2, 0, 1], [1, 2, 0, 1]];
verifier('deux bras bien vus et tendus', () => Math.round(angleCoudes(brasTendus)), 180);
verifier('un bras mal vu : on se sert de l\'autre', () => {
  const points = brasTendus.map((p) => [...p]);
  points[3] = [1, 1, 0, 0.1]; // coude droit mal vu
  points[5] = [2, 1, 0, 1]; // poignet droit plié à 90° (ignoré car le coude est mal vu)
  return Math.round(angleCoudes(points));
}, 180);
verifier('aucun bras bien vu : pas d\'angle', () => angleCoudes(brasTendus.map((p) => [p[0], p[1], p[2], 0.2])), null);

// ---- Données abîmées : ça ne doit JAMAIS planter pendant un duel ----
verifier('données abîmées sans plantage', () => [
  angleEntre(null, [0, 0, 0], [1, 0, 0]),
  angleEntre([0, 0, 0], [0, 0, 0], [1, 0, 0]),
  angleEntre([NaN, 0, 0], [1, 0, 0], [2, 0, 0]),
  angleCoudes(null),
  angleCoudes([[1, 2]]),
  angleCoudes('n\'importe quoi'),
  avancerCompteur(undefined, null).reps,
  avancerCompteur(null, { angle: 'x', t: 5 }).reps,
  avancerCompteur(nouvelEtatCompteur(), { angle: 80 }).reps,
  descenteBras(null),
  descenteBras([[1, 2]]),
  mesureDepuisPoints(null, 5).angle,
  mesureDepuisPoints("n'importe quoi", 5).descente,
], [null, null, null, null, null, null, 0, 0, 0, null, null, null, null]);
verifier('le compteur ne modifie jamais l\'état reçu', () => {
  const etat = nouvelEtatCompteur();
  const copie = JSON.stringify(etat);
  avancerCompteur(etat, { angle: 80, t: 0 });
  avancerCompteur(etat, { angle: 170, t: 400 });
  return JSON.stringify(etat) === copie;
}, true);

process.stdout.write(JSON.stringify(cas));
