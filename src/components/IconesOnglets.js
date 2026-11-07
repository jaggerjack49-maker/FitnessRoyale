// ICÔNES DE LA BARRE D'ONGLETS — piste « Arène » (validée le 08/09/2026).
//
// ⚠️ LES DESSINS ONT DÉMÉNAGÉ LE 27/10/2026 dans `src/components/Icones.js`,
// qui est désormais LE système d'icônes de toute l'app (grille, trait,
// terminaisons, couleur en prop : tout y est expliqué). Les six tracés étaient
// RECOPIÉS de Lucide ; ils sont maintenant dessinés pour Fitness Royale, à la
// demande de Hafiz (« crée toi-même tes propres icônes »).
//
// Ce fichier ne garde qu'une chose, et c'est sa seule raison d'exister : la
// TABLE qui associe la CLÉ d'un onglet (le tableau `ONGLETS` d'App.js) à son
// icône. Les deux doivent rester d'accord — c'est le seul endroit à toucher si
// l'ordre ou la liste des onglets change.
//
// Les métaphores ne changent PAS (couronne = Paliers, trophée = Compétition) :
// ce sont des arbitrages de Hafiz, pas des oublis.

export {
  IconeProfil,
  IconePerfs,
  IconePaliers,
  IconeCompetition,
  IconeEntrainement,
  IconeClan,
} from './Icones';

import {
  IconeProfil,
  IconePerfs,
  IconePaliers,
  IconeCompetition,
  IconeEntrainement,
  IconeClan,
} from './Icones';

export const ICONES_ONGLETS = {
  profil: IconeProfil,
  perfs: IconePerfs,
  paliers: IconePaliers,
  competition: IconeCompetition,
  entrainement: IconeEntrainement,
  clan: IconeClan,
};
