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

// ---- LE COACH (16/11/2026) : le RIR noté et la décharge ----
// Demande de Hafiz (« le 3 » de la liste des grands chantiers) : utiliser le
// RIR qu'il note à chaque série, et proposer une décharge quand il cale.
//
// LE RIR (« reps in reserve ») = les répétitions qu'on avait encore en
// réserve. Le seuil vient du programme (`rir_cible`, l'effort VISÉ) ; sans
// objectif fixé, on vise RIR 1 : une série menée jusqu'à l'échec (RIR 0) ne
// dit pas qu'on est prêt à charger, elle dit qu'on était au maximum.
export const RIR_VISE_PAR_DEFAUT = 1;
// Une réserve d'au moins 3 reps AU-DESSUS du seuil = la charge était trop
// légère : on saute d'un cran de plus.
export const RESERVE_LARGE = 3;
// Combien de séances au même poids, sans une rep gagnée, avant de parler de
// blocage. Et de combien on allège : 10 %, arrondi au cran de charge.
export const SEANCES_BLOCAGE = 3;
export const ALLEGEMENT_DECHARGE = 0.1;

// L'OBJECTIF DE REPS QUAND C'EST UNE FOURCHETTE (« 5 - 10 ») : on vise le
// HAUT. C'est la double progression classique — on grimpe dans la fourchette
// à charge égale, et on ne monte la charge qu'une fois le haut tenu.
// (Déplacée ici le 16/11/2026 depuis projectionProgramme.js, qui la réexporte :
// la séance et les « Attendu » visaient le BAS de la fourchette pendant que le
// tableau visait le haut — deux réponses pour un même exercice.)
export function cibleDeReps(repsCibles, repsCiblesMax) {
  const bas = Number(repsCibles);
  const haut = Number(repsCiblesMax);
  if (Number.isFinite(haut) && haut > 0) {
    return Number.isFinite(bas) && bas > haut ? bas : haut;
  }
  return Number.isFinite(bas) && bas > 0 ? bas : null;
}

