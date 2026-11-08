// LE TEMPS DE REPOS ET L'ORDRE DES EXERCICES PENDANT LA SÉANCE — logique pure,
// testable (demande de Hafiz du 08/11/2026 : « on doit pouvoir fixer des temps
// de repos lorsqu'on crée le programme et lorsqu'on termine une série le temps
// de repos s'active, et l'ordre des exercices doit être pris en compte »).
//
// Rien ici ne touche à React : ces règles tournent sous Node dans
// `backend/tests/harnais/harnais_repos.mjs`.

// Le repos proposé quand le programme n'en fixe pas (séance libre, exercice
// ajouté en cours de route, programme écrit avant ce réglage). 1 min 30 : un
// milieu raisonnable entre un exercice d'isolation et un gros polyarticulaire.
export const REPOS_PAR_DEFAUT = 90;

// Au-delà de 15 min, ce n'est plus un repos entre deux séries. Même plafond
// que le serveur (`repos_secondes` ≤ 900 dans main.py).
export const REPOS_MAX = 900;

// Le repos d'un exercice de programme, en secondes. 0 est une vraie valeur
// (« pas de repos », enchaîner) — seul un repos ABSENT retombe sur le défaut.
export function reposDe(exo) {
  const valeur = exo?.repos_secondes;
  if (typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0) {
    return Math.min(REPOS_MAX, Math.round(valeur));
  }
  return REPOS_PAR_DEFAUT;
}

// ---------------------------------------------------------------------------
// SAISIR UNE DURÉE
// ---------------------------------------------------------------------------
// Dans l'éditeur, on tape le repos comme on le dit : « 90 » (secondes) ou
// « 1:30 » (minutes:secondes). Vide ou illisible → null (= pas fixé).
export function lireDuree(texte) {
  const brut = String(texte ?? '').trim();
  if (!brut) return null;
  let secondes;
  const morceaux = brut.split(/[:'’]/);
  if (morceaux.length === 2) {
    const minutes = Number(morceaux[0] || 0);
    const sec = Number(morceaux[1] || 0);
    if (!Number.isInteger(minutes) || !Number.isInteger(sec) || minutes < 0
      || sec < 0 || sec > 59) return null;
    secondes = minutes * 60 + sec;
  } else if (morceaux.length === 1 && /^\d+$/.test(brut)) {
    secondes = Number(brut);
  } else {
    return null;
  }
  return Math.min(REPOS_MAX, secondes);
}

// 90 → « 1:30 », 45 → « 0:45 ». Rien (null) → '' (un champ vide).
export function dureeLisible(secondes) {
  if (secondes === null || secondes === undefined || secondes === '') return '';
  const total = Math.max(0, Math.round(Number(secondes)));
  if (!Number.isFinite(total)) return '';
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// LE MINUTEUR
// ---------------------------------------------------------------------------
// Comme le chrono de séance, il ne décompte pas seconde par seconde : on
// retient l'INSTANT où le repos finit (`finMs`) et on affiche l'écart. Il
// reste donc juste après une mise en veille ou une relance de l'app.
export function secondesRestantes(finMs, maintenantMs) {
  const fin = Number(finMs);
  const maintenant = Number(maintenantMs);
  if (!Number.isFinite(fin) || !Number.isFinite(maintenant) || fin <= 0) return 0;
  return Math.max(0, Math.ceil((fin - maintenant) / 1000));
}

// ---------------------------------------------------------------------------
// LA PROCHAINE ÉTAPE, DANS L'ORDRE DU PROGRAMME
// ---------------------------------------------------------------------------
// Ce que le repos annonce : « Prochain : développé couché, série 3 ».
//   - `ordre`         : les exercices de la séance, dans leur ordre ;
//   - `seriesFaites`  : { exercice: [séries déjà faites] } ;
//   - `objectifs`     : { exercice: nombre de séries prévu } (absent = séance
//                        libre ou exercice ajouté : on ne sait pas combien) ;
//   - `courant`       : l'exercice dont on vient de finir une série.
// La règle :
//   1. tant que l'exercice courant n'a pas fait ses séries → on y reste ;
//   2. sinon, le PREMIER exercice de l'ordre qui a encore des séries à faire —
//      c'est là que l'ordre compte : un exercice sauté plus haut redevient la
//      prochaine étape avant ceux d'en dessous ;
//   3. un exercice sans objectif n'a pas de fin connue : si c'est le courant,
//      on y reste ; sinon il n'est proposé que s'il n'a encore AUCUNE série ;
//   4. plus rien à faire → null (la séance est complète).
export function prochaineEtape(ordre, seriesFaites, objectifs, courant) {
  const liste = (Array.isArray(ordre) ? ordre : [])
    .filter((nom) => typeof nom === 'string' && nom.trim());
  const faites = seriesFaites && typeof seriesFaites === 'object' ? seriesFaites : {};
  const cibles = objectifs && typeof objectifs === 'object' ? objectifs : {};
  const nbFaites = (nom) => (Array.isArray(faites[nom]) ? faites[nom].filter(Boolean).length : 0);
  const cibleDe = (nom) => {
    const n = Number(cibles[nom]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };
  const etape = (nom) => ({ exercice: nom, numero: nbFaites(nom) + 1 });

  if (courant && liste.includes(courant)) {
    const cible = cibleDe(courant);
    if (cible === null || nbFaites(courant) < cible) return etape(courant);
  }
  for (const nom of liste) {
    const cible = cibleDe(nom);
    if (cible !== null && nbFaites(nom) < cible) return etape(nom);
  }
  for (const nom of liste) {
    if (cibleDe(nom) === null && nbFaites(nom) === 0) return etape(nom);
  }
  return null;
}

// « Prochain : développé couché — série 3 » / « Dernière série faite ».
export function libelleEtape(etape) {
  if (!etape) return 'Toutes les séries prévues sont faites.';
  return `Prochain : ${etape.exercice} — série ${etape.numero}`;
}
