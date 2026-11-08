// Les réglages de l'app (Profil → Paramètres, 08/11/2026) — exécute le VRAI
// code de l'app (src/logic/reglages.js et le repos par défaut de
// src/logic/repos.js) et rend le résultat en JSON pour test_reglages.py.
import {
  PREFERENCES_DEFAUT, normaliserPreferences, lireHeure, normaliserRappel, normaliserRappelSuivi,
} from '../../../src/logic/reglages.js';
import { reposDe } from '../../../src/logic/repos.js';

const cas = [
  // ---- Les préférences ----
  ['préférences : rien en mémoire → valeurs par défaut', () => normaliserPreferences(null), PREFERENCES_DEFAUT],
  ['préférences : mémoire abîmée → valeurs par défaut', () => normaliserPreferences('n\'importe quoi'),
    PREFERENCES_DEFAUT],
  ['préférences : un champ faux ne touche pas les autres',
    () => normaliserPreferences({ reposDefaut: 'long', vibrationRepos: false, notificationRepos: 'oui' }),
    { reposDefaut: 90, vibrationRepos: false, notificationRepos: true }],
  ['préférences : repos valide gardé', () => normaliserPreferences({ reposDefaut: 120 }).reposDefaut, 120],
  ['préférences : repos 0 gardé (enchaîner)', () => normaliserPreferences({ reposDefaut: 0 }).reposDefaut, 0],
  ['préférences : repos négatif refusé', () => normaliserPreferences({ reposDefaut: -5 }).reposDefaut, 90],
  ['préférences : repos au-delà de 15 min refusé',
    () => normaliserPreferences({ reposDefaut: 5000 }).reposDefaut, 90],
  ['préférences : une liste n\'est pas un réglage', () => normaliserPreferences([1, 2]), PREFERENCES_DEFAUT],

  // ---- Le repos par défaut appliqué au minuteur ----
  ['repos : le programme prime sur la préférence', () => reposDe({ repos_secondes: 150 }, 60), 150],
  ['repos : sans réglage du programme → la préférence', () => reposDe({}, 120), 120],
  ['repos : préférence à 0 → pas de minuteur', () => reposDe(undefined, 0), 0],
  ['repos : préférence illisible → 1:30', () => reposDe({}, 'x'), 90],
  ['repos : sans préférence → 1:30', () => reposDe({}), 90],

  // ---- L'heure d'un rappel ----
  ['heure : 18:00', () => lireHeure('18:00'), { heure: 18, minute: 0 }],
  ['heure : 7h05', () => lireHeure('7h05'), { heure: 7, minute: 5 }],
  ['heure : 25:00 refusée', () => lireHeure('25:00'), null],
  ['heure : 18:60 refusée', () => lireHeure('18:60'), null],
  ['heure : texte refusé', () => lireHeure('ce soir'), null],
  ['heure : vide refusé', () => lireHeure(undefined), null],

  // ---- Les rappels ----
  ['rappel : réglage d\'avant le déménagement relu tel quel',
    () => normaliserRappel({ jours: ['lundi', 'jeudi'], heure: '18:30', actif: true }),
    { jours: ['lundi', 'jeudi'], heure: '18:30', actif: true }],
  ['rappel : jours remis dans l\'ordre, inconnus écartés',
    () => normaliserRappel({ jours: ['jeudi', 'funday', 'lundi'], heure: '18:00', actif: false }).jours,
    ['lundi', 'jeudi']],
  ['rappel : actif sans aucun jour → inactif',
    () => normaliserRappel({ jours: [], heure: '18:00', actif: true }).actif, false],
  ['rappel : heure illisible → 18:00', () => normaliserRappel({ heure: 'tôt' }).heure, '18:00'],
  ['rappel : rien en mémoire', () => normaliserRappel(null), { jours: [], heure: '18:00', actif: false }],
  ['point hebdo : relu tel quel',
    () => normaliserRappelSuivi({ jour: 'samedi', heure: '20:00', actif: true }),
    { jour: 'samedi', heure: '20:00', actif: true }],
  ['point hebdo : jour inconnu → dimanche', () => normaliserRappelSuivi({ jour: 'x' }).jour, 'dimanche'],
  ['point hebdo : rien en mémoire', () => normaliserRappelSuivi(undefined),
    { jour: 'dimanche', heure: '19:00', actif: false }],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
