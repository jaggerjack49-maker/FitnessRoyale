// Le temps de repos, l'ordre des exercices et les lignes des éditeurs
// (08/11/2026) — exécute le VRAI code de l'app (src/logic/repos.js et
// src/logic/lignesProgramme.js) et rend le résultat en JSON pour test_repos.py.
import {
  REPOS_PAR_DEFAUT, reposDe, lireDuree, dureeLisible, secondesRestantes,
  prochaineEtape, libelleEtape,
} from '../../../src/logic/repos.js';
import {
  ligneVide, ligneDepuisExercice, exerciceDepuisLigne, exercicesDepuisLignes,
  deplacerLigne, resumeReglages, detecterRenommages,
} from '../../../src/logic/lignesProgramme.js';

const serie = { reps: 8, poids: 60 };
const n = (k) => Array.from({ length: k }, () => serie);

const cas = [
  // ---- Le repos d'un exercice ----
  ['repos : fixé par le programme', () => reposDe({ repos_secondes: 180 }), 180],
  ['repos : 0 est une vraie valeur (enchaîner)', () => reposDe({ repos_secondes: 0 }), 0],
  ['repos : absent → défaut', () => reposDe({}), REPOS_PAR_DEFAUT],
  ['repos : pas d\'exercice → défaut', () => reposDe(undefined), REPOS_PAR_DEFAUT],
  ['repos : abîmé → défaut', () => reposDe({ repos_secondes: 'abc' }), REPOS_PAR_DEFAUT],
  ['repos : plafonné à 15 min', () => reposDe({ repos_secondes: 5000 }), 900],

  // ---- Saisir une durée ----
  ['durée : secondes', () => lireDuree('90'), 90],
  ['durée : minutes:secondes', () => lireDuree('1:30'), 90],
  ['durée : avec apostrophe', () => lireDuree("2'00"), 120],
  ['durée : espaces autour', () => lireDuree('  0:45 '), 45],
  ['durée : vide → pas fixé', () => lireDuree(''), null],
  ['durée : texte → pas fixé', () => lireDuree('beaucoup'), null],
  ['durée : 1:75 refusé', () => lireDuree('1:75'), null],
  ['durée : négatif refusé', () => lireDuree('-30'), null],
  ['durée : plafonnée à 15 min', () => lireDuree('30:00'), 900],
  ['durée : 0 accepté', () => lireDuree('0'), 0],
  ['affichage : 1:30', () => dureeLisible(90), '1:30'],
  ['affichage : 0:45', () => dureeLisible(45), '0:45'],
  ['affichage : rien → champ vide', () => dureeLisible(null), ''],
  ['aller-retour : 2:15', () => dureeLisible(lireDuree('2:15')), '2:15'],

  // ---- Le minuteur ----
  ['restant : arrondi au-dessus', () => secondesRestantes(10_000, 8_200), 2],
  ['restant : fini → 0', () => secondesRestantes(10_000, 12_000), 0],
  ['restant : fin absente → 0', () => secondesRestantes(null, 1_000), 0],
  ['restant : fin illisible → 0', () => secondesRestantes('x', 1_000), 0],

  // ---- La prochaine étape, dans l'ordre ----
  ['étape : on reste sur l\'exercice tant qu\'il reste des séries',
    () => prochaineEtape(['A', 'B'], { A: n(1) }, { A: 3, B: 3 }, 'A'),
    { exercice: 'A', numero: 2 }],
  ['étape : exercice fini → le suivant dans l\'ordre',
    () => prochaineEtape(['A', 'B', 'C'], { A: n(3) }, { A: 3, B: 3, C: 3 }, 'A'),
    { exercice: 'B', numero: 1 }],
  ['étape : un exercice SAUTÉ plus haut repasse avant ceux d\'en dessous',
    () => prochaineEtape(['A', 'B', 'C'], { B: n(3) }, { A: 3, B: 3, C: 3 }, 'B'),
    { exercice: 'A', numero: 1 }],
  ['étape : l\'ordre de la séance, pas l\'ordre alphabétique',
    () => prochaineEtape(['Squat', 'Curl', 'Abdos'], { Squat: n(2) },
      { Squat: 2, Curl: 3, Abdos: 3 }, 'Squat'),
    { exercice: 'Curl', numero: 1 }],
  ['étape : tout est fait → null',
    () => prochaineEtape(['A', 'B'], { A: n(2), B: n(2) }, { A: 2, B: 2 }, 'B'), null],
  ['étape : séance libre, on reste sur l\'exercice courant',
    () => prochaineEtape(['A'], { A: n(4) }, {}, 'A'), { exercice: 'A', numero: 5 }],
  ['étape : exercice sans objectif pas encore commencé, proposé en dernier',
    () => prochaineEtape(['X', 'A'], { A: n(2) }, { A: 2 }, 'A'), { exercice: 'X', numero: 1 }],
  ['étape : séries en trop sur l\'exercice → on passe au suivant',
    () => prochaineEtape(['A', 'B'], { A: n(5) }, { A: 3, B: 3 }, 'A'), { exercice: 'B', numero: 1 }],
  ['étape : courant inconnu → le premier de l\'ordre',
    () => prochaineEtape(['A', 'B'], {}, { A: 3, B: 3 }, 'Z'), { exercice: 'A', numero: 1 }],
  ['étape : données abîmées ne plantent pas',
    () => prochaineEtape('x', null, 'y', undefined), null],
  ['étape : séries nulles ignorées',
    () => prochaineEtape(['A'], { A: [null, serie] }, { A: 2 }, 'A'), { exercice: 'A', numero: 2 }],
  ['libellé : prochaine série', () => libelleEtape({ exercice: 'Dips', numero: 3 }),
    'Prochain : Dips — série 3'],
  ['libellé : séance complète', () => libelleEtape(null), 'Toutes les séries prévues sont faites.'],

  // ---- Les lignes des éditeurs ----
  ['ligne : vide', () => ligneVide(),
    { exercice: '', series: '3', reps: '10', repsMax: '', repos: '', rir: '' }],
  ['ligne : depuis un exercice complet',
    () => ligneDepuisExercice({
      exercice: 'Dips', series_cibles: 4, reps_cibles: 6, reps_cibles_max: 10,
      repos_secondes: 150, rir_cible: 0,
    }),
    { exercice: 'Dips', series: '4', reps: '6', repsMax: '10', repos: '2:30', rir: '0' }],
  ['ligne : depuis un exercice d\'avant (sans repos ni RIR)',
    () => ligneDepuisExercice({ exercice: 'Dips', series_cibles: 3, reps_cibles: 10 }),
    { exercice: 'Dips', series: '3', reps: '10', repsMax: '', repos: '', rir: '' }],
  ['exercice : tout est converti',
    () => exerciceDepuisLigne({
      exercice: ' Dips ', series: '4', reps: '6', repsMax: '10', repos: '2:30', rir: '2',
    }),
    {
      exercice: 'Dips', series_cibles: 4, reps_cibles: 6, reps_cibles_max: 10,
      repos_secondes: 150, rir_cible: 2,
    }],
  ['exercice : un RIR de 0 est gardé',
    () => exerciceDepuisLigne({ exercice: 'Dips', series: '3', reps: '8', rir: '0' }).rir_cible, 0],
  ['exercice : RIR hors limites → pas fixé',
    () => exerciceDepuisLigne({ exercice: 'Dips', series: '3', reps: '8', rir: '12' }).rir_cible, null],
  ['exercice : fourchette à l\'envers → objectif simple',
    () => exerciceDepuisLigne({ exercice: 'Dips', series: '3', reps: '10', repsMax: '5' }).reps_cibles_max,
    null],
  ['exercice : repos illisible → pas fixé',
    () => exerciceDepuisLigne({ exercice: 'Dips', series: '3', reps: '8', repos: 'long' }).repos_secondes,
    null],
  ['exercice : séries absurdes bornées à 20',
    () => exerciceDepuisLigne({ exercice: 'Dips', series: '99', reps: '8' }).series_cibles, 20],
  ['exercice : sans nom → ignoré', () => exerciceDepuisLigne({ exercice: '  ', series: '3' }), null],
  ['exercice : ligne nulle → ignorée', () => exerciceDepuisLigne(null), null],
  ['liste : les lignes sans nom disparaissent, l\'ordre reste',
    () => exercicesDepuisLignes([{ exercice: 'B' }, { exercice: '' }, { exercice: 'A' }])
      .map((e) => e.exercice),
    ['B', 'A']],
  ['liste : pas une liste → vide', () => exercicesDepuisLignes('x'), []],
  ['déplacer : monter', () => deplacerLigne(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']],
  ['déplacer : descendre', () => deplacerLigne(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']],
  ['déplacer : le premier ne monte pas', () => deplacerLigne(['a', 'b'], 0, -1), ['a', 'b']],
  ['déplacer : le dernier ne descend pas', () => deplacerLigne(['a', 'b'], 1, 1), ['a', 'b']],
  ['déplacer : la liste d\'origine n\'est pas modifiée', () => {
    const l = ['a', 'b'];
    deplacerLigne(l, 0, 1);
    return l;
  }, ['a', 'b']],
  ['résumé : repos et RIR', () => resumeReglages({ repos_secondes: 90, rir_cible: 2 }),
    'repos 1:30 · RIR 2'],
  ['résumé : RIR 0', () => resumeReglages({ rir_cible: 0 }), 'RIR 0'],
  ['résumé : rien de fixé → vide', () => resumeReglages({ repos_secondes: null }), ''],

  // ---- Renommage ou simple déplacement ? (piège du 08/11/2026) ----
  ['renommage : un déplacement n\'est PAS un renommage',
    () => detecterRenommages(
      [{ exercice: 'A' }, { exercice: 'B' }, { exercice: 'C' }, { exercice: 'D' }],
      [{ exercice: 'A' }, { exercice: 'D' }, { exercice: 'B' }, { exercice: 'C' }],
    ), []],
  ['renommage : un nom changé sur place',
    () => detecterRenommages([{ exercice: 'dc' }, { exercice: 'Dips' }],
      [{ exercice: 'Développé couché' }, { exercice: 'Dips' }]),
    [{ ancien: 'dc', nouveau: 'Développé couché' }]],
  ['renommage : renommé ET déplacé',
    () => detecterRenommages([{ exercice: 'dc' }, { exercice: 'Dips' }],
      [{ exercice: 'Dips' }, { exercice: 'Développé couché' }]),
    [{ ancien: 'dc', nouveau: 'Développé couché' }]],
  ['renommage : ajout d\'une ligne → on ne devine rien',
    () => detecterRenommages([{ exercice: 'A' }], [{ exercice: 'B' }, { exercice: 'C' }]), []],
  ['renommage : espaces autour ignorés',
    () => detecterRenommages([{ exercice: 'Dips' }], [{ exercice: ' Dips ' }]), []],
  ['renommage : rien de changé', () => detecterRenommages([{ exercice: 'A' }], [{ exercice: 'A' }]), []],
  ['renommage : données abîmées', () => detecterRenommages(null, 'x'), []],
];

const resultats = cas.map(([nom, calcul, attendu]) => {
  try {
    return { nom, obtenu: calcul(), attendu };
  } catch (e) {
    return { nom, erreur: e.message, attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
