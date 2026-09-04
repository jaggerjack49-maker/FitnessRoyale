// Fait passer les CAS COMMUNS dans le classement CÔTÉ APP et écrit le
// résultat en JSON sur la sortie standard.
//
// Le test Python (`test_parite_front_back.py`) fait passer les mêmes cas dans
// `backend/app/logique.py` et compare les deux résultats. C'est le seul moyen
// de garantir que les deux implémentations du classement — qui existent en
// double depuis toujours (« portage exact ») — restent réellement d'accord.
//
// Lancement (depuis n'importe où) :
//   node --import ./resolveur-enregistre.mjs harnais_classement.mjs cas.json
import { readFileSync } from 'node:fs';
import {
  classer,
  classerParCategories,
  classerParExercice,
  classerSalles,
  ligueJoueur,
  moyennePaliers,
  cleSalle,
} from '../../../src/logic/classement.js';

const cas = JSON.parse(readFileSync(process.argv[2], 'utf-8'));
const resultat = {};

for (const [nom, entree] of Object.entries(cas)) {
  // Les clés commençant par « _ » sont des commentaires (JSON n'en a pas).
  // Même règle côté Python, sinon les deux ne traiteraient pas les mêmes cas.
  if (nom.startsWith('_')) continue;
  const joueurs = entree.joueurs;
  resultat[nom] = {
    // Arrondi à 2 décimales : Python et JavaScript n'écrivent pas les
    // flottants pareil, et ce n'est pas ce qu'on cherche à comparer.
    moyennes: joueurs.map((j) => Math.round(moyennePaliers(j) * 100) / 100),
    ligues: joueurs.map((j) => ligueJoueur(j)),
    global: classer(joueurs, 'global').map((j) => j.pseudo),
    categories: classerParCategories(joueurs).map((g) => ({
      categorie: g.categorie,
      joueurs: g.joueurs.map((j) => j.pseudo),
    })),
    salles: classerSalles(joueurs).map((s) => ({
      salle: s.salle, nbMembres: s.nbMembres,
    })),
    parExercice: (entree.exercices || []).map((exo) => ({
      exercice: exo,
      joueurs: classerParExercice(joueurs, exo).map((j) => j.pseudo),
    })),
    clesSalles: joueurs.map((j) => cleSalle(j.salle)),
  };
}

process.stdout.write(JSON.stringify(resultat, null, 2));
