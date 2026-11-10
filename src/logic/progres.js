// L'ÉCRAN « PROGRÈS » — statistiques et courbes, logique pure et testable
// (demande de Hafiz du 08/11/2026 : « au niveau de historique et records on
// devrait renommer ça en progrès, il va regrouper les statistiques avec aussi
// la possibilité de voir les performances sous forme de graphique »).
//
// Tout se calcule depuis les séances DÉJÀ chargées (`entrainements`) : aucun
// endpoint, aucune table. Même parti pris que les records, le volume ou le
// rattrapage — ce qui se recalcule tout seul ne peut pas se désynchroniser.
// Rien ici ne touche à React : ces règles tournent sous Node dans
// `backend/tests/harnais/harnais_progres.mjs`.
//
// DATES : une date « AAAA-MM-JJ » est un JOUR, pas un instant. Tous les calculs
// de semaine passent par Date.UTC, pour ne dépendre ni du fuseau ni du
// changement d'heure (le piège documenté avec le bloc, 06/10/2026).

const JOUR_MS = 24 * 3600 * 1000;

function enJours(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? Math.round(t / JOUR_MS) : null;
}

function depuisJours(n) {
  return new Date(n * JOUR_MS).toISOString().slice(0, 10);
}

// Le lundi de la semaine d'une date (« 2026-11-08 », un dimanche → « 2026-11-02 »).
export function lundiISO(iso) {
  const n = enJours(iso);
  if (n === null) return null;
  // 01/01/1970 était un JEUDI : (n + 3) % 7 donne 0 pour un lundi.
  const decalage = ((n + 3) % 7 + 7) % 7;
  return depuisJours(n - decalage);
}

// Les séances lisibles seulement : une séance abîmée ne doit jamais faire
// tomber l'écran (audit du 06/09/2026).
function seancesValides(entrainements) {
  return (Array.isArray(entrainements) ? entrainements : [])
    .filter((e) => e && enJours(e.date) !== null && Array.isArray(e.series));
}

function seriesValides(seance) {
  return seance.series.filter((s) => s && typeof s.exercice === 'string'
    && Number.isFinite(Number(s.reps)) && Number(s.reps) > 0);
}

// ---------------------------------------------------------------------------
// LE 1RM ESTIMÉ
// ---------------------------------------------------------------------------
// La charge qu'on soulèverait UNE fois, déduite d'une série : formule d'Epley,
// poids × (1 + reps / 30). C'est ce qui permet de comparer « 100 kg × 8 » et
// « 110 kg × 4 » sur une même courbe. Arrondi au demi-kilo. Au-delà de 12 reps
// la formule devient très approximative — on l'utilise quand même, la courbe
// reste une TENDANCE, et l'écran le dit.
export function e1rm(poids, reps) {
  const p = Number(poids);
  const r = Number(reps);
  if (!Number.isFinite(p) || !Number.isFinite(r) || p <= 0 || r <= 0) return 0;
  if (r === 1) return p;
  return Math.round(p * (1 + r / 30) * 2) / 2;
}

// ---------------------------------------------------------------------------
// LES EXERCICES À PROPOSER POUR LA COURBE
// ---------------------------------------------------------------------------
// Les plus pratiqués d'abord (nombre de séances où on les a faits), puis le plus
// récent. Le NOM est l'identifiant (voir CLAUDE.md, 04/09/2026).
export function exercicesSuivis(entrainements) {
  const parNom = new Map();
  for (const seance of seancesValides(entrainements)) {
    const noms = new Set(seriesValides(seance).map((s) => s.exercice));
    for (const nom of noms) {
      const actuel = parNom.get(nom) || { exercice: nom, nbSeances: 0, derniere: '' };
      actuel.nbSeances += 1;
      if (seance.date > actuel.derniere) actuel.derniere = seance.date;
      parNom.set(nom, actuel);
    }
  }
  return [...parNom.values()].sort((a, b) => b.nbSeances - a.nbSeances
    || (a.derniere < b.derniere ? 1 : a.derniere > b.derniere ? -1 : 0)
    || a.exercice.localeCompare(b.exercice));
}

