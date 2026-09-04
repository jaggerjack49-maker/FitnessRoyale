// Client API — relie l'app au serveur FastAPI (backend/).
//
// MODE HORS-LIGNE : si le serveur ne répond pas (pas lancé, pas sur le même
// réseau, timeout…), TOUTES les fonctions ci-dessous lèvent une erreur.
// App.js attrape ces erreurs et retombe sur les données locales (mockData.js).
// Rien ne casse si le backend n'est pas démarré : l'app reste utilisable.
//
// ADRESSE DU SERVEUR (depuis le 25/08/2026) : le serveur est HÉBERGÉ EN LIGNE
// (https://fitnessroyale.onrender.com — voir "Hébergement gratuit" dans
// CLAUDE.md), donc l'adresse est FIXE et posée dans app.json →
// expo.extra.apiUrl. C'est la première source lue par obtenirBaseUrl()
// ci-dessous : l'app parle au même serveur partout (Expo Go, web, APK), sans
// dépendre du Wi-Fi de la maison ni du PC allumé.
//
// POUR DÉVELOPPER CONTRE LE BACKEND LOCAL (uvicorn sur le PC) : vider
// expo.extra.apiUrl dans app.json (le mettre à null). La détection
// automatique de l'IP du PC reprend alors la main — mais seulement en mode
// LAN (`npx expo start` SANS --tunnel), le tunnel ne permettant pas au
// téléphone de joindre directement ton PC.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Au-delà de ce délai, on considère le serveur injoignable.
// PORTÉ DE 4s À 12s LE 25/08/2026, après un vrai bug en production : impossible
// de se connecter ni de créer un compte depuis l'APK (« aborted », ou « ce
// compte existe déjà » alors que l'inscription venait d'être tentée — elle
// avait en fait RÉUSSI côté serveur, mais l'app abandonnait avant la réponse).
// Deux causes, corrigées ensemble : la lenteur du serveur (voir la réserve de
// connexions dans backend/app/basededonnees.py) ET ce délai trop serré. Même
// une fois le serveur rapide, l'offre gratuite de Neon met la base en veille
// après quelques minutes d'inactivité : le premier accès qui la réveille peut
// dépasser 4s sans que rien ne soit en panne.
const DELAI_MAX_MS = 12000;
// RÉVEIL DU SERVEUR (20/08/2026) : sur l'hébergement gratuit choisi (Render,
// voir "Hébergement du backend" dans CLAUDE.md), le serveur s'endort après
// 15 min d'inactivité et peut mettre jusqu'à ~1 minute à répondre à la toute
// PREMIÈRE requête qui le relance. DELAI_MAX_MS suffit pour tous les appels
// normaux (serveur déjà éveillé), mais déclarerait à tort ce réveil comme une
// panne — voir verifierConnexion() ci-dessous, seul endroit qui utilise ce
// délai plus patient.
const DELAI_REVEIL_MS = 55000;

// DÉCOUVERTE (20/07/2026) : calculer l'adresse UNE SEULE FOIS au chargement du
// fichier (comme avant) est fragile — Constants.expoConfig peut ne pas encore
// être rempli à cet instant précis selon la façon dont l'app a été ouverte
// (ex. lien exp:// collé dans le navigateur du téléphone), et on retombait
// alors silencieusement sur 'localhost' (= le téléphone lui-même → jamais le
// PC). Corrigé : on la recalcule à CHAQUE appel, et on regarde plusieurs
// sources possibles selon la version/le mode de connexion d'Expo Go.
// Une des sources ci-dessous (surtout Constants.manifest, une API historique
// d'Expo) peut renvoyer autre chose qu'une chaîne selon la version d'Expo Go
// installée sur le téléphone (ex. un objet vide au lieu de undefined). Cette
// fonction ne renvoie donc JAMAIS le résultat d'une source sans vérifier
// explicitement que c'est une vraie chaîne de caractères non vide.
function chaineValide(valeur) {
  return typeof valeur === 'string' && valeur.length > 0 ? valeur : null;
}

