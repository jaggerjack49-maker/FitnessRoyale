// TestPompes — l'écran de test du compteur de pompes (prototype du 15/09/2026).
//
// Étape 1 du duel de pompes : AVANT de construire le duel et ses barres de
// combat, on vérifie sur un vrai téléphone que la caméra compte juste. Tout le
// jeu repose là-dessus.
//
// L'écran montre volontairement des informations de RÉGLAGE (l'angle des
// coudes en direct, la phase haut/bas) : si le compteur se trompe, elles
// disent pourquoi — seuils trop stricts, bras mal vus, mauvaise distance…
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import CameraPompes from './CameraPompes';
import {
  REGLAGES_POMPES, angleCoudes, avancerCompteur, nouvelEtatCompteur,
} from '../logic/compteurPompes';

const DUREE_TEST_MS = 60 * 1000;

function messageErreur(m) {
  if (m.nom === 'NotAllowedError') return 'Accès à la caméra refusé. Autorise-le pour compter tes pompes.';
  if (m.nom === 'NotFoundError' || m.nom === 'OverconstrainedError') return 'Aucune caméra avant trouvée sur cet appareil.';
  if (m.nom === 'NotSupportedError') return 'La caméra n\'est pas disponible ici.';
  return `La détection n'a pas pu démarrer : ${m.message || 'erreur inconnue'}`;
}

