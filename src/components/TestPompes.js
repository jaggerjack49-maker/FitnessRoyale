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
  REGLAGES_POMPES, avancerCompteur, mesureDepuisPoints, nouvelEtatCompteur,
} from '../logic/compteurPompes';

const DUREE_TEST_MS = 60 * 1000;

function messageErreur(m) {
  if (m.nom === 'NotAllowedError') return 'Accès à la caméra refusé. Autorise-le pour compter tes pompes.';
  if (m.nom === 'NotFoundError' || m.nom === 'OverconstrainedError') return 'Aucune caméra avant trouvée sur cet appareil.';
  if (m.nom === 'NotSupportedError') return 'La caméra n\'est pas disponible ici.';
  return `La détection n'a pas pu démarrer : ${m.message || 'erreur inconnue'}`;
}

// Les deux signaux ne s'affichent pas pareil : l'angle en degrés, la descente
// est un simple rapport (1 = bras tendu, 0 = poitrine au sol).
function arrondi(valeur, signal) {
  if (!Number.isFinite(valeur)) return '—';
  return signal === 'descente' ? valeur.toFixed(2) : `${Math.round(valeur)}°`;
}

export default function TestPompes({ onFermer }) {
  // L'état du compteur change à CHAQUE image (~30 par seconde) : il vit dans une
  // ref, et seul ce qui s'affiche passe par l'état React (moins de rendus).
  const compteur = useRef(nouvelEtatCompteur());
  const derniereMajAngle = useRef(0);
  // Le plus petit et le plus grand angle vus depuis la remise à zéro
  // (16/09/2026). Retour de Hafiz : « tout apparaissait mais le compteur ne
  // marchait pas ». On ne peut pas lire un angle qui bouge en pleine pompe :
  // ces deux nombres, lus APRÈS quelques pompes, disent si les seuils
  // (bras tendus / bras pliés) sont atteints par son mouvement réel.
  const extremes = useRef({ min: null, max: null });
  const [extremesAffiches, setExtremesAffiches] = useState({ min: null, max: null });
  // Ce que le compteur a DÉDUIT de ton mouvement (21/09/2026) : quel signal il
  // utilise, sur quelle amplitude, et où il a posé ses deux seuils. Sans ça, un
  // compteur qui reste à 0 ne dit pas POURQUOI.
  const [etalonnage, setEtalonnage] = useState({
    signal: 'angle', etalonne: false, seuilBas: null, seuilHaut: null, amplitude: null,
  });
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
    extremes.current = { min: null, max: null };
    setExtremesAffiches({ min: null, max: null });
    setEtalonnage({ signal: 'angle', etalonne: false, seuilBas: null, seuilHaut: null, amplitude: null });
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
      const mesure = mesureDepuisPoints(m.points, m.t, REGLAGES_POMPES);
      const a = mesure.angle;
      const suivant = avancerCompteur(compteur.current, mesure, REGLAGES_POMPES);
      compteur.current = suivant;
      if (a !== null) {
        const { min, max } = extremes.current;
        extremes.current = {
          min: min === null ? a : Math.min(min, a),
          max: max === null ? a : Math.max(max, a),
        };
      }
      setReps(suivant.reps);
      // L'affichage de l'angle est limité à ~8 mises à jour par seconde.
      if (m.t - derniereMajAngle.current > 120) {
        derniereMajAngle.current = m.t;
        setAngle(a);
        setPhase(suivant.phase);
        setExtremesAffiches({ ...extremes.current });
        setEtalonnage({
          signal: suivant.signal, etalonne: suivant.etalonne,
          seuilBas: suivant.seuilBas, seuilHaut: suivant.seuilHaut, amplitude: suivant.amplitude,
        });
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
        {etalonnage.etalonne
          ? `Seuils réglés sur TON mouvement : en bas sous ${arrondi(etalonnage.seuilBas, etalonnage.signal)}, `
            + `en haut au-dessus de ${arrondi(etalonnage.seuilHaut, etalonnage.signal)}`
            + `${etalonnage.signal === 'descente' ? ' (mesure de descente : l\'angle bougeait trop peu)' : ''}. `
            + 'Une pompe compte quand tu remontes.'
          : `Les premières secondes servent à s'étalonner : bouge franchement. En attendant, `
            + `bras tendus au-dessus de ${REGLAGES_POMPES.angleHaut}°, pliés sous ${REGLAGES_POMPES.angleBas}°.`}
      </Text>
      <View style={styles.carteExtremes}>
        <Text style={styles.titreExtremes}>Depuis la remise à zéro</Text>
        <Text style={styles.valeursExtremes}>
          Plus petit angle : {extremesAffiches.min === null ? '—' : `${Math.round(extremesAffiches.min)}°`}
          {'   ·   '}
          Plus grand : {extremesAffiches.max === null ? '—' : `${Math.round(extremesAffiches.max)}°`}
        </Text>
        <Text style={styles.valeursExtremes}>
          Amplitude vue : {etalonnage.amplitude === null ? '—' : arrondi(etalonnage.amplitude, etalonnage.signal)}
          {'   ·   '}
          Étalonné : {etalonnage.etalonne ? `oui (${etalonnage.signal})` : 'pas encore'}
        </Text>
        <Text style={styles.aide}>
          Remets à zéro, fais 5 pompes, puis lis ces nombres. Le compteur n'a plus besoin
          d'angles précis : il lui faut seulement une amplitude d'au moins{' '}
          {REGLAGES_POMPES.amplitudeAngleMin}°. Si « Étalonné » reste à « pas encore »,
          c'est que la caméra ne voit pas assez ton mouvement — recule-la ou tourne-toi
          de trois quarts.
        </Text>
      </View>

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
  carteExtremes: {
    marginTop: espacement.m, padding: espacement.s, borderRadius: 10,
    borderWidth: 1, borderColor: colors.or,
  },
  titreExtremes: { color: colors.texteGris, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  valeursExtremes: { color: colors.or, fontSize: 16, fontWeight: '800', marginTop: 4 },
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
