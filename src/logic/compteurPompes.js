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
// ⚠️ LES SEUILS FIXES NE MARCHAIENT PAS — CORRIGÉ LE 21/09/2026.
// Première version : on comparait l'angle du coude à deux valeurs écrites en
// dur (bras pliés ≤ 100°, bras tendus ≥ 150°). Hafiz : « tout apparaissait
// mais le compteur ne marchait pas » — caméra, bras dessinés, angle affiché,
// et 0 pompe. C'est que, vu DE FACE, la perspective écrase l'angle : le
// mouvement réel peut n'osciller qu'entre 120° et 155°, sans jamais franchir
// ni l'un ni l'autre des deux seuils. La phase ne basculait donc JAMAIS.
//
// LA RÈGLE MAINTENANT : on ne suppose plus rien sur les valeurs. On observe le
// mouvement des dernières secondes, on en prend le minimum et le maximum, et
// on place les deux seuils à l'intérieur de CETTE amplitude (30 % de chaque
// côté, le tiers du milieu restant une zone neutre). Chaque personne, chaque
// position de téléphone, chaque angle de vue s'étalonne donc tout seul.
// Tant que le mouvement observé est trop faible pour être étalonné, on garde
// les anciens seuils fixes — utile pour la toute première pompe.
//
// DEUX SIGNAUX, choisis automatiquement :
//   1. l'ANGLE DU COUDE (épaule-coude-poignet), le plus naturel ;
//   2. si l'angle bouge trop peu (cas extrême de la vue de face), la
//      DESCENTE : la hauteur épaule→poignet rapportée à la longueur du bras.
//      Elle vaut ~1 bras tendus (l'épaule est à la verticale du poignet) et
//      chute quand la poitrine descend vers le sol.
// Les deux vont dans le même sens : GRAND = en haut, PETIT = en bas.
//
// QUATRE GARDE-FOUS contre les faux comptages (inchangés) :
// 1. deux seuils distincts : entre les deux, rien ne change — sinon un signal
//    qui tremble autour d'un seuil unique compterait une pompe à chaque
//    tremblement ;
// 2. une phase n'est acquise qu'après 150 ms : une seule image mal détectée ne
//    fait pas une pompe ;
// 3. une pompe dure au moins 500 ms (d'un « haut » au suivant) : plus vite,
//    c'est une erreur de détection, pas un humain ;
// 4. il faut être passé par le HAUT avant de descendre : commencer allongé ne
//    donne pas une pompe gratuite.