export default function TestPompes({ onFermer }) {
  // L'état du compteur change à CHAQUE image (~30 par seconde) : il vit dans une
  // ref, et seul ce qui s'affiche passe par l'état React (moins de rendus).
  const compteur = useRef(nouvelEtatCompteur());
  const derniereMajAngle = useRef(0);
  const [reps, setReps] = useState(0);
  const [angle, setAngle] = useState(null);
  const [phase, setPhase] = useState('inconnue');
  const [statut, setStatut] = useState('Préparation…');
  const [erreur, setErreur] = useState(null);
  const [finTest, setFinTest] = useState(null); // instant (ms) de fin du test 1 minute
  const [maintenant, setMaintenant] = useState(Date.now());

  useEffect(() => {
    if (!finTest) return undefined;
    const id = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(id);
  }, [finTest]);

  const testEnCours = finTest !== null && maintenant < finTest;
  const testFini = finTest !== null && maintenant >= finTest;
  const secondesRestantes = testEnCours ? Math.ceil((finTest - maintenant) / 1000) : 0;

  function remettreAZero() {
    compteur.current = nouvelEtatCompteur();
    setReps(0);
  }

  function lancerTestMinute() {
    remettreAZero();
    setMaintenant(Date.now());
    setFinTest(Date.now() + DUREE_TEST_MS);
  }

  function recevoir(m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'etat') setStatut(m.message);
    else if (m.type === 'pret') { setStatut(null); setErreur(null); }
    else if (m.type === 'erreur') setErreur(messageErreur(m));
    else if (m.type === 'pose') {
      // Test d'une minute terminé : le score est FIGÉ.
      if (finTest !== null && Date.now() >= finTest) return;
      const a = angleCoudes(m.points, REGLAGES_POMPES);
      const suivant = avancerCompteur(compteur.current, { angle: a, t: m.t }, REGLAGES_POMPES);
      compteur.current = suivant;
      setReps(suivant.reps);
      // L'affichage de l'angle est limité à ~8 mises à jour par seconde.
      if (m.t - derniereMajAngle.current > 120) {
        derniereMajAngle.current = m.t;
        setAngle(a);
        setPhase(suivant.phase);
      }
    }
  }

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>🧪 Test du compteur de pompes</Text>
      <Text style={styles.consigne}>
        Pose le téléphone au sol devant toi, caméra tournée vers toi, à 1 ou 2 mètres. On doit voir
        tes épaules, tes coudes et tes poignets : ils s'allument en or quand ils sont bien détectés.
      </Text>

      {/* Largeur bornée : sur grand écran (version web) le cadre 3:4 prenait
          toute la largeur et devenait immense. */}
      <View style={styles.zoneCamera}>
        <CameraPompes onMessage={recevoir} />
        <View style={styles.compteurSurImage} pointerEvents="none">
          <Text style={styles.compteurChiffre}>{reps}</Text>
          <Text style={styles.compteurLibelle}>{reps > 1 ? 'pompes' : 'pompe'}</Text>
        </View>
        {testEnCours && (
          <View style={styles.chronoSurImage} pointerEvents="none">
            <Text style={styles.chronoTexte}>⏱ {secondesRestantes}s</Text>
          </View>
        )}
      </View>

      {erreur && <Text style={styles.erreur}>⚠️ {erreur}</Text>}
      {!erreur && statut && <Text style={styles.statut}>⏳ {statut}</Text>}

      {/* Pour RÉGLER : ce que le compteur voit, en direct. */}
      <View style={styles.ligneReglage}>
        <Text style={styles.reglage}>
          Coudes : {angle === null ? '— (bras non détectés)' : `${Math.round(angle)}°`}
        </Text>
        <Text style={styles.reglage}>
          {phase === 'haut' ? '▲ En haut' : phase === 'bas' ? '▼ En bas' : '· En attente'}
        </Text>
      </View>
      <Text style={styles.aide}>
        Bras tendus : au-dessus de {REGLAGES_POMPES.angleHaut}° · bras pliés : en dessous de{' '}
        {REGLAGES_POMPES.angleBas}°. Une pompe compte quand tu remontes.
      </Text>

      {testFini && (
        <Text style={styles.resultat}>🏁 Temps écoulé : {reps} {reps > 1 ? 'pompes' : 'pompe'} en 1 minute</Text>
      )}

      <View style={styles.ligneBoutons}>
        <TouchableOpacity style={styles.bouton} onPress={remettreAZero}>
          <Text style={styles.boutonTexte}>↺ Remettre à zéro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bouton, styles.boutonOr]} onPress={lancerTestMinute}>
          <Text style={[styles.boutonTexte, { color: colors.fond }]}>
            {testEnCours ? '↻ Relancer 1 minute' : '⏱ Test 1 minute'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onFermer}>
        <Text style={styles.fermer}>Fermer le test</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m, marginBottom: espacement.m },
  titre: { color: colors.texte, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  consigne: { color: colors.texteGris, fontSize: 13, marginBottom: espacement.m, lineHeight: 18 },
  zoneCamera: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  compteurSurImage: {
    position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center',
  },
  compteurChiffre: {
    color: colors.or, fontSize: 64, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 8,
  },
  compteurLibelle: { color: colors.texte, fontSize: 14, fontWeight: '700', marginTop: -6 },
  chronoSurImage: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  chronoTexte: { color: colors.texte, fontWeight: '800', fontSize: 16 },
  erreur: { color: colors.rouge, marginTop: espacement.s },
  statut: { color: colors.texteGris, marginTop: espacement.s },
  ligneReglage: { flexDirection: 'row', justifyContent: 'space-between', marginTop: espacement.m },
  reglage: { color: colors.texte, fontWeight: '700' },
  aide: { color: colors.texteGris, fontSize: 12, marginTop: 4 },
  resultat: { color: colors.or, fontSize: 16, fontWeight: '800', marginTop: espacement.m, textAlign: 'center' },
  ligneBoutons: { flexDirection: 'row', gap: espacement.s, marginTop: espacement.m },
  bouton: {
    flex: 1, borderWidth: 1, borderColor: colors.or, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  boutonOr: { backgroundColor: colors.or },
  boutonTexte: { color: colors.or, fontWeight: '800' },
  fermer: { color: colors.texteGris, textAlign: 'center', marginTop: espacement.m, textDecorationLine: 'underline' },
});
