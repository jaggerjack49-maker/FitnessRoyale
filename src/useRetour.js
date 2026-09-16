// useRetour — réagir au geste / bouton « retour » d'Android (16/09/2026).
//
// Signalé par Hafiz : « quand on glisse retour arrière sur l'écran, il sort de
// l'app complètement ». L'app ne s'abonnait à rien : Android appliquait donc
// son comportement par défaut, fermer l'app, quel que soit l'écran affiché.
//
// UTILISATION : useRetour(condition, () => { …; return true; })
// - le gestionnaire n'est actif QUE tant que `condition` est vraie (une
//   sous-vue ouverte, l'onglet à l'écran…) ;
// - il renvoie `true` s'il a traité le retour (Android ne fait rien de plus),
//   `false` pour laisser la main au gestionnaire suivant — en dernier recours,
//   Android ferme l'app.
//
// ORDRE : Android appelle d'abord le DERNIER abonné. Une sous-vue qui s'ouvre
// s'abonne après App.js : elle passe donc en premier, ce qui est exactement
// ce qu'on veut (le retour ferme la sous-vue avant de changer d'onglet).
//
// Ne fait RIEN ailleurs que sur Android : iOS n'a pas de bouton retour, et sur
// le web `BackHandler` n'existe pas (il affiche une erreur si on s'y abonne).
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

export default function useRetour(condition, gerer) {
  // Toujours la DERNIÈRE version du gestionnaire (elle lit l'état à jour),
  // sans se réabonner à chaque rendu — ce qui changerait l'ordre des abonnés.
  const rappel = useRef(gerer);
  rappel.current = gerer;

  useEffect(() => {
    if (Platform.OS !== 'android' || !condition) return undefined;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => rappel.current());
    return () => abonnement.remove();
  }, [condition]);
}
