// LES LIGNES D'EXERCICES DES ÉDITEURS DE PROGRAMME — logique pure, testable
// (08/11/2026).
//
// Deux formulaires écrivent des exercices de programme : l'éditeur d'une
// séance (`EditeurSeance`) et le formulaire « Nouveau programme ». Ils avaient
// chacun leur propre forme de ligne, et l'un connaissait la fourchette de reps
// quand l'autre l'ignorait. Avec le repos et le RIR en plus, deux copies
// auraient fini par diverger : UNE SEULE forme de ligne, UNE SEULE conversion.
//
// Une LIGNE est ce que l'utilisateur tape (que des chaînes) ; un EXERCICE est
// ce que le serveur reçoit (des nombres, ou null).

import { lireDuree, dureeLisible } from './repos';

export function ligneVide() {
  return { exercice: '', series: '3', reps: '10', repsMax: '', repos: '', rir: '' };
}

// Un exercice enregistré → une ligne à éditer (le repos réécrit en « 1:30 »).
export function ligneDepuisExercice(exo) {
  if (!exo || typeof exo !== 'object') return ligneVide();
  const texte = (v) => (v === null || v === undefined ? '' : String(v));
  return {
    exercice: texte(exo.exercice),
    series: texte(exo.series_cibles) || '3',
    reps: texte(exo.reps_cibles) || '10',
    repsMax: exo.reps_cibles_max ? String(exo.reps_cibles_max) : '',
    repos: dureeLisible(exo.repos_secondes),
    rir: texte(exo.rir_cible),
  };
}

function entier(texte) {
  const n = parseInt(String(texte ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// Une ligne → l'exercice envoyé au serveur. null si la ligne n'a pas de nom
// (une ligne vide n'est pas une erreur, elle est simplement ignorée).
export function exerciceDepuisLigne(ligne) {
  const nom = String(ligne?.exercice ?? '').trim();
  if (!nom) return null;
  const bas = Math.min(100, Math.max(1, entier(ligne.reps) || 1));
  const haut = entier(ligne.repsMax);
  const rir = entier(ligne.rir);
  return {
    exercice: nom,
    series_cibles: Math.min(20, Math.max(1, entier(ligne.series) || 1)),
    reps_cibles: bas,
    // Une fourchette à l'envers (10 → 5) ou égale au bas n'en est pas une :
    // rangée en objectif simple plutôt que refusée pour si peu.
    reps_cibles_max: haut !== null && haut > bas ? Math.min(100, haut) : null,
    repos_secondes: lireDuree(ligne.repos),
    // Le RIR va de 0 (jusqu'à l'échec) à 10 ; hors de là, « pas fixé ».
    rir_cible: rir !== null && rir >= 0 && rir <= 10 ? rir : null,
  };
}

export function exercicesDepuisLignes(lignes) {
  return (Array.isArray(lignes) ? lignes : []).map(exerciceDepuisLigne).filter(Boolean);
}

// Monter (sens -1) ou descendre (sens +1) une ligne. Hors limites : la liste
// revient telle quelle (jamais modifiée sur place).
export function deplacerLigne(lignes, index, sens) {
  const liste = Array.isArray(lignes) ? [...lignes] : [];
  const cible = index + sens;
  if (!Number.isInteger(index) || index < 0 || index >= liste.length
    || cible < 0 || cible >= liste.length) return liste;
  [liste[index], liste[cible]] = [liste[cible], liste[index]];
  return liste;
}

// « repos 1:30 · RIR 2 » — le résumé affiché sous un exercice prévu. Vide si
// rien n'est fixé (on n'affiche pas le repos par défaut comme une consigne).
export function resumeReglages(exo) {
  const morceaux = [];
  if (typeof exo?.repos_secondes === 'number') morceaux.push(`repos ${dureeLisible(exo.repos_secondes)}`);
  if (typeof exo?.rir_cible === 'number') morceaux.push(`RIR ${exo.rir_cible}`);
  return morceaux.join(' · ');
}

// UN EXERCICE A-T-IL ÉTÉ RENOMMÉ (et pas simplement déplacé ou remplacé) ?
// Utilisé après l'enregistrement d'une séance pour PROPOSER « Renommer
// partout » (04/09/2026) — jamais pour le faire tout seul.
//
// ⚠️ PIÈGE DU 08/11/2026 : l'ancienne règle comparait les noms POSITION PAR
// POSITION. Dès qu'on a pu réordonner les exercices, monter « Dips » de deux
// crans donnait trois « renommages » (« élévations → Dips », « face pull →
// élévations »…) — et les accepter aurait réécrit l'historique de trois
// exercices à tort.
// La règle compare donc des ENSEMBLES de noms : un nom qui a DISPARU et un nom
// qui est APPARU. Un déplacement ne fait ni l'un ni l'autre.
//   - liste de longueur différente (ajout ou retrait) → on ne devine rien ;
//   - autant de disparus que d'apparus → appariés dans l'ordre de la liste ;
//   - sinon → rien (mieux vaut ne rien proposer que réécrire l'historique sur
//     une fausse piste).
export function detecterRenommages(ancienne, nouvelle) {
  if (!Array.isArray(ancienne) || !Array.isArray(nouvelle)
    || ancienne.length !== nouvelle.length) return [];
  const nom = (e) => String(e?.exercice ?? '').trim();
  const avant = ancienne.map(nom);
  const apres = nouvelle.map(nom);
  const disparus = avant.filter((n) => n && !apres.includes(n));
  const apparus = apres.filter((n) => n && !avant.includes(n));
  if (disparus.length === 0 || disparus.length !== apparus.length) return [];
  return disparus.map((ancien, i) => ({ ancien, nouveau: apparus[i] }));
}
