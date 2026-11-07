// Vérifie la BIBLIOTHÈQUE D'EXERCICES (src/data/bibliothequeExercices.js) en
// exécutant le VRAI code de l'app avec Node — pas une copie de ses règles.
//
// Ce qui se joue ici, et qui justifie un harnais plutôt qu'une relecture :
//   - un `groupe` mal orthographié dans une fiche ne se verrait NULLE PART à
//     l'écran. Il ne ferait que ranger l'exercice dans un 13e groupe fantôme,
//     que le compteur de volume n'affiche pas — donc des séries comptées nulle
//     part, en silence. C'est exactement la famille de bug du 03/09/2026 ;
//   - un `materiel` inconnu afficherait un point d'interrogation ;
//   - et surtout : la fiche doit être D'ACCORD avec la détection par mots-clés
//     partout où celle-ci se prononce (voir le cas « desaccord… » plus bas).
//
// Lancé par test_bibliotheque.py.
import {
  bibliothequeExercices, MATERIELS, chercherExercices, nombreParGroupe,
  exerciceDeLaBibliotheque, groupeDeLaBibliotheque, descriptionExercice, dejaChoisi,
} from '../../../src/data/bibliothequeExercices.js';
import {
  groupesMusculaires, groupeDeLExercice, deviner_groupe,
} from '../../../src/data/groupesMusculaires.js';
import { placerExerciceChoisi } from '../../../src/logic/choixExercice.js';

const echecs = [];
const verifie = (nom, condition, detail) => {
  if (!condition) echecs.push({ nom, detail: detail || '' });
};
const essaie = (nom, f) => {
  try { f(); } catch (e) { echecs.push({ nom, detail: `PLANTAGE : ${e.message}` }); }
};

// ---------------------------------------------------------------------------
// 1. L'INTÉGRITÉ DES FICHES
// ---------------------------------------------------------------------------
verifie('la bibliothèque n’est pas vide', bibliothequeExercices.length >= 50,
  `${bibliothequeExercices.length} exercices`);

for (const exo of bibliothequeExercices) {
  verifie(`groupe connu : ${exo.nom}`, groupesMusculaires.includes(exo.groupe),
    `groupe « ${exo.groupe} » absent des 12 groupes`);
  verifie(`materiel connu : ${exo.nom}`,
    Object.prototype.hasOwnProperty.call(MATERIELS, exo.materiel),
    `materiel « ${exo.materiel} » absent de MATERIELS`);
  verifie(`nom non vide : ${JSON.stringify(exo.nom)}`,
    typeof exo.nom === 'string' && exo.nom.trim().length > 1);
  verifie(`alias est une liste : ${exo.nom}`,
    exo.alias === undefined || Array.isArray(exo.alias));
}

// Un nom en DOUBLE serait un vrai dégât : le nom EST l'identifiant de
// l'exercice dans ce projet, donc deux fiches de même nom se disputeraient le
// même historique et le même record.
const vus = new Map();
for (const exo of bibliothequeExercices) {
  const cle = exo.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  verifie(`nom unique : ${exo.nom}`, !vus.has(cle), `déjà pris par « ${vus.get(cle)} »`);
  vus.set(cle, exo.nom);
}

// Tous les groupes doivent être servis : un groupe vide dans la grille de
// choix serait une tuile « 0 » sur laquelle on appuierait pour rien.
const compte = nombreParGroupe();
for (const groupe of groupesMusculaires) {
  verifie(`le groupe ${groupe} a des exercices`, (compte[groupe] || 0) >= 3,
    `${compte[groupe] || 0} exercice(s)`);
}

// Chaque matériel doit servir au moins une fois, sinon on entretient un
// pictogramme que personne ne voit jamais.
for (const cle of Object.keys(MATERIELS)) {
  verifie(`le materiel ${cle} est utilisé`,
    bibliothequeExercices.some((e) => e.materiel === cle));
}

