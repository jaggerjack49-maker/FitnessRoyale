// Nutrition — les calculs de la carte « 🍽 Nutrition » (18/09/2026).
//
// L'analyse d'une photo est faite par le SERVEUR (backend/app/nutrition.py,
// Claude Opus 5). Ce fichier ne contient que ce que l'app calcule elle-même
// pendant que le joueur RELIT l'analyse avant de l'ajouter à son journal :
// totaux du brouillon, ajustement d'une portion, progression vers l'objectif.
// Logique pure, donc testée : backend/tests/test_nutrition_front.py.
//
// Les totaux d'un repas ENREGISTRÉ, eux, viennent toujours du serveur, qui
// les recalcule de son côté : ceux d'ici ne servent qu'à l'aperçu.

const arrondi1 = (n) => Math.round(n * 10) / 10;

// Un nombre >= 0, borné. Une valeur illisible devient 0, jamais une exception.
export function nombrePositif(valeur, maximum = Infinity) {
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, maximum);
}

export function totauxAliments(aliments) {
  const liste = Array.isArray(aliments) ? aliments.filter((a) => a && typeof a === 'object') : [];
  const somme = (cle) => liste.reduce((total, a) => total + nombrePositif(a[cle]), 0);
  return {
    kcal: Math.round(somme('kcal')),
    proteines_g: arrondi1(somme('proteines_g')),
    glucides_g: arrondi1(somme('glucides_g')),
    lipides_g: arrondi1(somme('lipides_g')),
  };
}

// Transforme l'analyse du serveur en BROUILLON modifiable. Chaque aliment
// garde une copie de ses valeurs d'origine (`base`) : c'est à partir d'elles
// qu'on recalcule quand le joueur change la portion.
export function brouillonDepuisAnalyse(analyse) {
  const aliments = (Array.isArray(analyse?.aliments) ? analyse.aliments : [])
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({ ...a, base: { ...a } }));
  return {
    nom: analyse?.description || 'Repas',
    source: 'photo',
    aliments,
    confiance: analyse?.confiance || 'faible',
    remarque: analyse?.remarque || '',
  };
}

// Le joueur corrige les grammes d'un aliment : calories et macros suivent,
// proportionnellement. On repart TOUJOURS des valeurs d'origine de l'IA
// (`base`), pas des valeurs déjà ajustées — sinon passer 150 g → 300 g →
// 150 g accumulerait des erreurs d'arrondi au lieu de retomber pile.
// Sans poids d'origine connu (0), impossible de faire une règle de trois :
// seuls les grammes changent.
export function ajusterPortion(aliment, grammes) {
  if (!aliment || typeof aliment !== 'object') return aliment;
  const base = aliment.base && typeof aliment.base === 'object' ? aliment.base : aliment;
  const g = Math.round(nombrePositif(grammes, 5000));
  const grammesOrigine = nombrePositif(base.grammes);
  if (!(grammesOrigine > 0)) return { ...aliment, grammes: g };
  const r = g / grammesOrigine;
  return {
    ...aliment,
    grammes: g,
    kcal: Math.round(nombrePositif(base.kcal) * r),
    proteines_g: arrondi1(nombrePositif(base.proteines_g) * r),
    glucides_g: arrondi1(nombrePositif(base.glucides_g) * r),
    lipides_g: arrondi1(nombrePositif(base.lipides_g) * r),
  };
}

// Les aliments tels qu'ils partent au serveur (sans la copie `base`).
export function alimentsAEnvoyer(brouillon) {
  const liste = Array.isArray(brouillon?.aliments) ? brouillon.aliments : [];
  return liste
    .filter((a) => a && typeof a === 'object' && String(a.nom || '').trim())
    .map((a) => ({
      nom: String(a.nom).trim().slice(0, 80),
      portion: String(a.portion || '').slice(0, 40),
      grammes: nombrePositif(a.grammes, 5000),
      kcal: nombrePositif(a.kcal, 10000),
      proteines_g: nombrePositif(a.proteines_g, 1000),
      glucides_g: nombrePositif(a.glucides_g, 1000),
      lipides_g: nombrePositif(a.lipides_g, 1000),
    }));
}

// Remplissage d'une barre de progression, entre 0 et 1 (0 sans objectif).
export function progression(valeur, objectif) {
  const o = Number(objectif);
  if (!Number.isFinite(o) || o <= 0) return 0;
  return Math.max(0, Math.min(1, nombrePositif(valeur) / o));
}

// « Il te reste 1150 kcal » / « Objectif dépassé de 200 kcal » / null sans objectif.
export function libelleReste(consomme, objectif, unite) {
  const o = Number(objectif);
  if (!Number.isFinite(o) || o <= 0) return null;
  const reste = Math.round(o - nombrePositif(consomme));
  return reste >= 0 ? `Il te reste ${reste} ${unite}` : `Objectif dépassé de ${-reste} ${unite}`;
}

// ---------------------------------------------------------------------------
// LE JOURNAL NUTRITION (12/11/2026, demande de Hafiz : « il faut un log pour
// la nutrition »). Les totaux de chaque jour viennent du serveur
// (GET /joueurs/{id}/nutrition/historique) ; ici, seulement ce qu'on en tire.

const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Le jour 'AAAA-MM-JJ' décalé de n jours (n négatif = dans le passé).
// Calcul en UTC, volontairement : une date ISO est un JOUR, pas un instant —
// ni fuseau ni changement d'heure ne peuvent faire sauter un jour (même règle
// que le bloc, 06/10/2026). null pour une date illisible.
export function decalerJour(jourISO, n) {
  const m = RE_DATE.exec(String(jourISO ?? ''));
  const decalage = Number(n);
  if (!m || !Number.isFinite(decalage)) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + Math.round(decalage) * 86400000;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const mois = String(d.getUTCMonth() + 1).padStart(2, '0');
  const jour = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mois}-${jour}`;
}

// La moyenne des jours NOTÉS (un jour sans repas n'est pas un jour à 0 kcal :
// c'est un jour où l'on n'a rien noté — le compter ferait mentir la moyenne,
// même règle que la durée moyenne des séances du 10/11/2026).
// { nbJours, kcal, proteines_g, glucides_g, lipides_g } ou null sans aucun jour.
export function moyennesNutrition(jours) {
  const notes = (Array.isArray(jours) ? jours : []).filter(
    (j) => j && typeof j === 'object' && Number(j.nb_repas) > 0,
  );
  if (notes.length === 0) return null;
  const somme = (cle) => notes.reduce((t, j) => t + nombrePositif(j[cle]), 0);
  return {
    nbJours: notes.length,
    kcal: Math.round(somme('kcal') / notes.length),
    proteines_g: Math.round(somme('proteines_g') / notes.length),
    glucides_g: Math.round(somme('glucides_g') / notes.length),
    lipides_g: Math.round(somme('lipides_g') / notes.length),
  };
}

// Où en est une journée par rapport à son objectif de calories ?
// 'objectif' à ±10 % près, sinon 'sous' ou 'dessus' ; null sans objectif.
// Le ±10 % est assumé : personne ne mange au kcal près, et une estimation
// photo n'est de toute façon pas plus précise que ça.
export const TOLERANCE_OBJECTIF = 0.1;
export function etatDuJour(kcal, objectif) {
  const o = Number(objectif);
  if (!Number.isFinite(o) || o <= 0) return null;
  const v = nombrePositif(kcal);
  if (v < o * (1 - TOLERANCE_OBJECTIF)) return 'sous';
  if (v > o * (1 + TOLERANCE_OBJECTIF)) return 'dessus';
  return 'objectif';
}
