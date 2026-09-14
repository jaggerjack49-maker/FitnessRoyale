// Point d'entrée de Fitness Royale.
// L'état des performances de l'utilisateur vit ICI (App) et est partagé
// avec les écrans : quand tu ajoutes une perf, tout se met à jour.
//
// COMPTES : au démarrage, l'app essaie de joindre le serveur FastAPI
// (src/api.js). Si le serveur répond mais qu'on n'a pas de session valide,
// l'écran de connexion/inscription s'affiche (src/screens/ConnexionScreen.js).
// Le token de connexion est gardé dans AsyncStorage pour ne pas avoir à se
// reconnecter à chaque lancement. Si le serveur ne répond PAS DU TOUT (pas
// lancé, pas sur le même réseau…), l'app saute la connexion et retombe sur
// les données locales de mockData.js — MODE HORS-LIGNE, rien ne casse.
// Les duels et défis restent simulés localement pour l'instant (voir
// CLAUDE.md : "duels en ligne" est une prochaine étape de la roadmap).
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ScrollView, Dimensions,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './src/theme';
import { utilisateur, autresJoueurs, duels, defiJournalier, defiHebdo } from './src/data/mockData';
import { jouerRoundIA } from './src/logic/duels';
import * as api from './src/api';
import * as stockageSeance from './src/stockageSeance';
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
  const [mesPerfs, setMesPerfs] = useState(utilisateur.performances);
  const [mesSeances, setMesSeances] = useState(utilisateur.seances);
  const [maSalle, setMaSalle] = useState(utilisateur.salle);
  const [mesPoints, setMesPoints] = useState(utilisateur.points);
  const [mesTitres, setMesTitres] = useState(utilisateur.titres);
  const [defisFaits, setDefisFaits] = useState({}); // { jour: true, semaine: true }
  const [mesDuels, setMesDuels] = useState(duels);

  // ----- Comptes & branchement backend -----
  const [chargement, setChargement] = useState(true); // true pendant la vérification initiale
  const [reveil, setReveil] = useState(false); // true pendant l'attente du réveil du serveur (hébergement gratuit, voir CLAUDE.md)
  const [enLigne, setEnLigne] = useState(false); // true si le SERVEUR répond (avec ou sans compte connecté)
  const [moiServeur, setMoiServeur] = useState(null); // mon compte réel (null = pas connecté)
  const [joueursServeur, setJoueursServeur] = useState(null); // autres joueurs venant du serveur
  // SOUS QUEL COMPTE RANGER LES SÉANCES SUR CE TÉLÉPHONE (07/09/2026).
  // Ce n'est PAS forcément `moi.id` : sans réseau, l'app retombe sur
  // l'identité de démonstration, alors que la séance doit rester rattachée au
  // vrai compte pour repartir au serveur une fois le réseau revenu.
  const [idStockage, setIdStockage] = useState(null);

  // Au tout premier rendu, on relit le dernier compte connu (le serveur, lui,
  // n'a peut-être pas encore répondu — ou pas du tout).
  useEffect(() => {
    let annule = false;
    stockageSeance.lireJoueurMemorise().then((id) => {
      if (!annule && id !== null) setIdStockage((actuel) => actuel ?? id);
    });
    return () => { annule = true; };
  }, []);

  // Applique les données d'un compte fraîchement connecté (login, inscription,
  // ou session retrouvée dans AsyncStorage au démarrage).
  // BUG CORRIGÉ (26/07/2026) : mesDuels/defisFaits/mesSeances sont des états
  // 100% LOCAUX (jamais envoyés au serveur, voir décisions dans CLAUDE.md) —
  // ils ne se réinitialisaient pas quand on changeait de compte, donc un
  // nouveau compte voyait les duels/défis simulés du compte précédent (ou de
  // mockData.js). Ces états vivent dans AppInterne, qui ne redémarre PAS à la
  // connexion (seul l'écran affiché change) : il faut donc les remettre à
  // zéro explicitement ici à chaque connexion.
  function entrerEnLigne(joueur) {
    setMoiServeur(joueur);
    // On retient QUEL compte est connecté sur ce téléphone, pour que les
    // séances faites plus tard SANS réseau soient rangées sous lui — et non
    // sous l'identité de démonstration (voir src/stockageSeance.js).
    stockageSeance.memoriserJoueurConnecte(joueur.id);
    setIdStockage(joueur.id);
    setMesPerfs(joueur.performances);
    setMaSalle(joueur.salle || '');
    setMesPoints(joueur.points || 0);
    setMesTitres(joueur.titres || []);
    setMesDuels([]);
    setDefisFaits({});
    setMesSeances([]);
    setEnLigne(true);
  }

  // Au démarrage : on regarde si le serveur répond, puis si on a une session
  // sauvegardée (AsyncStorage) encore valide. Si le serveur ne répond PAS DU
  // TOUT, on saute direct en mode hors-ligne avec mockData — pas de compte à
  // proposer puisqu'il n'y a personne à qui parler.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        await api.verifierConnexion(() => { if (!annule) setReveil(true); });
        if (annule) return;
        setReveil(false);
        setEnLigne(true);

        const tokenSauvegarde = await AsyncStorage.getItem(CLE_TOKEN);
        if (tokenSauvegarde) {
          api.definirToken(tokenSauvegarde);
          try {
            const joueur = await api.monProfil();
            if (!annule) entrerEnLigne(joueur);
          } catch {
            // Token périmé ou compte supprimé : on l'oublie, l'écran de
            // connexion s'affichera pour que l'utilisateur se reconnecte.
            await AsyncStorage.removeItem(CLE_TOKEN);
            api.definirToken(null);
          }
        }
        const joueurs = await api.listerJoueurs().catch(() => null);
        if (!annule && joueurs) setJoueursServeur(joueurs);
      } catch (erreur) {
        if (!annule) setEnLigne(false); // serveur injoignable → mode hors-ligne (mockData)
      } finally {
        if (!annule) {
          setReveil(false);
          setChargement(false);
        }
      }
    })();
    return () => { annule = true; };
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
    if (!enLigne) return;
    const id = setInterval(rechargerDepuisServeur, DELAI_RAFRAICHISSEMENT_MS);
    return () => clearInterval(id);
  }, [enLigne, !!moiServeur]);

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

  // Ajoute une durée (minutes) au compteur hebdo du Profil — utilisé quand une
  // séance est loggée depuis l'onglet Entraînement (voir EntrainementScreen.js).
  // Reste LOCAL comme le reste de mesSeances, pas encore envoyé au serveur.
  function ajouterSeanceLocale(minutes) {
    setMesSeances((s) => [...s, minutes]);
  }

  // Recharge mes points/titres depuis le serveur (ex. après un duel en ligne
  // gagné : la récompense est ajoutée aux points côté serveur, il faut
  // rafraîchir pour la voir dans l'app).
  async function rafraichirMonProfil() {
    if (!moiServeur) return;
    try {
      const joueur = await api.monProfil();
      setMesPoints(joueur.points || 0);
      setMesTitres(joueur.titres || []);
    } catch {
      // Pas grave : les points resteront juste affichés avec un léger retard.
    }
  }

  // Ajoute une perf : mise à jour locale immédiate + synchro serveur si connecté.
  // Une vraie coupure réseau repasse l'app hors-ligne ; un refus du serveur
  // (permission…) reste local et n'affecte pas le statut de connexion.
  async function ajouterPerf(exercice, valeur, statutInitial) {
    setMesPerfs((perfs) => ({ ...perfs, [exercice]: { valeur, statut: statutInitial } }));
    if (!moiServeur) return;
    try {
      await api.ajouterPerformance(moiServeur.id, exercice, valeur);
      if (statutInitial !== 'non_verifie') {
        await api.verifierPerformance(moiServeur.id, exercice, statutInitial);
      }
    } catch (erreur) {
      if (!(erreur instanceof api.ErreurAPI)) setEnLigne(false);
    }
  }

  // Valide une perf par la communauté (vidéo) : mise à jour locale + synchro serveur.
  // En ligne, le serveur refuse de valider SA PROPRE perf par la communauté
  // (voir CLAUDE.md) — PerformancesScreen n'affiche d'ailleurs plus ce bouton
  // dans ce cas, cette fonction ne sert donc en pratique qu'en mode hors-ligne.
  async function validerPerf(exercice) {
    setMesPerfs((perfs) => ({ ...perfs, [exercice]: { ...perfs[exercice], statut: 'communaute' } }));
    if (!moiServeur) return;
    try {
      await api.verifierPerformance(moiServeur.id, exercice, 'communaute');
    } catch (erreur) {
      if (!(erreur instanceof api.ErreurAPI)) setEnLigne(false);
    }
  }

  // Enregistrer un duel en direct terminé : il rejoint l'historique, victoire → points.
  function terminerDuelDirect(duel) {
    setMesDuels((duelsActuels) => [duel, ...duelsActuels]);
    if (duel.statut === 'gagné') setMesPoints((pts) => pts + duel.recompense);
  }

  // Jouer le round de départage d'un duel (simulation). Victoire → points.
  function jouerDepartage(duelId) {
    setMesDuels((duelsActuels) =>
      duelsActuels.map((duel) => {
        if (duel.id !== duelId || duel.statut !== 'en cours') return duel;
        const joue = jouerRoundIA(duel, utilisateur.sexe);
        if (joue.statut === 'gagné') setMesPoints((pts) => pts + duel.recompense);
        return joue;
      })
    );
  }

  // Valider un défi récurrent : points gagnés, titre éventuel débloqué.
  function validerDefi(defi) {
    if (defisFaits[defi.id]) return; // déjà fait
    setDefisFaits({ ...defisFaits, [defi.id]: true });
    setMesPoints(mesPoints + defi.points);
    if (defi.titreRecompense) setMesTitres([...mesTitres, defi.titreRecompense]);
  }

  // "moi" = l'utilisateur avec ses perfs À JOUR. En ligne, l'identité (pseudo,
  // sexe, poids…) vient du VRAI compte serveur ; hors-ligne, de mockData.
  // serieJours/stats/affilieSalle n'existent pas encore côté serveur (pas
  // suivis pour un vrai compte) : on met des valeurs par défaut neutres.
  const identite = moiServeur || utilisateur;
  const moi = {
    serieJours: 0,
    stats: { victoires: 0, defaites: 0 },
    affilieSalle: false,
    ...identite,
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
    if (chargement) return;   // on attend de savoir QUI on est
    let annule = false;
    (async () => {
      const seance = await stockageSeance.lireSeanceEnCours(idStockage ?? moi.id);
      // Seulement au DÉMARRAGE : on ne rapatrie pas l'utilisateur de force
      // s'il vient de quitter la séance pour aller voir autre chose.
      if (!annule && seance) setOngletActif('entrainement');
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargement, idStockage, moi.id]);

  const monId = moiServeur?.id ?? 0;
  // Les autres joueurs viennent du serveur si on est en ligne, sinon des données locales.
  const autresJoueursAffiches = enLigne && joueursServeur
    ? joueursServeur.filter((j) => j.id !== monId)
    : autresJoueurs;
  const joueurs = [{ ...moi, id: monId, moi: true }, ...autresJoueursAffiches];

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
            estConnecte={!!moiServeur}
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
            validerPerf={validerPerf}
            estConnecte={!!moiServeur}
            actif={actif}
          />
        );
      case 'entrainement':
        return (
          <EntrainementScreen
            moi={moi}
            estConnecte={!!moiServeur}
            ajouterSeanceLocale={ajouterSeanceLocale}
            idStockage={idStockage ?? moi.id}
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
            jouerDepartage={jouerDepartage}
            defisRecurrents={[defiJournalier, defiHebdo]}
            defisFaits={defisFaits}
            validerDefi={validerDefi}
            estConnecte={!!moiServeur}
            rafraichirMonProfil={rafraichirMonProfil}
            demandeDuel={demandeDuel}
          />
        );
      case 'clan':
        return (
          <ClanScreen
            moi={moi}
            joueurs={joueurs}
            salle={maSalle}
            setSalle={setMaSalle}
            estConnecte={!!moiServeur}
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

  // Serveur joignable mais pas de session valide : il faut se connecter/inscrire.
  // (Si le serveur est injoignable, on saute cet écran — mode hors-ligne direct.)
  if (enLigne && !moiServeur) {
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
      {!enLigne && (
        <View style={styles.banniereHorsLigne}>
          <Text style={styles.banniereTexte}>
            📡 Mode hors-ligne — données locales (tentative : {api.adresseServeur()})
          </Text>
        </View>
      )}
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
  banniereHorsLigne: {
    backgroundColor: colors.carteClaire,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  banniereTexte: { color: colors.texteGris, fontSize: 11, textAlign: 'center' },
});
