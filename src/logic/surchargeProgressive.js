// Surcharge progressive : aider l'utilisateur à progresser d'une séance à
// l'autre, à partir de son historique de séances loggées.
//
// TOUT SE CALCULE ICI, CÔTÉ APP : ces fonctions ne lisent que la liste
// `entrainements` déjà chargée par l'écran Entraînement. Aucun appel au
// serveur, donc ça marche aussi en mode hors-ligne.
//
// Rappel du format : un entraînement = { date: 'AAAA-MM-JJ', series: [
//   { exercice, numero_serie, reps, poids }, ... ] }

// Les séances (plus récentes d'abord) où cet exercice a été fait.
// `avantDate` exclut la séance en cours (on ne se compare pas à soi-même).
function seancesAvec(entrainements, exercice, avantDate = null) {
  return entrainements
    .filter((e) => (!avantDate || e.date < avantDate)
      && e.series.some((s) => s.exercice === exercice))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

// La série la plus lourde d'une liste (à poids égal, celle qui a le plus de reps).
function meilleureSerie(series) {
  return series.reduce((meilleure, serie) => {
    if (!meilleure) return serie;
    if (serie.poids > meilleure.poids) return serie;
    if (serie.poids === meilleure.poids && serie.reps > meilleure.reps) return serie;
    return meilleure;
  }, null);
}

// De combien on augmente la charge : les petits mouvements (élévations,
// curls légers) ne se chargent pas par bonds de 2,5 kg.
function incrementCharge(poids) {
  if (poids <= 0) return 0;     // exercice au poids du corps : on ajoute des reps
  if (poids < 20) return 1;
  return 2.5;
}

// SUGGESTION pour la séance du jour, en double progression :
// tant que l'objectif de reps n'est pas atteint, on ajoute une rep ;
// une fois atteint, on monte la charge et on repart à l'objectif de reps.
// Renvoie null si l'exercice n'a jamais été fait (rien à quoi se comparer).
export function suggererProchaineSerie(entrainements, exercice, repsCibles, avantDate = null) {
  const precedentes = seancesAvec(entrainements, exercice, avantDate);
  if (precedentes.length === 0) return null;
  const seriesExercice = precedentes[0].series.filter((s) => s.exercice === exercice);
  const meilleure = meilleureSerie(seriesExercice);
  if (!meilleure) return null;

  const cible = repsCibles && repsCibles > 0 ? repsCibles : 8;
  if (meilleure.reps >= cible) {
    const increment = incrementCharge(meilleure.poids);
    if (increment === 0) {
      // Poids du corps : on ne peut que viser plus de répétitions.
      return {
        poids: 0, reps: meilleure.reps + 1,
        raison: `tu as tenu ${meilleure.reps} reps — vise une de plus`,
      };
    }
    return {
      poids: meilleure.poids + increment, reps: cible,
      raison: `objectif de ${cible} reps atteint à ${meilleure.poids} kg`,
    };
  }
  return {
    poids: meilleure.poids, reps: meilleure.reps + 1,
    raison: `vise ${cible} reps à ${meilleure.poids} kg avant de charger`,
  };
}

// RECORD PERSONNEL : la série la plus lourde jamais faite sur cet exercice.
// Renvoie { poids, reps, date } ou null si jamais fait.
export function recordPersonnel(entrainements, exercice) {
  let record = null;
  entrainements.forEach((entrainement) => {
    entrainement.series
      .filter((s) => s.exercice === exercice)
      .forEach((serie) => {
        if (!record
          || serie.poids > record.poids
          || (serie.poids === record.poids && serie.reps > record.reps)) {
          record = { poids: serie.poids, reps: serie.reps, date: entrainement.date };
        }
      });
  });
  return record;
}

// Les séries faites AUJOURD'HUI battent-elles le record ? (badge en direct
// pendant la séance). `record` peut être null : la 1re série devient le record.
export function bat_le_record(seriesDuJour, record) {
  const meilleure = meilleureSerie(seriesDuJour || []);
  if (!meilleure) return false;
  if (!record) return true;
  return meilleure.poids > record.poids
    || (meilleure.poids === record.poids && meilleure.reps > record.reps);
}

// STAGNATION : sur les `seuil` dernières séances de cet exercice, la charge
// maximale n'a jamais dépassé celle de la plus ancienne des trois.
// Renvoie { seances, poids } si ça stagne, sinon null.
export function detecterStagnation(entrainements, exercice, seuil = 3, avantDate = null) {
  const precedentes = seancesAvec(entrainements, exercice, avantDate).slice(0, seuil);
  if (precedentes.length < seuil) return null; // pas assez de recul
  const maxParSeance = precedentes.map((e) =>
    Math.max(...e.series.filter((s) => s.exercice === exercice).map((s) => s.poids))
  );
  const plusAncien = maxParSeance[maxParSeance.length - 1];
  const meilleur = Math.max(...maxParSeance);
  if (meilleur <= plusAncien) return { seances: seuil, poids: plusAncien };
  return null;
}

// Tous les records du joueur, du plus lourd au plus léger — pour la section
// récapitulative « 🏆 Mes records ».
export function tousLesRecords(entrainements) {
  const exercices = new Set();
  entrainements.forEach((e) => e.series.forEach((s) => exercices.add(s.exercice)));
  return [...exercices]
    .map((exercice) => ({ exercice, ...recordPersonnel(entrainements, exercice) }))
    .sort((a, b) => b.poids - a.poids);
}