// ---------------------------------------------------------------------------
// LA COURBE D'UN EXERCICE
// ---------------------------------------------------------------------------
// Un point par JOUR où l'exercice a été fait (deux séances le même jour n'en
// font qu'un : on garde le meilleur, ou on additionne pour le volume), du plus
// ancien au plus récent. Trois mesures :
//   'charge' — la charge la plus lourde du jour ;
//   'e1rm'   — le meilleur 1RM estimé du jour ;
//   'volume' — Σ charge × reps du jour.
// Exercice AU POIDS DU CORPS (aucune charge jamais notée) : les trois mesures
// basculent sur les RÉPÉTITIONS (max du jour, ou total pour le volume) —
// sinon la courbe serait une ligne plate à 0. `unite` le dit à l'écran.
export function courbeExercice(entrainements, exercice, mesure = 'charge') {
  const parJour = new Map();
  for (const seance of seancesValides(entrainements)) {
    for (const s of seriesValides(seance)) {
      if (s.exercice !== exercice) continue;
      const liste = parJour.get(seance.date) || [];
      liste.push({ poids: Math.max(0, Number(s.poids) || 0), reps: Number(s.reps) });
      parJour.set(seance.date, liste);
    }
  }
  const toutes = [...parJour.values()].flat();
  const auPoidsDuCorps = toutes.length > 0 && toutes.every((s) => s.poids === 0);
  const unite = auPoidsDuCorps ? 'reps' : 'kg';

  const points = [...parJour.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, series]) => {
      // La meilleure série du jour : la plus lourde, puis la plus longue.
      const meilleure = series.reduce((m, s) => (!m || s.poids > m.poids
        || (s.poids === m.poids && s.reps > m.reps) ? s : m), null);
      let valeur;
      if (auPoidsDuCorps) {
        valeur = mesure === 'volume'
          ? series.reduce((t, s) => t + s.reps, 0)
          : Math.max(...series.map((s) => s.reps));
      } else if (mesure === 'e1rm') {
        valeur = Math.max(...series.map((s) => e1rm(s.poids, s.reps)));
      } else if (mesure === 'volume') {
        valeur = series.reduce((t, s) => t + s.poids * s.reps, 0);
      } else {
        valeur = meilleure.poids;
      }
      const detail = auPoidsDuCorps
        ? `${series.length} série${series.length > 1 ? 's' : ''} · max ${meilleure.reps} reps`
        : `${String(meilleure.poids).replace('.', ',')} kg × ${meilleure.reps} · ${series.length} série${series.length > 1 ? 's' : ''}`;
      return { date, valeur: Math.round(valeur * 10) / 10, detail };
    });
  return { points, unite };
}

// L'évolution entre le premier et le dernier point de la courbe.
// null s'il n'y a pas au moins deux points (rien à comparer).
export function variation(points) {
  const liste = Array.isArray(points) ? points.filter((p) => p && Number.isFinite(p.valeur)) : [];
  if (liste.length < 2) return null;
  const debut = liste[0];
  const fin = liste[liste.length - 1];
  const ecart = Math.round((fin.valeur - debut.valeur) * 10) / 10;
  const pourcent = debut.valeur > 0 ? Math.round((ecart / debut.valeur) * 100) : null;
  return { depuis: debut.date, ecart, pourcent };
}

// ---------------------------------------------------------------------------
// L'ACTIVITÉ SEMAINE PAR SEMAINE
// ---------------------------------------------------------------------------
// Le nombre de JOURS entraînés par semaine (lundi → dimanche), des `nbSemaines`
// dernières semaines, la semaine en cours comprise et en dernier. Des jours et
// non des séances : deux séances le même jour comptent pour une, comme le
// compteur du Profil et les défis (« un jour = une séance », 24/09/2026).
export function seancesParSemaine(entrainements, aujourdhuiISO, nbSemaines = 12) {
  const lundiCourant = enJours(lundiISO(aujourdhuiISO));
  const n = Math.max(1, Math.min(52, Math.floor(Number(nbSemaines) || 12)));
  if (lundiCourant === null) return [];
  const jours = new Set(seancesValides(entrainements)
    .filter((e) => seriesValides(e).length > 0)
    .map((e) => e.date));
  const semaines = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const debut = lundiCourant - 7 * i;
    let nb = 0;
    for (let j = 0; j < 7; j += 1) if (jours.has(depuisJours(debut + j))) nb += 1;
    semaines.push({ lundi: depuisJours(debut), nb });
  }
  return semaines;
}

