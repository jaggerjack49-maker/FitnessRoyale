// Groupes musculaires ("body parts") — servent à fixer un objectif de SÉRIES
// par semaine et à compter les séries réellement faites (onglet Entraînement).
//
// Les exercices étant en TEXTE LIBRE dans l'app, on devine le groupe à partir
// du nom écrit par l'utilisateur (liste de mots-clés ci-dessous). La détection
// n'est jamais parfaite : l'utilisateur peut corriger le groupe d'un exercice,
// et cette correction est enregistrée côté serveur (table groupes_exercices).

export const groupesMusculaires = [
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps',
  'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets',
  'Abdos', 'Avant-bras', 'Cardio',
];

// ORDRE IMPORTANT : la première règle qui correspond gagne. Les expressions
// les plus SPÉCIFIQUES doivent donc venir avant les plus générales — sinon
// « leg curl » (ischios) serait attrapé par « curl » (biceps), et « soulevé de
// terre jambes tendues » (ischios) par « soulevé de terre » (dos).
const reglesDetection = [
  // --- Cas particuliers d'abord (pièges connus) ---
  { groupe: 'Ischio-jambiers', motsCles: ['leg curl', 'legcurl', 'ischio', 'jambes tendues', 'roumain', 'good morning'] },
  { groupe: 'Quadriceps', motsCles: ['leg extension', 'extension jambes', 'hack squat', 'presse', 'fente', 'squat', 'pistol'] },
  { groupe: 'Mollets', motsCles: ['mollet', 'calf'] },
  { groupe: 'Fessiers', motsCles: ['hip thrust', 'fessier', 'glute', 'soulevé de terre sumo'] },

  // --- Haut du corps ---
  { groupe: 'Triceps', motsCles: ['triceps', 'barre au front', 'kickback', 'skull'] },
  { groupe: 'Biceps', motsCles: ['biceps', 'curl', 'marteau'] },
  { groupe: 'Épaules', motsCles: ['militaire', 'élévation', 'elevation', 'face pull', 'oiseau', 'épaule', 'epaule', 'arnold', 'shoulder'] },
  { groupe: 'Pectoraux', motsCles: ['développé couché', 'developpe couche', 'développé incliné', 'developpe incline', 'décliné', 'ecarté', 'écarté', 'pec deck', 'pectoraux', 'pompes', 'dips', 'butterfly'] },
  { groupe: 'Dos', motsCles: ['traction', 'rowing', 'tirage', 'pull-over', 'pull over', 'soulevé de terre', 'souleve de terre', 'deadlift', 'dos', 'lat', 'shrug', 'trapèze'] },
  { groupe: 'Avant-bras', motsCles: ['avant-bras', 'avant bras', 'poignet', 'forearm'] },

  // --- Reste ---
  { groupe: 'Abdos', motsCles: ['abdo', 'gainage', 'crunch', 'planche', 'relevé de jambes', 'russian twist'] },
  { groupe: 'Cardio', motsCles: ['course', 'cardio', 'vélo', 'velo', 'rameur', 'corde à sauter', 'tapis', 'elliptique'] },
];

// Devine le groupe musculaire d'un exercice écrit en texte libre.
// Renvoie null si aucun mot-clé ne correspond (à l'utilisateur de préciser).
export function deviner_groupe(nomExercice) {
  const texte = (nomExercice || '').toLowerCase();
  for (const regle of reglesDetection) {
    if (regle.motsCles.some((mot) => texte.includes(mot))) return regle.groupe;
  }
  return null;
}

// Le groupe RETENU pour un exercice : la correction manuelle de l'utilisateur
// si elle existe, sinon la détection automatique.
// `corrections` = { "nom de l'exercice": "Groupe" }
export function groupeDeLExercice(nomExercice, corrections = {}) {
  return corrections[nomExercice] || deviner_groupe(nomExercice);
}

// ----- Semaine en cours (lundi → dimanche), pour compter le volume -----

// Le lundi de la semaine contenant `date` (objet Date), à midi (à l'abri des
// changements d'heure et des fuseaux).
export function lundiDeLaSemaine(date = new Date()) {
  const jour = (date.getDay() + 6) % 7; // 0 = lundi
  const lundi = new Date(date.getFullYear(), date.getMonth(), date.getDate() - jour, 12);
  return lundi;
}

// Compte les SÉRIES faites par groupe musculaire, sur les entraînements dont
// la date tombe entre debutISO et finISO (inclus).
// Renvoie { Pectoraux: 12, Dos: 8, ... } (groupes sans série absents).
export function compterSeriesParGroupe(entrainements, corrections, debutISO, finISO) {
  const total = {};
  entrainements.forEach((entrainement) => {
    if (entrainement.date < debutISO || entrainement.date > finISO) return;
    entrainement.series.forEach((serie) => {
      const groupe = groupeDeLExercice(serie.exercice, corrections);
      if (!groupe) return; // exercice non classé : compté nulle part
      total[groupe] = (total[groupe] || 0) + 1;
    });
  });
  return total;
}

// Les exercices loggés sur la période qui n'ont PAS de groupe (ni deviné, ni
// corrigé) — l'app les propose à l'utilisateur pour qu'il les classe.
export function exercicesNonClasses(entrainements, corrections, debutISO, finISO) {
  const noms = new Set();
  entrainements.forEach((entrainement) => {
    if (entrainement.date < debutISO || entrainement.date > finISO) return;
    entrainement.series.forEach((serie) => {
      if (!groupeDeLExercice(serie.exercice, corrections)) noms.add(serie.exercice);
    });
  });
  return [...noms];
}
