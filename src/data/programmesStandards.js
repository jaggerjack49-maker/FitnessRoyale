// Modèles de programmes STANDARDS — proposés dans l'onglet Entraînement.
//
// Un modèle = une organisation de la semaine éprouvée (Push Pull Legs, Full
// Body…) : en l'appliquant, l'app crée d'un coup TOUS les programmes du modèle
// (ex. Push + Pull + Legs), chacun avec ses jours de la semaine pré-remplis.
// L'utilisateur peut ensuite les modifier/supprimer comme n'importe quel
// programme créé à la main — le modèle n'est qu'un point de départ.
//
// Les exercices sont en texte libre (comme tout l'onglet Entraînement) :
// AUCUN lien avec le barème Fitness Royale ni le classement.

export const programmesStandards = [
  {
    id: 'ppl6',
    nom: 'Push Pull Legs — 6 jours',
    emoji: '🔥',
    description:
      "Le classique : pousser (pectoraux/épaules/triceps), tirer (dos/biceps), jambes — chaque famille travaillée 2 fois par semaine.",
    seances: [
      {
        nom: 'Push',
        jours: ['lundi', 'jeudi'],
        exercices: [
          { exercice: 'Développé couché', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Développé militaire', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Développé incliné haltères', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Élévations latérales', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Dips', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Extensions triceps poulie', series_cibles: 3, reps_cibles: 12 },
        ],
      },
      {
        nom: 'Pull',
        jours: ['mardi', 'vendredi'],
        exercices: [
          { exercice: 'Tractions', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Rowing barre', series_cibles: 4, reps_cibles: 10 },
          { exercice: 'Tirage horizontal', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Face pull', series_cibles: 3, reps_cibles: 15 },
          { exercice: 'Curl biceps barre', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Curl marteau', series_cibles: 3, reps_cibles: 12 },
        ],
      },
      {
        nom: 'Legs',
        jours: ['mercredi', 'samedi'],
        exercices: [
          { exercice: 'Squat', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Presse à cuisses', series_cibles: 4, reps_cibles: 10 },
          { exercice: 'Soulevé de terre jambes tendues', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Fentes marchées', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Leg curl', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Mollets debout', series_cibles: 4, reps_cibles: 15 },
        ],
      },
    ],
  },
  {
    id: 'ppl3',
    nom: 'Push Pull Legs — 3 jours',
    emoji: '💼',
    description:
      'La même logique Push/Pull/Legs, mais une seule fois par semaine — idéal si tu as peu de temps.',
    seances: [
      {
        nom: 'Push',
        jours: ['lundi'],
        exercices: [
          { exercice: 'Développé couché', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Développé militaire', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Élévations latérales', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Extensions triceps poulie', series_cibles: 3, reps_cibles: 12 },
        ],
      },
      {
        nom: 'Pull',
        jours: ['mercredi'],
        exercices: [
          { exercice: 'Tractions', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Rowing barre', series_cibles: 4, reps_cibles: 10 },
          { exercice: 'Face pull', series_cibles: 3, reps_cibles: 15 },
          { exercice: 'Curl biceps barre', series_cibles: 3, reps_cibles: 10 },
        ],
      },
      {
        nom: 'Legs',
        jours: ['vendredi'],
        exercices: [
          { exercice: 'Squat', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Presse à cuisses', series_cibles: 4, reps_cibles: 10 },
          { exercice: 'Leg curl', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Mollets debout', series_cibles: 4, reps_cibles: 15 },
        ],
      },
    ],
  },
  {
    id: 'fullbody3',
    nom: 'Full Body — 3 jours',
    emoji: '🧱',
    description:
      'Tout le corps à chaque séance, 3 fois par semaine — parfait pour débuter et progresser vite.',
    seances: [
      {
        nom: 'Full Body',
        jours: ['lundi', 'mercredi', 'vendredi'],
        exercices: [
          { exercice: 'Squat', series_cibles: 3, reps_cibles: 8 },
          { exercice: 'Développé couché', series_cibles: 3, reps_cibles: 8 },
          { exercice: 'Rowing barre', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Développé militaire', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Tractions', series_cibles: 3, reps_cibles: 8 },
          { exercice: 'Curl biceps barre', series_cibles: 3, reps_cibles: 12 },
        ],
      },
    ],
  },
  {
    id: 'upperlower4',
    nom: 'Upper / Lower — 4 jours',
    emoji: '⚖️',
    description:
      'Haut du corps / bas du corps en alternance, 2 fois chacun par semaine — bon équilibre volume/récupération.',
    seances: [
      {
        nom: 'Upper (haut du corps)',
        jours: ['lundi', 'jeudi'],
        exercices: [
          { exercice: 'Développé couché', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Rowing barre', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Développé militaire', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Tractions', series_cibles: 3, reps_cibles: 8 },
          { exercice: 'Curl biceps barre', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Extensions triceps poulie', series_cibles: 3, reps_cibles: 12 },
        ],
      },
      {
        nom: 'Lower (bas du corps)',
        jours: ['mardi', 'vendredi'],
        exercices: [
          { exercice: 'Squat', series_cibles: 4, reps_cibles: 8 },
          { exercice: 'Soulevé de terre roumain', series_cibles: 3, reps_cibles: 10 },
          { exercice: 'Presse à cuisses', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Leg curl', series_cibles: 3, reps_cibles: 12 },
          { exercice: 'Mollets debout', series_cibles: 4, reps_cibles: 15 },
        ],
      },
    ],
  },
];

// Jours de la semaine, dans l'ordre français — utilisés par les puces de
// sélection ET le calendrier (mêmes noms que le backend, voir JOURS_SEMAINE
// dans backend/app/main.py).
export const joursSemaine = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Abréviations pour les puces (L M M J V S D serait ambigu — on garde 2-3 lettres).
export const abreviationsJours = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu',
  vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
};

// Le nom français du jour d'une date JS (getDay() : 0 = dimanche … 6 = samedi).
export function jourDeLaDate(date) {
  return joursSemaine[(date.getDay() + 6) % 7];
}
