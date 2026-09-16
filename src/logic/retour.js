// Que faire du « retour » Android quand AUCUNE sous-vue ne l'a pris (16/09/2026) ?
//
// - Sur un autre onglet que le Profil : revenir au Profil. Le Profil est la
//   « maison » de l'app, comme l'écran d'accueil d'un jeu.
// - Sur le Profil : ne pas fermer l'app au premier geste. Glisser depuis le
//   bord de l'écran déclenche facilement le retour sans le vouloir (surtout
//   depuis qu'on glisse aussi pour changer d'onglet). Un premier retour
//   AVERTIT, un second dans les 2 secondes QUITTE.
//
// Logique pure, sans React ni Android : testée par
// backend/tests/test_retour.py (harnais Node, comme les autres).

export const DELAI_DOUBLE_RETOUR_MS = 2000;

// Renvoie 'profil' (aller au Profil), 'avertir' (afficher « appuie encore une
// fois pour quitter ») ou 'quitter' (laisser Android fermer l'app).
export function decisionRetour({ ongletActif, dernierRetourMs, maintenantMs }) {
  if (ongletActif !== 'profil') return 'profil';
  const recent = Number.isFinite(dernierRetourMs) && Number.isFinite(maintenantMs)
    && maintenantMs - dernierRetourMs >= 0
    && maintenantMs - dernierRetourMs <= DELAI_DOUBLE_RETOUR_MS;
  return recent ? 'quitter' : 'avertir';
}