// ---------------------------------------------------------------------------
// 2. LE DÉSACCORD AVEC LA DÉTECTION PAR MOTS-CLÉS
// ---------------------------------------------------------------------------
// LE TEST LE PLUS UTILE DU FICHIER. À l'exécution, la fiche gagne toujours
// (c'est l'ordre posé dans `groupeDeLExercice`), donc un désaccord ne casse
// rien tout de suite — il pose une MINE : le jour où quelqu'un tape le même
// exercice à la main au lieu de le choisir dans la liste, ses séries partent
// dans un autre groupe que celles d'avant. Deux historiques pour un seul
// mouvement, sans un mot à l'écran.
// On n'exige l'accord que là où la détection se prononce : qu'elle renvoie
// null est normal et sans danger (la fiche répond).
for (const exo of bibliothequeExercices) {
  const devine = deviner_groupe(exo.nom);
  verifie(`accord mots-clés/fiche : ${exo.nom}`,
    devine === null || devine === exo.groupe,
    `les mots-clés disent « ${devine} », la fiche dit « ${exo.groupe} »`);
}

// ---------------------------------------------------------------------------
// 3. L'ORDRE DE DÉCISION DU GROUPE
// ---------------------------------------------------------------------------
verifie('la fiche sert de groupe',
  groupeDeLExercice('Développé haltères assis', {}) === 'Épaules',
  `obtenu : ${groupeDeLExercice('Développé haltères assis', {})}`);

verifie('une correction manuelle bat la fiche',
  groupeDeLExercice('Développé couché', { 'Développé couché': 'Triceps' }) === 'Triceps');

verifie('un exercice hors bibliothèque garde la détection',
  groupeDeLExercice('mon squat maison', {}) === 'Quadriceps');

verifie('un exercice inconnu de tout reste non classé',
  groupeDeLExercice('truc bizarre 42', {}) === null,
  `obtenu : ${groupeDeLExercice('truc bizarre 42', {})}`);

// ---------------------------------------------------------------------------
// 4. LA RECHERCHE ET LA NORMALISATION DES NOMS
// ---------------------------------------------------------------------------
// Les deux fichiers normalisent les noms chacun de leur côté (un import
// croisé créerait un cycle, voir le commentaire dans la bibliothèque). Ces cas
// vérifient qu'ils tombent d'accord sur les écarts d'écriture les plus
// courants : accents, casse, tirets, espaces en trop.
const variantes = [
  ['developpe couche', 'Développé couché'],
  ['DÉVELOPPÉ COUCHÉ', 'Développé couché'],
  ['  Développé-couché  ', 'Développé couché'],
  ['leg curl assis', 'Leg curl assis'],
  ['Soulevé de terre Roumain', 'Soulevé de terre roumain'],
];
for (const [ecrit, attendu] of variantes) {
  const fiche = exerciceDeLaBibliotheque(ecrit);
  verifie(`variante reconnue : ${JSON.stringify(ecrit)}`,
    fiche && fiche.nom === attendu, `obtenu : ${fiche ? fiche.nom : 'null'}`);
  const exo = bibliothequeExercices.find((e) => e.nom === attendu);
  verifie(`même groupe pour la variante : ${JSON.stringify(ecrit)}`,
    groupeDeLExercice(ecrit, {}) === exo.groupe,
    `obtenu : ${groupeDeLExercice(ecrit, {})}, attendu ${exo.groupe}`);
}

verifie('un nom hors bibliothèque n’a pas de fiche',
  exerciceDeLaBibliotheque('Développé couché à la lune') === null);
verifie('groupeDeLaBibliotheque est null hors bibliothèque',
  groupeDeLaBibliotheque('exercice inventé') === null);

