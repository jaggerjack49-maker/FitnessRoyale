// Point d'entrée de Fitness Royale.
// L'état des performances de l'utilisateur vit ICI (App) et est partagé
// avec les écrans : quand tu ajoutes une perf, tout se met à jour.
//
// IL FAUT UN SERVEUR ET UN COMPTE — le « mode hors-ligne » a été SUPPRIMÉ
// le 26/09/2026 (demande de Hafiz). Au démarrage, l'app joint le serveur
// FastAPI (src/api.js) :
//   - il ne répond pas  → on le DIT, avec un bouton « Réessayer ». Avant,
//     l'app basculait sur un profil de DÉMONSTRATION (src/data/mockData.js,
//     supprimé ce jour-là) qui
//     ressemblait à s'y tromper à un compte vidé de ses données : c'est ce qui
//     a fait croire deux fois à Hafiz que ses séances avaient disparu ;
//   - il répond sans session valide → écran de connexion/inscription
//     (src/screens/ConnexionScreen.js). Le token est gardé dans AsyncStorage
//     pour ne pas avoir à se reconnecter à chaque lancement.
// CE QUI RESTE LOCAL, et n'a rien à voir avec un « mode » : la séance EN COURS
// et la file des séances terminées pas encore envoyées (src/stockageSeance.js)
// — un filet contre la perte, pas une app parallèle.
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ScrollView, Dimensions,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './src/theme';
import * as api from './src/api';
import * as stockageSeance from './src/stockageSeance';
import useRetour from './src/useRetour';
import { decisionRetour, DELAI_DOUBLE_RETOUR_MS } from './src/logic/retour';
import { enISO } from './src/logic/rattrapage';
import ConnexionScreen from './src/screens/ConnexionScreen';
import ProfilScreen from './src/screens/ProfilScreen';
import CompetitionScreen from './src/screens/CompetitionScreen';
import PerformancesScreen from './src/screens/PerformancesScreen';
import PaliersScreen from './src/screens/PaliersScreen';
import ClanScreen from './src/screens/ClanScreen';
import EcranChargement from './src/components/EcranChargement';
import EntrainementScreen from './src/screens/EntrainementScreen';
import LimiteErreur from './src/components/LimiteErreur';
import Losange from './src/components/Losange';
import { ICONES_ONGLETS } from './src/components/IconesOnglets';

const CLE_TOKEN = 'fitnessRoyale.token'; // clé AsyncStorage du token de session
const DELAI_RAFRAICHISSEMENT_MS = 10000; // re-consulte le serveur toutes les 10s (classement, mon profil)

// L'ORDRE DE CE TABLEAU EST L'ORDRE DES ONGLETS À L'ÉCRAN (revu le 26/08/2026
// à la demande de Hafiz) : le parcours de compétition d'abord — je saisis mes
// perfs, je vois où j'en suis dans les paliers, je me compare aux autres —
// puis l'entraînement et le clan, qui sont des outils du quotidien.
// L'écran affiché est choisi par la CLÉ (voir `ongletActif` plus bas) :
// réordonner ici suffit, il n'y a rien d'autre à changer.
// LIBELLÉS RACCOURCIS (08/09/2026) : « Compétition » et « Entraînement »
// passaient à la ligne dans une case de barre et déformaient sa hauteur.
// Les emojis ont disparu : chaque onglet porte maintenant une icône dessinée
// (src/components/IconesOnglets.js), rangée par la même CLÉ que ci-dessous.
const ONGLETS = [
  { cle: 'profil', libelle: 'Profil' },
  { cle: 'perfs', libelle: 'Perfs' },
  { cle: 'paliers', libelle: 'Paliers' },
  { cle: 'competition', libelle: 'Compét.' },
  { cle: 'entrainement', libelle: 'Entraîn.' },
  { cle: 'clan', libelle: 'Clan' },
];

// Point d'entrée réel : enveloppe AppInterne dans un filet de sécurité
// (voir src/components/LimiteErreur.js) pour afficher un diagnostic clair
// en cas de plantage au rendu, au lieu de l'écran générique d'Expo Go.
export default function App() {
  return (
    <LimiteErreur>
      <AppInterne />
    </LimiteErreur>
  );
}