// Un RIR lisible (entier de 0 à 10), sinon null : une valeur absente ou
// abîmée ne doit RIEN changer à la suggestion.
function rirValide(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = Number(valeur);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

// LA RÉSERVE de la dernière séance : le PLUS PETIT RIR noté sur les séries
// faites à la charge la plus lourde — la série la plus dure dit la vérité.
// null si aucun RIR n'a été noté à cette charge (on ne suppose rien).
export function reserveDerniereSeance(series, poids) {
  const notes = (Array.isArray(series) ? series : [])
    .filter((s) => s && Number(s.poids) === Number(poids))
    .map((s) => rirValide(s.rir))
    .filter((r) => r !== null);
  return notes.length > 0 ? Math.min(...notes) : null;
}

// BLOQUÉ ? Sur les `SEANCES_BLOCAGE` dernières séances de l'exercice, la
// charge la plus lourde est EXACTEMENT la même, et la plus récente n'a pas
// gagné une seule rep sur la plus ancienne.
// ⚠️ « Exactement la même charge » et pas « pas plus lourde » : une séance de
// décharge (plus légère) casse la série. Sans ça, à peine revenu à 100 kg
// après une décharge, deux séances difficiles suffiraient à en reproposer une
// (la décharge, plus légère, compterait comme la 3e) : on descendrait sans
// fin. Il faut 3 NOUVELLES séances à la même charge.
function estBloque(precedentes, exercice) {
  const dernieres = precedentes.slice(0, SEANCES_BLOCAGE);
  if (dernieres.length < SEANCES_BLOCAGE) return false;
  const tetes = dernieres.map((e) => meilleureSerie(
    e.series.filter((s) => s && s.exercice === exercice)));
  if (tetes.some((t) => !t || !(Number(t.poids) > 0))) return false;
  if (tetes.some((t) => Number(t.poids) !== Number(tetes[0].poids))) return false;
  return Number(tetes[0].reps) <= Number(tetes[tetes.length - 1].reps);
}

// La charge d'une décharge : 10 % de moins, arrondie au cran de charge, et
// toujours STRICTEMENT plus légère (sinon ce ne serait pas une décharge).
function chargeAllegee(poids) {
  const cran = incrementCharge(poids) || 1;
  let allegee = Math.round((poids * (1 - ALLEGEMENT_DECHARGE)) / cran) * cran;
  if (allegee >= poids) allegee = poids - cran;
  return Math.max(0, Math.round(allegee * 100) / 100);
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
  const { avantDate = null, modes, seriesCibles = null, rirCible = null } = reglages;
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

  // ---- LE RIR (16/11/2026) ----
  const seuilRir = rirValide(rirCible) ?? RIR_VISE_PAR_DEFAUT;
  const reserve = reserveDerniereSeance(seriesExercice, meilleure.poids);
  // La charge devrait monter (objectifs tenus)… mais la dernière séance était
  // plus dure que l'effort visé : on refait la même charge.
  const objectifsTenus = (!axes.includes('series') || cibleSeries === null
    || seriesFaites >= cibleSeries)
    && (!axes.includes('reps') || meilleure.reps >= cible);
  const tropDur = reserve !== null && reserve < seuilRir;

  // ---- LA DÉCHARGE (16/11/2026) : bloqué, ET la règle ne chargerait pas ----
  // Si les objectifs sont tenus et que l'effort le permet, on n'est pas
  // « bloqué » : on n'a juste pas encore chargé — la règle normale s'en
  // occupe. On ne propose d'alléger que quand on ne PASSE plus.
  if (peutCharger && (!objectifsTenus || tropDur)
    && estBloque(precedentes, exercice)) {
    const allegee = chargeAllegee(meilleure.poids);
    return {
      poids: allegee,
      reps: axes.includes('reps') ? cible : meilleure.reps,
      series,
      decharge: true,
      raison: `bloqué à ${meilleure.poids} kg depuis ${SEANCES_BLOCAGE} séances : `
        + `allège à ${allegee} kg pour repartir`,
    };
  }

  // Objectifs tenus mais effort trop dur : on CONSOLIDE la charge.
  if (peutCharger && objectifsTenus && tropDur) {
    return {
      ...base,
      series: axes.includes('series') ? (cibleSeries || seriesFaites) : null,
      raison: `tu étais à RIR ${reserve} (visé : ${seuilRir}) — `
        + `refais ${meilleure.poids} kg avant de charger`,
    };
  }

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
  // Une GRANDE réserve (16/11/2026) : la charge était trop légère, on saute
  // d'un cran de plus — en le disant.
  if (peutCharger && reserve !== null && reserve >= seuilRir + RESERVE_LARGE) {
    return {
      poids: meilleure.poids + 2 * increment,
      reps: axes.includes('reps') ? cible : meilleure.reps,
      series: axes.includes('series') ? (cibleSeries || seriesFaites) : null,
      raison: `il te restait ${reserve} reps en réserve : +${2 * increment} kg`,
    };
  }
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

// LA SUGGESTION D'UN EXERCICE DE PROGRAMME — UNE SEULE façon de lire ses
// objectifs (16/11/2026). Avant, la séance et les « Attendu » visaient le BAS
// d'une fourchette de reps pendant que le tableau visait le HAUT, et aucun ne
// connaissait le RIR visé. Tous les écrans passent maintenant par ici.
export function suggestionPourExercice(entrainements, exo, options = {}) {
  if (!exo || typeof exo.exercice !== 'string') return null;
  return suggererProchaineSerie(entrainements, exo.exercice,
    cibleDeReps(exo.reps_cibles, exo.reps_cibles_max), {
      seriesCibles: exo.series_cibles,
      rirCible: exo.rir_cible,
      ...options,
    });
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
