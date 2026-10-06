// UN BLOC D'ENTRAÎNEMENT — demande de Hafiz du 05/10/2026 : « il faut qu'on
// puisse créer des cycles… un cycle sur un mois, avec des exercices comme un
// programme… à partir du programme, on peut faire le cycle qui sera visualisé
// en tableau ».
//
// ⚠️ VOCABULAIRE : on dit BLOC, pas « cycle ». Dans ce projet, `cycles` est
// déjà le nom interne d'un programme complet qui groupe plusieurs séances
// (« Mon PPL » et ses jours). Deux sens pour un même mot, c'est le piège qu'on
// a déjà payé avec « arène » et « ligue » (voir CLAUDE.md, 20/08/2026).
//
// UN BLOC = un programme + une DATE DE DÉBUT + N semaines (+ une décharge).
//
// ⚠️ DÉMARRER UN BLOC FIGE LE PLAN. Jusqu'ici le tableau était une PROJECTION :
// il se recalculait depuis l'historique à chaque ouverture. Pour qu'une séance
// puisse annoncer « semaine 2/4 — 8 reps à 105 kg », il faut que cette ligne
// existe quelque part et ne bouge plus : on écrit donc toutes les cases dans
// `cibles_semaine` au démarrage. Le tableau n'invente plus rien, il LIT.
//
// Ce qui rend le plan vivant malgré tout (choix de Hafiz : « le plan, mais qui
// se rattrape ») : on COMPARE ce qui a été fait à ce qui était prévu, on le
// DIT, et on propose de recalculer la suite. On ne recalcule jamais dans son dos.
import { planificationProgramme } from './rattrapage';

// ⚠️ TOUT LE CALCUL DE DATES EST EN UTC, VOLONTAIREMENT. Une date ISO
// (« 2026-10-05 ») est un JOUR, pas un instant : la convertir en heure locale
// expose à deux pièges que ce projet a déjà payés — le décalage UTC/local du
// 03/09/2026 (un ✅ posé sur la veille), et le changement d'heure, qui fait
// qu'un intervalle de 21 jours peut mesurer 503 ou 505 heures et basculer d'une
// semaine au passage. En UTC, un jour fait toujours 24 h.
function enJours(dateISO) {
  if (typeof dateISO !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / (24 * 3600 * 1000));
}

