// Le contrat de `src/cacheEntrainement.js` (15/11/2026) : la dernière réponse
// du serveur se relit à l'identique, ne fuit pas d'un compte à l'autre, et une
// mémoire abîmée ne s'affiche jamais. Exécute le VRAI code de l'app avec un
// AsyncStorage en mémoire. Lancé par test_cache_entrainement.py.
import faux from './faux_asyncstorage.mjs';
import {
  lireCacheEntrainement, ecrireCacheEntrainement, donneesValides,
} from '../../../src/cacheEntrainement.js';

const resultats = [];
const verifier = async (nom, f) => {
  faux.__vider();
  try {
    await f();
    resultats.push({ nom, ok: true });
  } catch (e) {
    resultats.push({ nom, ok: false, erreur: e.message });
  }
};
const egal = (obtenu, attendu, quoi) => {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : obtenu ${a}, attendu ${b}`);
};

const donnees = {
  programmes: [{ id: 19, nom: 'Push', exercices: [] }],
  entrainements: [{ id: 3, date: '2026-11-10', series: [{ exercice: 'squat', reps: 5, poids: 120 }] }],
  planning: [], cycles: [{ id: 2, nom: 'PPL', seances: [] }],
  objectifs_series: [{ groupe: 'Pectoraux', series_cibles: 12 }],
  groupes_exercices: [], cibles_semaine: [],
};

await verifier('la dernière réponse se relit à l\u2019identique', async () => {
  await ecrireCacheEntrainement(7, donnees, 1234);
  egal(await lireCacheEntrainement(7), { donnees, enregistreLe: 1234 }, 'la mémoire relue');
});

await verifier('rien en mémoire → null (on attend le serveur)', async () => {
  egal(await lireCacheEntrainement(7), null, 'sans mémoire');
});

await verifier('un autre compte ne voit pas la mémoire du précédent', async () => {
  await ecrireCacheEntrainement(7, donnees);
  egal(await lireCacheEntrainement(8), null, 'le compte 8');
});

await verifier('une mémoire illisible ne s\u2019affiche pas', async () => {
  await faux.setItem('fitnessRoyale.cacheEntrainement.7', '{pas du json');
  egal(await lireCacheEntrainement(7), null, 'mémoire illisible');
});

await verifier('une mémoire à moitié abîmée ne s\u2019affiche pas', async () => {
  await faux.setItem('fitnessRoyale.cacheEntrainement.7', JSON.stringify({
    joueurId: 7, donnees: { ...donnees, cycles: 'pas une liste' },
  }));
  egal(await lireCacheEntrainement(7), null, 'liste abîmée');
});

await verifier('une mémoire rangée sous un autre compte est refusée', async () => {
  await faux.setItem('fitnessRoyale.cacheEntrainement.7', JSON.stringify({ joueurId: 8, donnees }));
  egal(await lireCacheEntrainement(7), null, 'mauvais propriétaire');
});

await verifier('une réponse incomplète n\u2019est pas mise en mémoire', async () => {
  await ecrireCacheEntrainement(7, { programmes: [] });
  egal(await lireCacheEntrainement(7), null, 'réponse incomplète');
});

await verifier('donneesValides : les cas limites', async () => {
  egal([donneesValides(null), donneesValides(3), donneesValides(donnees)], [false, false, true], 'validation');
});

process.stdout.write(JSON.stringify(resultats));
