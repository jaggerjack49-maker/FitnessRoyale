// LES RÉGLAGES DE L'APP — lecture et écriture sur le téléphone (08/11/2026).
//
// Trois mémoires locales (AsyncStorage), une par sorte de réglage :
//   - les PRÉFÉRENCES (repos par défaut, vibration, notification de fin de
//     repos) ;
//   - le RAPPEL D'ENTRAÎNEMENT (jours + heure) ;
//   - le POINT HEBDO sur le volume (jour + heure).
// Les deux rappels gardent les MÊMES CLÉS qu'avant (`fitnessRoyale.rappel`,
// `fitnessRoyale.rappelSuivi`) : ils vivaient dans l'onglet Entraînement et ont
// déménagé dans Profil → Paramètres. Un rappel déjà réglé n'est donc pas perdu.
//
// Ce sont des réglages DE CE TÉLÉPHONE (comme les notifications elles-mêmes,
// programmées localement) : rien n'est envoyé au serveur.
//
// La forme valide de chaque réglage est décidée dans src/logic/reglages.js
// (pur, testé) ; ce fichier ne fait que lire, écrire et prévenir les écrans.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as notifications from './notifications';
import {
  normaliserPreferences, normaliserRappel, normaliserRappelSuivi, lireHeure,
} from './logic/reglages';

const CLE_PREFERENCES = 'fitnessRoyale.preferences';
const CLE_RAPPEL = 'fitnessRoyale.rappel';
const CLE_RAPPEL_SUIVI = 'fitnessRoyale.rappelSuivi';

async function lireJSON(cle) {
  try {
    const brut = await AsyncStorage.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null; // mémoire illisible : on repart des valeurs par défaut
  }
}

async function ecrireJSON(cle, valeur) {
  try {
    await AsyncStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible (navigation privée sur le web…) : le réglage
    // vaut pour cette session seulement.
  }
}

// ---------------------------------------------------------------------------
// LES PRÉFÉRENCES
// ---------------------------------------------------------------------------
// Un écran qui les UTILISE (l'Entraînement, pour le minuteur de repos) s'abonne
// avec `ecouterPreferences` : un changement fait dans les Paramètres s'applique
// tout de suite, sans relancer l'app.
let enMemoire = null;
const abonnes = new Set();

export async function lirePreferences() {
  if (!enMemoire) enMemoire = normaliserPreferences(await lireJSON(CLE_PREFERENCES));
  return enMemoire;
}

export async function changerPreferences(modif) {
  const actuelles = await lirePreferences();
  enMemoire = normaliserPreferences({ ...actuelles, ...modif });
  await ecrireJSON(CLE_PREFERENCES, enMemoire);
  abonnes.forEach((f) => f(enMemoire));
  return enMemoire;
}

export function ecouterPreferences(fonction) {
  abonnes.add(fonction);
  lirePreferences().then(fonction);
  return () => abonnes.delete(fonction);
}

// ---------------------------------------------------------------------------
// LE RAPPEL D'ENTRAÎNEMENT
// ---------------------------------------------------------------------------
export async function lireRappel() {
  return normaliserRappel(await lireJSON(CLE_RAPPEL));
}

// Renvoie { ok, message } : le message est affiché tel quel par l'écran.
export async function activerRappel(jours, heureTexte) {
  const heure = lireHeure(heureTexte);
  if (!heure) return { ok: false, message: 'Heure invalide — utilise le format 18:00 (ou 18h00).' };
  if (!jours.length) return { ok: false, message: 'Choisis au moins un jour de rappel.' };
  if (!(await notifications.demanderPermission())) {
    return { ok: false, message: 'Notifications refusées — autorise-les dans les réglages du téléphone.' };
  }
  await notifications.programmerRappels(jours, heure.heure, heure.minute);
  await ecrireJSON(CLE_RAPPEL, { jours, heure: heureTexte.trim(), actif: true });
  return { ok: true, message: `Rappel activé : ${jours.join(', ')} à ${heureTexte.trim()}.` };
}

export async function desactiverRappel(jours, heureTexte) {
  await notifications.annulerRappels();
  await ecrireJSON(CLE_RAPPEL, { jours, heure: String(heureTexte || '').trim(), actif: false });
  return { ok: true, message: 'Rappel désactivé.' };
}

// ---------------------------------------------------------------------------
// LE POINT HEBDO SUR LE VOLUME
// ---------------------------------------------------------------------------
// Son MESSAGE porte les chiffres réels de la semaine (« Pectoraux 8/12 »), que
// seul l'onglet Entraînement sait calculer. Activé depuis les Paramètres, il
// part avec un message générique ; l'Entraînement le REPROGRAMME ensuite avec
// les vrais chiffres (`reprogrammerRappelSuivi`) à chaque chargement et après
// chaque séance — le contenu d'une notification locale est figé au moment où
// on la programme.
const MESSAGE_SUIVI_GENERIQUE = 'Fais le point sur tes séries de la semaine.';

export async function lireRappelSuivi() {
  return normaliserRappelSuivi(await lireJSON(CLE_RAPPEL_SUIVI));
}

export async function activerRappelSuivi(jour, heureTexte) {
  const heure = lireHeure(heureTexte);
  if (!heure) return { ok: false, message: 'Heure invalide — utilise le format 19:00.' };
  if (!(await notifications.demanderPermission())) {
    return { ok: false, message: 'Notifications refusées — autorise-les dans les réglages du téléphone.' };
  }
  await notifications.programmerRappelSuivi(jour, heure.heure, heure.minute, MESSAGE_SUIVI_GENERIQUE);
  await ecrireJSON(CLE_RAPPEL_SUIVI, { jour, heure: heureTexte.trim(), actif: true });
  return { ok: true, message: `Point hebdo activé : chaque ${jour} à ${heureTexte.trim()}.` };
}

export async function desactiverRappelSuivi(jour, heureTexte) {
  await notifications.annulerRappelSuivi();
  await ecrireJSON(CLE_RAPPEL_SUIVI, { jour, heure: String(heureTexte || '').trim(), actif: false });
  return { ok: true, message: 'Point hebdo désactivé.' };
}

// Appelé par l'Entraînement avec le résumé chiffré de la semaine. Ne fait rien
// si le point hebdo n'est pas activé.
export async function reprogrammerRappelSuivi(resume) {
  const config = await lireRappelSuivi();
  const heure = lireHeure(config.heure);
  if (!config.actif || !heure) return;
  await notifications.programmerRappelSuivi(config.jour, heure.heure, heure.minute, resume);
}