export const REGLAGES_POMPES = {
  angleBas: 100, // en dessous : bras pliés (repli, avant étalonnage)
  angleHaut: 150, // au-dessus : bras tendus (repli, avant étalonnage)
  dureePhaseMinMs: 150,
  dureeRepMinMs: 500,
  visibiliteMin: 0.5, // un bras mal vu par la caméra est ignoré
  // ----- Étalonnage automatique (21/09/2026) -----
  fenetreEtalonnageMs: 8000, // on regarde les 8 dernières secondes
  mesuresMaxFenetre: 400, // garde-fou mémoire (~13 images/s pendant 8 s)
  amplitudeAngleMin: 25, // en degrés : en dessous, le mouvement n'est pas exploitable
  amplitudeDescenteMin: 0.25, // même idée pour la descente (un rapport, pas des degrés)
  margeSeuils: 0.3, // les seuils sont posés à 30 % de chaque bout de l'amplitude
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

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Les bras assez bien vus pour être utilisés, sous forme [épaule, coude, poignet].
function brasUtilisables(points, reglages) {
  if (!Array.isArray(points) || points.length < 6) return [];
  const bons = [];
  for (const [e, c, p] of BRAS) {
    const trio = [points[e], points[c], points[p]];
    if (!trio.every(estPoint)) continue;
    if (trio.some((q) => !(Number(q[3]) >= reglages.visibiliteMin))) continue;
    bons.push(trio);
  }
  return bons;
}

function moyenne(valeurs) {
  if (valeurs.length === 0) return null;
  return valeurs.reduce((somme, x) => somme + x, 0) / valeurs.length;
}

// L'angle des coudes pour une image : la moyenne des bras BIEN VUS.
// null si aucun bras n'est assez visible (personne hors cadre, bras cachés).
export function angleCoudes(points, reglages = REGLAGES_POMPES) {
  const bras = brasUtilisables(points, reglages);
  const angles = [];
  for (const trio of bras) {
    const angle = angleEntre(trio[0], trio[1], trio[2]);
    if (angle !== null) angles.push(angle);
  }
  return moyenne(angles);
}

// LA DESCENTE : de combien l'épaule est-elle au-dessus du poignet, rapporté à
// la longueur du bras ? ~1 quand le bras est tendu à la verticale, proche de 0
// quand la poitrine est au sol. Sert de second signal quand l'angle du coude
// bouge trop peu pour être exploitable (vue de face très écrasée).
export function descenteBras(points, reglages = REGLAGES_POMPES) {
  const bras = brasUtilisables(points, reglages);
  const valeurs = [];
  for (const [epaule, coude, poignet] of bras) {
    const longueur = distance(epaule, coude) + distance(coude, poignet);
    if (!(longueur > 0)) continue;
    valeurs.push(Math.abs(epaule[1] - poignet[1]) / longueur);
  }
  return moyenne(valeurs);
}

// Ce qu'on retient d'une image : les deux signaux d'un coup.
export function mesureDepuisPoints(points, t, reglages = REGLAGES_POMPES) {
  return {
    angle: angleCoudes(points, reglages),
    descente: descenteBras(points, reglages),
    t,
  };
}

export function nouvelEtatCompteur() {
  return {
    phase: 'inconnue', // 'inconnue' | 'haut' | 'bas'
    candidat: null, // la phase qu'on est peut-être en train d'atteindre…
    debutCandidat: null, // … et depuis quand
    debutHaut: null, // quand la dernière phase HAUTE a commencé
    reps: 0,
    // ---- Étalonnage : ce qu'on a observé, et ce qu'on en a déduit ----
    fenetre: [], // les mesures des dernières secondes
    signal: 'angle', // le signal réellement utilisé ('angle' ou 'descente')
    etalonne: false, // a-t-on assez vu bouger pour poser nos propres seuils ?
    seuilBas: null, // les deux seuils en cours (affichés à l'écran de test)
    seuilHaut: null,
    amplitude: null, // l'amplitude observée sur le signal utilisé
  };
}

// Le plus petit et le plus grand d'un signal sur la fenêtre observée.
function etendue(fenetre, cle) {
  let min = null;
  let max = null;
  for (const m of fenetre) {
    const v = m[cle];
    if (!Number.isFinite(v)) continue;
    if (min === null || v < min) min = v;
    if (max === null || v > max) max = v;
  }
  if (min === null) return null;
  return { min, max, amplitude: max - min };
}

// CHOISIR LE SIGNAL ET POSER LES SEUILS.
// On préfère toujours l'angle du coude quand il bouge assez ; la descente n'est
// qu'un secours pour les vues où l'angle est écrasé. Si aucun des deux n'a
// bougé assez, on garde les seuils fixes d'origine (repli des débuts).
function etalonner(fenetre, reglages) {
  const angle = etendue(fenetre, 'angle');
  if (angle && angle.amplitude >= reglages.amplitudeAngleMin) {
    const marge = angle.amplitude * reglages.margeSeuils;
    return {
      signal: 'angle',
      etalonne: true,
      seuilBas: angle.min + marge,
      seuilHaut: angle.max - marge,
      amplitude: angle.amplitude,
    };
  }
  const descente = etendue(fenetre, 'descente');
  if (descente && descente.amplitude >= reglages.amplitudeDescenteMin) {
    const marge = descente.amplitude * reglages.margeSeuils;
    return {
      signal: 'descente',
      etalonne: true,
      seuilBas: descente.min + marge,
      seuilHaut: descente.max - marge,
      amplitude: descente.amplitude,
    };
  }
  return {
    signal: 'angle',
    etalonne: false,
    seuilBas: reglages.angleBas,
    seuilHaut: reglages.angleHaut,
    amplitude: angle ? angle.amplitude : null,
  };
}

// Fait avancer le compteur d'UNE mesure { angle, descente, t } (t en ms).
// Fonction PURE : renvoie un nouvel état, ne modifie jamais celui reçu.
export function avancerCompteur(etat, mesure, reglages = REGLAGES_POMPES) {
  const base = etat && typeof etat === 'object' ? etat : nouvelEtatCompteur();
  const fenetreBase = Array.isArray(base.fenetre) ? base.fenetre : [];
  const angle = mesure ? mesure.angle : null;
  const descente = mesure ? mesure.descente : null;
  const t = mesure ? mesure.t : null;

  // Image inutilisable (personne détectée, ou horloge absurde) : on garde la
  // phase acquise — être perdu un instant tout en bas, visage près de
  // l'objectif, ne doit pas annuler la pompe — mais on oublie la phase en
  // cours de confirmation.
  if (!Number.isFinite(t) || (!Number.isFinite(angle) && !Number.isFinite(descente))) {
    return { ...base, fenetre: fenetreBase, candidat: null, debutCandidat: null };
  }

  // 1) On range cette mesure et on oublie ce qui est trop vieux.
  let fenetre = [...fenetreBase, { angle, descente, t }]
    .filter((m) => t - m.t <= reglages.fenetreEtalonnageMs);
  if (fenetre.length > reglages.mesuresMaxFenetre) {
    fenetre = fenetre.slice(fenetre.length - reglages.mesuresMaxFenetre);
  }

  // 2) On (re)calcule nos seuils sur ce qu'on vient d'observer.
  const reglage = etalonner(fenetre, reglages);
  const avec = { ...base, ...reglage, fenetre };

  const valeur = reglage.signal === 'angle' ? angle : descente;
  if (!Number.isFinite(valeur)) {
    return { ...avec, candidat: null, debutCandidat: null };
  }

  // 3) La machine à états, identique à avant — seuls les seuils ont changé.
  let lue = null;
  if (valeur <= reglage.seuilBas) lue = 'bas';
  else if (valeur >= reglage.seuilHaut) lue = 'haut';

  // Zone neutre, ou déjà dans cette phase : rien à confirmer.
  if (lue === null || lue === base.phase) {
    return { ...avec, candidat: null, debutCandidat: null };
  }

  // Nouvelle phase aperçue : on commence à la chronométrer.
  if (base.candidat !== lue) {
    return { ...avec, candidat: lue, debutCandidat: t };
  }

  // Pas encore tenue assez longtemps (garde-fou 2).
  if (t - base.debutCandidat < reglages.dureePhaseMinMs) return avec;

  // La phase est CONFIRMÉE, datée du moment où elle a commencé.
  const debut = base.debutCandidat;
  const suivant = { ...avec, phase: lue, candidat: null, debutCandidat: null };

  if (lue === 'haut') {
    const cycleComplet = base.phase === 'bas' && base.debutHaut !== null; // garde-fou 4
    const assezLent = base.debutHaut === null || debut - base.debutHaut >= reglages.dureeRepMinMs; // garde-fou 3
    if (cycleComplet && assezLent) suivant.reps = base.reps + 1;
    suivant.debutHaut = debut;
  }
  return suivant;
}