function AppInterne() {
  const [ongletActif, setOngletActif] = useState('profil');

  // ---- Le « retour » Android (16/09/2026) ----
  // Signalé par Hafiz : « quand on glisse retour arrière, il sort de l'app
  // complètement ». Rien n'était branché : Android fermait donc l'app depuis
  // n'importe quel écran. Les SOUS-VUES (détail d'historique, test de pompes,
  // chat…) prennent le retour en premier dans leur écran ; ce qui arrive
  // jusqu'ici suit `decisionRetour` (src/logic/retour.js) : Profil d'abord,
  // puis « appuie encore une fois pour quitter ».
  const dernierRetour = useRef(null);
  const [avertissementQuitter, setAvertissementQuitter] = useState(false);
  useRetour(true, () => {
    const decision = decisionRetour({
      ongletActif, dernierRetourMs: dernierRetour.current, maintenantMs: Date.now(),
    });
    if (decision === 'profil') {
      setOngletActif('profil');
      return true;
    }
    if (decision === 'quitter') return false; // Android ferme l'app
    dernierRetour.current = Date.now();
    setAvertissementQuitter(true);
    setTimeout(() => setAvertissementQuitter(false), DELAI_DOUBLE_RETOUR_MS);
    return true;
  });

  // ---- Glisser entre les onglets (14/09/2026) ----
  // Les onglets déjà ouverts au moins une fois : leur écran reste en place pour
  // qu'on puisse glisser vers lui et retrouver son état.
  const [ongletsVisites, setOngletsVisites] = useState(['profil']);
  const [largeurPage, setLargeurPage] = useState(Dimensions.get('window').width);
  // La hauteur est mesurée elle aussi : sur web, une page posée dans un
  // défilement horizontal ne prend PAS d'elle-même toute la hauteur — elle se
  // tasserait à la taille de son contenu et son propre défilement vertical
  // cesserait de fonctionner.
  const [hauteurPage, setHauteurPage] = useState(0);
  const pagerRef = useRef(null);
  const minuterieDefilement = useRef(null);
  const indexActif = Math.max(0, ONGLETS.findIndex((o) => o.cle === ongletActif));

  // L'onglet actif change — par la barre, par `allerA`, ou par la reprise
  // d'une séance au démarrage : on amène la page correspondante à l'écran.
  useEffect(() => {
    setOngletsVisites((v) => (v.includes(ongletActif) ? v : [...v, ongletActif]));
    pagerRef.current?.scrollTo({ x: indexActif * largeurPage, animated: true });
  }, [indexActif, largeurPage]);

  // Le doigt a fait glisser les pages : on attend que le défilement se POSE
  // avant de changer d'onglet. Sans ce petit délai, chaque pixel parcouru
  // pendant le glissement ferait basculer l'onglet actif (et clignoter la
  // barre). Le même mécanisme couvre le téléphone et le web, où l'évènement
  // « fin d'élan » du défilement n'est pas fiable.
  function surDefilementPages(e) {
    const x = e.nativeEvent.contentOffset.x;
    clearTimeout(minuterieDefilement.current);
    minuterieDefilement.current = setTimeout(() => {
      const index = Math.round(x / largeurPage);
      const cle = ONGLETS[index]?.cle;
      if (cle) setOngletActif(cle);
    }, 120);
  }
  // Quand on arrive sur Compétition depuis la touche VS du Profil, on ne veut
  // pas atterrir sur le classement mais DIRECTEMENT sur le choix du duel
  // (demande de Hafiz du 01/09/2026). Ce compteur sert de « top départ » :
  // CompetitionScreen le surveille et ouvre les duels quand il change.
  const [demandeDuel, setDemandeDuel] = useState(0);

  // Aller sur un onglet ; `options.duel` demande en plus d'ouvrir les duels.
  function allerA(cle, options) {
    setOngletActif(cle);
    if (options && options.duel) setDemandeDuel((n) => n + 1);
  }
  // TOUT VIENT DU SERVEUR : ces états ne sont qu'un reflet de mon compte,
  // rempli à la connexion. Aucune valeur de démonstration — un écran vide
  // avant la première réponse, c'est plus honnête qu'un faux profil.
  const [mesPerfs, setMesPerfs] = useState({});
  // LES SÉANCES VIENNENT DU SERVEUR (24/09/2026) : [{ date, minutes }, …].
  // Avant, c'était un simple tableau de MINUTES vivant dans cet état — remis à
  // zéro à chaque connexion et jamais envoyé au serveur. Le compteur « Cette
  // semaine » du Profil repartait donc de zéro à chaque lancement, et les défis
  // (qui, eux, lisent les séances du serveur) n'étaient jamais réussis.
  const [mesSeances, setMesSeances] = useState([]);
  const [maSalle, setMaSalle] = useState('');
  const [mesPoints, setMesPoints] = useState(0);
  const [mesTitres, setMesTitres] = useState([]);
  // L'état des défis, tel que le serveur le calcule depuis les vraies séances
  // (null tant qu'on ne l'a pas lu). Il n'y a plus de simulation locale : sans
  // serveur, personne ne peut vérifier qu'un défi est réussi.
  const [etatDefis, setEtatDefis] = useState(null);
  // L'historique des duels EN DIRECT (pass-and-play, un seul téléphone) joués
  // depuis le lancement de l'app. Il commence vide : les duels de
  // démonstration ont disparu avec le fichier mockData.js, supprimé.
  const [mesDuels, setMesDuels] = useState([]);

  // ----- Comptes & branchement backend -----
  const [chargement, setChargement] = useState(true); // true pendant la vérification initiale
  const [reveil, setReveil] = useState(false); // true pendant l'attente du réveil du serveur (hébergement gratuit, voir CLAUDE.md)
  // LE SERVEUR N'A PAS RÉPONDU : le message à afficher (null = tout va bien).
  // C'est le remplaçant du mode hors-ligne : on s'arrête et on le dit, au lieu
  // de faire semblant avec des données de démonstration.
  const [erreurServeur, setErreurServeur] = useState(null);
  const [moiServeur, setMoiServeur] = useState(null); // mon compte réel (null = pas connecté)
  const [joueursServeur, setJoueursServeur] = useState(null); // autres joueurs venant du serveur

  // Applique les données d'un compte fraîchement connecté (login, inscription,
  // ou session retrouvée dans AsyncStorage au démarrage).
  // BUG CORRIGÉ (26/07/2026) : `mesDuels` (l'historique des duels en direct)
  // vit dans AppInterne, qui ne redémarre PAS à la connexion — seul l'écran
  // affiché change. Sans remise à zéro explicite ici, un nouveau compte
  // voyait les duels du compte précédent.
  function entrerEnLigne(joueur) {
    setMoiServeur(joueur);
    setMesPerfs(joueur.performances);
    setMaSalle(joueur.salle || '');
    setMesPoints(joueur.points || 0);
    setMesTitres(joueur.titres || []);
    setMesDuels([]);
    setMesSeances([]);
    chargerSeances(joueur.id);
    verifierDefis(joueur.id);
  }

  // LE DÉMARRAGE — et le bouton « Réessayer », qui rejoue exactement la même
  // chose. On regarde si le serveur répond, puis si on a une session
  // sauvegardée (AsyncStorage) encore valide. S'il ne répond pas, on s'arrête
  // là et on l'annonce : il n'y a plus de repli hors-ligne.
  // `numeroEssai` évite qu'un essai abandonné (l'app fermée, ou un second
  // « Réessayer » plus rapide) vienne écraser l'état du plus récent.
  const numeroEssai = useRef(0);
  async function demarrer() {
    numeroEssai.current += 1;
    const essai = numeroEssai.current;
    const encoreAJour = () => numeroEssai.current === essai;
    setChargement(true);
    setErreurServeur(null);
    try {
      await api.verifierConnexion(() => { if (encoreAJour()) setReveil(true); });
      if (!encoreAJour()) return;
      setReveil(false);

      const tokenSauvegarde = await AsyncStorage.getItem(CLE_TOKEN);
      if (tokenSauvegarde) {
        api.definirToken(tokenSauvegarde);
        try {
          const joueur = await api.monProfil();
          if (encoreAJour()) entrerEnLigne(joueur);
        } catch {
          // Token périmé ou compte supprimé : on l'oublie, l'écran de
          // connexion s'affichera pour que l'utilisateur se reconnecte.
          await AsyncStorage.removeItem(CLE_TOKEN);
          api.definirToken(null);
        }
      }
      const joueurs = await api.listerJoueurs().catch(() => null);
      if (encoreAJour() && joueurs) setJoueursServeur(joueurs);
    } catch (erreur) {
      if (encoreAJour()) {
        // Le message brut du navigateur (« Failed to fetch ») ne dit rien à
        // personne : on le garde entre parenthèses, derrière une phrase qui
        // indique quoi faire.
        const detail = erreur && erreur.message ? ` (${erreur.message})` : '';
        setErreurServeur(
          `Pas de réponse du serveur${detail}. Vérifie ta connexion internet,`
          + " puis réessaie : s'il dormait, il peut mettre jusqu'à une minute"
          + ' à se lever.'
        );
      }
    } finally {
      if (encoreAJour()) {
        setReveil(false);
        setChargement(false);
      }
    }
  }

  useEffect(() => {
    demarrer();
    // On ne redémarre jamais tout seul : « Réessayer » est un geste de
    // l'utilisateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RAFRAÎCHISSEMENT AUTOMATIQUE : pas de WebSocket (comme les duels/le chat
  // de clan, voir CLAUDE.md) — sans ça, le classement (Compétition) et mon
  // propre profil (ex. une perf validée par un AUTRE joueur via son vote
  // vidéo, des points gagnés en duel) restaient figés à l'état du tout
  // premier chargement jusqu'à un redémarrage complet de l'app. On
  // re-consulte donc le serveur toutes les 10 secondes tant qu'il répond.
  // Recharge classement + profil depuis le serveur. Appelée périodiquement
  // (ci-dessous) et à la demande — le mode test s'en sert pour voir l'effet
  // d'une action tout de suite, sans attendre le prochain tick.
  async function rechargerDepuisServeur() {
    const joueursFrais = await api.listerJoueurs().catch(() => null);
    if (joueursFrais) setJoueursServeur(joueursFrais);
    if (moiServeur) {
      try {
        const joueur = await api.monProfil();
        setMoiServeur(joueur);
        setMesPerfs(joueur.performances);
        setMesPoints(joueur.points || 0);
        setMesTitres(joueur.titres || []);
      } catch {
        // Coupure passagère : on retentera au prochain tick.
      }
    }
  }

  useEffect(() => {
    if (!moiServeur) return undefined;
    const id = setInterval(rechargerDepuisServeur, DELAI_RAFRAICHISSEMENT_MS);
    return () => clearInterval(id);
  }, [moiServeur?.id]);

  // Appelé par ConnexionScreen après une connexion/inscription réussie.
  async function surConnexionReussie(token, joueur) {
    await AsyncStorage.setItem(CLE_TOKEN, token);
    entrerEnLigne(joueur);
    const joueurs = await api.listerJoueurs().catch(() => null);
    if (joueurs) setJoueursServeur(joueurs);
  }

  // Déconnexion : oublie le token (côté serveur ET app) et revient à l'écran de connexion.
  async function seDeconnecter() {
    await api.deconnexion().catch(() => {});
    await AsyncStorage.removeItem(CLE_TOKEN);
    setMoiServeur(null);
  }

  // Les séances telles que le SERVEUR les connaît (source de vérité).
  async function chargerSeances(joueurId) {
    try {
      setMesSeances(await api.seancesDuJoueur(joueurId));
    } catch {
      // Coupure passagère : on garde ce qu'on a à l'écran plutôt que de tout
      // effacer, et le prochain tick de rafraîchissement remettra à jour.
    }
  }

  // Appelée quand une séance vient d'être loggée depuis l'onglet Entraînement.
  // ⚠️ C'EST LE SERVEUR QUI ENREGISTRE LA SÉANCE, au moment où il reçoit
  // l'entraînement (voir backend/app/main.py) : ici on ne fait qu'afficher le
  // résultat tout de suite, puis on relit la vérité du serveur. Envoyer la
  // séance une deuxième fois depuis l'app la compterait en double.
  async function ajouterSeanceLocale(minutes, jour) {
    if (!moiServeur) return;
    const date = jour || enISO(new Date());
    setMesSeances((s) => [{ date, minutes }, ...s.filter((x) => x.date !== date)]);
    await chargerSeances(moiServeur.id);
    await verifierDefis(moiServeur.id);
  }

  // LES DÉFIS SE VALIDENT TOUT SEULS (demande de Hafiz du 24/09/2026).
  // Le serveur dit lesquels sont RÉUSSIS (d'après les vraies séances) et
  // lesquels sont DÉJÀ VALIDÉS ; l'app valide simplement ceux qui attendent.
  // Il n'y a donc plus rien à toucher pour toucher sa récompense.
  async function verifierDefis(joueurId) {
    const id = joueurId || (moiServeur && moiServeur.id);
    if (!id) return;
    try {
      let etats = await api.etatDesDefis(id);
      const aValider = etats.filter((d) => d.reussi && !d.deja_valide);
      if (aValider.length > 0) {
        for (const defi of aValider) {
          // 409 = déjà validé entre-temps (deux appareils) : sans gravité.
          await api.validerDefiServeur(id, defi.id).catch(() => null);
        }
        etats = await api.etatDesDefis(id).catch(() => etats);
        await rafraichirMonProfil(); // points et titres gagnés
      }
      setEtatDefis(etats);
    } catch {
      // Coupure passagère : on garde l'état précédent. On revient ici à chaque
      // arrivée sur l'onglet Compétition et après chaque séance.
    }
  }

  // Recharge mes points/titres depuis le serveur (ex. après un duel en ligne
  // gagné : la récompense est ajoutée aux points côté serveur, il faut
  // rafraîchir pour la voir dans l'app).
  async function rafraichirMonProfil() {
    if (!moiServeur) return;
    try {
      const joueur = await api.monProfil();
      setMesPerfs(joueur.performances);
      setMesPoints(joueur.points || 0);
      setMesTitres(joueur.titres || []);
    } catch {
      // Pas grave : les points resteront juste affichés avec un léger retard.
    }
  }

  // Ajoute une perf : affichée tout de suite, puis envoyée au serveur.
  // RENVOIE null si c'est passé, sinon le message d'erreur — l'écran le dit et
  // l'affichage est remis d'accord avec le serveur. Avant, un échec faisait
  // basculer toute l'app en mode hors-ligne : la perf restait à l'écran comme
  // si elle était enregistrée, alors que le serveur ne l'avait jamais reçue.
  async function ajouterPerf(exercice, valeur, statutInitial) {
    setMesPerfs((perfs) => ({ ...perfs, [exercice]: { valeur, statut: statutInitial } }));
    try {
      await api.ajouterPerformance(moiServeur.id, exercice, valeur);
      if (statutInitial !== 'non_verifie') {
        await api.verifierPerformance(moiServeur.id, exercice, statutInitial);
      }
      return null;
    } catch (erreur) {
      await rafraichirMonProfil(); // l'écran remontre ce que le serveur sait
      // Un refus du serveur (ErreurAPI) se raconte tel quel ; une coupure
      // réseau, elle, ne dit rien d'utile en anglais (« Failed to fetch »).
      if (erreur instanceof api.ErreurAPI) return erreur.message;
      return `le serveur n'a pas répondu (${erreur.message || 'raison inconnue'})`;
    }
  }

  // Enregistrer un duel en direct terminé : il rejoint l'historique, victoire → points.
  function terminerDuelDirect(duel) {
    setMesDuels((duelsActuels) => [duel, ...duelsActuels]);
    if (duel.statut === 'gagné') setMesPoints((pts) => pts + duel.recompense);
  }

  // LE DÉPARTAGE PAR L'IA A DISPARU AVEC LES FAUX DUELS : il ne servait qu'aux
  // duels « en cours » des données de démonstration. Un duel en direct, lui,
  // se joue jusqu'au
  // bout sur le téléphone (il finit toujours gagné ou perdu), et un duel en
  // ligne est arbitré par le serveur.

  // « moi » = mon compte serveur, avec mes perfs À JOUR.
  // serieJours/stats/affilieSalle ne sont pas encore suivis côté serveur :
  // valeurs neutres, pour que les écrans ne plantent pas.
  const moi = {
    serieJours: 0,
    stats: { victoires: 0, defaites: 0 },
    affilieSalle: false,
    ...(moiServeur || {}),
    performances: mesPerfs,
    seances: mesSeances,
    salle: maSalle,
    points: mesPoints,
    titres: mesTitres,
  };
  // ON REPREND LÀ OÙ ON S'EST ARRÊTÉ (07/09/2026, demande de Hafiz : « si on
  // se reconnecte, on est lancé directement sur la séance »).
  // L'écran Entraînement sait déjà retrouver la séance interrompue, mais il ne
  // sert à rien tant qu'on ne le REGARDE pas : App.js ne monte que l'onglet
  // affiché, et l'app s'ouvre normalement sur le Profil. C'est donc ici qu'il
  // faut regarder, avant même de savoir quoi que ce soit du serveur — une
  // séance en cours vit sur le téléphone, pas côté serveur.
  useEffect(() => {
    if (!moiServeur) return undefined; // on attend de savoir QUI on est
    let annule = false;
    (async () => {
      const seance = await stockageSeance.lireSeanceEnCours(moiServeur.id);
      // Seulement à la connexion : on ne rapatrie pas l'utilisateur de force
      // s'il vient de quitter la séance pour aller voir autre chose.
      if (!annule && seance) setOngletActif('entrainement');
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moiServeur?.id]);

  const monId = moiServeur?.id ?? 0;
  // Le classement vient du serveur, toujours (il y a au moins les joueurs de
  // démonstration créés au premier démarrage du serveur, donc jamais de liste
  // vide à afficher).
  const joueurs = [
    { ...moi, id: monId, moi: true },
    ...(joueursServeur || []).filter((j) => j.id !== monId),
  ];

  // L'écran d'un onglet, rangé par sa CLÉ (celle du tableau ONGLETS).
  // `actif` dit à l'écran s'il est celui qu'on regarde : ceux qui interrogent
  // le serveur en boucle s'en servent pour se mettre en pause.
  function renduEcran(cle) {
    const actif = cle === ongletActif;
    switch (cle) {
      case 'profil':
        return (
          <ProfilScreen
            moi={moi}
            joueurs={joueurs}
            seances={mesSeances}
            salle={maSalle}
            seDeconnecter={seDeconnecter}
            allerA={allerA}
            rafraichir={rechargerDepuisServeur}
          />
        );
      case 'perfs':
        return (
          <PerformancesScreen
            moi={moi}
            mesPerfs={mesPerfs}
            ajouterPerf={ajouterPerf}
            actif={actif}
          />
        );
      case 'entrainement':
        return (
          <EntrainementScreen
            moi={moi}
            ajouterSeanceLocale={ajouterSeanceLocale}
            actif={actif}
          />
        );
      case 'paliers':
        return <PaliersScreen moi={moi} />;
      case 'competition':
        return (
          <CompetitionScreen
            joueurs={joueurs}
            moi={moi}
            duels={mesDuels}
            terminerDuelDirect={terminerDuelDirect}
            etatDefis={etatDefis}
            verifierDefis={verifierDefis}
            rafraichirMonProfil={rafraichirMonProfil}
            demandeDuel={demandeDuel}
            actif={actif}
          />
        );
      case 'clan':
        return (
          <ClanScreen
            moi={moi}
            joueurs={joueurs}
            salle={maSalle}
            setSalle={setMaSalle}
            actif={actif}
          />
        );
      default:
        return null;
    }
  }

  // Écran de chargement pendant la vérification initiale (serveur + session).
  // Si le premier essai rapide échoue, on suppose que le serveur (hébergement
  // gratuit, voir CLAUDE.md) est simplement endormi plutôt que hors service —
  // le message change pour ne pas donner une fausse impression de panne
  // pendant l'attente (jusqu'à ~1 minute).
  if (chargement) {
    // Écran plein cadre (illustration fournie par Hafiz le 06/09/2026), donc
    // PAS de SafeAreaView ici : l'image doit aller jusqu'aux bords, y compris
    // sous la barre d'état. Le texte, lui, est posé en bas, loin de l'encoche.
    return (
      // Un conteneur `flex: 1` est INDISPENSABLE ici : sans lui (un simple
      // fragment `<>`), l'image de fond n'a aucune hauteur à remplir et se
      // contente de sa taille naturelle, le bas de l'écran restant noir.
      <View style={styles.conteneur}>
        <StatusBar style="light" />
        <EcranChargement reveil={reveil} />
      </View>
    );
  }

  // LE SERVEUR N'A PAS RÉPONDU : on s'arrête ici et on le dit, avec de quoi
  // réessayer. C'est ce qui remplace le mode hors-ligne — l'app ne fait plus
  // semblant de fonctionner avec des données qui ne sont pas les tiennes.
  if (erreurServeur) {
    return (
      <View style={styles.conteneur}>
        <StatusBar style="light" />
        <EcranChargement
          erreur={erreurServeur}
          adresse={api.adresseServeur()}
          onReessayer={demarrer}
        />
      </View>
    );
  }

  // Serveur joignable mais pas de session valide : il faut se connecter/inscrire.
  if (!moiServeur) {
    return (
      <SafeAreaView style={styles.conteneur}>
        <StatusBar style="light" />
        <ConnexionScreen onConnecte={surConnexionReussie} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.conteneur}>
      <StatusBar style="light" />
      {/* LES ONGLETS SE PARCOURENT EN GLISSANT LE DOIGT (14/09/2026, demande de
          Hafiz : « pouvoir scroller horizontalement entre les onglets au lieu
          d'être obligé de cliquer »).
          Une page par onglet, côte à côte, dans un défilement horizontal « page
          par page » : la page suit le doigt, comme dans Clash Royale. Aucune
          dépendance ajoutée (un ScrollView natif), et ça marche aussi sur web.

          ⚠️ CHANGEMENT DE FOND : avant, SEUL l'onglet affiché existait — les
          autres étaient détruits à chaque changement. Pour pouvoir glisser vers
          une page, elle doit exister à côté. Donc :
          - un écran n'est créé qu'à sa PREMIÈRE visite (`ongletsVisites`), pour
            ne pas tout charger au démarrage ;
          - une fois visité, il RESTE en place : on retrouve son état (scroll,
            dépliages, saisie en cours) en revenant ;
          - les écrans qui interrogent le serveur en boucle (chat du Clan,
            vidéos des Perfs) reçoivent `actif` et se METTENT EN PAUSE quand on
            ne les regarde pas — sinon ils tourneraient tous en même temps. */}
      <View style={{ flex: 1 }} onLayout={(e) => {
        const { width: largeur, height: hauteur } = e.nativeEvent.layout;
        if (largeur > 0 && largeur !== largeurPage) setLargeurPage(largeur);
        if (hauteur > 0 && hauteur !== hauteurPage) setHauteurPage(hauteur);
      }}>
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={surDefilementPages}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
      >
        {ONGLETS.map((o) => (
          <View
            key={o.cle}
            style={hauteurPage > 0 ? { width: largeurPage, height: hauteurPage } : { width: largeurPage, flex: 1 }}
          >
            {ongletsVisites.includes(o.cle) && renduEcran(o.cle)}
          </View>
        ))}
      </ScrollView>
      </View>

      {/* Barre d'onglets en bas — piste « Arène » : icône pleine ligne, et sur
          l'onglet actif un liseré or au-dessus + une pastille voilée d'or. */}
      {avertissementQuitter && (
        <View style={styles.avertissementQuitter} pointerEvents="none">
          <Text style={styles.avertissementQuitterTexte}>Appuie encore une fois pour quitter</Text>
        </View>
      )}
      <View style={styles.barreOnglets}>
        {ONGLETS.map((o) => {
          const actif = o.cle === ongletActif;
          const couleur = actif ? colors.or : colors.texteGris;
          const Icone = ICONES_ONGLETS[o.cle];
          return (
            <TouchableOpacity
              key={o.cle}
              style={styles.onglet}
              onPress={() => setOngletActif(o.cle)}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={o.libelle}
            >
              {actif && <View style={styles.ongletLisere} />}
              <View style={[styles.ongletPastille, actif && styles.ongletPastilleActive]}>
                <Icone taille={20} couleur={couleur} />
              </View>
              <Text style={[styles.ongletLibelle, { color: couleur }]} numberOfLines={1}>
                {o.libelle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: colors.fond,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  avertissementQuitter: {
    position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center',
  },
  avertissementQuitterTexte: {
    color: colors.texte, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 8, fontWeight: '700', overflow: 'hidden',
  },
  barreOnglets: {
    flexDirection: 'row',
    backgroundColor: colors.carte,
    borderTopWidth: 1,
    borderTopColor: colors.bordure,
    paddingVertical: 8,
  },
  onglet: { flex: 1, alignItems: 'center', gap: 5 },
  // Liseré or au-dessus de l'onglet actif. Positioné en absolu pour ne pas
  // décaler l'icône : il déborde sur le padding de la barre.
  ongletLisere: {
    position: 'absolute',
    top: -8,
    width: 26,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.or,
  },
  ongletPastille: {
    width: 34,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Même teinte que colors.or (#e8b23a), à 8 % : un voile, pas un bouton.
  ongletPastilleActive: { backgroundColor: 'rgba(232, 178, 58, 0.08)' },
  ongletLibelle: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
});
