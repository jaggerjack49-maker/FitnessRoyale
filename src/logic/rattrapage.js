// LE PLANNING DE LA SEMAINE, ET CE QU'ON A RATÉ — logique pure, testable.
// Ajouté le 07/09/2026 (demande de Hafiz : « si en cours de semaine on rate un
// jour, il peut être rattrapé »).
//
// POURQUOI UN FICHIER À PART plutôt que quelques lignes dans l'écran : ce
// calcul ne peut PAS être vérifié à l'œil. Il ne montre quelque chose que les
// jours où l'on a effectivement raté une séance — impossible à provoquer sur
// commande sans mentir à l'horloge. Sorti de l'écran, il se teste sur des
// dates choisies (voir `backend/tests/test_rattrapage.py`).
//
// AUCUNE NOUVELLE TABLE, AUCUN NOUVEL ÉTAT : tout se déduit de ce qu'on a
// déjà — les jours prévus d'un côté, les séances réellement loggées de
// l'autre. Même parti pris que les titres et l'XP (voir CLAUDE.md) : ce qui
// se recalcule tout seul ne peut pas se désynchroniser du reste de l'app.
import { joursSemaine, jourDeLaDate } from '../data/programmesStandards';

// La date locale 'AAAA-MM-JJ' d'un objet Date.
// SURTOUT PAS `toISOString()`, qui renvoie la date UTC : les deux ne tombent
// pas le même jour avant 2 h du matin en France, et ce décalage avait déjà
// posé le ✅ du calendrier sur la mauvaise case (bug du 03/09/2026).
export function enISO(date) {
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}`;
}

// Un programme est-il prévu ce jour-là, et si planifié, à quelle semaine en
// est-il ? (pour le calendrier et le badge « semaine 2/4 »)
//
// C'EST CETTE FONCTION QUI PROJETTE LES JOURS SUR LE MOIS : le calendrier
// l'interroge case par case, et elle ne regarde que `programme.jours`. Cocher
// « lundi » remplit donc tous les lundis, sans qu'il y ait rien à « appliquer ».
export function planificationProgramme(programme, dateISO) {
  const jours = (programme && programme.jours) || [];
  if (jours.length === 0) return { prevuCeJour: false, semaine: null };
  const dateJs = new Date(`${dateISO}T12:00:00`); // midi : à l'abri des fuseaux
  const prevuCeJour = jours.includes(jourDeLaDate(dateJs));
  if (!programme.date_debut) return { prevuCeJour, semaine: null };
  if (dateISO < programme.date_debut) return { prevuCeJour: false, semaine: null };
  const debut = new Date(`${programme.date_debut}T12:00:00`);
  const numSemaine = Math.floor((dateJs - debut) / (7 * 24 * 3600 * 1000)) + 1;
  if (programme.duree_semaines && numSemaine > programme.duree_semaines) {
    return { prevuCeJour: false, semaine: null }; // programme terminé
  }
  return { prevuCeJour, semaine: numSemaine };
}

// Tout ce qui est prévu une date donnée : les programmes RÉCURRENTS (les jours
// de la semaine cochés) ET ceux posés sur cette DATE PRÉCISE par le calendrier.
// Les deux se cumulent, ils ne s'excluent pas.
export function programmesPrevusLe(programmes, planning, dateISO) {
  const liste = Array.isArray(programmes) ? programmes : [];
  const dates = Array.isArray(planning) ? planning : [];
  const recurrents = liste
    .map((p) => ({ programme: p, plan: planificationProgramme(p, dateISO) }))
    .filter(({ plan }) => plan.prevuCeJour);
  const precis = dates
    .filter((pl) => pl && pl.date === dateISO)
    .map((pl) => ({ planif: pl, programme: liste.find((p) => p.id === pl.programme_id) }))
    .filter((x) => x.programme);
  return { recurrents, precis };
}

// LES SÉANCES MANQUÉES DE LA SEMAINE EN COURS.
//
// Une séance prévue le jour J est :
//   - FAITE      si une séance a été loggée ce jour-là (peu importe laquelle :
//                on ne va pas reprocher d'avoir fait autre chose que prévu) ;
//   - RATTRAPÉE  si le MÊME programme a été loggé plus tard dans la semaine ;
//   - MANQUÉE    sinon.
//
// On ne regarde que les jours DÉJÀ PASSÉS : la séance d'aujourd'hui n'est pas
// en retard, elle est simplement encore à faire.
//
// Renvoie [{ date, programme }], du plus ancien au plus récent.
export function seancesARattraper({ programmes, planning, entrainements, lundiISO, jourJ }) {
  const seances = Array.isArray(entrainements) ? entrainements : [];
  const manquees = [];
  const curseur = new Date(`${lundiISO}T12:00:00`);
  // Une semaine au maximum : la borne de sécurité évite une boucle infinie si
  // jamais on recevait des dates incohérentes (lundi postérieur à aujourd'hui).
  for (let i = 0; i < 7 && enISO(curseur) < jourJ; i++, curseur.setDate(curseur.getDate() + 1)) {
    const dateISO = enISO(curseur);
    const { recurrents, precis } = programmesPrevusLe(programmes, planning, dateISO);
    const prevus = [
      ...recurrents.map((r) => r.programme),
      ...precis.map((p) => p.programme),
    ];
    if (prevus.length === 0) continue;
    if (seances.some((e) => e && e.date === dateISO)) continue;
    for (const programme of prevus) {
      // ON NE REPROCHE PAS UN JOUR ANTÉRIEUR AU PROGRAMME LUI-MÊME : cocher
      // « lundi » un mercredi ferait sinon apparaître le lundi précédent comme
      // manqué, alors que le programme n'existait pas encore ce jour-là.
      const creeLe = String((programme && programme.cree_le) || '').slice(0, 10);
      if (creeLe && dateISO < creeLe) continue;
      const dejaRattrapee = seances.some(
        (e) => e && e.programme_id === programme.id && e.date > dateISO && e.date <= jourJ
      );
      if (dejaRattrapee) continue;
      if (manquees.some((m) => m.date === dateISO && m.programme.id === programme.id)) continue;
      manquees.push({ date: dateISO, programme });
    }
  }
  return manquees;
}

export { joursSemaine };
