// Exécute la VRAIE règle du retour Android (src/logic/retour.js) sur des cas
// choisis, et rend le résultat en JSON pour test_retour.py.
//
// Pourquoi ce détour : le geste retour n'existe pas dans le navigateur où l'app
// est vérifiée — la règle se teste donc à part, sur des instants choisis.
import { decisionRetour, DELAI_DOUBLE_RETOUR_MS } from '../../../src/logic/retour.js';

const cas = [];
function verifier(nom, entree, attendu) {
  try {
    cas.push({ nom, obtenu: decisionRetour(entree), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

verifier('depuis un autre onglet : retour au Profil',
  { ongletActif: 'entrainement', dernierRetourMs: null, maintenantMs: 10000 }, 'profil');
verifier('depuis un autre onglet, même juste après un retour : Profil, jamais quitter',
  { ongletActif: 'clan', dernierRetourMs: 9500, maintenantMs: 10000 }, 'profil');
verifier('sur le Profil, premier retour : avertir, ne pas quitter',
  { ongletActif: 'profil', dernierRetourMs: null, maintenantMs: 10000 }, 'avertir');
verifier('sur le Profil, second retour dans les 2 s : quitter',
  { ongletActif: 'profil', dernierRetourMs: 9000, maintenantMs: 10000 }, 'quitter');
verifier('sur le Profil, second retour pile à 2 s : quitter',
  { ongletActif: 'profil', dernierRetourMs: 10000 - DELAI_DOUBLE_RETOUR_MS, maintenantMs: 10000 }, 'quitter');
verifier('sur le Profil, retour bien après le premier : avertir à nouveau',
  { ongletActif: 'profil', dernierRetourMs: 1000, maintenantMs: 10000 }, 'avertir');
verifier('horloge incohérente (retour « dans le futur ») : avertir, pas quitter',
  { ongletActif: 'profil', dernierRetourMs: 12000, maintenantMs: 10000 }, 'avertir');
verifier('données manquantes : avertir sans planter',
  { ongletActif: 'profil' }, 'avertir');

process.stdout.write(JSON.stringify(cas));
