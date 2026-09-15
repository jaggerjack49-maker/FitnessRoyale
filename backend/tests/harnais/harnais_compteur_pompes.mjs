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
  REGLAGES_POMPES, angleCoudes, angleEntre, avancerCompteur, nouvelEtatCompteur,
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

function compter(mesures) {
  let etat = nouvelEtatCompteur();
  for (const m of mesures) etat = avancerCompteur(etat, m, REGLAGES_POMPES);
  return etat.reps;
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
], [null, null, null, null, null, null, 0, 0, 0]);
verifier('le compteur ne modifie jamais l\'état reçu', () => {
  const etat = nouvelEtatCompteur();
  const copie = JSON.stringify(etat);
  avancerCompteur(etat, { angle: 80, t: 0 });
  avancerCompteur(etat, { angle: 170, t: 400 });
  return JSON.stringify(etat) === copie;
}, true);

process.stdout.write(JSON.stringify(cas));
