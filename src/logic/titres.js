// LES TITRES — ce qu'on gagne à être devant les autres.
//
// Demande de Hafiz du 01/09/2026 : « afficher les titres qui seront attribués
// en fonction du classement par exercices ».
//
// DÉCISION : aucun nouveau score, aucune table serveur. Un titre n'est que la
// LECTURE d'un classement déjà calculé — celui par exercice
// (`classerParExercice`, écran Compétition). Il se recalcule donc tout seul
// dès qu'une perf est vérifiée, et il est impossible qu'il se désynchronise
// du classement affiché ailleurs. Même principe que l'XP, recalculée à la
// volée plutôt que stockée (voir CLAUDE.md).
//
// PAS DE GENRE dans les libellés : « N°1 au développé couché » plutôt que
// Roi/Reine — le titre décrit un rang, pas la personne qui le porte.
import { classerParExercice, listeExercicesClassement } from './classement';

// Les trois marches qui donnent un titre sur un exercice.
const MARCHES = [
  { rang: 1, embleme: '🥇', prefixe: 'N°1' },
  { rang: 2, embleme: '🥈', prefixe: 'N°2' },
  { rang: 3, embleme: '🥉', prefixe: 'N°3' },
];

// Tous les titres d'exercice existants, avec qui les détient aujourd'hui.
// Renvoie [{ exercice, rang, embleme, libelle, detenteur, aMoi }].
// Un exercice sur lequel PERSONNE n'a de perf vérifiée ne donne aucun titre :
// on ne décerne pas un « N°1 » à un classement vide.
export function titresParExercice(joueurs) {
  const titres = [];
  listeExercicesClassement.forEach((exercice) => {
    const classement = classerParExercice(joueurs, exercice);
    MARCHES.forEach(({ rang, embleme, prefixe }) => {
      const joueur = classement[rang - 1];
      if (!joueur) return;
      titres.push({
        exercice,
        rang,
        embleme,
        libelle: `${prefixe} · ${exercice}`,
        detenteur: joueur.pseudo,
        aMoi: !!joueur.moi,
      });
    });
  });
  return titres;
}

// Ceux que JE détiens, les mieux placés d'abord.
export function mesTitresDExercice(joueurs) {
  return titresParExercice(joueurs)
    .filter((t) => t.aMoi)
    .sort((a, b) => a.rang - b.rang || a.exercice.localeCompare(b.exercice));
}

// Les titres à ma portée : les exercices où je suis 4e ou moins bien classé,
// ou pas classé du tout. On indique combien de paliers me séparent du 3e —
// c'est ACTIONNABLE, contrairement à un simple « pas encore obtenu ».
// Renvoie [{ exercice, rangActuel, palierAViser }].
export function titresAPortee(joueurs, limite = 5) {
  const cibles = [];
  listeExercicesClassement.forEach((exercice) => {
    const classement = classerParExercice(joueurs, exercice);
    const monIndex = classement.findIndex((j) => j.moi);
    if (monIndex >= 0 && monIndex < 3) return; // déjà sur le podium
    const troisieme = classement[2];
    // Personne sur la 3e marche : le titre est libre, il suffit d'une perf vérifiée.
    const palierAViser = troisieme ? troisieme.palierExo : 1;
    cibles.push({
      exercice,
      rangActuel: monIndex >= 0 ? monIndex + 1 : null,
      palierAViser,
      monPalier: monIndex >= 0 ? classement[monIndex].palierExo : 0,
    });
  });
  return cibles
    .sort((a, b) => (b.monPalier - b.palierAViser) - (a.monPalier - a.palierAViser))
    .slice(0, limite);
}
