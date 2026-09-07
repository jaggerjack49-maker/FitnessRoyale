// LA SÉANCE SURVIT À TOUT — mémoire locale du journal d'entraînement.
// Ajouté le 07/09/2026 (demandes de Hafiz : « les performances doivent être
// enregistrées même si on recommence le programme à zéro » et « on doit
// pouvoir rattraper une séance en cours même déconnecté du serveur ; si on se
// reconnecte on est lancé directement sur la séance »).
//
// CE QUI SE PERDAIT AVANT, ET POURQUOI :
//
// 1. LA SÉANCE EN COURS vivait dans l'état React de `EntrainementScreen`.
//    Or App.js DÉMONTE cet écran dès qu'on change d'onglet
//    (`{ongletActif === 'entrainement' && <EntrainementScreen …/>}`) : toucher
//    « Profil » au milieu d'une séance effaçait toutes les séries saisies,
//    sans le moindre avertissement. Fermer l'app faisait pire.
//
// 2. UNE SÉANCE TERMINÉE HORS-LIGNE n'était ajoutée qu'à l'état local. Au
//    retour du réseau, `chargerTout()` REMPLAÇAIT toute la liste par celle du
//    serveur — qui ne l'avait jamais reçue. La séance disparaissait donc au
//    moment précis où l'on se reconnectait, c'est-à-dire là où l'on croyait
//    justement qu'elle était enfin sauvegardée.
//
// D'où deux mémoires distinctes, toutes deux dans AsyncStorage (le seul
// stockage qui survit à la fermeture de l'app) :
//   - LA SÉANCE EN COURS : une seule à la fois, écrasée à chaque changement.
//   - LA FILE D'ATTENTE : les séances TERMINÉES que le serveur n'a pas encore
//     accusé réception. Elles ne sortent de la file qu'une fois vraiment
//     enregistrées côté serveur.
//
// TOUT EST RANGÉ PAR JOUEUR (`joueurId`) : sans ça, se connecter avec un
// autre compte sur le même téléphone reprendrait la séance du précédent.
// Chaque lecture/écriture est protégée par un try/catch — AsyncStorage peut
// échouer (stockage plein, navigateur en navigation privée) et une séance
// perdue ne doit JAMAIS se transformer en écran d'erreur.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE_EN_COURS = 'fitnessRoyale.seanceEnCours';
const CLE_EN_ATTENTE = 'fitnessRoyale.seancesAEnvoyer';

// ----- La séance EN COURS (celle qu'on est en train de faire) -----

// Renvoie la séance interrompue de CE joueur, ou null s'il n'y en a pas
// (ou si elle appartient à quelqu'un d'autre).
export async function lireSeanceEnCours(joueurId) {
  try {
    const brut = await AsyncStorage.getItem(CLE_EN_COURS);
    if (!brut) return null;
    const seance = JSON.parse(brut);
    if (!seance || seance.joueurId !== joueurId) return null;
    return seance;
  } catch {
    return null;
  }
}

export async function ecrireSeanceEnCours(joueurId, seance) {
  try {
    await AsyncStorage.setItem(
      CLE_EN_COURS, JSON.stringify({ ...seance, joueurId })
    );
  } catch {
    // Tant pis : la séance continue à l'écran, elle ne survivra simplement
    // pas à une fermeture de l'app. Mieux vaut ça qu'un plantage.
  }
}

export async function effacerSeanceEnCours() {
  try {
    await AsyncStorage.removeItem(CLE_EN_COURS);
  } catch {
    // Rien à faire : au pire une séance déjà enregistrée sera reproposée.
  }
}

// ----- La FILE D'ATTENTE (séances terminées, pas encore chez le serveur) -----

export async function lireSeancesEnAttente(joueurId) {
  try {
    const brut = await AsyncStorage.getItem(CLE_EN_ATTENTE);
    if (!brut) return [];
    const liste = JSON.parse(brut);
    if (!Array.isArray(liste)) return [];
    return liste.filter((s) => s && s.joueurId === joueurId);
  } catch {
    return [];
  }
}

// Ajoute une séance terminée à la file. On l'écrit AVANT de tenter l'envoi :
// si l'envoi échoue — ou si l'app est fermée pendant l'envoi — elle est déjà
// à l'abri.
export async function ajouterSeanceEnAttente(joueurId, seance) {
  try {
    const brut = await AsyncStorage.getItem(CLE_EN_ATTENTE);
    const liste = brut ? JSON.parse(brut) : [];
    const toutes = Array.isArray(liste) ? liste : [];
    toutes.push({ ...seance, joueurId });
    await AsyncStorage.setItem(CLE_EN_ATTENTE, JSON.stringify(toutes));
  } catch {
    // Voir ci-dessus : on ne casse jamais la fin de séance pour un stockage.
  }
}

// Retire une séance de la file — appelé UNIQUEMENT quand le serveur a
// confirmé l'avoir enregistrée.
export async function retirerSeanceEnAttente(idLocal) {
  try {
    const brut = await AsyncStorage.getItem(CLE_EN_ATTENTE);
    if (!brut) return;
    const liste = JSON.parse(brut);
    if (!Array.isArray(liste)) return;
    await AsyncStorage.setItem(
      CLE_EN_ATTENTE, JSON.stringify(liste.filter((s) => s && s.id !== idLocal))
    );
  } catch {
    // La séance restera dans la file : elle sera renvoyée une fois de trop
    // plutôt que perdue. Le mauvais côté de l'erreur est le bon.
  }
}

// ----- QUI SUIS-JE QUAND LE SERVEUR NE RÉPOND PAS ? -----
//
// Tout ce qui précède est rangé PAR JOUEUR. Or si l'app est relancée SANS
// réseau, elle n'a personne à qui demander qui est connecté : elle retombe sur
// l'identité de démonstration (mockData, voir App.js). Une séance faite dans
// cet état serait donc rangée sous un compte fictif, et resterait invisible —
// donc jamais envoyée — au retour du réseau. C'est précisément le scénario
// visé par la demande de Hafiz (« même si on est déconnecté du serveur, et si
// on se reconnecte… »), donc on ne peut pas s'en contenter.
//
// On se souvient donc du DERNIER COMPTE réellement connecté sur ce téléphone.
// C'est un simple numéro, jamais une preuve d'identité : il ne donne aucun
// accès (le serveur exige toujours le token et vérifie la propriété), il sert
// uniquement à ranger les séances au bon endroit en attendant le réseau.
const CLE_DERNIER_JOUEUR = 'fitnessRoyale.dernierJoueur';

export async function memoriserJoueurConnecte(joueurId) {
  try {
    await AsyncStorage.setItem(CLE_DERNIER_JOUEUR, String(joueurId));
  } catch {
    // Sans ça, une séance faite hors-ligne après redémarrage restera sous
    // l'identité de repli — récupérable à la main, jamais perdue.
  }
}

export async function lireJoueurMemorise() {
  try {
    const brut = await AsyncStorage.getItem(CLE_DERNIER_JOUEUR);
    if (!brut) return null;
    const id = parseInt(brut, 10);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}