// Recherche par alias anglais — c'est ainsi que Hafiz nomme ses exercices
// (voir le correctif du 03/09/2026).
const parAlias = chercherExercices('bench press');
verifie('un alias anglais trouve la fiche française',
  parAlias.some((e) => e.nom === 'Développé couché'),
  `obtenu : ${parAlias.map((e) => e.nom).join(', ') || 'rien'}`);

// Mots dans n'importe quel ORDRE : on tape ce qui vient.
const desordre = chercherExercices('halteres curl');
verifie('les mots cherchés peuvent être en désordre',
  desordre.some((e) => e.nom === 'Curl haltères'),
  `obtenu : ${desordre.map((e) => e.nom).join(', ') || 'rien'}`);

// Le filtre par groupe ne laisse QUE ce groupe.
const dos = chercherExercices('', 'Dos');
verifie('le filtre par groupe est étanche',
  dos.length > 0 && dos.every((e) => e.groupe === 'Dos'));

// Recherche vide = toute la bibliothèque (c'est ce que fait le mode
// consultation avant qu'on tape quoi que ce soit).
verifie('recherche vide = tout',
  chercherExercices('', null).length === bibliothequeExercices.length);

verifie('une recherche sans résultat renvoie une liste vide',
  chercherExercices('zzzzz introuvable', null).length === 0);

// Le tri : par groupe puis par nom. Une liste de 96 lignes rangée au hasard
// serait inutilisable.
const tout = chercherExercices('', null);
let triOk = true;
for (let i = 1; i < tout.length; i++) {
  const a = tout[i - 1];
  const b = tout[i];
  const ordre = a.groupe === b.groupe
    ? a.nom.localeCompare(b.nom, 'fr')
    : a.groupe.localeCompare(b.groupe, 'fr');
  if (ordre > 0) triOk = false;
}
verifie('la liste est triée par groupe puis par nom', triOk);

// ---------------------------------------------------------------------------
// 5. OÙ ATTERRIT L'EXERCICE CHOISI
// ---------------------------------------------------------------------------
const neuve = { exercice: '', series: '3', reps: '10', repsMax: '' };

const dansLaVide = placerExerciceChoisi(
  [{ ...neuve }], 'Squat', neuve,
);
verifie('la première ligne vide est remplie',
  dansLaVide.length === 1 && dansLaVide[0].exercice === 'Squat',
  JSON.stringify(dansLaVide));

const ajoute = placerExerciceChoisi(
  [{ ...neuve, exercice: 'Squat' }], 'Dips', neuve,
);
verifie('une ligne pleine n’est pas écrasée',
  ajoute.length === 2 && ajoute[0].exercice === 'Squat' && ajoute[1].exercice === 'Dips',
  JSON.stringify(ajoute));

const premiereVide = placerExerciceChoisi(
  [{ ...neuve, exercice: 'Squat' }, { ...neuve }, { ...neuve, exercice: 'Dips' }], 'Pompes', neuve,
);
verifie('c’est la première ligne vide qui est servie, pas la fin',
  premiereVide.length === 3 && premiereVide[1].exercice === 'Pompes',
  JSON.stringify(premiereVide));

const espaces = placerExerciceChoisi([{ ...neuve, exercice: '   ' }], 'Squat', neuve);
verifie('une ligne faite d’espaces compte comme vide',
  espaces.length === 1 && espaces[0].exercice === 'Squat');

const autreForme = placerExerciceChoisi(
  [], 'Squat', { exercice: '', seriesCibles: '3', repsCibles: '10' },
);
verifie('la ligne neuve garde la forme donnée par l’appelant',
  autreForme.length === 1 && autreForme[0].seriesCibles === '3'
  && autreForme[0].repsCibles === '10',
  JSON.stringify(autreForme));

