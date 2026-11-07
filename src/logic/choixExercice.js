// Où atterrit un exercice choisi dans la bibliothèque (passe 3, 07/11/2026).
//
// Une seule règle, mais elle vit dans `src/logic/` et PAS dans le composant
// `ChoixExercice.js` pour une raison précise : un fichier qui importe
// `react-native` ne peut pas être exécuté par Node, donc pas être couvert par
// un harnais de test (voir backend/tests/harnais/). Les règles de ce projet
// vivent là où on peut les mettre à l'épreuve.

// Dans une liste de lignes en cours de saisie, l'exercice choisi va dans la
// première ligne VIDE s'il y en a une, sinon dans une ligne neuve.
//
// ⚠️ UNE SEULE DÉFINITION, parce qu'il y a DEUX éditeurs de séance dans l'app
// (celui de « Mes programmes » et celui du formulaire « Nouveau programme »)
// et que leurs lignes n'ont même pas la même forme — d'où `ligneNeuve`, que
// l'appelant fournit. Deux copies de cette règle auraient fini par se
// comporter différemment d'un écran à l'autre.
//
// POURQUOI LA PREMIÈRE LIGNE VIDE D'ABORD : un éditeur fraîchement ouvert en
// contient toujours une. Sans cette règle, choisir son premier exercice
// laisserait une ligne vide orpheline juste au-dessus.
export function placerExerciceChoisi(lignes, nom, ligneNeuve) {
  const liste = Array.isArray(lignes) ? lignes : [];
  const vide = liste.findIndex((l) => !String((l && l.exercice) || '').trim());
  if (vide >= 0) return liste.map((l, i) => (i === vide ? { ...l, exercice: nom } : l));
  return [...liste, { ...ligneNeuve, exercice: nom }];
}
