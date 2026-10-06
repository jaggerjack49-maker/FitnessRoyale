// PROJETER UN PROGRAMME SUR PLUSIEURS SEMAINES — le tableau de progression
// demandé par Hafiz le 04/10/2026 (image de référence : `icones/IMG_1703.PNG`,
// une grille « une ligne par exercice × une colonne par semaine »).
//
// ⚠️ LA RÈGLE DE PROGRESSION N'EST PAS RÉÉCRITE ICI. On rejoue
// `suggererProchaineSerie` (src/logic/surchargeProgressive.js) semaine après
// semaine, en lui donnant la semaine projetée COMME SI elle avait été faite.
// C'est le seul moyen d'être certain que le tableau et le « 🎯 Attendu » de
// l'écran de séance ne se contrediront jamais — ce projet a déjà payé une
// seconde définition divergente (voir `cycleEnService`, bug du 28/08/2026).
//
// Tout se calcule CÔTÉ APP, depuis l'historique déjà chargé : aucun appel au
// serveur, donc le tableau s'affiche aussi vite que le reste de l'onglet.
import { suggererProchaineSerie } from './surchargeProgressive';

export const SEMAINES_PAR_DEFAUT = 4;
// Borne haute : au-delà, la projection n'a plus de sens (elle suppose que
// CHAQUE semaine est réussie exactement comme prévu) et le tableau devient
// illisible sur un téléphone.
export const SEMAINES_MAX = 12;

// Les séances synthétiques sont datées très loin dans le futur pour passer
// devant tout l'historique réel : `seancesAvec` trie par date décroissante et
// ne regarde que la plus récente.
function dateProjetee(index) {
  return `9000-01-${String(index + 1).padStart(2, '0')}`;
}

// L'OBJECTIF DE REPS QUAND C'EST UNE FOURCHETTE (« 5 - 10 ») : on vise le
// HAUT. C'est la double progression classique — on grimpe dans la fourchette
// à charge égale, et on ne monte la charge qu'une fois le haut tenu.
export function cibleDeReps(repsCibles, repsCiblesMax) {
  const bas = Number(repsCibles);
  const haut = Number(repsCiblesMax);
  if (Number.isFinite(haut) && haut > 0) {
    return Number.isFinite(bas) && bas > haut ? bas : haut;
  }
  return Number.isFinite(bas) && bas > 0 ? bas : null;
}

// Comment s'écrit l'objectif de reps dans le tableau : « 10 » ou « 5 - 10 ».
export function libelleFourchette(repsCibles, repsCiblesMax) {
  const bas = Number(repsCibles);
  const haut = Number(repsCiblesMax);
  if (!Number.isFinite(bas) || bas <= 0) return null;
  if (Number.isFinite(haut) && haut > bas) return `${bas} - ${haut}`;
  return String(bas);
}

// Combien de séries ont été faites la dernière fois sur cet exercice
// (la suggestion ne renvoie `series` que si l'axe des séries est coché).
function seriesDerniereFois(entrainements, exercice) {
  const faites = (entrainements || [])
    .filter((e) => e && Array.isArray(e.series)
      && e.series.some((s) => s && s.exercice === exercice))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))[0];
  if (!faites) return null;
  return faites.series.filter((s) => s && s.exercice === exercice).length;
}

// UNE SEMAINE DE DÉCHARGE, par défaut : moitié moins de séries, et on revient
// à la charge de la PREMIÈRE semaine du bloc. C'est un protocole de décharge
// courant (on garde le mouvement, on enlève le volume), et c'est explicable en
// une phrase — ce qui compte, puisque Hafiz peut corriger chaque case.
export function decharge(premiere) {
  if (!premiere) return null;
  return {
    semaine: 'decharge',
    series: Math.max(1, Math.floor((premiere.series || 2) / 2)),
    reps: premiere.reps,
    poids: premiere.poids,
    raison: 'décharge : moitié moins de séries, charge de la semaine 1',
  };
}

