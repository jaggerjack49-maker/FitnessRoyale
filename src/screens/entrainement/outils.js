// Petits outils de l'onglet Entraînement (dates, calendrier, historique).
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.

import { abreviationsJours, jourDeLaDate, joursSemaine } from '../../data/programmesStandards';
import { colors } from '../../theme';
import { enISO } from '../../logic/rattrapage';

// BUG CORRIGÉ (03/09/2026) : cette fonction renvoyait la date UTC
// (`toISOString`), alors que les cases du calendrier utilisent la date LOCALE
// (`enISO`) — l'avertissement était pourtant écrit juste au-dessus, mais
// n'avait été appliqué qu'à `enISO`. Les deux ne tombent pas le même jour
// aux heures où le fuseau et l'UTC divergent (avant 2 h du matin en France) :
// une séance terminée à ce moment-là était datée de la VEILLE, et le ✅
// apparaissait donc sur une case où l'on n'avait encore rien fait.
// Les deux passent maintenant par le même calcul.
export function aujourdhui() {
  return enISO(new Date());
}

// « lundi 7 septembre » — pour nommer un jour manqué sans faire lire une
// date ISO à l'utilisateur.
// « 2026-10-06 » → « 06/10/26 » : la colonne de date des records est étroite.
export function dateCourteRecord(dateISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || ''));
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : '';
}

export function libelleDate(dateISO) {
  const date = new Date(`${dateISO}T12:00:00`);
  return `${jourDeLaDate(date)} ${date.getDate()} ${nomsMois[date.getMonth()]}`;
}

// La zone TOUCHÉE déborde du dessin : un cercle de 40 px se vise mal au pouce,
// surtout quand il efface un programme entier. On vise les 44 px recommandés
// (44 pt iOS / 48 dp Android) sans grossir le visuel.
export const ZONE_TACTILE = { top: 8, bottom: 8, left: 8, right: 8 };

export const nomsMois = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// La grille d'un mois pour le calendrier : un tableau de SEMAINES (rangées de
// 7 cases, lundi en premier), avec null pour les cases hors du mois.
export function grilleDuMois(annee, mois) {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // 0 = lundi
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const cases = [];
  for (let i = 0; i < decalage; i++) cases.push(null);
  for (let j = 1; j <= nbJours; j++) cases.push(new Date(annee, mois, j));
  while (cases.length % 7 !== 0) cases.push(null);
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

// Cherche les dernières séries loggées pour un exercice, AVANT une date donnée
// (jamais la séance en cours) — calcul 100% local, marche même hors-ligne.
export function trouverDernieresSeries(entrainements, exercice, avantDate) {
  const candidats = entrainements
    .filter((e) => e.date < avantDate && e.series.some((s) => s.exercice === exercice))
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  if (candidats.length === 0) return null;
  const dernier = candidats[0];
  return { date: dernier.date, series: dernier.series.filter((s) => s.exercice === exercice) };
}

// ↑ / = / ↓ : compare la charge la plus lourde d'aujourd'hui à la fois précédente.
export function indicateurProgression(seriesAujourdhui, seriesPrecedentes) {
  if (!seriesAujourdhui?.length || !seriesPrecedentes?.length) return null;
  const maxAujourdhui = Math.max(...seriesAujourdhui.map((s) => s.poids));
  const maxPrecedent = Math.max(...seriesPrecedentes.map((s) => s.poids));
  if (maxAujourdhui > maxPrecedent) return { symbole: '↑', couleur: colors.vert };
  if (maxAujourdhui < maxPrecedent) return { symbole: '↓', couleur: colors.rouge };
  return { symbole: '=', couleur: colors.texteGris };
}

// Les jours occupés par un cycle, en abrégé (« Lun Mar Jeu ») — le résumé
// affiché quand le détail du programme est replié.
export function joursDuCycle(cycle) {
  const jours = [];
  cycle.seances.forEach((seance) => {
    (seance.jours || []).forEach((jour) => {
      if (!jours.includes(jour)) jours.push(jour);
    });
  });
  return joursSemaine
    .filter((jour) => jours.includes(jour))
    .map((jour) => abreviationsJours[jour])
    .join(' ');
}

// CE QUI A ÉTÉ FAIT CE JOUR-LÀ (15/09/2026, bug signalé par Hafiz : « même
// quand on termine une séance, il affiche les perfs attendues sur ce jour
// alors que la séance est bouclée »).
// Un jour bouclé montre le RÉALISÉ — les séries vraiment faites, regroupées
// par exercice — au lieu de l'attendu : après coup, « 🎯 Attendu : 102,5 kg »
// n'a plus rien à dire, c'est ce qu'on a soulevé qui compte.
// LE TYPE D'UNE SÉANCE FAITE : le nom du programme suivi ce jour-là, ou
// « Séance libre ». Demande de Hafiz du 06/10/2026 : « au niveau de
// l'historique on doit voir le type de la séance réalisé en plus de la date ».
//
// ⚠️ UNE SEULE DÉFINITION, utilisée par les TROIS endroits qui nomment une
// séance passée (le résumé du calendrier, la liste de l'historique, le détail
// d'une séance). Ce `find` tenait sur une ligne, ce qui est précisément
// pourquoi il aurait été recopié trois fois — et le projet paie en boucle les
// secondes définitions de la même idée (voir `cycleEnService`, 28/08/2026).
//
// ⚠️ UN PROGRAMME SUPPRIMÉ REDEVIENT « Séance libre », et c'est assumé : la
// table `entrainements` porte `programme_id ... ON DELETE SET NULL` (le lien
// est coupé, les séries sont gardées — voir « Entraînement v5 »). Le NOM n'est
// stocké nulle part, donc on ne peut pas l'inventer après coup. Mieux vaut
// « Séance libre » qu'un nom faux.
export function typeDeSeance(entrainement, programmes) {
  if (!entrainement || !entrainement.programme_id) return 'Séance libre';
  const programme = (programmes || []).find((p) => p.id === entrainement.programme_id);
  return programme ? programme.nom : 'Séance libre';
}
