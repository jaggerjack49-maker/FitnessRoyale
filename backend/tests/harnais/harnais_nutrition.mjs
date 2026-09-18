// Exécute les VRAIS calculs de la carte Nutrition (src/logic/nutrition.js)
// sur des cas choisis, et rend le résultat en JSON pour test_nutrition_front.py.
import {
  ajusterPortion, alimentsAEnvoyer, brouillonDepuisAnalyse, libelleReste, progression,
  totauxAliments,
} from '../../../src/logic/nutrition.js';

const cas = [];
function verifier(nom, calcul, attendu) {
  try {
    cas.push({ nom, obtenu: calcul(), attendu });
  } catch (e) {
    cas.push({ nom, erreur: e.message, attendu });
  }
}

const POULET = { nom: 'Poulet', portion: '150 g', grammes: 150, kcal: 248, proteines_g: 46.5, glucides_g: 0, lipides_g: 5.4 };
const RIZ = { nom: 'Riz', portion: '1 bol', grammes: 180, kcal: 234, proteines_g: 4.9, glucides_g: 50.4, lipides_g: 0.5 };

verifier('totaux d\'un repas', () => totauxAliments([POULET, RIZ]),
  { kcal: 482, proteines_g: 51.4, glucides_g: 50.4, lipides_g: 5.9 });

const brouillon = brouillonDepuisAnalyse({ description: 'Poulet riz', aliments: [POULET, RIZ], confiance: 'moyenne' });
verifier('le brouillon garde les valeurs d\'origine', () => brouillon.aliments[0].base.kcal, 248);
verifier('doubler la portion double calories et macros',
  () => { const a = ajusterPortion(brouillon.aliments[0], 300); return [a.grammes, a.kcal, a.proteines_g, a.lipides_g]; },
  [300, 496, 93, 10.8]);
// 150 → 333 → 77 → 150 : on repart toujours de l'origine, donc on retombe pile.
verifier('ajuster plusieurs fois puis revenir retombe pile sur l\'origine', () => {
  let a = brouillon.aliments[1];
  for (const g of [333, 77, 180]) a = ajusterPortion(a, g);
  return [a.kcal, a.proteines_g, a.glucides_g, a.lipides_g];
}, [234, 4.9, 50.4, 0.5]);
verifier('sans poids d\'origine, seuls les grammes changent',
  () => { const a = ajusterPortion({ nom: 'Sauce', grammes: 0, kcal: 90 }, 50); return [a.grammes, a.kcal]; },
  [50, 90]);
verifier('ce qui part au serveur n\'emporte pas la copie d\'origine',
  () => Object.keys(alimentsAEnvoyer(brouillon)[0]).sort(),
  ['glucides_g', 'grammes', 'kcal', 'lipides_g', 'nom', 'portion', 'proteines_g']);
verifier('un aliment sans nom ne part pas',
  () => alimentsAEnvoyer({ aliments: [{ nom: '  ', kcal: 100 }, { nom: 'Pomme', kcal: 80 }] }).map((a) => a.nom),
  ['Pomme']);

verifier('progression bornée à 100 %', () => [progression(1200, 2400), progression(3000, 2400), progression(500, 0)],
  [0.5, 1, 0]);
verifier('ce qu\'il reste, ou le dépassement', () => [
  libelleReste(1250, 2400, 'kcal'), libelleReste(2600, 2400, 'kcal'), libelleReste(900, null, 'kcal'),
], ['Il te reste 1150 kcal', 'Objectif dépassé de 200 kcal', null]);

verifier('données abîmées sans plantage', () => [
  totauxAliments(null).kcal,
  totauxAliments([null, 'x', { kcal: 'abc' }, { kcal: -50 }]).kcal,
  brouillonDepuisAnalyse(undefined).aliments.length,
  ajusterPortion(null, 100),
  ajusterPortion({ nom: 'x', grammes: 100, kcal: 200 }, 'pas un nombre').kcal,
  alimentsAEnvoyer(null).length,
  progression('x', 'y'),
], [0, 0, 0, null, 0, 0, 0]);

process.stdout.write(JSON.stringify(cas));
