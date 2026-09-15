// La page web qui regarde la caméra et repère les bras (prototype du 15/09/2026).
//
// POURQUOI UNE PAGE WEB DANS L'APP : Expo ne donne pas accès, image par image,
// au flux de la caméra, et un module natif de détection du corps ajouterait
// plusieurs dépendances lourdes, sans version web. Une page web, elle, sait
// ouvrir la caméra (getUserMedia) et faire tourner MediaPipe (l'IA de Google
// qui repère le corps). On la charge :
// - sur téléphone, dans un WebView (src/components/CameraPompes.js) ;
// - sur la version web, dans un cadre <iframe> (CameraPompes.web.js).
// Et le jour de l'appel vidéo en direct, il pourra vivre dans cette même page.
//
// CE QUE LA PAGE FAIT : elle ouvre la caméra AVANT, dessine les bras en or
// par-dessus l'image, et envoie à l'app, pour chaque image, les 6 points
// utiles (épaules, coudes, poignets). Elle NE COMPTE PAS : le comptage vit dans
// src/logic/compteurPompes.js, où il peut être testé.
//
// MESSAGES ENVOYÉS À L'APP :
//   { type: 'etat', message }         — étape en cours (chargement, caméra…)
//   { type: 'pret' }                  — la détection tourne
//   { type: 'pose', t, points|null }  — une image analysée (null = personne)
//   { type: 'erreur', nom, message }  — ça n'a pas pu démarrer
//
// ⚠️ MediaPipe et son modèle sont téléchargés AU LANCEMENT (CDN jsDelivr et
// Google) : il faut Internet. Pour un duel en ligne, c'est de toute façon le
// cas. Les versions sont FIGÉES pour que la détection ne change pas toute seule.

export const VERSION_MEDIAPIPE = '1.0.1';
export const MODELE_POSE =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Le code qui tourne DANS la page. ⚠️ Écrit sans accents graves ni « ${ » :
// il est rangé dans une chaîne, qui les interpréterait avant la page.
const SCRIPT_PAGE = `
const INDICES = [11, 12, 13, 14, 15, 16];
const video = document.getElementById('video');
const calque = document.getElementById('calque');
const ctx = calque.getContext('2d');

function envoyer(message) {
  try {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    } else if (window.parent !== window) {
      window.parent.postMessage({ source: 'fr-pompes', message: message }, '*');
    }
  } catch (e) {}
}

window.addEventListener('error', function (e) {
  envoyer({ type: 'erreur', nom: 'Error', message: String(e.message || e) });
});

function visibilite(p) {
  return p && typeof p.visibility === 'number' ? p.visibility : 0;
}

function dessiner(ecran) {
  if (calque.width !== video.videoWidth) {
    calque.width = video.videoWidth;
    calque.height = video.videoHeight;
  }
  ctx.clearRect(0, 0, calque.width, calque.height);
  if (!ecran) return;
  const segments = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12]];
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  segments.forEach(function (s) {
    const a = ecran[s[0]];
    const b = ecran[s[1]];
    const bienVu = visibilite(a) >= 0.5 && visibilite(b) >= 0.5;
    ctx.strokeStyle = bienVu ? '#e8b23a' : 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(a.x * calque.width, a.y * calque.height);
    ctx.lineTo(b.x * calque.width, b.y * calque.height);
    ctx.stroke();
  });
}

async function creerDetecteur(vision, fichiers) {
  function options(delegue) {
    return { baseOptions: { modelAssetPath: MODELE, delegate: delegue }, runningMode: 'VIDEO', numPoses: 1 };
  }
  // La carte graphique d'abord ; certains téléphones la refusent, on se
  // rabat alors sur le processeur (plus lent, mais ça marche).
  try {
    return await vision.PoseLandmarker.createFromOptions(fichiers, options('GPU'));
  } catch (e) {
    return await vision.PoseLandmarker.createFromOptions(fichiers, options('CPU'));
  }
}

async function demarrer() {
  try {
    envoyer({ type: 'etat', message: 'Chargement de la détection…' });
    const vision = await import(BASE + '/vision_bundle.mjs');
    const fichiers = await vision.FilesetResolver.forVisionTasks(BASE + '/wasm');
    const detecteur = await creerDetecteur(vision, fichiers);

    envoyer({ type: 'etat', message: 'Ouverture de la caméra…' });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const indisponible = new Error('Caméra indisponible dans cette page.');
      indisponible.name = 'NotSupportedError';
      throw indisponible;
    }
    const flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = flux;
    await video.play();
    envoyer({ type: 'pret' });

    let dernierInstant = -1;
    function boucle() {
      // Une analyse par NOUVELLE image de la caméra, pas plus.
      if (video.readyState >= 2 && video.currentTime !== dernierInstant) {
        dernierInstant = video.currentTime;
        const t = performance.now();
        const resultat = detecteur.detectForVideo(video, t);
        const monde = resultat.worldLandmarks && resultat.worldLandmarks[0];
        const ecran = resultat.landmarks && resultat.landmarks[0];
        dessiner(ecran);
        envoyer({
          type: 'pose',
          t: Math.round(t),
          points: monde
            ? INDICES.map(function (i) {
              return [monde[i].x, monde[i].y, monde[i].z, ecran ? visibilite(ecran[i]) : visibilite(monde[i])];
            })
            : null,
        });
      }
      requestAnimationFrame(boucle);
    }
    requestAnimationFrame(boucle);
  } catch (e) {
    envoyer({ type: 'erreur', nom: e && e.name ? e.name : '', message: String(e && e.message ? e.message : e) });
  }
}

demarrer();
`;

export function htmlDetectionPompes() {
  const base = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_MEDIAPIPE}`;
  return [
    '<!doctype html>',
    '<html><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>',
    'html, body { margin: 0; height: 100%; background: #0c0b0f; overflow: hidden; }',
    '#scene { position: relative; width: 100%; height: 100%; }',
    // L'image est retournée comme dans un miroir : on se voit comme devant une glace.
    'video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }',
    '</style>',
    '</head><body>',
    '<div id="scene"><video id="video" playsinline muted autoplay></video><canvas id="calque"></canvas></div>',
    '<script type="module">',
    `const BASE = ${JSON.stringify(base)};`,
    `const MODELE = ${JSON.stringify(MODELE_POSE)};`,
    SCRIPT_PAGE,
    '</script>',
    '</body></html>',
  ].join('\n');
}
