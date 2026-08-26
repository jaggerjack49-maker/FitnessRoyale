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
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from './src/theme';
import { utilisateur, autresJoueurs, duels, defiJournalier, defiHebdo } from './src/data/mockData';
import { jouerRoundIA } from './src/logic/duels';
import * as api from './src/api';
import ConnexionScreen from './src/screens/ConnexionScreen';
import ProfilScreen from './src/screens/ProfilScreen';
import CompetitionScreen from './src/screens/CompetitionScreen';
import PerformancesScreen from './src/screens/PerformancesScreen';
import PaliersScreen from './src/screens/PaliersScreen';
import ClanScreen from './src/screens/ClanScreen';
import EntrainementScreen from './src/screens/EntrainementScreen';
import LimiteErreur from './src/components/LimiteErreur';
import Losange from './src/components/Losange';

const CLE_TOKEN = 'fitnessRoyale.token'; // clé AsyncStorage du token de session
const DELAI_RAFRAICHISSEMENT_MS = 10000; // re-consulte le serveur toutes les 10s (classement, mon profil)

const ONGLETS = [
  { cle: 'profil', libelle: 'Profil', emoji: '👤' },
  { cle: 'perfs', libelle: 'Perfs', emoji: '📊' },
  { cle: 'entrainement', libelle: 'Entraînement', emoji: '💪' },
  { cle: 'paliers', libelle: 'Paliers', emoji: '🏅' },
  { cle: 'competition', libelle: 'Compétition', emoji: '⚔️' },
  { cle: 'clan', libelle: 'Clan', emoji: '💬' },
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
  const monId = moiServeur?.id ?? 0;
  // Les autres joueurs viennent du serveur si on est en ligne, sinon des données locales.
  const autresJoueursAffiches = enLigne && joueursServeur
    ? joueursServeur.filter((j) => j.id !== monId)
    : autresJoueurs;
  const joueurs = [{ ...moi, id: monId, moi: true }, ...autresJoueursAffiches];

  // Écran de chargement pendant la vérification initiale (serveur + session).
  // Si le premier essai rapide échoue, on suppose que le serveur (hébergement
  // gratuit, voir CLAUDE.md) est simplement endormi plutôt que hors service —
  // le message change pour ne pas donner une fausse impression de panne
  // pendant l'attente (jusqu'à ~1 minute).
  if (chargement) {
    return (
      <SafeAreaView style={[styles.conteneur, styles.conteneurChargement]}>
        <StatusBar style="light" />
        <Text style={styles.chargementTexte}>
          {reveil ? '🔄 Réveil du serveur… (jusqu\'à 1 min)' : '⏳ Connexion au serveur…'}
        </Text>
      </SafeAreaView>
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
      <View style={{ flex: 1 }}>
        {ongletActif === 'profil' && (
          <ProfilScreen
            moi={moi}
            joueurs={joueurs}
            seances={mesSeances}
            salle={maSalle}
            setSalle={setMaSalle}
            estConnecte={!!moiServeur}
            seDeconnecter={seDeconnecter}
            allerA={setOngletActif}
            rafraichir={rechargerDepuisServeur}
          />
        )}
        {ongletActif === 'perfs' && (
          <PerformancesScreen
            moi={moi}
            mesPerfs={mesPerfs}
            ajouterPerf={ajouterPerf}
            validerPerf={validerPerf}
            estConnecte={!!moiServeur}
          />
        )}
        {ongletActif === 'entrainement' && (
          <EntrainementScreen
            moi={moi}
            estConnecte={!!moiServeur}
            ajouterSeanceLocale={ajouterSeanceLocale}
          />
        )}
        {ongletActif === 'paliers' && <PaliersScreen moi={moi} />}
        {ongletActif === 'competition' && (
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
          />
        )}
        {ongletActif === 'clan' && <ClanScreen moi={moi} estConnecte={!!moiServeur} />}
      </View>

      {/* Barre d'onglets en bas — style de la maquette : un LOSANGE au lieu
          d'une icône, qui s'allume en or sur l'onglet actif. */}
      <View style={styles.barreOnglets}>
        {ONGLETS.map((o) => {
          const actif = o.cle === ongletActif;
          const couleur = actif ? colors.or : colors.texteGris;
          return (
            <TouchableOpacity key={o.cle} style={styles.onglet} onPress={() => setOngletActif(o.cle)}>
              <Losange couleur={couleur} taille={7} />
              <Text style={[styles.ongletLibelle, { color: couleur }]}>{o.libelle}</Text>
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
  ongletLibelle: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  conteneurChargement: { alignItems: 'center', justifyContent: 'center' },
  chargementTexte: { color: colors.texteGris, fontSize: 16 },
  banniereHorsLigne: {
    backgroundColor: colors.carteClaire,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  banniereTexte: { color: colors.texteGris, fontSize: 11, textAlign: 'center' },
});
