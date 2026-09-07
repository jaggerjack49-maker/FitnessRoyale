// Vérifie le CONTRAT de `src/stockageSeance.js` : ce qui doit survivre à la
// fermeture de l'app, et ce qui ne doit surtout pas fuiter d'un compte à
// l'autre. Exécute le VRAI code de l'app, avec un AsyncStorage en mémoire.
//
// Pourquoi pas un simple clic dans l'app : ce qu'on veut prouver, c'est
// justement le comportement APRÈS une fermeture — et la reprise sur le
// mauvais compte, qu'on ne verrait qu'en jonglant entre deux comptes.
//
// Lancé par test_stockage_seance.py.
import faux from './faux_asyncstorage.mjs';
import {
  lireSeanceEnCours, ecrireSeanceEnCours, effacerSeanceEnCours,
  lireSeancesEnAttente, ajouterSeanceEnAttente, retirerSeanceEnAttente,
} from '../../../src/stockageSeance.js';

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

const seance = {
  programmeActif: { id: 19, nom: 'Push', exercices: [] },
  exercicesSession: ['developpe couche'],
  seriesLoggees: { 'developpe couche': [{ numero_serie: 1, reps: 8, poids: 100 }] },
  champsSaisie: { 'developpe couche': { reps: '8', poids: '100' } },
  rattrapageDe: '2026-09-07',
};

await verifier('la séance en cours se relit à l\'identique', async () => {
  await ecrireSeanceEnCours(7, seance);
  const relue = await lireSeanceEnCours(7);
  egal(relue.seriesLoggees, seance.seriesLoggees, 'les séries saisies');
  egal(relue.programmeActif.nom, 'Push', 'le programme');
  egal(relue.rattrapageDe, '2026-09-07', 'le rattrapage');
});

await verifier('la séance d\'un AUTRE joueur n\'est jamais reprise', async () => {
  await ecrireSeanceEnCours(7, seance);
  egal(await lireSeanceEnCours(8), null, 'la séance vue par le joueur 8');
});

await verifier('abandonner efface vraiment la séance', async () => {
  await ecrireSeanceEnCours(7, seance);
  await effacerSeanceEnCours();
  egal(await lireSeanceEnCours(7), null, 'après effacement');
});

await verifier('aucune séance en mémoire : on ne plante pas', async () => {
  egal(await lireSeanceEnCours(7), null, 'mémoire vide');
  egal(await lireSeancesEnAttente(7), [], 'file vide');
});

await verifier('une mémoire corrompue ne plante pas l\'app', async () => {
  faux.__ecrireBrut('fitnessRoyale.seanceEnCours', '{ceci n\'est pas du JSON');
  faux.__ecrireBrut('fitnessRoyale.seancesAEnvoyer', 'pas du JSON non plus');
  egal(await lireSeanceEnCours(7), null, 'séance illisible');
  egal(await lireSeancesEnAttente(7), [], 'file illisible');
});

await verifier('la file garde les séances terminées, dans l\'ordre', async () => {
  await ajouterSeanceEnAttente(7, { id: 'local-1', date: '2026-09-07', series: [] });
  await ajouterSeanceEnAttente(7, { id: 'local-2', date: '2026-09-08', series: [] });
  const file = await lireSeancesEnAttente(7);
  egal(file.map((s) => s.id), ['local-1', 'local-2'], 'la file');
});

await verifier('une séance ne sort de la file que quand on la retire', async () => {
  await ajouterSeanceEnAttente(7, { id: 'local-1', date: '2026-09-07', series: [] });
  await ajouterSeanceEnAttente(7, { id: 'local-2', date: '2026-09-08', series: [] });
  await retirerSeanceEnAttente('local-1');
  egal((await lireSeancesEnAttente(7)).map((s) => s.id), ['local-2'], 'après retrait');
});

await verifier('la file d\'un joueur reste invisible aux autres', async () => {
  await ajouterSeanceEnAttente(7, { id: 'local-1', date: '2026-09-07', series: [] });
  await ajouterSeanceEnAttente(8, { id: 'local-2', date: '2026-09-07', series: [] });
  egal((await lireSeancesEnAttente(7)).map((s) => s.id), ['local-1'], 'file du joueur 7');
  egal((await lireSeancesEnAttente(8)).map((s) => s.id), ['local-2'], 'file du joueur 8');
});

await verifier('les séries survivent telles quelles (reps et poids en nombres)', async () => {
  const finie = {
    id: 'local-9', programme_id: 19, date: '2026-09-07',
    series: [{ exercice: 'squat', numero_serie: 1, reps: 5, poids: 120.5 }],
  };
  await ajouterSeanceEnAttente(7, finie);
  egal((await lireSeancesEnAttente(7))[0].series, finie.series, 'les séries');
});

process.stdout.write(JSON.stringify(resultats));