// L'inverse : un nombre de jours depuis 1970 → « 2026-11-01 ».
function versISO(jours) {
  const d = new Date(jours * 24 * 3600 * 1000);
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}-${deuxChiffres(d.getUTCDate())}`;
}

// La clé d'une case du plan, partagée avec le tableau et le serveur.
export function cleCase(programmeId, exercice, semaine) {
  return `${programmeId}|${exercice}|${semaine}`;
}

// En quelle semaine du bloc tombe cette date ?
// Renvoie 1..N, 'decharge' (la semaine qui suit la dernière, si elle existe),
// ou null quand la date est hors du bloc (avant le début, ou après la fin).
export function semaineDuBloc(programme, dateISO) {
  if (!programme || !programme.date_debut || !programme.duree_semaines) return null;
  const debut = enJours(programme.date_debut);
  const jour = enJours(dateISO);
  if (debut === null || jour === null) return null;
  const numero = Math.floor((jour - debut) / 7) + 1;
  if (numero < 1) return null;
  if (numero <= programme.duree_semaines) return numero;
  if (programme.avec_deload && numero === programme.duree_semaines + 1) return 'decharge';
  return null; // bloc terminé
}

// Le bloc est-il commencé et pas encore fini ?
export function blocEnCours(programme, dateISO) {
  return semaineDuBloc(programme, dateISO) !== null;
}

// La dernière date couverte par le bloc (décharge comprise) — pour l'afficher.
export function finDuBloc(programme) {
  if (!programme || !programme.date_debut || !programme.duree_semaines) return null;
  const semaines = programme.duree_semaines + (programme.avec_deload ? 1 : 0);
  const debut = enJours(programme.date_debut);
  if (debut === null) return null;
  return versISO(debut + semaines * 7 - 1);
}

// La cible PRÉVUE pour un exercice, à une date donnée du bloc.
// C'est ce que la séance affiche : elle LIT le plan, elle ne le recalcule pas.
export function ciblePrevue(programme, exercice, dateISO, cibles) {
  if (!programme) return null;
  return ciblePrevueDansBloc(programme, programme.id, exercice, dateISO, cibles);
}

// La même chose quand le bloc et la séance sont deux objets différents : un
// programme complet (« Mon PPL ») porte la date et la durée, mais c'est la
// SÉANCE (« Push ») qui identifie les cases du plan.
// `ciblePrevue` n'est que le cas où les deux se confondent — une seule
// définition de « quelle case me concerne aujourd'hui ».
export function ciblePrevueDansBloc(bloc, programmeId, exercice, dateISO, cibles) {
  const semaine = semaineDuBloc(bloc, dateISO);
  if (semaine === null) return null;
  const prevue = (cibles || {})[cleCase(programmeId, exercice, semaine)];
  if (!prevue) return null;
  return {
    semaine,
    series: prevue.series,
    reps: prevue.reps,
    poids: prevue.poids,
    // Une case que l'utilisateur a corrigée lui-même : la séance doit le dire,
    // sinon il croirait lire une proposition de l'app.
    corrigee: prevue.origine !== 'plan',
  };
}

// Les séances du bloc faites pendant sa durée, rangées par semaine.
//
// ⚠️ PLUSIEURS NUMÉROS DE PROGRAMME POUR UN SEUL BLOC : un programme complet
// (un « cycle ») est fait de plusieurs séances, chacune portant son propre
// numéro — et c'est ce numéro qui identifie ses cases dans le plan. La date et
// la durée, elles, appartiennent au bloc. Les deux échelles ne se confondent
// pas, d'où cette liste d'identifiants plutôt qu'un seul.
function seancesParSemaine(bloc, idsSeances, entrainements) {
  const parSemaine = {};
  const ids = (Array.isArray(idsSeances) ? idsSeances : []).map(Number);
  (Array.isArray(entrainements) ? entrainements : []).forEach((e) => {
    if (!e || !e.date || !ids.includes(Number(e.programme_id))) return;
    const semaine = semaineDuBloc(bloc, e.date);
    if (semaine === null) return;
    if (!parSemaine[semaine]) parSemaine[semaine] = [];
    parSemaine[semaine].push(e);
  });
  return parSemaine;
}

// LES ÉCARTS ENTRE LE PLAN ET LA RÉALITÉ.
//
// Deux sortes, et seulement deux — il fallait décider ce que « s'écarter »
// veut dire, sinon l'app alerterait sur tout et plus personne ne la croirait :
//  1. une SEMAINE PASSÉE du bloc sans aucune séance de ce programme ;
//  2. une CHARGE qui ne correspond pas au plan sur un exercice (plus lourd
//     comme plus léger : les deux rendent la suite du plan fausse).
//
// La semaine EN COURS n'est jamais signalée comme sautée : elle n'est pas
// finie. On ne reproche pas un mardi qui n'est pas encore arrivé.
export function ecartsDuBloc(programme, entrainements, cibles, aujourdhuiISO) {
  if (!programme) return { semainesSautees: [], chargesDifferentes: [] };
  return ecartsDuBlocComplet(programme, [programme.id], entrainements,
    cibles, aujourdhuiISO);
}

// La même chose pour un programme COMPLET : le bloc porte la date et la durée,
// `idsSeances` dit quelles séances lui appartiennent.
// UNE SEULE DÉFINITION de la règle : `ecartsDuBloc` n'est qu'un cas
// particulier de celle-ci (une seule séance). Deux écritures de « qu'est-ce
// qu'un écart » finiraient par se contredire.
export function ecartsDuBlocComplet(bloc, idsSeances, entrainements, cibles,
                                    aujourdhuiISO) {
  const vide = { semainesSautees: [], chargesDifferentes: [] };
  if (!bloc || !bloc.date_debut || !bloc.duree_semaines) return vide;

  const semaineCourante = semaineDuBloc(bloc, aujourdhuiISO);
  // Hors du bloc (pas commencé, ou terminé) : rien à rattraper en cours de route.
  if (semaineCourante === null) return vide;
  const numeroCourant = semaineCourante === 'decharge'
    ? bloc.duree_semaines + 1 : semaineCourante;

  const faites = seancesParSemaine(bloc, idsSeances, entrainements);

  const semainesSautees = [];
  for (let n = 1; n < numeroCourant; n++) {
    if (!faites[n] || faites[n].length === 0) semainesSautees.push(n);
  }

  // La charge réellement soulevée, semaine par semaine, comparée au plan.
  const chargesDifferentes = [];
  Object.keys(faites).forEach((semaine) => {
    faites[semaine].forEach((seance) => {
      (Array.isArray(seance.series) ? seance.series : []).forEach((serie) => {
        if (!serie || !serie.exercice) return;
        // La case se cherche sous le numéro de LA SÉANCE qui a été faite —
        // c'est lui qui identifie les cases du plan, pas celui du bloc.
        const prevu = (cibles || {})[
          cleCase(seance.programme_id, serie.exercice, semaine)];
        if (!prevu || prevu.poids === null || prevu.poids === undefined) return;
        if (Number(serie.poids) === Number(prevu.poids)) return;
        // Un seul écart par exercice et par semaine : répéter la même
        // information pour chaque série ne dit rien de plus.
        const deja = chargesDifferentes.some(
          (x) => x.exercice === serie.exercice && String(x.semaine) === String(semaine)
        );
        if (!deja) {
          chargesDifferentes.push({
            exercice: serie.exercice,
            semaine: String(semaine) === 'decharge' ? 'decharge' : Number(semaine),
            prevu: prevu.poids,
            fait: Number(serie.poids),
          });
        }
      });
    });
  });

  return { semainesSautees, chargesDifferentes };
}

// Y a-t-il quelque chose à signaler ?
export function blocADerive(ecarts) {
  if (!ecarts) return false;
  return ecarts.semainesSautees.length > 0 || ecarts.chargesDifferentes.length > 0;
}

// Les semaines qu'un « recalcul de la suite » doit réécrire : celles qui ne
// sont PAS ENCORE FAITES, à partir de la semaine en cours.
//
// ⚠️ UNE SEMAINE DÉJÀ ENTRAÎNÉE N'EST JAMAIS RÉÉCRITE, même la semaine en
// cours. Ce défaut a été TROUVÉ À L'ÉCRAN le 06/10/2026 : la règle se
// contentait de « la semaine en cours et les suivantes », donc après une
// séance faite à 120 kg au lieu des 105 prévus, recalculer réécrivait la
// semaine 1 à 122,5 — et l'app signalait aussitôt un NOUVEL écart
// (« 120 kg, le plan disait 122,5 ») qu'on ne pouvait plus jamais résoudre.
// Le recalcul fabriquait exactement le problème qu'il devait régler.
// Une semaine déjà faite est de l'HISTOIRE : sa ligne de plan est la trace de
// ce qui avait été demandé, pas une prévision à rafraîchir.
export function semainesARecalculer(bloc, idsSeances, entrainements, aujourdhuiISO) {
  const courante = semaineDuBloc(bloc, aujourdhuiISO);
  if (courante === null) return [];
  const depart = courante === 'decharge' ? bloc.duree_semaines + 1 : courante;
  const faites = seancesParSemaine(bloc, idsSeances, entrainements);
  const estFaite = (cle) => Array.isArray(faites[cle]) && faites[cle].length > 0;
  const semaines = [];
  for (let n = depart; n <= bloc.duree_semaines; n++) {
    if (!estFaite(n)) semaines.push(n);
  }
  if (bloc.avec_deload && !estFaite('decharge')) semaines.push('decharge');
  return semaines;
}

// Réexporté pour que l'écran n'ait pas à connaître deux modules pour la même
// idée : « en quelle semaine suis-je ? ».
export { planificationProgramme };
