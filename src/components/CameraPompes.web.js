// CameraPompes — version WEB (navigateur).
// Même rôle que CameraPompes.js, mais `react-native-webview` n'existe pas sur
// le web : la page de détection est posée dans un cadre <iframe>, et ses
// messages arrivent par `window.postMessage`.
import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { htmlDetectionPompes } from '../pompes/pageDetection';

export default function CameraPompes({ onMessage, style }) {
  const html = useMemo(() => htmlDetectionPompes(), []);
  const cadre = useRef(null);
  // Toujours la DERNIÈRE fonction reçue, sans réabonner l'écoute à chaque rendu.
  const rappel = useRef(onMessage);
  rappel.current = onMessage;

  useEffect(() => {
    function recevoir(e) {
      const donnees = e.data;
      if (!donnees || donnees.source !== 'fr-pompes') return;
      // Seulement NOTRE cadre (s'il y en avait deux à l'écran).
      if (cadre.current && e.source !== cadre.current.contentWindow) return;
      rappel.current?.(donnees.message);
    }
    window.addEventListener('message', recevoir);
    return () => window.removeEventListener('message', recevoir);
  }, []);

  return (
    <View style={[styles.cadre, style]}>
      {React.createElement('iframe', {
        ref: cadre,
        srcDoc: html,
        allow: 'camera; autoplay',
        title: 'Détection des pompes',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
});
