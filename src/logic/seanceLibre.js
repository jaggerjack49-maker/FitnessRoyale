// LE CHRONO DE SÉANCE ET « UNE SÉANCE LIBRE DEVIENT UN PROGRAMME » — logique
// pure, testable (demandes de Hafiz du 08/11/2026 : « un chrono qui se lance
// automatiquement au début de la séance » et « la possibilité d'ajouter les
// exercices d'une séance libre à un nouveau programme »).
//
// Rien ici ne touche à React ni au serveur : ces règles tournent sous Node
// dans `backend/tests/harnais/harnais_seance_libre.mjs`.

// ---------------------------------------------------------------------------
// LE CHRONO
// ---------------------------------------------------------------------------
// On ne compte PAS les secondes une par une : on retient l'INSTANT où la
// séance a commencé (`debutChrono`, en millisecondes) et on affiche l'écart
// avec maintenant. Conséquence voulue : le chrono reste juste si l'app passe en
// arrière-plan, change d'onglet ou est relancée — un compteur incrémenté, lui,
// s'arrêterait dès que l'écran ne tourne plus.

// Les secondes écoulées depuis le début. Jamais négatif, jamais NaN : une date
// absente ou illisible donne 0 plutôt qu'un « NaN:NaN » à l'écran (le piège du
// chrono des duels sur Android, 09/08/2026).
export function secondesEcoulees(debutMs, maintenantMs) {
  const debut = Number(debutMs);
  const maintenant = Number(maintenantMs);
  if (!Number.isFinite(debut) || !Number.isFinite(maintenant) || debut <= 0) return 0;
  return Math.max(0, Math.floor((maintenant - debut) / 1000));
}

// « 4:07 », « 47:12 », puis « 1:02:05 » au-delà d'une heure.
export function chronoLisible(secondes) {
  const total = Math.max(0, Math.floor(Number(secondes) || 0));
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  if (heures > 0) return `${heures}:${String(minutes).padStart(2, '0')}:${sec}`;
  return `${minutes}:${sec}`;
}

// ---------------------------------------------------------------------------
// LA DURÉE RÉELLE D'UNE SÉANCE (10/11/2026)
// ---------------------------------------------------------------------------
// Demande de Hafiz : la durée dans l'historique, et la durée moyenne dans les
// stats. Le chrono donne le DÉBUT ; reste à décider de la FIN.
//
// ⚠️ PAS « le moment où l'on touche Terminer » : une séance oubliée ouverte
// et terminée le lendemain matin durerait 12 heures. La fin retenue est la
// DERNIÈRE SÉRIE NOTÉE (chaque série retient son `instant`), plus une marge
// pour la dernière récupération et le rangement — sauf si l'on termine avant
// la fin de cette marge, auquel cas c'est l'instant réel.
// On ne mesure RIEN (null → le serveur garde son estimation) quand :
//   - le chrono n'a pas d'instant de départ (séance d'avant le chrono) ;
//   - aucune série ne porte d'instant (séries notées avant ce correctif) ;
//   - le résultat dépasse 5 h : une séance reprise le lendemain, pas un
//     entraînement de 5 h. Mieux vaut l'estimation qu'un chiffre faux.
export const MARGE_APRES_DERNIERE_SERIE_MS = 10 * 60 * 1000;
export const DUREE_MAX_MINUTES = 300;

export function dureeReelleMinutes(debutMs, series, finMs) {
  const debut = Number(debutMs);
  const fin = Number(finMs);
  if (!Number.isFinite(debut) || debut <= 0 || !Number.isFinite(fin)) return null;
  const instants = (Array.isArray(series) ? series : [])
    .map((s) => Number(s && s.instant))
    .filter((t) => Number.isFinite(t) && t >= debut);
  if (instants.length === 0) return null;
  const derniere = Math.max(...instants);
  const finRetenue = Math.min(fin, derniere + MARGE_APRES_DERNIERE_SERIE_MS);
  if (finRetenue <= debut) return null;
  const minutes = Math.max(1, Math.round((finRetenue - debut) / 60000));
  return minutes > DUREE_MAX_MINUTES ? null : minutes;
}