function obtenirBaseUrl() {
  try {
    const surApp = chaineValide(Constants.expoConfig?.extra?.apiUrl);
    if (surApp) return surApp;

    // hostUri ressemble à "192.168.1.23:8081" en mode LAN (Expo Go).
    const hostUri =
      chaineValide(Constants.expoConfig?.hostUri) ||
      chaineValide(Constants.expoGoConfig?.debuggerHost) ||
      chaineValide(Constants.manifest?.hostUri) ||
      chaineValide(Constants.manifest2?.extra?.expoClient?.hostUri);
    const ip = hostUri ? hostUri.split(':')[0] : null;
    if (ip) return `http://${ip}:8000`;
  } catch {
    // Une source a levé une erreur inattendue : on ignore et on utilise le repli.
  }

  // Repli : marche pour un simulateur/web tournant sur la même machine que le serveur.
  return 'http://localhost:8000';
}

// Exposée pour l'affichage (ex. bannière hors-ligne) : utile pour diagnostiquer
// un souci de connexion sans avoir à fouiller le code. String(...) en dernier
// rempart : ne renvoie JAMAIS autre chose qu'une vraie chaîne de caractères,
// même si obtenirBaseUrl() se comportait mal un jour.
export function adresseServeur() {
  return String(obtenirBaseUrl());
}

// ----- Token de connexion : gardé en mémoire, ajouté automatiquement aux appels -----
// (voir aussi AsyncStorage dans App.js pour le retrouver après un redémarrage de l'app)
let tokenActuel = null;

export function definirToken(token) {
  tokenActuel = token;
}

// ----- Conversion des statuts : le front dit 'non_verifie', le serveur dit 'declare' -----
export function statutVersAPI(statut) {
  return statut === 'non_verifie' ? 'declare' : statut;
}

export function statutDepuisAPI(statut) {
  return statut === 'declare' ? 'non_verifie' : statut;
}

function joueurDepuisAPI(joueur) {
  const performances = {};
  Object.entries(joueur.performances || {}).forEach(([exo, perf]) => {
    performances[exo] = { valeur: perf.valeur, statut: statutDepuisAPI(perf.statut) };
  });
  return { ...joueur, performances };
}

// Erreur "métier" : le serveur A RÉPONDU mais a refusé (403, 404, 409…).
// À distinguer d'une vraie coupure réseau (timeout, serveur injoignable) —
// App.js ne doit PAS basculer en mode hors-ligne pour un simple refus de
// permission, seulement pour une vraie panne de connexion.
export class ErreurAPI extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// BUG CORRIGÉ (20/07/2026) : sur une erreur de validation (422), FastAPI
// renvoie `detail` comme une LISTE D'OBJETS (un par champ invalide), pas une
// chaîne de texte. Utilisé tel quel comme message d'erreur puis affiché dans
// un <Text>, ça faisait planter React ("Objects are not valid as a React
// child"). Cette fonction transforme TOUJOURS `detail` en texte lisible,
// quelle que soit sa forme.
function messageErreurDepuis(corps, statutHTTP) {
  const detail = corps?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'string' ? d : d?.msg || JSON.stringify(d)))
      .join(' · ');
  }
  return `Erreur serveur (${statutHTTP})`;
}

