// À QUEL JOUR APPARTIENT UNE SÉANCE ? — 21/09/2026
//
// Bug signalé par Hafiz : « quand on lance une séance et qu'on oublie de
// l'enregistrer le jour même et qu'on l'enregistre le jour suivant, elle est
// enregistrée comme séance du jour suivant, ce qui n'est pas correct ».
//
// LA CAUSE : `terminerSeance` datait la séance avec la date du jour AU MOMENT
// D'APPUYER SUR « TERMINER » (`aujourdhui()`). Rien ne retenait le jour où le
// travail avait vraiment été fait. Conséquences en chaîne, toutes silencieuses :
// le ✅ du calendrier se posait sur le mauvais jour, la séance comptait dans le
// volume de la MAUVAISE semaine, et le jour réel passait pour « manqué »
// (voir src/logic/rattrapage.js).
//
// LA RÈGLE RETENUE : une séance appartient au jour où l'on a fait le PLUS DE
// SÉRIES. Chaque série est estampillée du jour (local) où elle a été saisie,
// donc on sait répondre même quand une séance traîne sur deux jours :
//   - séries faites lundi, « Terminer » touché mardi  → lundi (le cas de Hafiz) ;
//   - séance ouverte lundi mais réellement faite mardi → mardi (on ne date pas
//     une séance d'un jour où l'on n'a rien fait).
// À ÉGALITÉ, on prend le jour LE PLUS ANCIEN : c'est celui où la séance a
// commencé, et c'est la réponse qui correspond au cas signalé.
//
// POURQUOI PAS SIMPLEMENT LA DATE DE DÉBUT : une séance laissée ouverte par
// oubli (zéro série, ou une série d'essai) serait alors datée d'un jour où l'on
// n'a rien fait — on remplacerait un faux jour par un autre.
//
// AUCUNE DONNÉE NOUVELLE CÔTÉ SERVEUR : le jour d'une série ne sert qu'ici, à
// l'app, pour choisir la date de la séance. Il est retiré avant l'envoi
// (`seriesSansJour`) — le serveur continue de recevoir exactement les mêmes
// champs qu'avant (exercice, numero_serie, reps, poids).

// Un jour valide est une date ISO « AAAA-MM-JJ » (celle que produit `enISO`,
// la date LOCALE du téléphone — jamais l'UTC, voir le bug du 03/09/2026).
function jourValide(valeur) {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur);
}

// series : [{ exercice, reps, poids, jour? }, …]
// dateDebut : le jour où la séance a été lancée (repli si aucune série n'est
//             estampillée — cas d'une séance commencée avant le 21/09/2026).
// jourJ : la date du jour, dernier repli.
export function jourDeLaSeance(series, { dateDebut = null, jourJ = null } = {}) {
  const repli = jourValide(dateDebut) ? dateDebut : (jourValide(jourJ) ? jourJ : null);
  if (!Array.isArray(series)) return repli;

  // Combien de séries par jour ?
  const comptes = new Map();
  for (const serie of series) {
    const jour = serie && serie.jour;
    if (!jourValide(jour)) continue;
    comptes.set(jour, (comptes.get(jour) || 0) + 1);
  }
  if (comptes.size === 0) return repli;

  // Le jour le plus fourni ; à égalité, le plus ancien (les dates ISO se
  // comparent comme du texte, c'est tout l'intérêt de ce format).
  let meilleur = null;
  let meilleurCompte = -1;
  for (const [jour, compte] of comptes) {
    if (compte > meilleurCompte || (compte === meilleurCompte && jour < meilleur)) {
      meilleur = jour;
      meilleurCompte = compte;
    }
  }
  return meilleur;
}

// Le jour d'une série est une information LOCALE à l'app : on l'enlève avant
// d'envoyer la séance au serveur (et avant de la ranger dans l'historique
// affiché, pour que les deux aient exactement la même forme).
export function seriesSansJour(series) {
  if (!Array.isArray(series)) return [];
  return series.map((serie) => {
    if (!serie || typeof serie !== 'object') return serie;
    const { jour, ...reste } = serie;
    return reste;
  });
}

// Une séance est-elle « à cheval » sur plusieurs jours, ou sur un jour autre
// qu'aujourd'hui ? Sert à prévenir l'utilisateur AVANT qu'il enregistre, plutôt
// que de décider dans son dos.
export function joursTravailles(series) {
  if (!Array.isArray(series)) return [];
  const jours = new Set();
  for (const serie of series) {
    if (serie && jourValide(serie.jour)) jours.add(serie.jour);
  }
  return [...jours].sort();
}
