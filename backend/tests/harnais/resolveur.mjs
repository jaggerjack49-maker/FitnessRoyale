// Apprend à Node à charger le code de l'APP tel quel.
//
// POURQUOI IL EXISTE : `src/logic/classement.js` importe `'../data/clubSP'`
// SANS extension. C'est la convention de Metro (le bundler d'Expo), mais Node
// en modules ES exige l'extension complète — il refuse donc le fichier.
// Plutôt que de modifier le code de l'app pour l'amour d'un test, on complète
// l'extension nous-mêmes, comme le fait Metro.
//
// `registerHooks` (et non l'ancien `module.register`, déprécié depuis Node 26)
// installe un crochet SYNCHRONE dans le même fil d'exécution.
// Chargé via `--import`, avant le harnais (voir test_parite_front_back.py).
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, contexte, suivant) {
    if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
      for (const essai of [`${specifier}.js`, `${specifier}/index.js`]) {
        const url = new URL(essai, contexte.parentURL);
        if (existsSync(fileURLToPath(url))) {
          return suivant(essai, contexte);
        }
      }
    }
    return suivant(specifier, contexte);
  },
});
