// CameraPompes — version TÉLÉPHONE (Android / iOS).
// La version web est dans CameraPompes.web.js : Expo choisit tout seul le bon
// fichier selon la plateforme, et n'embarque jamais `react-native-webview` sur
// le web (ce module n'y fonctionne pas).
//
// Rôle : afficher la page de détection (src/pompes/pageDetection.js) et
// transmettre ses messages à l'écran qui l'utilise, via `onMessage`.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Platform, PermissionsAndroid, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, espacement } from '../theme';
import { htmlDetectionPompes } from '../pompes/pageDetection';

export default function CameraPompes({ onMessage, style }) {
  // Sur Android, l'app doit avoir la permission CAMÉRA pour que la page puisse
  // ouvrir la caméra : on la demande AVANT d'afficher la page.
  const [permission, setPermission] = useState(Platform.OS === 'android' ? 'demande' : 'ok');
  const html = useMemo(() => htmlDetectionPompes(), []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Caméra',
      message: 'Fitness Royale utilise ta caméra pour compter tes pompes. Rien n\'est enregistré.',
      buttonPositive: 'OK',
    })
      .then((reponse) => setPermission(reponse === PermissionsAndroid.RESULTS.GRANTED ? 'ok' : 'refusee'))
      .catch(() => setPermission('refusee'));
  }, []);

  if (permission !== 'ok') {
    return (
      <View style={[styles.cadre, styles.centre, style]}>
        <Text style={styles.texte}>
          {permission === 'demande'
            ? 'Autorisation de la caméra…'
            : 'Caméra refusée : autorise-la dans les réglages du téléphone pour compter tes pompes.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.cadre, style]}>
      <WebView
        // Adresse de base en https : la caméra n'est accessible qu'à une page
        // considérée comme « sûre ».
        source={{ html, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantBehavior="grant"
        onMessage={(e) => {
          try {
            onMessage?.(JSON.parse(e.nativeEvent.data));
          } catch {
            // Message illisible : ignoré, la page en renverra un autre.
          }
        }}
        style={styles.page}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: espacement.m },
  texte: { color: colors.texteGris, textAlign: 'center' },
  page: { flex: 1, backgroundColor: 'transparent' },
});
