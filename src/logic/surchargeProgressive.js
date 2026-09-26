// Surcharge progressive : aider l'utilisateur à progresser d'une séance à
// l'autre, à partir de son historique de séances loggées.
//
// TOUT SE CALCULE ICI, CÔTÉ APP : ces fonctions ne lisent que la liste
// `entrainements` déjà chargée par l'écran Entraînement. Aucun appel au
// serveur — une aide affichée pendant la séance ne doit pas dépendre du
// réseau, et surtout pas attendre une réponse entre deux séries.
//
// Rappel du format : un entraînement = { date: 'AAAA-MM-JJ', series: [
//   { exercice, numero_serie, reps, poids }, ... ] }

// Les séances (plus récentes d'abord) où cet exercice a été fait.
// `avantDate` exclut la séance en cours (on ne se compare pas à soi-même).
function seancesAvec(entrainements, exercice, avantDate = null) {
  // Garde-fous ajoutés le 06/09/2026 (audit) : une séance sans `series`, ou un
  // trou dans la liste, faisait planter la suggestion de charge — donc tout
  // l'écran de séance, au moment précis où l'on s'entraîne. Ces trois aides
  // (suggestion, record, stagnation) sont du CONFORT : elles doivent se taire
  // sur une donnée incomplète, jamais casser la séance en cours.
  return (entrainements || [])
    .filter((e) => e && Array.isArray(e.series)
      && (!avantDate || e.date < avantDate)
      && e.series.some((s) => s && s.exercice === exercice))
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
// LES AXES DE PROGRESSION (24/09/2026).
// Demande de Hafiz : « les perfs attendues à la prochaine séance devront être
// cohérentes avec le type de progressive overload qu'on a choisi pour les
// exercices : les séries, les reps ou le poids. On peut choisir un ou un
// mélange des 3. »
//
// Par défaut on garde la DOUBLE PROGRESSION d'origine (reps puis poids) :
// c'est ce que faisait l'app depuis le 12/08/2026, et un exercice sans réglage
// ne doit pas changer de comportement du jour au lendemain.
export const AXES_PROGRESSION = ['series', 'reps', 'poids'];
export const AXES_PAR_DEFAUT = ['reps', 'poids'];

// UN SEUL AXE AVANCE À LA FOIS, dans cet ordre : séries → reps → poids.
// Pourquoi cet ordre : ajouter une série puis des reps se fait à charge égale
// (le corps encaisse le volume avant l'intensité) ; on ne monte la charge que
// lorsque les objectifs du programme sont tenus. C'est la « triple
// progression » classique, dont la double progression n'est qu'un cas
// particulier — d'où un seul chemin de code pour les deux.
function axesValides(modes) {
  if (!Array.isArray(modes)) return AXES_PAR_DEFAUT;
  const gardes = AXES_PROGRESSION.filter((axe) => modes.includes(axe));
  return gardes.length > 0 ? gardes : AXES_PAR_DEFAUT;
}

export function suggererProchaineSerie(entrainements, exercice, repsCibles, options = {}) {
  // Rétrocompatibilité : le 4e paramètre était autrefois `avantDate`.
  const reglages = typeof options === 'string' || options === null
    ? { avantDate: options } : (options || {});
  const { avantDate = null, modes, seriesCibles = null } = reglages;
  const axes = axesValides(modes);

  const precedentes = seancesAvec(entrainements, exercice, avantDate);
  if (precedentes.length === 0) return null;
  const seriesExercice = precedentes[0].series.filter((s) => s.exercice === exercice);
  const meilleure = meilleureSerie(seriesExercice);
  if (!meilleure) return null;

  const cible = repsCibles && repsCibles > 0 ? repsCibles : 8;
  const seriesFaites = seriesExercice.length;
  const cibleSeries = seriesCibles && seriesCibles > 0 ? seriesCibles : null;
  const increment = incrementCharge(meilleure.poids);
  // Poids du corps : la charge ne peut pas monter, quoi qu'on ait coché.
  const peutCharger = axes.includes('poids') && increment > 0;
  // `series` n'est renseigné QUE si l'axe des séries est choisi : sinon,
  // afficher « 10 séries » ressemblerait à une consigne alors qu'on n'a rien
  // demandé de tel. Ce qui ne progresse pas ne s'affiche pas.
  const series = axes.includes('series') ? seriesFaites : null;
  const base = { poids: meilleure.poids, reps: meilleure.reps, series };

  // 1) Une série de plus, à charge et reps égales.
  if (axes.includes('series') && (cibleSeries === null || seriesFaites < cibleSeries)) {
    return {
      ...base, series: seriesFaites + 1,
      raison: `ajoute une série : ${seriesFaites + 1} × ${meilleure.reps} reps à ${meilleure.poids} kg`,
    };
  }

  // 2) Une répétition de plus, à charge égale, jusqu'à l'objectif du programme.
  if (axes.includes('reps') && meilleure.reps < cible) {
    return {
      ...base, reps: meilleure.reps + 1,
      raison: peutCharger
        ? `vise ${cible} reps à ${meilleure.poids} kg avant de charger`
        : `vise ${cible} reps à ${meilleure.poids} kg`,
    };
  }

  // 3) Plus lourd — et on repart de l'objectif de reps (et de séries).
  if (peutCharger) {
    return {
      poids: meilleure.poids + increment,
      reps: axes.includes('reps') ? cible : meilleure.reps,
      series: axes.includes('series') ? (cibleSeries || seriesFaites) : null,
      raison: axes.includes('reps')
        ? `objectif de ${cible} reps atteint à ${meilleure.poids} kg`
        : `monte la charge : +${increment} kg`,
    };
  }

  // 4) Plus de charge possible (poids du corps, ou axe non coché) : les reps
  // restent le seul levier si elles sont autorisées.
  if (axes.includes('reps')) {
    return {
      ...base, reps: meilleure.reps + 1,
      raison: `tu as tenu ${meilleure.reps} reps — vise une de plus`,
    };
  }

  // 5) Tous les objectifs sont tenus et rien d'autre n'est autorisé à bouger.
  return {
    ...base,
    raison: `objectifs tenus : ${seriesFaites} × ${meilleure.reps} reps à ${meilleure.poids} kg`,
  };
}

// RECORD PERSONNEL : la série la plus lourde jamais faite sur cet exercice.
// Renvoie { poids, reps, date } ou null si jamais fait.
export function recordPersonnel(entrainements, exercice) {
  let record = null;
  // Mêmes garde-fous que `seancesAvec` : une séance incomplète ne doit pas
  // faire tomber l'écran (audit du 06/09/2026).
  (entrainements || []).forEach((entrainement) => {
    if (!entrainement || !Array.isArray(entrainement.series)) return;
    entrainement.series
      .filter((s) => s && s.exercice === exercice)
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
  (entrainements || []).forEach((e) => {
    if (!e || !Array.isArray(e.series)) return;
    e.series.forEach((s) => { if (s && s.exercice) exercices.add(s.exercice); });
  });
  return [...exercices]
    .map((exercice) => ({ exercice, ...recordPersonnel(entrainements, exercice) }))
    .sort((a, b) => b.poids - a.poids);
}
