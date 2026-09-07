// Un faux AsyncStorage, en mémoire — pour tester `src/stockageSeance.js` avec
// Node. Le vrai module est natif (React Native) et n'existe pas hors d'un
// téléphone ou d'un navigateur ; le résolveur redirige donc l'import vers ce
// fichier (voir resolveur.mjs).
//
// Il reproduit ce qui compte : des clés qui ne stockent que du TEXTE (d'où le
// JSON.stringify côté app), et rien d'autre. `__vider` et `__ecrireBrut`
// servent au harnais pour partir d'une base propre et pour simuler une
// mémoire corrompue.
const memoire = new Map();

export default {
  async getItem(cle) {
    return memoire.has(cle) ? memoire.get(cle) : null;
  },
  async setItem(cle, valeur) {
    if (typeof valeur !== 'string') throw new Error('AsyncStorage ne stocke que du texte');
    memoire.set(cle, valeur);
  },
  async removeItem(cle) {
    memoire.delete(cle);
  },
  __vider() { memoire.clear(); },
  __ecrireBrut(cle, texte) { memoire.set(cle, texte); },
};