// Requête HTTP avec timeout : au-delà de delaiMs, on abandonne (mode hors-ligne).
// delaiMs est réglable au cas par cas (voir verifierConnexion, seul appel qui
// s'autorise à attendre plus longtemps que DELAI_MAX_MS).
async function appel(chemin, options = {}, delaiMs = DELAI_MAX_MS) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    const reponse = await fetch(`${obtenirBaseUrl()}${chemin}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(tokenActuel ? { Authorization: `Bearer ${tokenActuel}` } : {}),
        ...options.headers,
      },
      signal: controleur.signal,
    });
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}));
      throw new ErreurAPI(messageErreurDepuis(corps, reponse.status), reponse.status);
    }
    if (reponse.status === 204) return null;
    return await reponse.json();
  } finally {
    clearTimeout(minuteur);
  }
}

function get(chemin, delaiMs) {
  return appel(chemin, {}, delaiMs);
}

function post(chemin, corps) {
  return appel(chemin, { method: 'POST', body: corps !== undefined ? JSON.stringify(corps) : undefined });
}

// ----- Santé du serveur -----
// Deux temps : un essai rapide (le cas normal — serveur déjà éveillé, ou en
// LAN local où il n'y a pas de mise en veille) puis, seulement s'il échoue,
// un essai plus patient qui laisse le temps à Render de réveiller le serveur
// (voir DELAI_REVEIL_MS ci-dessus). `onReveil` (optionnel) est appelé juste
// avant ce second essai, pour que l'app puisse afficher un message du genre
// « Réveil du serveur… » au lieu de laisser croire à une vraie panne.
export async function verifierConnexion(onReveil) {
  try {
    await get('/sante', DELAI_MAX_MS);
  } catch (erreur) {
    if (onReveil) onReveil();
    await get('/sante', DELAI_REVEIL_MS);
  }
  return true;
}

// ----- Authentification -----
// inscription/connexion renvoient { token, joueur } — le token est aussi
// gardé en mémoire ici (definirToken) pour les appels protégés suivants.
export async function inscription(pseudo, motDePasse, sexe, poids, salle) {
  const reponse = await post('/auth/inscription', {
    pseudo, mot_de_passe: motDePasse, sexe, poids, salle,
  });
  definirToken(reponse.token);
  return {
    token: reponse.token,
    joueur: joueurDepuisAPI(reponse.joueur),
    // Le CODE DE SECOURS ("mot de passe oublié") — renvoyé en clair UNE SEULE
    // fois, à afficher à l'utilisateur pour qu'il le note (voir ConnexionScreen).
    codeRecuperation: reponse.code_recuperation,
  };
}

// Change le mot de passe du joueur CONNECTÉ (l'ancien est exigé par le serveur).
export async function changerMotDePasse(ancien, nouveau) {
  return post('/auth/changer-mot-de-passe', {
    ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau,
  });
}

// Réinitialise le mot de passe avec le code de secours (pas besoin d'être
// connecté) — le serveur reconnecte directement (même réponse que connexion()).
export async function motDePasseOublie(pseudo, codeRecuperation, nouveauMotDePasse) {
  const reponse = await post('/auth/mot-de-passe-oublie', {
    pseudo, code_recuperation: codeRecuperation, nouveau_mot_de_passe: nouveauMotDePasse,
  });
  definirToken(reponse.token);
  return { token: reponse.token, joueur: joueurDepuisAPI(reponse.joueur) };
}

// (Re)génère un code de secours pour le joueur connecté — à afficher une fois.
export async function regenererCodeRecuperation() {
  return post('/auth/code-recuperation');
}

export async function connexion(pseudo, motDePasse) {
  const reponse = await post('/auth/connexion', { pseudo, mot_de_passe: motDePasse });
  definirToken(reponse.token);
  return { token: reponse.token, joueur: joueurDepuisAPI(reponse.joueur) };
}

export async function deconnexion() {
  try {
    await post('/auth/deconnexion');
  } finally {
    definirToken(null);
  }
}

// Le profil du joueur connecté (à partir du token déjà en mémoire) —
// sert à vérifier qu'un token retrouvé dans AsyncStorage est encore valide.
export async function monProfil() {
  const joueur = await get('/auth/moi');
  return joueurDepuisAPI(joueur);
}

// ----- Joueurs -----
export async function listerJoueurs() {
  const joueurs = await get('/joueurs');
  return joueurs.map(joueurDepuisAPI);
}

export async function lireJoueur(joueurId) {
  const joueur = await get(`/joueurs/${joueurId}`);
  return joueurDepuisAPI(joueur);
}

export async function ajouterPerformance(joueurId, exercice, valeur) {
  return post(`/joueurs/${joueurId}/performances`, { exercice, valeur });
}

export async function verifierPerformance(joueurId, exercice, statut) {
  return post(`/joueurs/${joueurId}/performances/${encodeURIComponent(exercice)}/verifier`, {
    statut: statutVersAPI(statut),
  });
}

// ----- Classements -----
export async function classementGlobal() {
  const classement = await get('/classement/global');
  return classement.map(joueurDepuisAPI);
}

export async function classementParPoids() {
  const groupes = await get('/classement/poids');
  return groupes.map((g) => ({ ...g, joueurs: g.joueurs.map(joueurDepuisAPI) }));
}

export async function classementSalles() {
  return get('/classement/salles');
}

// ----- Duels BO3 en ligne (à deux téléphones, via un code à partager) -----
// Flux : creerDuelEnLigne() → code affiché → l'adversaire appelle
// rejoindreDuel(code) sur SON téléphone → chacun joue son tour avec
// choisirExercice/soumettreMesReps. Pas de push serveur : l'app doit
// re-consulter lireDuel() de temps en temps pour voir les coups de l'autre.
export async function creerDuelEnLigne(recompense = 100) {
  return post('/duels/creer', { recompense });
}

export async function rejoindreDuel(code) {
  return post('/duels/rejoindre', { code });
}

export async function lireDuel(duelId) {
  return get(`/duels/${duelId}`);
}

export async function duelsDuJoueur(joueurId) {
  return get(`/joueurs/${joueurId}/duels`);
}

export async function choisirExercice(duelId, numero, exercice, charge) {
  return post(`/duels/${duelId}/rounds/${numero}/choisir-exercice`, { exercice, charge });
}

export async function tirerIA(duelId) {
  return post(`/duels/${duelId}/rounds/3/tirer-ia`);
}

export async function soumettreMesReps(duelId, numero, reps) {
  return post(`/duels/${duelId}/rounds/${numero}/mes-reps`, { reps });
}

// Signale "je commence ma série" — l'adversaire voit un chrono en direct
// (voir "Statut en direct des duels" dans CLAUDE.md).
export async function commencerRound(duelId, numero) {
  return post(`/duels/${duelId}/rounds/${numero}/commencer`);
}

// ----- Séances -----
export async function ajouterSeanceServeur(joueurId, minutes, date) {
  return post(`/joueurs/${joueurId}/seances`, { minutes, date });
}

export async function seancesDuJoueur(joueurId) {
  return get(`/joueurs/${joueurId}/seances`);
}

// ----- Défis récurrents -----
export async function etatDesDefis(joueurId) {
  return get(`/joueurs/${joueurId}/defis`);
}

export async function validerDefiServeur(joueurId, typeDefi) {
  return post(`/joueurs/${joueurId}/defis/${typeDefi}/valider`);
}

// ----- Preuves vidéo (upload + vote communauté) -----
// L'upload passe par un FormData (multipart), donc PAS par le helper appel()
// qui force le Content-Type JSON — on construit la requête à la main ici.
export async function joindreVideo(joueurId, exercice, uriFichier) {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    // SUR LE WEB : l'objet {uri, name, type} de React Native ne marche pas —
    // le navigateur attend un vrai fichier (Blob). L'URI donnée par le
    // sélecteur (blob:... ou data:...) se lit avec fetch() pour récupérer le
    // contenu, et l'extension se déduit du type MIME du fichier (le nom dans
    // l'URI est un identifiant aléatoire sans extension sur le web).
    const blob = await (await fetch(uriFichier)).blob();
    const extensionsParMime = {
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-m4v': 'm4v',
      'video/x-msvideo': 'avi',
      'video/webm': 'webm',
    };
    const extension = extensionsParMime[blob.type] || 'mp4';
    formData.append('fichier', blob, `preuve.${extension}`);
  } else {
    // SUR TÉLÉPHONE : format spécial React Native (le fichier est lu depuis
    // la pellicule au moment de l'envoi, à partir de son URI locale).
    const nomFichier = uriFichier.split('/').pop() || 'preuve.mp4';
    const extension = nomFichier.includes('.') ? nomFichier.split('.').pop() : 'mp4';
    formData.append('fichier', {
      uri: uriFichier,
      name: nomFichier,
      type: `video/${extension}`,
    });
  }
  const reponse = await fetch(
    `${obtenirBaseUrl()}/joueurs/${joueurId}/performances/${encodeURIComponent(exercice)}/video`,
    {
      method: 'POST',
      headers: tokenActuel ? { Authorization: `Bearer ${tokenActuel}` } : {},
      body: formData,
    }
  );
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({}));
    throw new ErreurAPI(messageErreurDepuis(corps, reponse.status), reponse.status);
  }
  return reponse.json();
}

export async function videosEnAttente() {
  return get('/videos/en-attente');
}

export async function voterVideo(videoId, valide) {
  return post(`/videos/${videoId}/voter`, { valide });
}

// URL directe du fichier vidéo (pour le composant <Video> — pas un appel JSON).
export function urlVideo(videoId) {
  return `${obtenirBaseUrl()}/videos/${videoId}/fichier`;
}

// ----- Validation SANS VIDÉO n°1 : code partagé avec un partenaire présent -----
// Comme un duel en ligne : je génère un code, mon partenaire (présent, son
// propre compte) le saisit sur SON téléphone pour confirmer ma perf en direct.
export async function creerCodeValidation(joueurId, exercice) {
  return post(`/joueurs/${joueurId}/performances/${encodeURIComponent(exercice)}/code-validation`);
}

export async function rejoindreValidation(code) {
  return post('/validations/rejoindre', { code });
}

// ----- Validation SANS VIDÉO n°2 : vote communauté sur simple confiance -----
export async function performancesAValiderSansVideo() {
  return get('/performances/a-valider-sans-video');
}

export async function voterSansVideo(joueurId, exercice, valide) {
  return post(`/joueurs/${joueurId}/performances/${encodeURIComponent(exercice)}/voter-sans-video`, { valide });
}

// Renomme un exercice PARTOUT : mes programmes, mon historique de séries, et
// ma correction de groupe musculaire. Le nom d'un exercice est son seul
// identifiant (texte libre, aucune table d'exercices) : le changer à un seul
// endroit couperait le lien avec les records, la suggestion de charge et le
// comptage de séries.
export async function renommerExercicePartout(joueurId, ancien, nouveau) {
  return appel(`/joueurs/${joueurId}/exercices/${encodeURIComponent(ancien)}/nom`, {
    method: 'PUT', body: JSON.stringify({ nouveau }),
  });
}

// Change MA salle de gym (= mon clan). Depuis le 01/09/2026 la salle est
// vraiment enregistrée côté serveur : le chat de clan et le classement des
// membres s'appuient dessus, une valeur qui ne vivrait que dans l'app ferait
// répondre 403 au chat.
export async function changerSalle(joueurId, salle) {
  return appel(`/joueurs/${joueurId}/salle`, {
    method: 'PUT', body: JSON.stringify({ salle: salle || '' }),
  });
}

// ----- Programmes partagés (l'admin partage, on récupère avec un CODE) -----
// Il n'existe AUCUN endpoint qui liste tous les programmes partagés : sans le
// code, un joueur ne peut même pas savoir qu'un programme existe
// (correction du 02/09/2026, demande de Hafiz).
export async function programmeParCode(code) {
  return get(`/programmes-partages/${encodeURIComponent(code.trim().toUpperCase())}`);
}

// Ce que MOI j'ai partagé, avec les codes — réservé à l'admin.
export async function mesProgrammesPartages() {
  return get('/admin/programmes-officiels');
}

// Partage un programme et renvoie { id, code } — réservé à l'admin.
export async function publierProgrammeOfficiel(nom, description, seances) {
  return post('/admin/programmes-officiels', { nom, description, seances });
}

export async function retirerProgrammeOfficiel(programmeId) {
  return appelSuppression(`/admin/programmes-officiels/${programmeId}`);
}

// ----- Chat de clan (par salle) -----
// Réservé aux membres de la salle (le serveur vérifie que courant.salle == salle).
export async function messagesClan(salle) {
  return get(`/clans/${encodeURIComponent(salle)}/messages`);
}

export async function envoyerMessageClan(salle, texte) {
  return post(`/clans/${encodeURIComponent(salle)}/messages`, { texte });
}

// ----- Entraînement (programmes + journal de séance) -----
// INDÉPENDANT du barème Fitness Royale — ne touche jamais aux perfs officielles.
// jours = jours de la semaine prévus (ex. ['lundi', 'jeudi']) ; dureeSemaines +
// dateDebut ('AAAA-MM-JJ') = planification sur plusieurs semaines (calendrier).
// Les trois sont optionnels — un programme "simple" reste possible comme avant.
export async function creerProgramme(joueurId, nom, exercices, jours = [], dureeSemaines = null, dateDebut = null) {
  return post(`/joueurs/${joueurId}/programmes`, {
    nom, exercices, jours, duree_semaines: dureeSemaines, date_debut: dateDebut,
  });
}

export async function programmesDuJoueur(joueurId) {
  return get(`/joueurs/${joueurId}/programmes`);
}

export async function supprimerProgramme(programmeId) {
  return appelSuppression(`/programmes/${programmeId}`);
}

function appelSuppression(chemin) {
  return appel(chemin, { method: 'DELETE' });
}

// Change les jours RÉCURRENTS d'un programme (semaine type) — remplace la liste.
export async function changerJoursProgramme(programmeId, jours) {
  return appel(`/programmes/${programmeId}/jours`, {
    method: 'PUT', body: JSON.stringify({ jours }),
  });
}

// Renomme un programme (édition d'une séance depuis la semaine type).
export async function renommerProgramme(programmeId, nom) {
  return appel(`/programmes/${programmeId}/nom`, {
    method: 'PUT', body: JSON.stringify({ nom }),
  });
}

// Remplace la liste d'exercices cibles d'un programme (édition séries × reps).
export async function changerExercicesProgramme(programmeId, exercices) {
  return appel(`/programmes/${programmeId}/exercices`, {
    method: 'PUT', body: JSON.stringify({ exercices }),
  });
}

// ----- MODE TEST (comptes administrateur uniquement) -----
// Le serveur renvoie 403 si le compte n'a pas le drapeau `admin` — celui-ci
// ne s'active qu'à la main en base (voir « Mode test » dans CLAUDE.md).
export async function adminRemplirMesPerfs(palier, nbExercices = null) {
  return post('/admin/mes-perfs', { palier, nb_exercices: nbExercices });
}

export async function adminFixerMesPoints(points) {
  return post('/admin/mes-points', { points });
}

export async function adminGenererJoueurs(nombre, palierMin, palierMax, sexe, salle = null) {
  return post('/admin/joueurs-test', {
    nombre, palier_min: palierMin, palier_max: palierMax, sexe, salle,
  });
}

export async function adminSupprimerJoueursTest() {
  return appelSuppression('/admin/joueurs-test');
}

// ----- XP : la jauge d'ACTIVITÉ (séances, défis, duels gagnés) -----
// NE CHANGE NI l'arène, NI la ligue, NI le classement — voir backend/app/xp.py.
export async function xpDuJoueur(joueurId) {
  return get(`/joueurs/${joueurId}/xp`);
}

// ----- Volume : objectifs de séries par groupe musculaire -----
// objectifs = [{groupe, series_cibles}] — remplace toute la liste.
export async function objectifsSeries(joueurId) {
  return get(`/joueurs/${joueurId}/objectifs-series`);
}

export async function definirObjectifsSeries(joueurId, objectifs) {
  return appel(`/joueurs/${joueurId}/objectifs-series`, {
    method: 'PUT', body: JSON.stringify({ objectifs }),
  });
}

// Corrections « cet exercice appartient à ce groupe musculaire ».
export async function groupesExercices(joueurId) {
  return get(`/joueurs/${joueurId}/groupes-exercices`);
}

export async function definirGroupeExercice(joueurId, exercice, groupe) {
  return appel(`/joueurs/${joueurId}/groupes-exercices/${encodeURIComponent(exercice)}`, {
    method: 'PUT', body: JSON.stringify({ groupe }),
  });
}

// ----- Cycles : un programme COMPLET réparti sur la semaine -----
// seances = [{jour, nom, exercices: [{exercice, series_cibles, reps_cibles}]}]
export async function creerCycle(joueurId, nom, seances) {
  return post(`/joueurs/${joueurId}/cycles`, { nom, seances });
}

export async function cyclesDuJoueur(joueurId) {
  return get(`/joueurs/${joueurId}/cycles`);
}

export async function supprimerCycle(cycleId) {
  return appelSuppression(`/cycles/${cycleId}`);
}

// ----- Planning par date précise (calendrier interactif) -----
export async function planningDuJoueur(joueurId) {
  return get(`/joueurs/${joueurId}/planning`);
}

export async function planifierJour(joueurId, dateJour, programmeId) {
  return post(`/joueurs/${joueurId}/planning`, { date: dateJour, programme_id: programmeId });
}

export async function deplanifierJour(planningId) {
  return appelSuppression(`/planning/${planningId}`);
}

// Placement GROUPÉ (cycle complet type PPL) : elements = [{date, programme_id}].
export async function planifierLot(joueurId, elements) {
  return post(`/joueurs/${joueurId}/planning/lot`, { elements });
}

export async function creerEntrainement(joueurId, programmeId, dateJour, series) {
  return post(`/joueurs/${joueurId}/entrainements`, {
    programme_id: programmeId, date: dateJour, series,
  });
}

export async function entrainementsDuJoueur(joueurId) {
  return get(`/joueurs/${joueurId}/entrainements`);
}

export async function dernieresSeriesPourExercice(joueurId, exercice, avant) {
  const requete = avant ? `?avant=${encodeURIComponent(avant)}` : '';
  return get(`/joueurs/${joueurId}/exercices/${encodeURIComponent(exercice)}/dernier${requete}`);
}
