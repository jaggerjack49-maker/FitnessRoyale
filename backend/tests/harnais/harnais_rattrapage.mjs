// Exécute le VRAI code de l'app (src/logic/rattrapage.js) sur les cas de
// cas_rattrapage.json, et rend le résultat en JSON pour test_rattrapage.py.
//
// Pourquoi ce détour : ce calcul ne s'affiche à l'écran que les jours où l'on
// a réellement raté une séance. On ne peut donc pas le vérifier en regardant
// l'app — il faut lui donner des dates choisies.
//
// Lancé par test_rattrapage.py.
import { readFileSync } from 'node:fs';
import { seancesARattraper } from '../../../src/logic/rattrapage.js';

const cas = JSON.parse(readFileSync(new URL('./cas_rattrapage.json', import.meta.url), 'utf8')).cas;

const resultats = cas.map((c) => {
  try {
    const manquees = seancesARattraper({
      programmes: c.programmes,
      planning: c.planning,
      entrainements: c.entrainements,
      lundiISO: c.lundiISO,
      jourJ: c.jourJ,
    });
    return {
      nom: c.nom,
      obtenu: manquees.map((m) => ({ date: m.date, programme: m.programme.nom })),
      attendu: c.attendu,
    };
  } catch (e) {
    return { nom: c.nom, erreur: e.message, attendu: c.attendu };
  }
});

process.stdout.write(JSON.stringify(resultats));
