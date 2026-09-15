// compteurPompes — compter des pompes à partir de la position des bras.
//
// Demande de Hafiz du 15/09/2026 : un duel de pompes en ligne (« celui qui en
// fait le plus en 1 minute »), face à la caméra, avec une barre qui avance à
// chaque pompe comme dans les jeux de combat. Ce fichier est la BRIQUE DU
// COMPTAGE, testée seule avant de construire le duel autour (prototype).
//
// D'OÙ VIENNENT LES DONNÉES : la page de détection (src/pompes/pageDetection.js)
// fait tourner MediaPipe (Google) sur l'image de la caméra et nous envoie, pour
// chaque image, 6 points du corps en 3D : épaules, coudes, poignets (gauche et
// droite), chacun sous la forme [x, y, z, visibilité].
//
// POURQUOI LE COMPTAGE VIT ICI ET PAS DANS LA PAGE : ici c'est du JavaScript
// ordinaire, donc TESTABLE (voir backend/tests/test_compteur_pompes.py). La
// page web, elle, ne se teste qu'avec une vraie caméra.
//
// LA RÈGLE : l'angle du coude (épaule-coude-poignet) vaut ~170° bras tendus
// (en haut) et ~80° bras pliés (en bas). Une pompe = un cycle complet
// HAUT → BAS → HAUT, comptée au moment où l'on REMONTE.
// On mesure l'angle en 3D (coordonnées « monde » de MediaPipe) : de face, un
// angle mesuré à plat sur l'image serait écrasé par la perspective.
//
// QUATRE GARDE-FOUS contre les faux comptages :
// 1. deux seuils distincts (bas ≤ 100°, haut ≥ 150°) : entre les deux, rien ne
//    change — sinon un angle qui tremble autour d'un seuil unique compterait
//    une pompe à chaque tremblement ;
// 2. une phase n'est acquise qu'après 150 ms : une seule image mal détectée ne
//    fait pas une pompe ;
// 3. une pompe dure au moins 500 ms (d'un « haut » au suivant) : plus vite,
//    c'est une erreur de détection, pas un humain ;
// 4. il faut être passé par le HAUT avant de descendre : commencer allongé ne
//    donne pas une pompe gratuite.

export const REGLAGES_POMPES = {
  angleBas: 100, // en dessous : bras pliés
  angleHaut: 150, // au-dessus : bras tendus
  dureePhaseMinMs: 150,
  dureeRepMinMs: 500,
  visibiliteMin: 0.5, // un bras mal vu par la caméra est ignoré
};

// Ordre des 6 points envoyés par la page de détection.
const BRAS = [
  [0, 2, 4], // épaule, coude, poignet GAUCHES
  [1, 3, 5], // épaule, coude, poignet DROITS
];

function estPoint(p) {
  return Array.isArray(p) && p.length >= 3
    && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);
}

// Angle (en degrés) au point B, entre les segments B→A et B→C.
// Renvoie null si un point est inutilisable, plutôt que de planter.
export function angleEntre(a, b, c) {
  if (!estPoint(a) || !estPoint(b) || !estPoint(c)) return null;
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const nu = Math.hypot(u[0], u[1], u[2]);
  const nv = Math.hypot(v[0], v[1], v[2]);
  if (nu === 0 || nv === 0) return null;
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

// L'angle des coudes pour une image : la moyenne des bras BIEN VUS.
// null si aucun bras n'est assez visible (personne hors cadre, bras cachés).
export function angleCoudes(points, reglages = REGLAGES_POMPES) {
  if (!Array.isArray(points) || points.length < 6) return null;
  const angles = [];
  for (const [e, c, p] of BRAS) {
    const trio = [points[e], points[c], points[p]];
    if (!trio.every(estPoint)) continue;
    if (trio.some((q) => !(Number(q[3]) >= reglages.visibiliteMin))) continue;
    const angle = angleEntre(trio[0], trio[1], trio[2]);
    if (angle !== null) angles.push(angle);
  }
  if (angles.length === 0) return null;
  return angles.reduce((somme, x) => somme + x, 0) / angles.length;
}

export function nouvelEtatCompteur() {
  return {
    phase: 'inconnue', // 'inconnue' | 'haut' | 'bas'
    candidat: null, // la phase qu'on est peut-être en train d'atteindre…
    debutCandidat: null, // … et depuis quand
    debutHaut: null, // quand la dernière phase HAUTE a commencé
    reps: 0,
  };
}

// Fait avancer le compteur d'UNE mesure { angle, t } (t en millisecondes).
// Fonction PURE : renvoie un nouvel état, ne modifie jamais celui reçu.
export function avancerCompteur(etat, mesure, reglages = REGLAGES_POMPES) {
  const base = etat && typeof etat === 'object' ? etat : nouvelEtatCompteur();
  const angle = mesure ? mesure.angle : null;
  const t = mesure ? mesure.t : null;

  // Personne détectée cette image : on garde la phase acquise (être perdu un
  // instant tout en bas, visage près de l'objectif, ne doit pas annuler la
  // pompe), mais on oublie la phase en cours de confirmation.
  if (!Number.isFinite(angle) || !Number.isFinite(t)) {
    return { ...base, candidat: null, debutCandidat: null };
  }

  let lue = null;
  if (angle <= reglages.angleBas) lue = 'bas';
  else if (angle >= reglages.angleHaut) lue = 'haut';

  // Zone neutre, ou déjà dans cette phase : rien à confirmer.
  if (lue === null || lue === base.phase) {
    return { ...base, candidat: null, debutCandidat: null };
  }

  // Nouvelle phase aperçue : on commence à la chronométrer.
  if (base.candidat !== lue) {
    return { ...base, candidat: lue, debutCandidat: t };
  }

  // Pas encore tenue assez longtemps (garde-fou 2).
  if (t - base.debutCandidat < reglages.dureePhaseMinMs) return base;

  // La phase est CONFIRMÉE, datée du moment où elle a commencé.
  const debut = base.debutCandidat;
  const suivant = { ...base, phase: lue, candidat: null, debutCandidat: null };

  if (lue === 'haut') {
    const cycleComplet = base.phase === 'bas' && base.debutHaut !== null; // garde-fou 4
    const assezLent = base.debutHaut === null || debut - base.debutHaut >= reglages.dureeRepMinMs; // garde-fou 3
    if (cycleComplet && assezLent) suivant.reps = base.reps + 1;
    suivant.debutHaut = debut;
  }
  return suivant;
}
