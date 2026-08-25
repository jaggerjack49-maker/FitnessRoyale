// LES ARÈNES — la progression façon Clash Royale, adossée aux ligues Club SP.
//
// Une arène = une ligue (Bronze, Silver…), présentée comme une étape d'un
// parcours à gravir. AUCUN nouveau système de score : l'arène est déterminée
// par le PALIER MOYEN sur TOUS les exercices du barème, exactement comme
// `ligueJoueur()` (src/logic/classement.js). Ici on ne fait qu'habiller ce
// calcul d'un nom, d'un emblème et d'un seuil affichable.
//
// Les emblèmes sont les MÊMES que ceux de l'avatar évolutif
// (src/components/AvatarJoueur.js) pour que tout parle le même langage visuel.

import { nomsLigues } from './clubSP';

// UNE ARÈNE = UNE LIGUE Club SP (décision de Hafiz du 12/08/2026 : « arène et
// palier/ligue c'est pareil »). Les noms d'arènes remplacent donc simplement
// les noms de ligues à l'affichage — l'arène se gagne UNIQUEMENT avec des
// perfs vérifiées, jamais avec de l'XP (l'XP est une jauge d'activité à part,
// qui alimentera l'Arena Pass — voir docs/VISION_ARENA_PASS.md).
//
// `titre` = ce que le joueur peut afficher sur son profil à cette arène.
// index 0 = le départ, avant toute perf vérifiée.
export const arenes = [
  {
    index: 0,
    ligue: 'Aucune',
    nom: 'DÉBUT',
    embleme: '🚪',
    titre: null,
    devise: "Tu es dans la place. Fais vérifier ta première perf pour entrer dans l'arène.",
    decor: 'Vestiaire vide',
  },
  {
    index: 1,
    ligue: 'Bronze',
    nom: 'INITIATION',
    embleme: '🌱',
    titre: 'Recrue',
    devise: 'Je commence mon aventure.',
    decor: "Salle d'entraînement basique, petit équipement",
  },
  {
    index: 2,
    ligue: 'Silver',
    nom: 'FORGE',
    embleme: '🔥',
    titre: 'Fighter',
    devise: "Tu ne découvres plus : tu t'entraînes pour de vrai.",
    decor: 'Machines et haltères, environnement plus impressionnant',
  },
  {
    index: 3,
    ligue: 'Gold',
    nom: 'COLOSSE',
    embleme: '⚔️',
    titre: 'Gladiator',
    devise: 'On commence à te reconnaître comme un joueur sérieux.',
    decor: 'Grande salle, plateformes de force, équipements lourds',
  },
  {
    index: 4,
    ligue: 'Legend',
    nom: 'TITAN',
    embleme: '🏆',
    titre: 'Titan',
    devise: 'Le rang que tout le monde veut afficher sur son profil.',
    decor: 'Architecture monumentale, énorme rack, ambiance compétition',
  },
  {
    index: 5,
    ligue: 'Titan',
    nom: 'OLYMPE',
    embleme: '💎',
    titre: 'Olympien',
    devise: 'Très haut niveau. Peu y arrivent.',
    decor: "Temple sur la montagne, statues d'athlètes",
  },
  {
    // Le sommet garde le nom de la MARQUE (Fitness Royale) : c'est le rang
    // ultime du Club SP, il porte le nom du jeu.
    index: 6,
    ligue: 'Royal',
    nom: 'ROYALE',
    embleme: '👑',
    titre: 'Royal',
    devise: "Il n'y a plus d'arène au-dessus. Il reste le classement mondial.",
    decor: 'Arène gigantesque, trophée central, effets légendaires',
  },
];

// Les arènes accessibles à ce joueur : les femmes s'arrêtent à Titan (5 paliers
// au barème), les hommes vont jusqu'à Royal (6). On se base sur le NOMBRE DE
// PALIERS du barème plutôt que sur le sexe en dur — si un barème change, les
// arènes suivent automatiquement.
export function arenesDuBareme(bareme) {
  const premier = Object.values(bareme || {})[0];
  const nbPaliers = premier ? premier.paliers.length : nomsLigues.length;
  return arenes.filter((a) => a.index <= nbPaliers);
}

// L'arène correspondant à une ligue (celle que renvoie ligueJoueur()).
export function areneDeLaLigue(ligue) {
  return arenes.find((a) => a.ligue === ligue) || arenes[0];
}

// SEUIL d'entrée dans une arène, en palier moyen.
// `ligueJoueur()` fait Math.round(moyenne) : on entre donc dans l'arène N
// dès que la moyenne atteint N - 0,5.
export function seuilMoyenne(indexArene) {
  return indexArene === 0 ? 0 : indexArene - 0.5;
}

// Combien de PALIERS il reste à décrocher pour entrer dans l'arène suivante.
// Concret et actionnable : « il te manque 12 paliers » = 12 montées de palier
// à faire vérifier, réparties sur les exercices de ton choix.
// scoreSP = somme des paliers vérifiés, nbExercices = taille du barème.
export function paliersManquants(scoreSP, nbExercices, indexAreneSuivante) {
  const requis = seuilMoyenne(indexAreneSuivante) * nbExercices;
  return Math.max(0, Math.ceil(requis - scoreSP));
}

// Progression (0 → 1) à l'intérieur de l'arène actuelle, pour la barre.
export function progressionVersSuivante(moyenne, indexActuel, indexSuivant) {
  const depart = seuilMoyenne(indexActuel);
  const arrivee = seuilMoyenne(indexSuivant);
  if (arrivee <= depart) return 1;
  return Math.min(1, Math.max(0, (moyenne - depart) / (arrivee - depart)));
}

// TOUT l'état d'arène d'un joueur, en un seul appel — pour que le Profil et
// l'écran Paliers affichent exactement la même chose sans recopier le calcul.
// (les fonctions de score sont passées en paramètres pour éviter que ce fichier
// de données dépende de src/logic/classement.js — c'est l'appelant qui les
// fournit ; voir CarteArene.js.)
export function etatArene({ moyenne, scoreSP, nbExercices, ligue, bareme }) {
  const liste = arenesDuBareme(bareme);
  const actuelle = areneDeLaLigue(ligue);
  const suivante = liste.find((a) => a.index === actuelle.index + 1) || null;
  return {
    liste,
    actuelle,
    suivante,
    moyenne,
    manquants: suivante ? paliersManquants(scoreSP, nbExercices, suivante.index) : 0,
    progression: suivante
      ? progressionVersSuivante(moyenne, actuelle.index, suivante.index)
      : 1,
  };
}