// ---------------------------------------------------------------------------
// 6. DONNÉES ABÎMÉES — rien ne doit PLANTER
// ---------------------------------------------------------------------------
// Même exigence que l'audit du 06/09/2026 : la bibliothèque s'affiche pendant
// qu'on remplit un programme ou qu'on s'entraîne. Une exception ici remplace
// l'onglet par l'écran d'erreur.
for (const bancal of [null, undefined, '', '   ', 123, {}, [], '\n\t', NaN]) {
  const vu = JSON.stringify(bancal) || String(bancal);
  essaie(`exerciceDeLaBibliotheque(${vu})`, () => exerciceDeLaBibliotheque(bancal));
  essaie(`groupeDeLaBibliotheque(${vu})`, () => groupeDeLaBibliotheque(bancal));
  essaie(`chercherExercices(${vu})`, () => chercherExercices(bancal, null));
  essaie(`chercherExercices(_, ${vu})`, () => chercherExercices('', bancal));
  essaie(`groupeDeLExercice(${vu})`, () => groupeDeLExercice(bancal, {}));
  essaie(`placerExerciceChoisi(${vu})`, () => placerExerciceChoisi(bancal, 'Squat', neuve));
}
essaie('placerExerciceChoisi(lignes avec null)',
  () => placerExerciceChoisi([null, undefined, {}], 'Squat', neuve));
essaie('groupeDeLExercice(sans corrections)', () => groupeDeLExercice('Squat'));

// ---------------------------------------------------------------------------
// 7. LA LIGNE DE DESCRIPTION
// ---------------------------------------------------------------------------
verifie('description normale',
  descriptionExercice({ groupe: 'Dos', materiel: 'barre' }) === 'Dos · Barre',
  descriptionExercice({ groupe: 'Dos', materiel: 'barre' }));
// Pour le cardio, groupe et materiel portent le MEME nom : « Cardio · Cardio »
// s'affichait tel quel avant ce correctif.
verifie('pas de doublon quand groupe et matériel se nomment pareil',
  descriptionExercice({ groupe: 'Cardio', materiel: 'cardio' }) === 'Cardio',
  descriptionExercice({ groupe: 'Cardio', materiel: 'cardio' }));
verifie('matériel inconnu ne fait pas disparaître le groupe',
  descriptionExercice({ groupe: 'Dos', materiel: 'inconnu' }) === 'Dos · autre');
essaie('descriptionExercice(null)', () => descriptionExercice(null));
essaie('descriptionExercice({})', () => descriptionExercice({}));

// ---------------------------------------------------------------------------
// 8. « DÉJÀ DANS LA LISTE »
// ---------------------------------------------------------------------------
// Le cas qui a motivé cette fonction, trouvé A L'ECRAN : le programme de test
// contenait « developpe couche » (tapé à la main, sans accents) et la
// bibliothèque proposait « Développé couché » sans le griser. L'ajouter créait
// DEUX exercices pour un seul mouvement.
verifie('un nom sans accents grise la fiche accentuée',
  dejaChoisi('Développé couché', ['developpe couche']) === true);
verifie('la casse ne compte pas',
  dejaChoisi('Squat', ['SQUAT']) === true);
verifie('les espaces autour ne comptent pas',
  dejaChoisi('Squat', ['  squat  ']) === true);
verifie('un tiret ne compte pas',
  dejaChoisi('Leg curl assis', ['leg-curl assis']) === true);
verifie('un autre exercice n’est pas grisé',
  dejaChoisi('Squat', ['Squat avant', 'Dips']) === false);
verifie('liste vide = rien de pris', dejaChoisi('Squat', []) === false);
for (const bancal of [null, undefined, 0, {}, 'texte']) {
  essaie(`dejaChoisi(_, ${JSON.stringify(bancal)})`, () => dejaChoisi('Squat', bancal));
  essaie(`dejaChoisi(${JSON.stringify(bancal)}, [])`, () => dejaChoisi(bancal, []));
}
verifie('un nom vide n’est jamais « déjà pris »',
  dejaChoisi('   ', ['', '  ']) === false);

process.stdout.write(JSON.stringify(echecs, null, 2));
