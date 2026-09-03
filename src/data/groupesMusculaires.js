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

// Met un nom d'exercice sous une forme comparable : minuscules, SANS ACCENTS,
// et toute la ponctuation remplacée par des espaces. « Leg-curl », « leg curl »
// et « LEG CURL » deviennent donc la même chose.
function normaliser(texte) {
  return (texte || '')
    .toLowerCase()
    .normalize('NFD')
    // ̀-ͯ = les accents détachés par NFD, écrits en échappement
    // plutôt qu'en caractères réels : invisibles dans un éditeur, ils se
    // perdent au premier copier-coller malchanceux.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')       // ponctuation, tirets… -> espace
    .trim();
}

// Un mot-clé ne correspond que s'il apparaît en MOT ENTIER (ou en suite de
// mots entiers), avec un pluriel toléré sur chacun.
//
// ⚠️ C'EST LE CŒUR DU CORRECTIF DU 03/09/2026. Avant, on cherchait le mot-clé
// n'importe où dans le texte (`texte.includes(mot)`), ce qui produisait des
// classements absurdes et silencieux :
//   - « uni-LAT-éral raises » était rangé dans le DOS, à cause du mot-clé
//     « lat » (prévu pour « lat pulldown ») — d'où des séries d'épaules qui
//     n'apparaissaient jamais dans Épaules ;
//   - « ab-DOS » était rangé dans le Dos, pour la même raison.
// Un fragment de mot ne suffit plus : il faut le mot en entier.
function contientExpression(texteNormalise, motCle) {
  const mots = normaliser(motCle).split(' ').filter(Boolean);
  if (mots.length === 0) return false;
  // Après normalisation il ne reste que [a-z0-9 ] : rien à échapper.
  const motif = mots.map((mot) => `${mot}s?`).join(' ');
  return new RegExp(`(^| )${motif}( |$)`).test(texteNormalise);
}

// ORDRE IMPORTANT : la première règle qui correspond gagne. Les expressions
// les plus SPÉCIFIQUES doivent donc venir avant les plus générales — sinon
// « leg curl » (ischios) serait attrapé par « curl » (biceps), « calf raise »
// (mollets) par « raise » (épaules), et « soulevé de terre jambes tendues »
// (ischios) par « soulevé de terre » (dos).
//
// Le vocabulaire est FRANÇAIS ET ANGLAIS : Hafiz nomme ses exercices en
// anglais (« unilateral raises », « overhead triceps extension », « leg
// curl »), et une liste uniquement française les laissait non classés.
const reglesDetection = [
  // --- Pièges connus, à trancher AVANT les règles générales ---
  { groupe: 'Ischio-jambiers', motsCles: [
    'leg curl', 'legcurl', 'hamstring', 'ischio', 'jambes tendues',
    'roumain', 'romanian', 'rdl', 'good morning'] },
  { groupe: 'Mollets', motsCles: ['mollet', 'calf', 'calve', 'calf raise'] },
  { groupe: 'Abdos', motsCles: [
    'leg raise', 'knee raise', 'releve de jambes', 'hanging leg raise'] },
  { groupe: 'Quadriceps', motsCles: [
    'leg extension', 'extension jambes', 'leg press', 'hack squat', 'presse',
    'fente', 'lunge', 'squat', 'pistol', 'quadriceps', 'quad'] },
  { groupe: 'Fessiers', motsCles: [
    'hip thrust', 'fessier', 'glute', 'soulevé de terre sumo', 'sumo deadlift'] },

  // --- Haut du corps ---
  { groupe: 'Triceps', motsCles: [
    'triceps', 'tricep', 'barre au front', 'kickback', 'skull', 'pushdown',
    'overhead extension'] },
  { groupe: 'Biceps', motsCles: ['biceps', 'bicep', 'curl', 'marteau', 'hammer', 'preacher'] },
  { groupe: 'Épaules', motsCles: [
    'militaire', 'military press', 'elevation', 'raise', 'lateral raise',
    'front raise', 'side raise', 'face pull', 'oiseau', 'epaule', 'arnold',
    'shoulder', 'overhead press', 'ohp', 'delt', 'upright row'] },
  { groupe: 'Pectoraux', motsCles: [
    'developpe couche', 'developpe incline', 'decline', 'ecarte', 'pec deck',
    'pectoraux', 'pompe', 'push up', 'pushup', 'dips', 'dip', 'butterfly',
    'fly', 'flye', 'bench press', 'bench', 'chest'] },
  { groupe: 'Dos', motsCles: [
    'traction', 'rowing', 'row', 'tirage', 'pulldown', 'pull down', 'pull up',
    'pullup', 'chin up', 'chinup', 'pull over', 'pullover', 'soulevé de terre',
    'souleve de terre', 'deadlift', 'dos', 'lat', 'shrug', 'trapeze', 'trap'] },
  { groupe: 'Avant-bras', motsCles: ['avant bras', 'poignet', 'forearm', 'wrist'] },

  // --- Reste ---
  { groupe: 'Abdos', motsCles: [
    'abdo', 'abs', 'gainage', 'crunch', 'planche', 'plank', 'sit up', 'situp',
    'russian twist'] },
  { groupe: 'Cardio', motsCles: [
    'course', 'cardio', 'velo', 'bike', 'rameur', 'rower', 'corde a sauter',
    'jump rope', 'tapis', 'treadmill', 'elliptique', 'elliptical', 'running'] },
];

// Devine le groupe musculaire d'un exercice écrit en texte libre.
// Renvoie null si aucun mot-clé ne correspond (à l'utilisateur de préciser).
export function deviner_groupe(nomExercice) {
  const texte = normaliser(nomExercice);
  for (const regle of reglesDetection) {
    if (regle.motsCles.some((mot) => contientExpression(texte, mot))) return regle.groupe;
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

// TOUS les exercices loggés sur la période, avec le groupe où ils sont
// actuellement comptés (null = nulle part).
// Sert à l'écran de correction : on doit pouvoir reclasser un exercice MAL
// rangé, pas seulement un exercice non reconnu (sans ça, « unilateral raises »
// classé à tort dans le Dos était impossible à corriger).
export function exercicesDeLaPeriode(entrainements, corrections, debutISO, finISO) {
  const parNom = new Map();
  entrainements.forEach((entrainement) => {
    if (entrainement.date < debutISO || entrainement.date > finISO) return;
    entrainement.series.forEach((serie) => {
      if (parNom.has(serie.exercice)) return;
      parNom.set(serie.exercice, {
        exercice: serie.exercice,
        groupe: groupeDeLExercice(serie.exercice, corrections),
        corrige: !!corrections[serie.exercice],
      });
    });
  });
  return [...parNom.values()].sort((a, b) => a.exercice.localeCompare(b.exercice));
}
