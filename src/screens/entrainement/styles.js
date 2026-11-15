// Les styles de l'onglet Entraînement, partagés par toutes ses vues.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.

import { StyleSheet } from 'react-native';
import { colors, espacement } from '../../theme';
import { da, monospace } from '../../designSystem';

export const styles = StyleSheet.create({
  // Bandeau « cette séance sera enregistrée au … » (21/09/2026).
  // Le bandeau du bloc : discret mais en or, comme les repères de progression.
  bandeauBloc: {
    borderWidth: 1, borderColor: colors.or, borderRadius: 10,
    backgroundColor: 'rgba(232, 178, 58, 0.10)',
    paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: espacement.s,
  },
  texteBandeauBloc: { color: colors.or, fontSize: 12, fontWeight: '700', lineHeight: 18 },

  // Le type de séance dans l'historique : en or, comme les repères de
  // progression — c'est une information, pas une action.
  typeHistorique: { color: colors.or, fontWeight: '800' },

  bandeauJourSeance: {
    backgroundColor: '#1d1a12',
    borderLeftWidth: 3,
    borderLeftColor: colors.or,
    borderRadius: 8,
    padding: espacement.s,
    marginBottom: espacement.s,
  },
  texteJourSeance: { color: colors.texte, fontSize: 13, lineHeight: 18 },
  lienJourSeance: {
    color: colors.or, fontSize: 13, fontWeight: '700', marginTop: 6,
  },
  conteneur: { flex: 1, backgroundColor: colors.fond },
  centre: { alignItems: 'center', justifyContent: 'center' },
  titre: { color: colors.texte, fontSize: 24, fontWeight: '800' },
  sousTitre: { color: colors.texteGris, fontSize: 13, marginTop: 4, marginBottom: espacement.m },
  bandeauChargement: {
    backgroundColor: colors.carteClaire, padding: espacement.s, borderRadius: 10,
    marginBottom: espacement.m,
  },
  bandeauEchec: { borderWidth: 1, borderColor: colors.rouge },
  texteBandeau: { color: colors.texte, fontSize: 13, lineHeight: 18 },
  lienReessayer: { color: colors.or, fontWeight: '800', marginTop: 6 },
  // Les actions du bandeau de la file d'attente (08/11/2026) : 40 px de haut.
  ligneBoutonsFile: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  boutonFile: {
    minHeight: 40, justifyContent: 'center', paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: colors.bordure,
  },
  texteBoutonFile: { color: colors.or, fontWeight: '800', fontSize: 13 },
  texteBoutonFileDiscret: { color: colors.texteGris, fontWeight: '700', fontSize: 12 },
  // Bandeau « de quel compte parle cet écran » (23/09/2026).
  bandeauCompte: {
    backgroundColor: '#12161d',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderRadius: 8,
    padding: espacement.s,
    marginBottom: espacement.s,
  },
  detailBandeau: { color: colors.texteGris, fontSize: 12, marginTop: 4, lineHeight: 17 },
  totalSeries: {
    color: colors.or, fontSize: 13, fontWeight: '800',
    marginTop: -4, marginBottom: espacement.s,
  },
  // Un en-tête qui se déplie : le titre à gauche, le chevron tout à droite.
  enTeteRepliable: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enTeteRepliableSection: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: espacement.l - 10, paddingVertical: 10, minHeight: 44,
  },
  titreSansMarge: { marginTop: 0, marginBottom: 0 },
  sectionTitre: {
    color: colors.texte, fontSize: 18, fontWeight: '700',
    marginTop: espacement.l, marginBottom: espacement.s,
  },
  indice: { color: colors.texteGris, fontSize: 12, marginTop: 2 },
  libelle: { color: colors.texte, fontWeight: '600', marginBottom: 6 },
  champ: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: 12,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure,
  },
  champCourt: { width: 70 },
  // 40 px (au lieu de 32) + `hitSlop` sur les deux croix les plus
  // dangereuses : c'est un geste DESTRUCTEUR posé juste à côté d'un bouton
  // inoffensif, il ne doit pas s'attraper par erreur.
  boutonRetirer: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.rouge,
  },
  boutonRetirerTexte: { color: colors.rouge, fontWeight: '800' },
  // L'OR, PLUS LE CYAN, POUR TOUTES LES ACTIONS (08/11/2026). Quand les cinq
  // autres onglets sont passés à l'or, l'Entraînement — leur modèle — était
  // resté le seul à avoir des boutons cyan. Action principale = or plein,
  // action secondaire = bordure or. Le cyan reste là où il est une DONNÉE
  // (barres de volume, protéines) ou un REPÈRE (jour choisi au calendrier).
  boutonSecondaire: {
    backgroundColor: da.orVoile, borderRadius: 12, padding: 12, alignItems: 'center',
    marginTop: espacement.s, marginBottom: espacement.m, borderWidth: 1, borderColor: da.bordureOrDouce,
  },
  boutonSecondaireTexte: { color: colors.or, fontWeight: '800' },
  // « Ligne vide » et « Bibliothèque » côte à côte (passe 3). La bibliothèque
  // est en OR : c'est le chemin à voir en premier, puisqu'il garantit un nom
  // d'exercice exact — et le NOM est l'identifiant (voir CLAUDE.md 04/09/2026).
  deuxBoutons: { flexDirection: 'row', gap: espacement.s },
  boutonMoitie: { flex: 1, minHeight: 44, justifyContent: 'center', padding: 10 },
  boutonBiblio: { borderColor: da.bordureOrDouce },
  boutonBiblioTexte: { color: colors.or, fontWeight: '700' },
  boutonBiblioSeance: {
    backgroundColor: da.orVoile, borderRadius: 12, minHeight: 44,
    alignItems: 'center', justifyContent: 'center',
    marginTop: espacement.s, borderWidth: 1, borderColor: da.bordureOrDouce,
  },
  boutonPrincipal: {
    backgroundColor: colors.or, borderRadius: 12, padding: 14, alignItems: 'center',
    marginTop: espacement.m, minHeight: 50, justifyContent: 'center',
  },
  boutonPrincipalTexte: { color: da.orSombre, fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  lienAnnuler: { color: colors.texteGris, textAlign: 'center', marginTop: espacement.m, fontSize: 13 },
  messageErreur: { color: colors.rouge, fontSize: 13, marginTop: espacement.s },
  carteProgramme: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.carte, borderRadius: 12,
    padding: espacement.m, marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure, gap: 8,
  },
  nomProgrammeTexte: { color: colors.texte, fontWeight: '700', fontSize: 15 },
  boutonDemarrer: { backgroundColor: colors.or, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  boutonDemarrerTexte: { color: da.orSombre, fontWeight: '900', fontSize: 12 },
  carteHistorique: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m,
    marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  dateHistorique: { color: colors.or, fontWeight: '700' },
  carteExercice: {
    backgroundColor: colors.carte, borderRadius: 14, padding: espacement.m,
    marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  nomExercice: { color: colors.texte, fontWeight: '700', fontSize: 15 },
  indiceDerniere: { color: colors.texteGris, fontSize: 12, marginTop: 4, marginBottom: espacement.s },
  serieFaite: { color: colors.vert, fontSize: 13 },
  // Le crayon « touche pour modifier » est une icone : il lui faut une
  // rangee, un SVG ne vit pas dans un <Text>.
  ligneSerieFaite: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  // `flex-end` : les champs portent un libellé au-dessus, le bouton doit
  // s'aligner sur le BAS des champs, pas sur le milieu de la colonne.
  ligneAjoutSerie: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: espacement.s },
  colonneChampSerie: { flex: 1 },
  // Le RIR (11/11/2026) : un ou deux chiffres, une colonne plus étroite.
  colonneChampRir: { width: 58 },
  champRir: { width: 52 },
  aideRir: { color: colors.texteGris, fontSize: 11, marginTop: 6, lineHeight: 15 },
  erreurSaisie: { color: colors.rouge, fontSize: 13, marginTop: 8, lineHeight: 18 },
  // Le nom de l'exercice et sa croix de retrait sur la même ligne : le nom
  // garde toute la place qu'il lui faut (il passe à la ligne, jamais écrasé).
  enteteExerciceSeance: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  boutonRetirerExercice: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
  },
  libelleChampSerie: {
    color: colors.texteGris, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, marginBottom: 4,
  },
  champSaisieSerie: { textAlign: 'center', fontSize: 16, fontWeight: '700' },
  boutonSerieAligne: { paddingVertical: 15 },
  boutonAjouterSerie: {
    backgroundColor: colors.or, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14,
  },
  boutonAjouterSerieTexte: { color: da.orSombre, fontWeight: '900', fontSize: 12 },
  lignePuces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lignePucesJoursSeance: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: espacement.s,
  },
  puceJourPetite: {
    paddingVertical: 5, paddingHorizontal: 7, borderRadius: 8,
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
  },
  libelleJoursSeance: {
    color: colors.texteGris, fontSize: 11, marginBottom: 4,
  },
  puceJour: {
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
  },
  puceJourActive: { borderColor: colors.or, backgroundColor: colors.carte },
  puceJourTexte: { color: colors.texteGris, fontWeight: '600', fontSize: 12 },
  puceJourTexteActif: { color: colors.or },
  ligneCalendrier: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.carte, borderRadius: 10, padding: espacement.s,
    marginBottom: 4, borderWidth: 1, borderColor: colors.bordure,
  },
  ligneCalendrierAujourdhui: { borderColor: colors.or },
  jourCalendrier: { color: colors.texte, fontWeight: '700', fontSize: 12, width: 82 },
  contenuCalendrier: { color: colors.texteGris, fontSize: 12, flex: 1 },
  cocheCalendrier: { fontSize: 14 },
  ligneSeanceCycle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: espacement.s,
    paddingTop: espacement.s, borderTopWidth: 1, borderTopColor: colors.bordure,
  },
  jourSeanceCycle: { color: colors.or, fontWeight: '700', fontSize: 11, width: 62 },
  boutonModifier: {
    borderWidth: 1, borderColor: da.bordureOrDouce, borderRadius: 8, backgroundColor: da.orVoile,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  boutonModifierTexte: { color: colors.or, fontWeight: '800', fontSize: 12 },
  // Le choix des groupes d'un exercice (15/11/2026) : principal + groupes en plus.
  panneauGroupes: { paddingVertical: espacement.s },
  puceGroupeEnPlus: { borderColor: colors.or, backgroundColor: da.orVoile },
  puceGroupeEnPlusTexte: { color: colors.or, fontWeight: '800' },
  // « Mise à jour… » pendant qu'on affiche la mémoire de la visite précédente.
  miseAJourDiscrete: { color: colors.texteGris, fontSize: 12, marginBottom: espacement.s, alignSelf: 'flex-end' },
  // « Une séance est déjà en cours » (15/11/2026) : la question posée sous le
  // bandeau quand on veut en démarrer une autre.
  carteConflitSeance: {
    marginHorizontal: espacement.m, marginTop: espacement.s, padding: espacement.m,
    backgroundColor: colors.carte, borderRadius: 14, borderWidth: 1, borderColor: da.bordureOrDouce,
    gap: espacement.s,
  },
  texteConflitSeance: { color: colors.texte, fontSize: 14, lineHeight: 20 },
  boutonRemplacerSeance: {
    borderWidth: 1, borderColor: colors.rouge, borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center',
  },
  boutonRemplacerSeanceTexte: { color: colors.rouge, fontWeight: '800', fontSize: 12 },
  // En-tête de la séance : le titre et « Réduire » sur la même ligne (15/11/2026).
  enteteSeance: { flexDirection: 'row', alignItems: 'flex-start', gap: espacement.s },
  boutonReduire: {
    flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: da.bordureOrDouce, backgroundColor: da.orVoile,
  },
  // Le journal d'un exercice déplié pendant la séance.
  lienJournalExo: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  lienJournalExoTexte: { color: colors.or, fontWeight: '700', fontSize: 12 },
  journalExo: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: 10,
    marginBottom: espacement.s, gap: 6,
  },
  ligneJournalExo: { flexDirection: 'row', gap: 8 },
  dateJournalExo: { color: colors.texteGris, fontSize: 12, width: 70, fontWeight: '700' },
  seriesJournalExo: { color: colors.texte, fontSize: 12, flex: 1, lineHeight: 17 },
  // « Annuler » du renommage d'un programme : neutre, à côté de « Enregistrer » en or.
  boutonAnnulerRenommage: {
    borderWidth: 1, borderColor: colors.bordure, borderRadius: 8,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  boutonAnnulerRenommageTexte: { color: colors.texteGris, fontWeight: '700', fontSize: 12 },
  zoneDeroule: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  boutonSortir: {
    borderWidth: 1, borderColor: colors.texteGris, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', marginTop: espacement.s,
  },
  boutonSortirTexte: { color: colors.texteGris, fontWeight: '700', fontSize: 12 },
  ligneVolume: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: espacement.s },
  ligneObjectif: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginTop: 6,
  },
  nomGroupe: { color: colors.texte, fontSize: 12, fontWeight: '600', width: 110 },
  barreVolumeFond: {
    flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.carteClaire, overflow: 'hidden',
  },
  barreVolumeRemplie: { height: 8, borderRadius: 4 },
  compteurVolume: { color: colors.texteGris, fontSize: 12, fontWeight: '700', width: 50, textAlign: 'right' },
  resumeVolume: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: espacement.s },
  pucheVolume: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
  },
  pucheGroupe: { color: colors.texteGris, fontSize: 11, fontWeight: '600' },
  pucheCompte: { color: colors.texte, fontSize: 11, fontWeight: '800' },
  suggestion: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  // « ➕ Ajouter une séance » sur la carte d'un programme (24/09/2026).
  boutonAjouterSeance: {
    borderWidth: 1, borderColor: colors.or, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', marginTop: espacement.s,
  },
  boutonAjouterSeanceTexte: { color: colors.or, fontWeight: '800', fontSize: 13 },
  blocNouvelleSeance: {
    borderWidth: 1, borderColor: colors.bordure, borderRadius: 8,
    padding: espacement.s, marginTop: espacement.s,
  },
  titreNouvelleSeance: { color: colors.texte, fontWeight: '800', marginBottom: 2 },
  messageAjoutSeance: { color: colors.rouge, fontSize: 12, marginBottom: 6 },
  aideNouvelleSeance: { color: colors.texteGris, fontSize: 12, marginBottom: 6 },

  // Repos / RIR rappelés sous un exercice (08/11/2026).
  reglagesExo: { color: colors.texteGris, fontWeight: '400' },
  reglagesSeance: { color: colors.texteDoux, fontSize: 12, marginBottom: 4 },
  numeroExercice: { color: colors.or },
  aideLignesJour: { color: colors.texteGris, fontSize: 11, lineHeight: 16, marginTop: espacement.s, marginBottom: 6 },
  raisonSuggestion: { color: colors.texteGris, fontSize: 11, fontWeight: '400' },
  record: { color: colors.texteGris, fontSize: 11, marginBottom: 3 },
  recordBattu: { color: colors.or, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  ligneRecord: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  nomRecord: { color: colors.texte, fontSize: 12, flex: 1 },
  valeurRecord: { color: colors.or, fontSize: 12, fontWeight: '700' },
  dateRecord: { color: colors.texteGris, fontSize: 10, width: 78, textAlign: 'right' },
  flecheCalendrier: { color: colors.texteGris, fontSize: 10 },
  ligneChoixProgramme: { paddingVertical: 8 },
  choixProgrammeTexte: { color: colors.texte, fontSize: 14 },
  // Le calendrier reste borné à 380 px (sinon ses cases, à 1/7 de la largeur,
  // deviennent énormes), mais il est CENTRÉ depuis le 26/10/2026 : dans la
  // colonne de lecture de 560 px, collé à gauche, il paraissait de travers.
  blocCalendrier: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  enTeteMois: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: espacement.s,
  },
  // 44 px pile : le minimum tactile iOS/Android. Mesuré à 42 px le
  // 26/10/2026, c'étaient les deux seules cibles encore sous la barre.
  boutonMois: {
    minHeight: 44, justifyContent: 'center',
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
  },
  flecheMois: { color: colors.or, fontWeight: '700' },
  titreMois: { color: colors.texte, fontWeight: '700', fontSize: 15, textTransform: 'capitalize' },
  ligneSemaine: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  enTeteCaseJour: {
    flex: 1, textAlign: 'center', color: colors.texteGris, fontSize: 10, fontWeight: '700',
  },
  caseJour: {
    flex: 1, aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
  },
  caseJourVide: { flex: 1, aspectRatio: 1 },
  caseAujourdhui: { borderColor: colors.or },
  caseSelectionnee: { backgroundColor: colors.carteClaire, borderColor: colors.accent },
  numeroJour: { color: colors.texte, fontSize: 12, fontWeight: '600' },
  // La place du marqueur est réservée (minHeight) même quand il n'y a rien :
  // sans ça, les cases d'une même semaine ne feraient pas la même hauteur.
  marqueurJour: {
    minHeight: 15, alignItems: 'center', justifyContent: 'center',
  },
  // Les trois états du calendrier (08/11/2026) — partagés par les cases ET la
  // légende, pour que la légende montre exactement ce qu'on voit dans la grille.
  // Le « prévu » est un vrai disque de 7 px (le « • » d'avant était un
  // caractère, minuscule selon la police du téléphone).
  pointPrevu: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  caseFaite: { backgroundColor: 'rgba(61, 220, 132, 0.14)', borderColor: 'rgba(61, 220, 132, 0.45)' },
  caseManquee: { borderColor: 'rgba(255, 84, 112, 0.6)' },
  texteManque: { color: colors.rouge, fontSize: 12, lineHeight: 15, fontWeight: '900' },
  detailJour: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: espacement.s,
    marginBottom: 4, marginLeft: espacement.m, borderWidth: 1, borderColor: colors.bordure,
  },
  exerciceDetailJour: { color: colors.texteGris, fontSize: 12, marginTop: 3 },
  attenduDetailJour: { color: colors.or, fontSize: 11, marginTop: 1 },
  indiceModifier: { color: colors.texteGris, fontSize: 10 },
  carteRattrapage: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m,
    borderWidth: 1, borderColor: colors.rouge, marginBottom: espacement.m,
  },
  enteteRattrapage: { flexDirection: 'row', alignItems: 'center', gap: espacement.s, marginBottom: 4 },
  titreRattrapage: { flex: 1, color: colors.rouge, fontWeight: '800' },
  // Un geste qui ne détruit rien : bordé, discret, gris — pas rouge.
  boutonMasquerRattrapage: {
    minHeight: 40, justifyContent: 'center', paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: colors.bordure,
  },
  texteMasquerRattrapage: { color: colors.texteGris, fontWeight: '700', fontSize: 12 },
  bandeauRattrapage: {
    color: colors.or, fontSize: 12, lineHeight: 17, marginBottom: espacement.s,
  },
  carteRenommage: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m,
    borderWidth: 1, borderColor: colors.or, marginBottom: espacement.m,
  },
  titreRenommage: { color: colors.or, fontWeight: '800', marginBottom: 4 },
  ligneRenommage: { color: colors.texte, fontSize: 13, marginBottom: 2 },
  ligneEditionSerie: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
  },
  numeroSerieEdition: {
    color: colors.texteGris, fontSize: 12, fontWeight: '700', width: 24,
  },
  // Les actions d'un programme, sous son nom : elles passent à la ligne
  // plutôt que d'écraser le titre ou de déborder de la carte.
  ligneActionsProgramme: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    gap: 10, marginTop: espacement.s,
  },
  detailGroupe: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordure,
    padding: espacement.s,
    marginBottom: espacement.s,
  },
  ligneDetailGroupe: { marginBottom: 6 },
  dateDetailGroupe: { color: colors.texte, fontSize: 12, fontWeight: '700' },
  seriesDetailGroupe: { color: colors.texteGris, fontSize: 12, marginTop: 1 },
  detailGroupeVide: {
    color: colors.texteGris, fontSize: 12, fontStyle: 'italic',
    marginBottom: espacement.s, marginLeft: espacement.s,
  },
  groupeExercice: { color: colors.texteGris, fontSize: 11, marginLeft: espacement.s },
  alerteNonClasses: {
    color: colors.rouge, fontSize: 12, lineHeight: 17, marginBottom: espacement.s,
  },
  carteOfficielle: { borderColor: colors.or },
  codePartage: {
    color: colors.or, fontSize: 26, fontWeight: '800', letterSpacing: 4,
    textAlign: 'center', marginVertical: espacement.s,
  },
  boutonPublier: {
    borderWidth: 1, borderColor: colors.rouge, borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 8, marginRight: 6,
  },
  boutonPublierTexte: { color: colors.rouge, fontWeight: '700', fontSize: 11 },
  // L'écran « Progrès » (08/11/2026).
  grilleTuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.s, marginBottom: espacement.s },
  tuileStat: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: colors.carte, borderRadius: 12,
    borderWidth: 1, borderColor: colors.bordure, padding: espacement.m,
  },
  titreTuile: { color: colors.texteGris, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  valeurTuile: { color: colors.or, fontFamily: monospace, fontWeight: '900', fontSize: 26, marginTop: 4 },
  legendeTuile: { color: colors.texteGris, fontSize: 11, marginTop: 2 },
  libelleProgres: { marginTop: espacement.m, marginBottom: espacement.s },
  puceProgres: {
    maxWidth: '100%', minHeight: 38, justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
  },
  puceMesure: {
    minHeight: 38, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 999, borderWidth: 1, borderColor: colors.bordure,
  },
  puceProgresActive: { borderColor: colors.or, backgroundColor: da.orVoile },
  evolution: { fontWeight: '800', fontSize: 14, marginTop: espacement.s },
  noteProgres: { color: colors.texteGris, fontSize: 11, lineHeight: 16, marginTop: 6 },
  carteModele: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m,
    marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  boutonUtiliserModele: {
    backgroundColor: colors.or, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: espacement.s,
  },
});
