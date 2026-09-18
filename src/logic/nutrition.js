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
