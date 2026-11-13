// En-tête des sous-écrans et lignes de raccourci de l'accueil Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.

import { Icone } from '../../components/Icones';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, espacement } from '../../theme';
import { da, monospace } from '../../designSystem';

// ---------------------------------------------------------------------------
// REFONTE DU 26/10/2026 — « trop chargé, trop long » (Hafiz).
// L'onglet empilait huit sections dans une seule page. Il s'ouvre désormais
// sur un ACCUEIL court (deux actions, la séance du jour, le calendrier) et
// range le reste dans des SOUS-ÉCRANS, atteignables en un geste.
// Les trois petits composants ci-dessous sont les briques de cette mise en
// page ; ils ne portent AUCUNE règle de calcul.
// ---------------------------------------------------------------------------

// L'en-tête d'un sous-écran : une flèche ronde de retour, un titre, un
// sous-titre. Le bouton fait 44 px (cible tactile minimale iOS/Android).
export function EnteteSousEcran({ titre, sousTitre, onRetour }) {
  return (
    <View style={stylesHub.enteteSousEcran}>
      <TouchableOpacity
        style={stylesHub.boutonRetour}
        onPress={onRetour}
        accessibilityLabel="Retour"
      >
        <Icone nom="chevron-gauche" taille={20} couleur={colors.texte} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={stylesHub.titreSousEcran}>{titre}</Text>
        {sousTitre ? <Text style={stylesHub.sousTitreSousEcran}>{sousTitre}</Text> : null}
      </View>
    </View>
  );
}

// Une ligne de navigation vers un sous-écran : libellé, résumé chiffré, chevron.
// Le résumé est ce qui évite d'avoir à ouvrir pour savoir où on en est — même
// principe que les puces de volume et le résumé des perfs.
export function LigneRaccourci({ icone, titre, resume, alerte, onPress }) {
  return (
    <TouchableOpacity style={stylesHub.ligneRaccourci} onPress={onPress}>
      <View style={stylesHub.iconeRaccourci}>
        <Icone nom={icone} taille={20} couleur={colors.or} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={stylesHub.titreRaccourci}>{titre}</Text>
        <Text style={[stylesHub.resumeRaccourci, alerte && { color: colors.rouge }]}>
          {resume}
        </Text>
      </View>
      <Icone nom="chevron-droit" taille={18} couleur={colors.texteGris} />
    </TouchableOpacity>
  );
}

