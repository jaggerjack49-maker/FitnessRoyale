// Rappels — notifications LOCALES programmées sur le téléphone.
//
// "Locale" = programmée et affichée par le téléphone lui-même (comme un
// réveil), AUCUN serveur impliqué : ça marche même hors-ligne et PC éteint.
// Sur le WEB, expo-notifications ne sait pas programmer de notification →
// toutes les fonctions ici deviennent des no-op silencieux (les écrans cachent
// les cartes de rappel sur web).
//
// TROIS FAMILLES DE NOTIFICATIONS, indépendantes :
//   'entrainement' — « c'est l'heure de t'entraîner », plusieurs jours/semaine ;
//   'suivi'        — « fais le point sur tes séries », une fois par semaine ;
//   'repos'        — la fin d'un temps de repos, app en arrière-plan (08/11/2026).
// ATTENTION : `cancelAllScheduledNotificationsAsync()` les annulerait TOUTES.
// On mémorise donc les identifiants de chaque famille (AsyncStorage) pour
// pouvoir en annuler une sans toucher à l'autre.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { joursSemaine } from './data/programmesStandards';

const estWeb = Platform.OS === 'web';
const CLE_IDS = 'fitnessRoyale.idsNotifications'; // { entrainement: [...], suivi: [...] }

// Comment afficher une notification si l'app est OUVERTE au moment où elle
// tombe (par défaut, rien ne s'affiche app ouverte — on préfère la montrer).
if (!estWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function lireIds() {
  try {
    const brut = await AsyncStorage.getItem(CLE_IDS);
    return brut ? JSON.parse(brut) : {};
  } catch {
    return {};
  }
}

async function ecrireIds(famille, ids) {
  const tout = await lireIds();
  tout[famille] = ids;
  await AsyncStorage.setItem(CLE_IDS, JSON.stringify(tout));
}

// Annule UNIQUEMENT les rappels de cette famille.
async function annulerFamille(famille) {
  if (estWeb) return;
  const tout = await lireIds();
  for (const id of tout[famille] || []) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Notification déjà partie ou inconnue : rien à annuler.
    }
  }
  await ecrireIds(famille, []);
}

// Demande la permission d'afficher des notifications (popup système la
// première fois). Renvoie true si accordée.
export async function demanderPermission() {
  if (estWeb) return false;
  // Android 8+ : les notifications passent par un "canal" (obligatoire).
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rappels', {
      name: 'Rappels Fitness Royale',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// expo-notifications compte les jours à l'américaine : 1 = dimanche … 7 = samedi.
function numeroJour(jour) {
  return ((joursSemaine.indexOf(jour) + 1) % 7) + 1;
}

async function programmerHebdo(jour, heure, minute, titre, corps) {
  return Notifications.scheduleNotificationAsync({
    content: { title: titre, body: corps, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: numeroJour(jour),
      hour: heure,
      minute,
      channelId: Platform.OS === 'android' ? 'rappels' : undefined,
    },
  });
}

// ----- Famille « entraînement » : un rappel par jour choisi -----
export async function programmerRappels(jours, heure, minute) {
  if (estWeb) return;
  await annulerFamille('entrainement');
  const ids = [];
  for (const jour of jours) {
    ids.push(await programmerHebdo(
      jour, heure, minute,
      "💪 C'est l'heure de t'entraîner !",
      `Ta séance du ${jour} t'attend — FIGHT FOR IT 🏆`
    ));
  }
  await ecrireIds('entrainement', ids);
}

export async function annulerRappels() {
  await annulerFamille('entrainement');
}

// ----- Famille « suivi » : le point hebdomadaire sur le volume -----
// `resume` est calculé par l'app AU MOMENT de la programmation (ex. « Pectoraux
// 8/12 · Dos 14/16 »). Le contenu d'une notification locale est figé une fois
// programmée : l'écran Entraînement la REPROGRAMME après chaque séance
// enregistrée pour que le message reste juste.
export async function programmerRappelSuivi(jour, heure, minute, resume) {
  if (estWeb) return;
  await annulerFamille('suivi');
  const id = await programmerHebdo(
    jour, heure, minute,
    '🎯 Point sur tes séries',
    resume || 'Fais le point sur ton volume de la semaine.'
  );
  await ecrireIds('suivi', [id]);
}

export async function annulerRappelSuivi() {
  await annulerFamille('suivi');
}

// ----- Famille « repos » : la fin d'un temps de repos (08/11/2026) -----
// Pendant le repos, on pose souvent le téléphone écran éteint : le minuteur de
// l'app ne peut alors ni vibrer ni s'afficher. Le minuteur programme donc UNE
// notification à l'instant où le repos finit QUAND L'APP PASSE EN
// ARRIÈRE-PLAN, et l'annule dès qu'on revient (app ouverte, il vibre lui-même —
// une bannière en plus ferait doublon).
export async function programmerFinRepos(secondes, corps) {
  if (estWeb || !(secondes > 0)) return;
  await annulerFamille('repos');
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Repos terminé', body: corps || 'À toi de jouer : série suivante.', sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondes)),
        channelId: Platform.OS === 'android' ? 'rappels' : undefined,
      },
    });
    await ecrireIds('repos', [id]);
  } catch {
    // Pas de notification possible : le minuteur de l'app reste là au retour.
  }
}

export async function annulerFinRepos() {
  await annulerFamille('repos');
}
