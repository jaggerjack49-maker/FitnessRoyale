// LES RÉGLAGES DE L'APP — la partie PURE, testable (08/11/2026).
//
// Demande de Hafiz : « au niveau du profil on va ajouter un petit onglet
// flottant en haut à droite qui fera office de paramètres […] on aura la partie
// compte, une partie préférences, une partie notifications ».
// Ce fichier ne touche ni à React ni au téléphone : il dit à quoi ressemble un
// réglage valide et répare une mémoire abîmée. Il tourne sous Node dans
// `backend/tests/harnais/harnais_reglages.mjs`. La lecture/écriture sur le
// téléphone vit dans `src/reglages.js`.

import { REPOS_PAR_DEFAUT, REPOS_MAX } from './repos';

// Les durées de repos proposées en un geste dans les préférences.
export const REPOS_PROPOSES = [45, 60, 90, 120, 180];

export const PREFERENCES_DEFAUT = {
  // Le repos lancé après une série quand le programme n'en fixe pas (séance
  // libre, exercice ajouté, programme écrit avant ce réglage).
  reposDefaut: REPOS_PAR_DEFAUT,
  // Le téléphone vibre quand le repos est fini.
  vibrationRepos: true,
  // Une notification prévient de la fin du repos si l'app est en arrière-plan.
  notificationRepos: true,
};

// Une mémoire illisible ou incomplète redevient un réglage valide : chaque
// champ absent ou faux reprend sa valeur par défaut, sans toucher aux autres.
export function normaliserPreferences(brut) {
  const p = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const repos = Number(p.reposDefaut);
  return {
    reposDefaut: Number.isInteger(repos) && repos >= 0 && repos <= REPOS_MAX
      ? repos : PREFERENCES_DEFAUT.reposDefaut,
    vibrationRepos: typeof p.vibrationRepos === 'boolean'
      ? p.vibrationRepos : PREFERENCES_DEFAUT.vibrationRepos,
    notificationRepos: typeof p.notificationRepos === 'boolean'
      ? p.notificationRepos : PREFERENCES_DEFAUT.notificationRepos,
  };
}

// « 18:00 », « 18h00 », « 7:05 » → { heure, minute }. Illisible → null.
export function lireHeure(texte) {
  const m = String(texte ?? '').trim().match(/^(\d{1,2})[:hH](\d{2})$/);
  if (!m) return null;
  const heure = Number(m[1]);
  const minute = Number(m[2]);
  if (heure > 23 || minute > 59) return null;
  return { heure, minute };
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Le rappel d'ENTRAÎNEMENT : plusieurs jours, une heure.
export function normaliserRappel(brut) {
  const r = brut && typeof brut === 'object' ? brut : {};
  const jours = Array.isArray(r.jours) ? JOURS.filter((j) => r.jours.includes(j)) : [];
  return {
    jours,
    heure: lireHeure(r.heure) ? String(r.heure).trim() : '18:00',
    actif: r.actif === true && jours.length > 0,
  };
}

// Le POINT HEBDO sur le volume : un seul jour, une heure.
export function normaliserRappelSuivi(brut) {
  const r = brut && typeof brut === 'object' ? brut : {};
  return {
    jour: JOURS.includes(r.jour) ? r.jour : 'dimanche',
    heure: lireHeure(r.heure) ? String(r.heure).trim() : '19:00',
    actif: r.actif === true,
  };
}