// LA PROJECTION D'UN EXERCICE — renvoie une ligne par semaine :
//   [{ semaine: 1, series, reps, poids, raison }, …, { semaine: 'decharge' }]
//
// Renvoie un tableau VIDE si l'exercice n'a jamais été loggé : on n'invente
// pas un chiffre de départ. C'est la règle déjà posée pour les « 🎯 Attendu »
// (01/09/2026) — mieux vaut une case vide qu'une charge sortie de nulle part.
export function projeterExercice(entrainements, exercice, options = {}) {
  const {
    repsCibles = null, repsCiblesMax = null, seriesCibles = null,
    modes, nbSemaines = SEMAINES_PAR_DEFAUT, avecDeload = false,
  } = options || {};

  const semaines = Math.max(1, Math.min(SEMAINES_MAX, Number(nbSemaines) || SEMAINES_PAR_DEFAUT));
  const cible = cibleDeReps(repsCibles, repsCiblesMax);

  let histoire = Array.isArray(entrainements) ? entrainements : [];
  let nbSeries = seriesDerniereFois(histoire, exercice);
  const lignes = [];

  for (let i = 0; i < semaines; i++) {
    const suggestion = suggererProchaineSerie(histoire, exercice, cible, {
      modes, seriesCibles,
    });
    // Jamais fait (ou historique abîmé) : rien à projeter, et surtout rien à
    // inventer. On s'arrête là plutôt que de remplir le tableau de faux.
    if (!suggestion) break;

    if (Number.isFinite(suggestion.series) && suggestion.series > 0) {
      nbSeries = suggestion.series;
    }
    const ligne = {
      semaine: i + 1,
      series: nbSeries,
      reps: suggestion.reps,
      poids: suggestion.poids,
      raison: suggestion.raison,
    };
    lignes.push(ligne);

    // LA SEMAINE PROJETÉE DEVIENT DE L'HISTOIRE : c'est ce qui permet de
    // rejouer la MÊME règle pour la semaine suivante, au lieu d'en écrire une
    // deuxième ici.
    histoire = [...histoire, {
      id: `projection-${i}`,
      date: dateProjetee(i),
      series: Array.from({ length: Math.max(1, nbSeries || 1) }, (_, k) => ({
        exercice, numero_serie: k + 1, reps: ligne.reps, poids: ligne.poids,
      })),
    }];
  }

  if (avecDeload && lignes.length > 0) {
    const ligneDecharge = decharge(lignes[0]);
    if (ligneDecharge) lignes.push(ligneDecharge);
  }
  return lignes;
}

// LE TABLEAU COMPLET d'un programme : une ligne par exercice, groupée par
// séance (= par jour), dans l'ordre des séances puis des exercices.
//
// `seances` = les séances du programme ({ id, nom, jours, exercices }).
// `progressions` = { "développé couché": ["reps","poids"], … } (axes choisis).
// `cibles` = les corrections MANUELLES, rangées par `${programmeId}|${exercice}|${semaine}` :
//            une case saisie à la main PRIME toujours sur le calcul.
export function projeterProgramme(seances, entrainements, options = {}) {
  const {
    progressions = {}, cibles = {},
    nbSemaines = SEMAINES_PAR_DEFAUT, avecDeload = false,
  } = options || {};

  return (Array.isArray(seances) ? seances : []).map((seance) => ({
    seance,
    lignes: (seance && Array.isArray(seance.exercices) ? seance.exercices : []).map((exo) => {
      const calculees = projeterExercice(entrainements, exo.exercice, {
        repsCibles: exo.reps_cibles,
        repsCiblesMax: exo.reps_cibles_max,
        seriesCibles: exo.series_cibles,
        modes: progressions[exo.exercice],
        nbSemaines,
        avecDeload,
      });
      return {
        exercice: exo.exercice,
        fourchette: libelleFourchette(exo.reps_cibles, exo.reps_cibles_max),
        seriesCibles: exo.series_cibles,
        semaines: calculees.map((ligne) => appliquerCorrection(ligne, seance.id, exo.exercice, cibles)),
      };
    }),
  }));
}

// « L'app propose, je corrige » (choix de Hafiz du 04/10/2026) : la valeur
// saisie à la main remplace la valeur calculée, case par case — on ne remplace
// que ce qui a été écrit, le reste continue d'être calculé.
// ⚠️ DEPUIS LE 05/10/2026, UNE CASE ENREGISTRÉE N'EST PLUS FORCÉMENT UNE
// CORRECTION. Démarrer un bloc FIGE tout le tableau : chaque case est écrite
// en base avec `origine: 'plan'`. Sans distinguer les deux, toutes les cases
// porteraient la marque « tu l'as écrite à la main » et cette marque ne
// voudrait plus rien dire. Une case sans `origine` est une correction manuelle
// (c'est le cas de l'écriture optimiste de l'écran, et de toutes les cases
// écrites avant cette date).
export function appliquerCorrection(ligne, programmeId, exercice, cibles) {
  const enregistree = (cibles || {})[`${programmeId}|${exercice}|${ligne.semaine}`];
  if (!enregistree) return { ...ligne, source: 'calcul' };
  const series = Number.isFinite(enregistree.series) && enregistree.series > 0
    ? enregistree.series : ligne.series;
  const reps = Number.isFinite(enregistree.reps) && enregistree.reps > 0
    ? enregistree.reps : ligne.reps;
  const poids = Number.isFinite(enregistree.poids) && enregistree.poids >= 0
    ? enregistree.poids : ligne.poids;
  return {
    ...ligne, series, reps, poids,
    source: enregistree.origine === 'plan' ? 'plan' : 'manuel',
  };
}
