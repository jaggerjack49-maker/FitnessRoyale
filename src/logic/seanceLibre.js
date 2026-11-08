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
