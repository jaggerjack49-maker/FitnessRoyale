// Logique de classement basée sur les barèmes du Club SP.
// IMPORTANT : seules les performances VÉRIFIÉES (communauté ou salle)
// comptent pour le score, la ligue et le classement.
import { baremes, nomsLigues } from '../data/clubSP';
import { estVerifiee } from '../data/statuts';

// Palier atteint sur UN exercice : 0 = aucun, 1 = Bronze, 2 = Silver, etc.
export function palierExercice(sexe, exercice, valeur) {
  const bareme = baremes[sexe][exercice];
  if (!bareme) return 0;
  let palier = 0;
  bareme.paliers.forEach((seuil, i) => {
    if (valeur >= seuil) palier = i + 1;
  });
  return palier;
}

// Performances vérifiées uniquement, sous forme de liste [exercice, perf].
function perfsVerifiees(joueur) {
  return Object.entries(joueur.performances).filter(([, perf]) => estVerifiee(perf));
}

// Score SP global = somme des paliers atteints (perfs vérifiées uniquement).
export function scoreSP(joueur) {
  return perfsVerifiees(joueur).reduce(
    (total, [exercice, perf]) => total + palierExercice(joueur.sexe, exercice, perf.valeur),
    0
  );
}

// Palier MOYEN (2 décimales) = le vrai score de classement.
// IMPORTANT : la moyenne se calcule sur TOUS les exercices du barème, PAS
// seulement ceux que le joueur a vérifiés — un exercice sans perf vérifiée
// compte pour 0. Ça récompense naturellement la POLYVALENCE : à niveau égal,
// celui qui a des perfs vérifiées sur plus d'exercices a une moyenne (et donc
// un rang) plus haute que celui qui excelle sur un seul exercice.
// Ex. : Gold (3) UNIQUEMENT au développé couché, sur 15 exercices → 3/15 = 0.2.
export function moyennePaliers(joueur) {
  const nbExercices = Object.keys(baremes[joueur.sexe] || {}).length;
  if (nbExercices === 0) return 0;
  return Math.round((scoreSP(joueur) / nbExercices) * 100) / 100;
}

// Ligue du joueur = palier moyen (arrondi) sur ses perfs vérifiées.
export function ligueJoueur(joueur) {
  const moyenne = moyennePaliers(joueur);
  if (moyenne === 0) return 'Aucune';
  const index = Math.round(moyenne);
  if (index === 0) return 'Aucune';
  return nomsLigues[Math.min(index, nomsLigues.length) - 1];
}

// Score RELATIF = force rapportée au poids du corps (perfs vérifiées, en kg).
export function scoreRelatif(joueur) {
  let total = 0;
  perfsVerifiees(joueur).forEach(([exercice, perf]) => {
    const bareme = baremes[joueur.sexe][exercice];
    if (bareme && bareme.unite === 'kg') {
      total += perf.valeur / joueur.poids;
    }
  });
  return Math.round(total * 100) / 100;
}

// Liste des joueurs triée + enrichie. mode : 'global' ou 'relatif'.
export function classer(joueurs, mode) {
  const enrichis = joueurs.map((j) => ({
    ...j,
    moyenne: moyennePaliers(j),
    scoreRelatif: scoreRelatif(j),
    ligue: ligueJoueur(j),
  }));
  // Classement par palier moyen. Égalité → départage aux POINTS de compétition
  // (duels + défis) : les perfs restent reines, les points récompensent l'activité.
  enrichis.sort(
    (a, b) => b.moyenne - a.moyenne || (b.points || 0) - (a.points || 0)
  );
  return enrichis;
}

// ----- Catégories de poids (classement relatif) -----
export const ordreCategories = ['-60 kg', '-70 kg', '-80 kg', '-90 kg', '+90 kg'];

export function categoriePoids(poids) {
  if (poids < 60) return '-60 kg';
  if (poids < 70) return '-70 kg';
  if (poids < 80) return '-80 kg';
  if (poids < 90) return '-90 kg';
  return '+90 kg';
}

// Regroupe les joueurs par catégorie de poids, chacune classée par palier moyen.
// Renvoie une liste [{ categorie, joueurs: [...] }] dans l'ordre des catégories.
export function classerParCategories(joueurs) {
  const classes = classer(joueurs, 'global'); // déjà triés par palier moyen
  return ordreCategories
    .map((categorie) => ({
      categorie,
      joueurs: classes.filter((j) => categoriePoids(j.poids) === categorie),
    }))
    .filter((groupe) => groupe.joueurs.length > 0);
}

// ----- Classement par salle (clans) -----
// Chaque salle est notée au palier moyen de ses membres.
// Égalité → départage au total de points de compétition de la salle.
export function classerSalles(joueurs) {
  const parSalle = {};
  joueurs.forEach((j) => {
    if (!j.salle) return;
    if (!parSalle[j.salle]) parSalle[j.salle] = [];
    parSalle[j.salle].push(j);
  });
  const salles = Object.entries(parSalle).map(([salle, membres]) => {
    const somme = membres.reduce((total, m) => total + moyennePaliers(m), 0);
    return {
      salle,
      nbMembres: membres.length,
      moyenne: Math.round((somme / membres.length) * 100) / 100,
      points: membres.reduce((total, m) => total + (m.points || 0), 0),
    };
  });
  salles.sort((a, b) => b.moyenne - a.moyenne || b.points - a.points);
  return salles;
}

// ----- Classement par exercice -----
// La liste des exercices est la même pour les deux sexes (mêmes noms, seuils
// différents) — on prend la liste "homme" comme référence.
export const listeExercicesClassement = Object.keys(baremes.homme);

// Pour UN exercice donné : classe les joueurs ayant une perf VÉRIFIÉE sur cet
// exercice, par PALIER atteint (comparable entre sexes, comme partout
// ailleurs dans l'app) — départage aux points, JAMAIS à la valeur brute :
// comparer des kg entre hommes et femmes serait injuste (échelles de
// barème différentes), le palier normalise déjà ça.
export function classerParExercice(joueurs, exercice) {
  return joueurs
    .filter((j) => j.performances[exercice] && estVerifiee(j.performances[exercice]))
    .map((j) => ({
      ...j,
      palierExo: palierExercice(j.sexe, exercice, j.performances[exercice].valeur),
      valeurExo: j.performances[exercice].valeur,
    }))
    .sort((a, b) => b.palierExo - a.palierExo || (b.points || 0) - (a.points || 0));
}