// ---------------------------------------------------------------------------
// LES CHIFFRES CLÉS
// ---------------------------------------------------------------------------
//   joursEntraines   — nombre de jours où au moins une série a été notée ;
//   seriesTotal      — toutes les séries notées ;
//   moyenneSemaine   — jours entraînés par semaine, sur les 8 dernières
//                      semaines TERMINÉES (la semaine en cours n'est pas finie,
//                      elle ferait baisser la moyenne chaque lundi) ;
//   semainesDAffilee — semaines consécutives avec au moins un entraînement, en
//                      remontant depuis la semaine en cours (si elle est encore
//                      vide, on part de la précédente : la semaine n'est pas
//                      finie, la série n'est pas encore cassée) ;
//   volumeMois       — Σ charge × reps du mois civil en cours, en kg ;
//   dureeMoyenne     — minutes, moyenne des séances CHRONOMÉTRÉES seulement
//                      (10/11/2026) : une séance d'avant le chrono n'a pas de
//                      durée, la compter pour 0 ferait mentir la moyenne.
//                      null s'il n'y en a aucune ; `nbChronometrees` dit sur
//                      combien de séances elle porte.
export function statistiques(entrainements, aujourdhuiISO) {
  const seances = seancesValides(entrainements).filter((e) => seriesValides(e).length > 0);
  const jours = new Set(seances.map((e) => e.date));
  const seriesTotal = seances.reduce((t, e) => t + seriesValides(e).length, 0);

  const semaines = seancesParSemaine(seances, aujourdhuiISO, 52);
  const terminees = semaines.slice(-9, -1);
  const moyenneSemaine = terminees.length
    ? Math.round((terminees.reduce((t, s) => t + s.nb, 0) / terminees.length) * 10) / 10
    : 0;

  let semainesDAffilee = 0;
  const ordre = [...semaines].reverse();
  const depart = ordre.length && ordre[0].nb === 0 ? 1 : 0;
  for (let i = depart; i < ordre.length && ordre[i].nb > 0; i += 1) semainesDAffilee += 1;

  const mois = String(aujourdhuiISO || '').slice(0, 7);
  const volumeMois = seances
    .filter((e) => e.date.slice(0, 7) === mois)
    .reduce((t, e) => t + seriesValides(e)
      .reduce((v, s) => v + Math.max(0, Number(s.poids) || 0) * Number(s.reps), 0), 0);

  const durees = seances
    .map((e) => Number(e.duree_minutes))
    .filter((m) => Number.isFinite(m) && m > 0);
  const dureeMoyenne = durees.length
    ? Math.round(durees.reduce((t, m) => t + m, 0) / durees.length)
    : null;

  return {
    joursEntraines: jours.size,
    seriesTotal,
    moyenneSemaine,
    semainesDAffilee,
    volumeMois: Math.round(volumeMois),
    dureeMoyenne,
    nbChronometrees: durees.length,
  };
}

// « 47 min », « 1 h 05 » : la durée d'une séance, telle qu'on la dit.
// Vide si la durée est inconnue — on n'affiche jamais « 0 min ».
export function dureeSeanceLisible(minutes) {
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m) || m <= 0) return '';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

// « 12 450 kg » → « 12,5 t » au-delà de 10 tonnes : un nombre à six chiffres
// ne se lit pas d'un coup d'œil dans une tuile.
export function volumeLisible(kg) {
  const v = Math.max(0, Math.round(Number(kg) || 0));
  if (v >= 10000) return `${String(Math.round(v / 100) / 10).replace('.', ',')} t`;
  return `${v.toLocaleString('fr-FR').replace(/ | /g, ' ')} kg`;
}
