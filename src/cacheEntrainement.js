// L'ÉCRAN ENTRAÎNEMENT S'AFFICHE SANS ATTENDRE LE RÉSEAU (15/11/2026).
//
// Retour de Hafiz : « l'écran Entraînement prend toujours du temps pour se
// charger ». Mesuré le jour même, serveur éveillé : chaque demande met 1,5 à
// 2,5 s, et même `/sante` (qui ne touche pas la base) en met 1,6 — c'est le
// trajet réseau jusqu'au serveur, pas un calcul qu'on pourrait accélérer.
//
// Le remède n'est donc pas d'aller plus vite, mais de ne plus ATTENDRE : on
// garde sur le téléphone la dernière réponse du serveur, on l'affiche tout de
// suite à l'ouverture de l'onglet, et la vraie réponse la remplace dès qu'elle
// arrive (quelques secondes plus tard).
//
// ⚠️ CE N'EST PAS LE RETOUR DU MODE HORS-LIGNE (supprimé le 26/09/2026) : ce
// mode montrait un profil de DÉMONSTRATION, c'est-à-dire des données qui
// n'étaient pas les tiennes. Ici ce sont TES données, celles que le serveur a
// lui-même renvoyées à ta dernière visite. Et l'écran le DIT tant que la mise à
// jour n'est pas arrivée (voir `fraicheur` dans EntrainementScreen).
//
// Rangé PAR JOUEUR : un autre compte sur le même téléphone ne voit jamais la
// mémoire du précédent. Toute lecture/écriture est protégée : une mémoire
// abîmée ou un stockage plein ne doit JAMAIS casser l'écran — au pire, on
// attend le serveur comme avant.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIXE = 'fitnessRoyale.cacheEntrainement.';
// Les listes que renvoie `GET /joueurs/{id}/donnees-entrainement`.
const LISTES = [
  'programmes', 'entrainements', 'planning', 'cycles',
  'objectifs_series', 'groupes_exercices', 'cibles_semaine',
];

// Une réponse du serveur est-elle utilisable ? Il faut que CHAQUE liste soit
// bien une liste : une mémoire à moitié abîmée ne s'affiche pas du tout plutôt
// que d'afficher un écran incohérent.
export function donneesValides(d) {
  return !!d && typeof d === 'object' && LISTES.every((cle) => Array.isArray(d[cle]));
}

export async function lireCacheEntrainement(joueurId) {
  try {
    const brut = await AsyncStorage.getItem(PREFIXE + joueurId);
    if (!brut) return null;
    const lu = JSON.parse(brut);
    if (!lu || lu.joueurId !== joueurId || !donneesValides(lu.donnees)) return null;
    return { donnees: lu.donnees, enregistreLe: lu.enregistreLe || null };
  } catch {
    return null;
  }
}

export async function ecrireCacheEntrainement(joueurId, donnees, maintenant = Date.now()) {
  if (!donneesValides(donnees)) return;
  try {
    await AsyncStorage.setItem(PREFIXE + joueurId, JSON.stringify({
      joueurId, enregistreLe: maintenant, donnees,
    }));
  } catch {
    // Stockage plein ou indisponible : l'écran attendra le serveur, comme avant.
  }
}
