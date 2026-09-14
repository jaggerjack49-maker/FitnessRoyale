// usePlaceDefilement — garder sa place dans une page qui change de vue.
//
// Demande de Hafiz du 14/09/2026 : ouvrir une séance de l'historique, puis en
// sortir, ramenait l'onglet Entraînement tout en haut. Même défaut dans
// Compétition (ouvrir un duel, changer de mode de classement) et dans le Clan
// (passer de Membres à Chat puis revenir).
//
// LA CAUSE, commune aux trois : quand une vue en remplace une autre, sa page
// est recréée (ou vidée puis re-remplie) et repart en haut. Ce hook retient la
// position de défilement DE CHAQUE VUE, rangée par une clé, et la remet quand
// on revient sur cette vue.
//
// UTILISATION — on étale ce que renvoie le hook sur le <ScrollView>, et on lui
// donne LA MÊME CLÉ en `key` :
//   const cle = onglet === 'defis' ? 'defis' : 'classement';
//   const place = usePlaceDefilement(cle);
//   <ScrollView key={cle} {...place} style={...}>
// (La `key` n'est pas dans ce que renvoie le hook : React 19 avertit quand une
// `key` arrive par un `{...}`.)
//
// ⚠️ CETTE `key` EST INDISPENSABLE : sans elle, React RÉUTILISE le même
// élément d'une vue à l'autre. Le contenu plus
// court de l'autre vue ramène alors le défilement à 0 sur cet élément, et
// comme il n'est pas neuf, rien ne signale qu'il faut remettre la place.
//
// `memoriser: false` : la vue repart toujours en haut (ex. un duel qu'on
// ouvre — le rouvrir plus tard au milieu de l'écran n'aurait aucun sens).
import { useCallback, useRef } from 'react';

// Pendant ce délai après la remise en place, les évènements de défilement sont
// ignorés : la page neuve, encore à 0, écraserait sinon la position qu'on
// cherche justement à retrouver.
const DELAI_REMISE_MS = 400;

export default function usePlaceDefilement(cle, { memoriser = true } = {}) {
  const positions = useRef({}); // { [cle]: y }
  const cleCourante = useRef(cle);
  const memoriserCourant = useRef(memoriser);
  cleCourante.current = cle;
  memoriserCourant.current = memoriser;

  const instance = useRef(null);
  const hauteurVisible = useRef(0);
  const enRemise = useRef(false);
  const minuterie = useRef(null);

  function remettre() {
    const y = positions.current[cleCourante.current] || 0;
    instance.current?.scrollTo({ y, animated: false });
    return y;
  }

  // Fonction STABLE (useCallback sans dépendance) : React ne l'appelle donc
  // qu'au montage et au démontage du ScrollView — c'est-à-dire exactement
  // quand une vue est (re)créée. Une fonction recréée à chaque rendu serait
  // rappelée à chaque rendu, et ramènerait l'utilisateur en arrière à chaque
  // dépliage de section.
  const ref = useCallback((noeud) => {
    clearTimeout(minuterie.current);
    instance.current = noeud;
    if (!noeud) return;
    const y = memoriserCourant.current ? positions.current[cleCourante.current] || 0 : 0;
    if (y <= 0) { enRemise.current = false; return; }
    enRemise.current = true;
    // Tout de suite : sur web, le contenu est déjà en place à ce moment-là.
    // On ne compte pas sur `onContentSizeChange` seul : sur web, il dépend
    // d'un observateur de taille qui peut ne jamais se déclencher.
    remettre();
    minuterie.current = setTimeout(() => { enRemise.current = false; }, DELAI_REMISE_MS);
  }, []);

  function onScroll(e) {
    if (enRemise.current || !memoriserCourant.current) return;
    positions.current[cleCourante.current] = e.nativeEvent.contentOffset.y;
  }

  function onLayout(e) {
    hauteurVisible.current = e.nativeEvent.layout.height;
  }

  // Renfort pour le téléphone : si le contenu finit de s'afficher après le
  // montage, la première remise a pu être bloquée plus haut. On la refait
  // tant que le contenu n'est pas assez haut pour atteindre la position.
  function onContentSizeChange(_largeur, hauteur) {
    if (!enRemise.current) return;
    const y = remettre();
    if (hauteur - hauteurVisible.current >= y) enRemise.current = false;
  }

  return { ref, onScroll, scrollEventThrottle: 16, onLayout, onContentSizeChange };
}
