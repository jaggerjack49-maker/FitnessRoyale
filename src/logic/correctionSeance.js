// CORRIGER UNE SÉANCE DÉJÀ ENREGISTRÉE (14/11/2026).
//
// Avant, une séance enregistrée était figée : une charge mal tapée (500 kg au
// lieu de 105) restait à vie dans l'historique, les records, les courbes et les
// suggestions de charge. Depuis le détail d'une séance passée, on peut
// maintenant corriger ses séries et sa durée, ou la supprimer.
//
// Ce fichier ne contient que la conversion entre la séance et le BROUILLON
// qu'on édite à l'écran (des textes, puisque ce sont des champs de saisie).
// Il est testé sans React (backend/tests/harnais/harnais_correction_seance.mjs).

import { lireRirSaisi } from './seanceLibre';

export const REPS_MAX = 200;   // mêmes bornes que le serveur (SerieLoggee)
export const POIDS_MAX = 500;
export const DUREE_MAX = 300;  // 5 h, comme la durée mesurée par le chrono

// La séance enregistrée -> un brouillon de champs texte. Une valeur absente
// devient un champ vide (jamais « undefined » ni « null » à l'écran).
export function brouillonDepuisSeance(entrainement) {
  const series = Array.isArray(entrainement?.series) ? entrainement.series : [];
  const texte = (v) => (v === null || v === undefined ? '' : String(v));
  return {
    series: series
      .filter((s) => s && typeof s === 'object')
      .map((s) => ({
        exercice: String(s.exercice ?? ''),
        reps: texte(s.reps),
        poids: texte(s.poids),
        rir: texte(s.rir),
      })),
    duree: texte(entrainement?.duree_minutes),
  };
}

// Le brouillon -> ce qu'on envoie au serveur, ou { erreur } si une saisie est
// invalide. On dit QUELLE ligne pose problème : avec quinze séries à l'écran,
// « valeur invalide » tout court ne servirait à rien.
export function correctionDepuisBrouillon(brouillon) {
  const lignes = Array.isArray(brouillon?.series) ? brouillon.series : [];
  if (lignes.length === 0) {
    return { erreur: 'Il ne reste aucune série : supprime plutôt la séance.' };
  }
  const numeros = {};
  const series = [];
  for (const ligne of lignes) {
    const exercice = String(ligne?.exercice ?? '').trim();
    numeros[exercice] = (numeros[exercice] || 0) + 1;
    const ou = `${exercice || 'Exercice'} — série ${numeros[exercice]}`;
    const repsTexte = String(ligne?.reps ?? '').trim();
    const reps = /^\d+$/.test(repsTexte) ? parseInt(repsTexte, 10) : NaN;
    if (!(reps >= 1 && reps <= REPS_MAX)) {
      return { erreur: `${ou} : les répétitions doivent être un nombre entre 1 et ${REPS_MAX}.` };
    }
    const poidsTexte = String(ligne?.poids ?? '').trim().replace(',', '.');
    const poids = poidsTexte === '' ? NaN : Number(poidsTexte);
    if (!(Number.isFinite(poids) && poids >= 0 && poids <= POIDS_MAX)) {
      return { erreur: `${ou} : la charge doit être entre 0 et ${POIDS_MAX} kg.` };
    }
    const rir = lireRirSaisi(ligne?.rir);
    if (rir === undefined) {
      return { erreur: `${ou} : le RIR doit être un nombre entre 0 et 10 (ou vide).` };
    }
    series.push({ exercice, numero_serie: numeros[exercice], reps, poids, rir });
  }
  if (series.some((s) => !s.exercice)) {
    return { erreur: 'Une série n\'a pas de nom d\'exercice.' };
  }
  const dureeTexte = String(brouillon?.duree ?? '').trim();
  let duree = null;
  if (dureeTexte !== '') {
    duree = /^\d+$/.test(dureeTexte) ? parseInt(dureeTexte, 10) : NaN;
    if (!(duree >= 1 && duree <= DUREE_MAX)) {
      return { erreur: `La durée doit être un nombre de minutes entre 1 et ${DUREE_MAX} (ou vide).` };
    }
  }
  return { series, duree_minutes: duree };
}