// ---------------------------------------------------------------------------
// LE RIR RESSENTI D'UNE SÉRIE (11/11/2026)
// ---------------------------------------------------------------------------
// Demande de Hafiz : « noter l'effort ressenti pendant la série via le RIR ».
// Le RIR (« reps in reserve ») = combien de répétitions on avait encore en
// réserve : 0 = jusqu'à l'échec. FACULTATIF à chaque série.
// À ne pas confondre avec le RIR VISÉ d'un programme (`rir_cible`).

export const RIR_MAX = 10;

// Ce qu'on a tapé dans le champ RIR :
//   - champ vide            → null      (pas noté, c'est permis) ;
//   - un entier de 0 à 10   → ce nombre (0 est une VRAIE valeur : l'échec) ;
//   - n'importe quoi d'autre → undefined (refusé : l'écran le dit).
export function lireRirSaisi(texte) {
  const brut = String(texte ?? '').trim();
  if (brut === '') return null;
  if (!/^\d{1,2}$/.test(brut)) return undefined;
  const n = parseInt(brut, 10);
  return n >= 0 && n <= RIR_MAX ? n : undefined;
}

// « 100 kg × 8 reps · RIR 2 » — UNE SEULE écriture d'une série, pour l'écran
// de séance ET le détail d'une séance passée.
export function libelleSerie(serie) {
  if (!serie || typeof serie !== 'object') return '';
  const base = `${serie.poids} kg × ${serie.reps} reps`;
  const rir = Number(serie.rir);
  const aRir = serie.rir !== null && serie.rir !== undefined && serie.rir !== ''
    && Number.isFinite(rir);
  return aRir ? `${base} · RIR ${rir}` : base;
}

// ---------------------------------------------------------------------------
// D'UNE SÉANCE À UN PROGRAMME
// ---------------------------------------------------------------------------

// L'objectif de départ d'un exercice, DÉDUIT de ce qu'on vient de faire :
// autant de séries que celles réellement faites, et les reps de la dernière.
// C'est la seule information honnête dont on dispose — on n'invente pas un
// « 4 × 12 » que personne n'a choisi. Un exercice ajouté mais jamais fait
// reçoit 3 × 10, un point de départ neutre à corriger dans l'éditeur.
// UNE SEULE DÉFINITION : « Ajouter au programme » (pendant une séance
// programmée) l'utilise aussi.
export function objectifDepuisSeries(series) {
  const liste = Array.isArray(series) ? series.filter(Boolean) : [];
  const derniere = liste[liste.length - 1];
  return {
    series_cibles: Math.max(1, liste.length || 3),
    reps_cibles: Math.max(1, parseInt(derniere?.reps, 10) || 10),
  };
}

function cleNom(nom) {
  return String(nom || '').trim().toLowerCase();
}

// Les exercices d'un programme fabriqué à partir d'une séance.
//   - `noms` : l'ordre voulu (celui de la séance) ; peut être vide, on prend
//     alors l'ordre d'apparition dans les séries ;
//   - `series` : les séries à plat, chacune avec son `exercice`.
// Un nom vide est ignoré ; un même exercice écrit deux fois (casse, espaces)
// ne donne qu'une ligne.
export function exercicesPourProgramme(noms, series) {
  const toutes = (Array.isArray(series) ? series : []).filter((s) => s && s.exercice);
  const ordre = [
    ...(Array.isArray(noms) ? noms : []),
    ...toutes.map((s) => s.exercice),
  ];
  const vus = new Set();
  const resultat = [];
  for (const nom of ordre) {
    const propre = String(nom || '').trim();
    const cle = cleNom(propre);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    const sesSeries = toutes.filter((s) => cleNom(s.exercice) === cle);
    resultat.push({ exercice: propre, ...objectifDepuisSeries(sesSeries) });
  }
  return resultat;
}
