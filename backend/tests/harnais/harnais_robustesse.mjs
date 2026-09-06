// Passe des ENTRÉES DÉGRADÉES dans la logique de l'app et signale ce qui PLANTE.
//
// Pourquoi ce harnais existe : ces fonctions sont au pied de tout l'affichage.
// `perfsVerifiees` sert à la ligue, à l'arène, au classement et aux titres ;
// `suggererProchaineSerie` et `recordPersonnel` tournent pendant la séance.
// Une seule donnée incomplète y déclenchait une exception, donc l'Error
// Boundary (src/components/LimiteErreur.js), donc un écran noir — au moment
// précis où l'on s'entraîne. Ces aides sont du CONFORT : elles doivent se
// taire sur une donnée bancale, jamais casser l'écran.
//
// Lancé par test_robustesse_front.py.
import {
  suggererProchaineSerie, recordPersonnel, detecterStagnation, tousLesRecords, bat_le_record,
} from '../../../src/logic/surchargeProgressive.js';
import { moyennePaliers, ligueJoueur, classer, classerSalles, classerParExercice }
  from '../../../src/logic/classement.js';
import { titresParExercice, mesTitresDExercice, titresAPortee } from '../../../src/logic/titres.js';
import { compterSeriesParGroupe, exercicesDeLaPeriode, deviner_groupe }
  from '../../../src/data/groupesMusculaires.js';
import { etatArene, areneDeLaLigue } from '../../../src/data/arenes.js';

const plantages = [];
const essaie = (nom, f) => {
  try { f(); } catch (e) { plantages.push({ nom, erreur: e.message }); }
};

// --- Séances mal formées : ce que produirait une réponse serveur partielle,
//     un état local à moitié écrit, ou une future évolution de l'API.
const seancesBancales = [
  [],
  [null],
  [undefined],
  [{}],                                     // ni date ni series
  [{ date: '2026-09-01' }],                 // series absente
  [{ date: '2026-09-01', series: null }],
  [{ date: '2026-09-01', series: [] }],
  [{ date: '2026-09-01', series: [null] }],
  [{ date: '2026-09-01', series: [{}] }],   // série sans exercice
  [{ series: [{ exercice: 'Squat', reps: 8, poids: 100 }] }],  // date absente
];
for (const [i, cas] of seancesBancales.entries()) {
  essaie(`suggererProchaineSerie #${i}`, () => suggererProchaineSerie(cas, 'Squat', 8));
  essaie(`recordPersonnel #${i}`, () => recordPersonnel(cas, 'Squat'));
  essaie(`detecterStagnation #${i}`, () => detecterStagnation(cas, 'Squat', 3));
  essaie(`tousLesRecords #${i}`, () => tousLesRecords(cas));
  essaie(`compterSeriesParGroupe #${i}`, () =>
    compterSeriesParGroupe(cas, {}, '2026-09-01', '2026-09-30'));
  essaie(`exercicesDeLaPeriode #${i}`, () =>
    exercicesDeLaPeriode(cas, {}, '2026-09-01', '2026-09-30'));
}
essaie('bat_le_record(null, null)', () => bat_le_record(null, null));

// --- Joueurs mal formés : le classement doit survivre à tout.
const joueursBancals = [
  {},
  { pseudo: 'SansPerfs', sexe: 'homme', poids: 80 },        // performances absent
  { pseudo: 'PerfsNull', sexe: 'homme', poids: 80, performances: null },
  { pseudo: 'SexeInconnu', sexe: 'martien', poids: 80, performances: {} },
  { pseudo: 'SansSexe', poids: 80, performances: {} },
  { pseudo: 'SansPoids', sexe: 'homme', performances: {} },
  { pseudo: 'PerfSansValeur', sexe: 'homme', poids: 80,
    performances: { Squat: { statut: 'communaute' } } },
  { pseudo: 'PerfSansStatut', sexe: 'homme', poids: 80,
    performances: { Squat: { valeur: 100 } } },
];
for (const j of joueursBancals) {
  essaie(`moyennePaliers ${j.pseudo}`, () => moyennePaliers(j));
  essaie(`ligueJoueur ${j.pseudo}`, () => ligueJoueur(j));
  essaie(`etatArene ${j.pseudo}`, () => etatArene({
    moyenne: moyennePaliers(j), scoreSP: 0, nbExercices: 15,
    ligue: ligueJoueur(j), bareme: {} }));
}
essaie('classer(liste bancale)', () => classer(joueursBancals, 'global'));
essaie('classerSalles(liste bancale)', () => classerSalles(joueursBancals));
essaie('classerParExercice(liste bancale)', () => classerParExercice(joueursBancals, 'Squat'));
essaie('titresParExercice(liste bancale)', () => titresParExercice(joueursBancals));
essaie('mesTitresDExercice(liste bancale)', () => mesTitresDExercice(joueursBancals));
essaie('titresAPortee(liste bancale)', () => titresAPortee(joueursBancals));
essaie('classer(null)', () => classer([], 'global'));

// --- Noms d'exercice bancals
for (const nom of [null, undefined, '', '   ', 123, {}, '\n\t']) {
  essaie(`deviner_groupe(${JSON.stringify(nom)})`, () => deviner_groupe(nom));
}
essaie('areneDeLaLigue(null)', () => areneDeLaLigue(null));
essaie('areneDeLaLigue(inconnue)', () => areneDeLaLigue('Inexistante'));

process.stdout.write(JSON.stringify(plantages, null, 2));
