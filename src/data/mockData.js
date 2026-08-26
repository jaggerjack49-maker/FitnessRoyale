// Données factices (mock) : plus tard, elles viendront d'un vrai serveur.
// Une performance = { valeur, statut }.
// statut : 'non_verifie' | 'communaute' | 'salle' (voir statuts.js).
// Les noms d'exercices doivent être EXACTS (mêmes que dans clubSP.js).

export const utilisateur = {
  pseudo: 'Hafiz',
  sexe: 'homme',
  poids: 75, // kg — sert au classement par catégories
  salle: 'Iron Temple', // salle de gym (modifiable dans le Profil) — futur clan
  points: 380, // points de compétition (duels + défis) — servent au DÉPARTAGE, pas au classement
  titres: [], // titres gagnés via les défis (affichés au profil)
  serieJours: 8,
  affilieSalle: false, // true = salle partenaire → perfs validées automatiquement
  performances: {
    'Développé couché': { valeur: 100, statut: 'salle' },
    'Squat': { valeur: 110, statut: 'salle' },
    'Soulevé de terre': { valeur: 175, statut: 'communaute' },
    'Traction prise large': { valeur: 22, statut: 'communaute' },
    'Dips': { valeur: 42, statut: 'non_verifie' }, // ne compte pas encore !
  },
  // Durée (en minutes) de chaque séance de la semaine — saisie dans l'écran Profil.
  seances: [45, 50, 40, 50],
  stats: {
    victoires: 23,
    defaites: 9,
  },
};

// Les autres joueurs du classement (l'utilisateur est ajouté dans App.js).
export const autresJoueurs = [
  {
    id: 1,
    pseudo: 'IronMax',
    points: 520,
    sexe: 'homme',
    poids: 96,
    salle: 'Titan Gym',
    performances: {
      'Développé couché': { valeur: 125, statut: 'salle' },
      'Squat': { valeur: 150, statut: 'salle' },
      'Soulevé de terre': { valeur: 200, statut: 'salle' },
      'Traction prise large': { valeur: 18, statut: 'communaute' },
      'Dips': { valeur: 38, statut: 'communaute' },
    },
  },
  {
    id: 2,
    pseudo: 'SarahFit',
    points: 610,
    sexe: 'femme',
    poids: 58,
    salle: 'Iron Temple',
    performances: {
      'Développé couché': { valeur: 47.5, statut: 'salle' },
      'Squat': { valeur: 72, statut: 'salle' },
      'Soulevé de terre': { valeur: 102, statut: 'salle' },
      'Traction prise large': { valeur: 12, statut: 'communaute' },
      'Dips': { valeur: 21, statut: 'communaute' },
    },
  },
  {
    id: 4,
    pseudo: 'KenzoLift',
    points: 300,
    sexe: 'homme',
    poids: 70,
    salle: 'PowerHouse',
    performances: {
      'Développé couché': { valeur: 95, statut: 'communaute' },
      'Squat': { valeur: 125, statut: 'salle' },
      'Soulevé de terre': { valeur: 165, statut: 'salle' },
      'Traction prise large': { valeur: 25, statut: 'communaute' },
      'Dips': { valeur: 45, statut: 'non_verifie' },
    },
  },
  {
    id: 5,
    pseudo: 'NoraRun',
    points: 150,
    sexe: 'femme',
    poids: 52,
    salle: 'Titan Gym',
    performances: {
      'Développé couché': { valeur: 32, statut: 'communaute' },
      'Squat': { valeur: 55, statut: 'salle' },
      'Soulevé de terre': { valeur: 75, statut: 'communaute' },
      'Traction prise large': { valeur: 6, statut: 'salle' },
      'Dips': { valeur: 13, statut: 'non_verifie' },
    },
  },
  {
    id: 6,
    pseudo: 'Djibril93',
    points: 210,
    sexe: 'homme',
    poids: 82,
    salle: 'PowerHouse',
    performances: {
      'Développé couché': { valeur: 85, statut: 'salle' },
      'Squat': { valeur: 100, statut: 'communaute' },
      'Soulevé de terre': { valeur: 150, statut: 'salle' },
      'Traction prise large': { valeur: 15, statut: 'communaute' },
      'Dips': { valeur: 30, statut: 'salle' },
    },
  },
];

// ----- Duels (charge fixe, le plus de reps gagne — premier à 2 victoires) -----
// Round 1 : choisi par le challenger. Round 2 : par l'autre. Round 3 : par l'IA.
// choisiPar : 'moi' | 'lui' | 'ia'. exercice null = round pas encore défini.
export const duels = [
  {
    id: 1,
    adversaire: 'IronMax',
    recompense: 150,
    statut: 'en cours', // 1 — 1, départage à jouer
    rounds: [
      { exercice: 'Développé couché', charge: 80, choisiPar: 'moi', mesReps: 12, sesReps: 9 },
      { exercice: 'Squat', charge: 100, choisiPar: 'lui', mesReps: 8, sesReps: 11 },
      { exercice: null, charge: null, choisiPar: 'ia', mesReps: null, sesReps: null },
    ],
  },
  {
    id: 2,
    adversaire: 'KenzoLift',
    recompense: 200,
    statut: 'gagné', // 2 — 0, pas besoin de départage
    rounds: [
      { exercice: 'Curl barre', charge: 30, choisiPar: 'lui', mesReps: 14, sesReps: 10 },
      { exercice: 'Rowing planche', charge: 60, choisiPar: 'moi', mesReps: 13, sesReps: 11 },
      { exercice: null, charge: null, choisiPar: 'ia', mesReps: null, sesReps: null },
    ],
  },
];

// ----- Défis récurrents (points + titres) -----
export const defiJournalier = {
  id: 'jour',
  titre: 'Défi du jour',
  description: 'Fais une séance aujourd\'hui (minimum 30 minutes).',
  points: 20,
};

export const defiHebdo = {
  id: 'semaine',
  titre: 'Défi de la semaine',
  description: 'Cumule 4 séances cette semaine.',
  points: 100,
  titreRecompense: 'Guerrier de la semaine',
};