export const stylesHub = StyleSheet.create({
  enteteSousEcran: {
    flexDirection: 'row', alignItems: 'center', gap: espacement.s,
    marginBottom: espacement.m,
  },
  boutonRetour: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
  },
  // Le chevron « ‹ » est petit dans la plupart des polices : on le grossit et
  // on le remonte d'un cheveu pour qu'il tombe au centre optique du rond.
  flecheRetour: { color: colors.texte, fontSize: 26, fontWeight: '800', lineHeight: 28, marginTop: -3 },
  titreSousEcran: { color: colors.texte, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  sousTitreSousEcran: { color: colors.texteGris, fontSize: 12, marginTop: 2 },

  // La fiche d'un exercice de la bibliothèque (sous-écran « Bibliothèque »).
  ficheExo: {
    backgroundColor: da.carte, borderRadius: 14, padding: espacement.m,
    borderWidth: 1, borderColor: da.bordureOr, marginBottom: espacement.s,
  },
  ficheEntete: { flexDirection: 'row', alignItems: 'center', gap: espacement.s + 2 },
  ficheIcone: {
    width: 46, height: 46, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', backgroundColor: da.orVoile,
  },
  ficheNom: { color: colors.texte, fontSize: 16, fontWeight: '800' },
  ficheDetail: { color: colors.texteGris, fontSize: 12, marginTop: 2 },
  // ⚠️ La chasse fixe n'est PAS dans le style de base : « fontFamily:
  // undefined » dans un style superposé ne l'annule pas (vu à l'écran, la
  // phrase « jamais noté » restait en monospace). On l'AJOUTE quand il y a
  // des chiffres à aligner, au lieu d'essayer de la retirer.
  ficheRecord: { color: colors.texteGris, fontSize: 13, marginTop: espacement.m },
  ficheChiffres: { color: colors.or, fontWeight: '700', fontFamily: monospace },
  ficheAide: { color: colors.texteGris, fontSize: 11, lineHeight: 16, marginTop: espacement.s },

  // Les deux grandes entrées de l'accueil, côte à côte.
  ligneActionsPrincipales: { flexDirection: 'row', gap: espacement.s },
  grandeAction: {
    flex: 1, borderRadius: 16, padding: espacement.m,
    minHeight: 96, justifyContent: 'center',
  },
  grandeActionOr: { backgroundColor: colors.or },
  grandeActionBordee: {
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
  },
  pastilleAction: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  pastilleActionOr: { backgroundColor: 'rgba(0,0,0,0.18)' },
  pastilleActionBordee: { backgroundColor: colors.carteClaire },
  titreActionOr: { color: '#141319', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  sousTitreActionOr: { color: 'rgba(20,19,25,0.72)', fontSize: 11, marginTop: 2, lineHeight: 15 },
  titreAction: { color: colors.texte, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  sousTitreAction: { color: colors.texteGris, fontSize: 11, marginTop: 2, lineHeight: 15 },

  // Le bandeau de section : un petit titre en capitales espacées, comme les
  // libellés de l'onglet Perfs (maquette du 09/09/2026).
  bandeauSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: espacement.l, marginBottom: espacement.s,
  },
  libelleSection: {
    color: colors.texteGris, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
  },
  // La légende du calendrier : sa propre ligne, qui passe à la ligne si
  // l'écran est étroit (elle débordait collée au titre).
  legendeCalendrier: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 6,
    marginBottom: espacement.s,
  },
  entreeLegende: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  echantillonCase: {
    width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
  },
  echantillonPrevu: {},
  texteLegende: { color: colors.texteDoux, fontSize: 12, fontWeight: '600' },
  espaceRaccourcis: { height: espacement.l },
  lienSection: { color: colors.or, fontSize: 12, fontWeight: '800' },

  // La carte « la séance du jour » (modèle : la carte de séance des maquettes).
  carteJour: {
    backgroundColor: colors.carte, borderRadius: 16, padding: espacement.m,
    borderWidth: 1, borderColor: colors.bordure, marginBottom: espacement.s,
    borderLeftWidth: 3, borderLeftColor: colors.or,
  },
  carteJourFaite: { borderLeftColor: colors.vert },
  nomSeanceJour: { color: colors.texte, fontSize: 17, fontWeight: '800' },
  metaSeanceJour: { color: colors.texteGris, fontSize: 12, marginTop: 3 },
  exercicesSeanceJour: { color: colors.texteDoux, fontSize: 13, marginTop: 8, lineHeight: 19 },
  boutonDemarrerJour: {
    backgroundColor: colors.or, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', marginTop: espacement.m,
  },
  texteDemarrerJour: { color: '#141319', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },

  // Jour sans séance : on le dit en une ligne, sans occuper un écran.
  carteJourVide: {
    backgroundColor: colors.carte, borderRadius: 16, padding: espacement.m,
    borderWidth: 1, borderColor: colors.bordure, marginBottom: espacement.s,
    alignItems: 'center',
  },
  texteJourVide: { color: colors.texteGris, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Les liens sous une journée bouclée. Un `paddingVertical` (et non une
  // simple marge) : c'est lui qui agrandit la zone qu'on touche.
  ligneLiensJour: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.m, marginTop: 4 },
  lienJour: { paddingVertical: 11 },
  texteLienJour: { color: colors.or, fontSize: 13, fontWeight: '700' },

  // Les raccourcis vers les sous-écrans.
  ligneRaccourci: {
    flexDirection: 'row', alignItems: 'center', gap: espacement.s,
    backgroundColor: colors.carte, borderRadius: 14, padding: espacement.m,
    borderWidth: 1, borderColor: colors.bordure, marginBottom: espacement.s,
    minHeight: 64,
  },
  // L'action principale du sous-écran « Mes programmes » : pleine largeur,
  // en or, en haut — c'est ce qu'on vient y faire quand on n'a encore rien.
  boutonCreer: {
    backgroundColor: colors.or, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginBottom: espacement.m,
  },
  texteBoutonCreer: { color: '#141319', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },

  iconeRaccourci: { width: 24, alignItems: 'center' },
  titreRaccourci: { color: colors.texte, fontSize: 15, fontWeight: '700' },
  resumeRaccourci: { color: colors.texteGris, fontSize: 12, marginTop: 2 },
  chevronRaccourci: { color: colors.texteGris, fontSize: 22, fontWeight: '700' },
});
