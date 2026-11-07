// =============================================================================
// LE SYSTÈME D'ICÔNES DE FITNESS ROYALE — dessiné à la main (27/10/2026)
// =============================================================================
//
// Demande de Hafiz : « change les icônes et crée toi-même tes propres icônes ».
// Avant ce fichier, l'app mélangeait DEUX choses :
//   - six icônes d'onglets RECOPIÉES de Lucide (user-round, trending-up…) ;
//   - des EMOJIS partout ailleurs (💪 📋 🎯 🏆 🔔 …).
// Un emoji est un caractère, pas un dessin : il ne prend JAMAIS la couleur
// qu'on lui demande (le ⚠️ reste orange dans un message rouge), il ne s'aligne
// pas sur la même grille que le texte, et il change de dessin selon le
// téléphone — donc l'app n'a pas le même visage chez deux personnes.
// Tout est maintenant dessiné ici, avec `react-native-svg` (déjà installé pour
// l'arène : AUCUNE dépendance ajoutée, et surtout pas une police d'icônes).
//
// -----------------------------------------------------------------------------
// LES SIX RÈGLES DU SYSTÈME — à respecter pour toute icône ajoutée plus tard
// -----------------------------------------------------------------------------
// 1. UNE SEULE GRILLE : `viewBox="0 0 24 24"`. On dessine dans la zone utile
//    2.5 → 21.5 : le trait a une épaisseur, et un tracé qui touche le bord 0
//    se fait couper de moitié.
// 2. UN SEUL TRAIT : `EPAISSEUR_TRAIT`, posé UNE fois sur le <Svg> du `Cadre`
//    et hérité par tous les tracés. Aucune icône ne règle son trait toute
//    seule — c'est ce qui fait qu'elles ont le même poids côte à côte.
// 3. TERMINAISONS ET ANGLES ARRONDIS (`strokeLinecap`/`strokeLinejoin`), posés
//    au même endroit. C'est la « signature » du jeu : des formes franches aux
//    angles adoucis, comme les cartes arrondies de la DA.
// 4. LA COULEUR ARRIVE TOUJOURS EN PROP, jamais écrite dans le fichier. Une
//    icône ne sait pas si elle est active, grise, en or ou en rouge : c'est
//    l'écran qui décide, avec les clés de `designSystem.js`.
// 5. DES CONTOURS, PAS DES APLATS — sauf deux EXCEPTIONS assumées : l'étoile
//    et le triangle de lecture (play). Elles ne DÉCRIVENT pas un objet, elles
//    MARQUENT (« ceci est un modèle », « appuie ici pour démarrer») ; en
//    contour, leurs pointes se brouillent sous 16 px.
// 6. ON JUGE À 20 px, JAMAIS SUR LE viewBox. Leçon payée le 08/09/2026 : des
//    épées croisées parfaitement dessinées en grand n'étaient qu'un gribouillis
//    dans la barre d'onglets. Donc : peu de tracés, des vides larges, et on
//    REGARDE l'icône dans l'app avant de la garder.
//
// -----------------------------------------------------------------------------
// COMMENT S'EN SERVIR
// -----------------------------------------------------------------------------
//   <Icone nom="cible" taille={16} couleur={colors.or} />
//   <TexteIcone nom="alerte" style={styles.messageErreur}>Oups…</TexteIcone>
//   <TexteIcone nom="valide" centre style={styles.boutonTexte}>Terminer</TexteIcone>
// `NOMS_ICONES` liste tout ce qui existe ; un nom inconnu ne dessine RIEN
// (jamais un carré rouge : une icône absente ne doit pas casser un écran).
//
// ⚠️ UNE ICÔNE NE PEUT PAS VIVRE DANS UN <Text> (react-native ne sait pas
// mettre un SVG dans une ligne de texte) : il faut une RANGÉE. C'est ce que
// font `TexteIcone` / `LibelleIcone` pour ne pas réécrire la mise en page à
// chaque endroit.
//
// -----------------------------------------------------------------------------
// ⚠️ POUR LA PASSE 3 (bibliothèque d'exercices)
// -----------------------------------------------------------------------------
// Elle devra dessiner une VINGTAINE de pictogrammes d'exercices et de matériel
// (barre, haltère court, poulie, banc, élastique, poids du corps, machine…).
// Ils se rangent DANS CE FICHIER, dans la section « MATÉRIEL ET EXERCICES »
// prévue en bas, avec les six règles ci-dessus et rien d'autre. Un pictogramme
// d'exercice est vu à 28-40 px (plus grand qu'un onglet) : on peut y mettre un
// tracé de plus, jamais un trait différent.
//
// -----------------------------------------------------------------------------
// CE QUI RESTE EN CARACTÈRES, VOLONTAIREMENT
// -----------------------------------------------------------------------------
// `✕` (retirer une ligne), `•` et `○` (puces), `→` (une fourchette « 8 → 12 »),
// `↑ = ↓` (l'évolution d'une charge) et `!` (jour manqué du calendrier) ne sont
// PAS des emojis : ce sont des signes typographiques monochromes, qui prennent
// bien la couleur du texte et appartiennent à la PHRASE. Les dessiner les
// sortirait du texte pour rien.
// Restent aussi les emojis de CÉLÉBRATION et de CONTENU, là où l'icône
// appauvrirait le sens — voir la note datée dans CLAUDE.md.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// Règle n°2 et n°3 : le trait et les terminaisons, à UN seul endroit.
export const EPAISSEUR_TRAIT = 2;

// L'enveloppe commune. Tous les tracés héritent d'elle leur couleur, leur
// épaisseur et leurs terminaisons : une icône n'est qu'une liste de formes.
function Cadre({ taille = 20, couleur = '#ffffff', children }) {
  return (
    <Svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={EPAISSEUR_TRAIT}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

// =============================================================================
// 1. LES SIX ONGLETS
// =============================================================================
// Les métaphores sont celles arrêtées avec Hafiz le 08/09/2026 (couronne pour
// les Paliers, trophée pour la Compétition) : seul le DESSIN change ici.
// Le fil conducteur : chaque onglet doit se reconnaître À SA SILHOUETTE, sans
// son libellé. Les deux pièges de cette barre :
//   - Profil et Clan parlent tous les deux d'une personne → le Profil a des
//     ÉPAULES DROITES (un buste de statue, posé), le Clan des épaules RONDES
//     et deux têtes. On ne les confond plus d'un coup d'œil.
//   - Perfs et Compétition parlent tous les deux de résultat → les Perfs sont
//     MES chiffres (trois barres qui montent), la Compétition est LE podium
//     (une coupe).

// Profil — un buste sur son socle. Épaules droites : c'est MOI, à l'arrêt.
export function IconeProfil(props) {
  return (
    <Cadre {...props}>
      <Circle cx="12" cy="7.4" r="3.6" />
      <Path d="M4.8 20.6 L7.6 14.6 H16.4 L19.2 20.6" />
    </Cadre>
  );
}

// Perfs — trois barres qui montent sur une ligne de sol.
// Pourquoi pas la courbe qui monte (l'ancienne) : une ligne brisée de 20 px
// ressemble à n'importe quel zigzag. Trois barres d'escalier, non.
export function IconePerfs(props) {
  return (
    <Cadre {...props}>
      <Path d="M3.4 20.4 H20.6" />
      <Path d="M7.2 20.4 V13.6" />
      <Path d="M12 20.4 V9.2" />
      <Path d="M16.8 20.4 V4.8" />
    </Cadre>
  );
}

// Paliers — la couronne, en une seule silhouette fermée + son socle.
// L'ancienne (Lucide) était une courbe de Bézier très fine : à 20 px ses
// creux se refermaient. Ici des angles francs, qui tiennent la petite taille.
export function IconePaliers(props) {
  return (
    <Cadre {...props}>
      <Path d="M3.6 8 L7.8 12.4 L12 5 L16.2 12.4 L20.4 8 L19 17.6 H5 Z" />
      <Path d="M6.4 20.8 H17.6" />
    </Cadre>
  );
}

// Compétition — la coupe : vasque, deux anses, pied, socle.
export function IconeCompetition(props) {
  return (
    <Cadre {...props}>
      <Path d="M7.4 3.6 H16.6 V8.6 C16.6 11.7 14.5 13.4 12 13.4 C9.5 13.4 7.4 11.7 7.4 8.6 Z" />
      <Path d="M7.4 5.4 H5.2 A2.6 2.6 0 0 0 5.2 10.6 H6.2" />
      <Path d="M16.6 5.4 H18.8 A2.6 2.6 0 0 1 18.8 10.6 H17.8" />
      <Path d="M12 13.4 V17.4" />
      <Path d="M8.2 20.6 H15.8" />
    </Cadre>
  );
}

// Entraînement — l'haltère, symétrique : la barre et deux disques par côté.
// L'ancienne (Lucide « dumbbell ») alignait SEPT petits traits en diagonale :
// à 20 px c'était une poignée d'échardes. Cinq traits horizontaux/verticaux
// se lisent instantanément.
// ⚠️ LES DISQUES SONT HAUTS EXPRÈS (5.8 → 18.2). Une première version les
// tenait entre 7.4 et 16.6 : vue dans la vraie barre, l'icône ne remplissait
// qu'une bande au milieu de sa case et paraissait plus PETITE que ses cinq
// voisines, qui occupent toute la hauteur. C'est exactement le genre d'écart
// qu'on ne voit jamais sur le viewBox.
export function IconeEntrainement(props) {
  return (
    <Cadre {...props}>
      <Path d="M8.8 12 H15.2" />
      <Path d="M6.4 5.8 V18.2" />
      <Path d="M3.4 9.2 V14.8" />
      <Path d="M17.6 5.8 V18.2" />
      <Path d="M20.6 9.2 V14.8" />
    </Cadre>
  );
}

// Clan — deux personnes, épaules RONDES (voir la note du Profil).
export function IconeClan(props) {
  return (
    <Cadre {...props}>
      <Circle cx="9.2" cy="8.6" r="3.5" />
      <Path d="M3.1 19.8 A6.1 6.1 0 0 1 15.3 19.8" />
      <Circle cx="17.6" cy="7.2" r="2.9" />
      <Path d="M15.4 13.2 A5.3 5.3 0 0 1 20.7 18.5" />
    </Cadre>
  );
}

// =============================================================================
// 2. ACTIONS
// =============================================================================

// Démarrer / jouer. PLEIN (exception de la règle n°5) : en contour, une pointe
// de triangle à 14 px se referme sur elle-même.
export function IconeLecture(props) {
  return (
    <Cadre {...props}>
      <Path
        d="M8.4 5 L18.6 12 L8.4 19 Z"
        fill={props.couleur}
        stroke={props.couleur}
      />
    </Cadre>
  );
}

export function IconePlus(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 5.4 V18.6" />
      <Path d="M5.4 12 H18.6" />
    </Cadre>
  );
}

export function IconeCroix(props) {
  return (
    <Cadre {...props}>
      <Path d="M6.6 6.6 L17.4 17.4" />
      <Path d="M17.4 6.6 L6.6 17.4" />
    </Cadre>
  );
}

// Validé / fait / enregistrer. Le crochet est volontairement large et bas :
// un « v » trop serré devient un point à 12 px (la case ✅ du calendrier).
export function IconeValide(props) {
  return (
    <Cadre {...props}>
      <Path d="M4.4 12.6 L9.4 17.8 L19.6 6.6" />
    </Cadre>
  );
}

export function IconeCrayon(props) {
  return (
    <Cadre {...props}>
      <Path d="M4.2 19.8 L5.6 15.2 L15.9 4.9 L19.1 8.1 L8.8 18.4 Z" />
      <Path d="M13.9 6.9 L17.1 10.1" />
    </Cadre>
  );
}

export function IconeCorbeille(props) {
  return (
    <Cadre {...props}>
      <Path d="M4.6 7.6 H19.4" />
      <Path d="M9.6 7.6 V4.8 H14.4 V7.6" />
      <Path d="M6.6 7.6 L7.6 20 H16.4 L17.4 7.6" />
    </Cadre>
  );
}

// Sortir d'une séance, quitter un programme.
export function IconeSortie(props) {
  return (
    <Cadre {...props}>
      <Path d="M9.6 3.6 H5.4 A1.8 1.8 0 0 0 3.6 5.4 V18.6 A1.8 1.8 0 0 0 5.4 20.4 H9.6" />
      <Path d="M15.6 7.6 L20 12 L15.6 16.4" />
      <Path d="M20 12 H9.8" />
    </Cadre>
  );
}

// Copier / récupérer un programme partagé : la flèche qui rentre dans le bac.
export function IconeTelecharger(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 3.6 V14.8" />
      <Path d="M7.2 10.2 L12 15.2 L16.8 10.2" />
      <Path d="M4.4 19.8 H19.6" />
    </Cadre>
  );
}

// Réessayer un chargement. Même squelette que `historique`, sans les aiguilles :
// le cercle ouvert et son coin fléché, c'est la famille « temps / reprise ».
export function IconeRecharger(props) {
  return (
    <Cadre {...props}>
      <Path d="M3.6 12 A8.4 8.4 0 1 0 12 3.6 A9.1 9.1 0 0 0 5.71 6.16 L3.6 8.27" />
      <Path d="M3.6 3.6 V8.27 H8.27" />
    </Cadre>
  );
}

// =============================================================================
// 3. NAVIGATION
// =============================================================================
// Les chevrons ‹ › et les triangles ▲ ▼ étaient des CARACTÈRES : le « ‹ » du
// bouton de retour demandait même un `marginTop: -3` pour tomber au centre de
// son rond, parce qu'une police place son glyphe comme elle veut. Un SVG est
// centré par construction : le réglage à la main disparaît.

export function IconeChevronGauche(props) {
  return (
    <Cadre {...props}>
      <Path d="M15 4.8 L7.8 12 L15 19.2" />
    </Cadre>
  );
}

export function IconeChevronDroit(props) {
  return (
    <Cadre {...props}>
      <Path d="M9 4.8 L16.2 12 L9 19.2" />
    </Cadre>
  );
}

// Déplier / replier une section.
export function IconeChevronBas(props) {
  return (
    <Cadre {...props}>
      <Path d="M4.8 9 L12 16.2 L19.2 9" />
    </Cadre>
  );
}

export function IconeChevronHaut(props) {
  return (
    <Cadre {...props}>
      <Path d="M4.8 15 L12 7.8 L19.2 15" />
    </Cadre>
  );
}

// =============================================================================
// 4. OBJETS DE L'APP
// =============================================================================

// Un programme : la planchette à pince. C'est l'objet « ma feuille de séance ».
export function IconeProgramme(props) {
  return (
    <Cadre {...props}>
      <Rect x="4.2" y="4.6" width="15.6" height="16" rx="2.6" />
      <Path d="M9 3 H15 V6.6 H9 Z" />
      <Path d="M8.6 11.6 H15.4" />
      <Path d="M8.6 15.8 H15.4" />
    </Cadre>
  );
}

export function IconeCalendrier(props) {
  return (
    <Cadre {...props}>
      <Rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2.6" />
      <Path d="M3.4 10.2 H20.6" />
      <Path d="M8.2 3 V7" />
      <Path d="M15.8 3 V7" />
    </Cadre>
  );
}

// Le tableau de progression : un en-tête et des colonnes de semaines.
export function IconeTableau(props) {
  return (
    <Cadre {...props}>
      <Rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.4" />
      <Path d="M3.4 9.6 H20.6" />
      <Path d="M9.6 9.6 V19.6" />
      <Path d="M15.2 9.6 V19.6" />
    </Cadre>
  );
}

// Un objectif : la cible. Sert aussi bien à « Suivi & objectifs » qu'au
// « Attendu » d'un exercice — c'est la même idée, ce qu'on VISE.
export function IconeCible(props) {
  return (
    <Cadre {...props}>
      <Circle cx="12" cy="12" r="8.6" />
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 11.9 V12.1" />
    </Cadre>
  );
}

// Nutrition : le couvert. Une assiette vue de dessus aurait été deux cercles,
// donc la cible ci-dessus — il fallait une autre silhouette.
export function IconeCouverts(props) {
  return (
    <Cadre {...props}>
      <Path d="M7.6 3 V8.4 A2.7 2.7 0 0 0 13 8.4 V3" />
      <Path d="M10.3 3 V8.4" />
      <Path d="M10.3 11.1 V21" />
      <Path d="M17.4 21 V3 C19.6 5.4 19.6 10 17.4 12.4" />
    </Cadre>
  );
}

// Le temps qui passe : « à rattraper », « en attente d'envoi », « ça charge ».
export function IconeHorloge(props) {
  return (
    <Cadre {...props}>
      <Circle cx="12" cy="12" r="8.6" />
      <Path d="M12 7.2 V12 L15.6 14" />
    </Cadre>
  );
}

// L'historique : l'horloge dont le cercle s'ouvre sur une flèche de retour.
export function IconeHistorique(props) {
  return (
    <Cadre {...props}>
      <Path d="M3.6 12 A8.4 8.4 0 1 0 12 3.6 A9.1 9.1 0 0 0 5.71 6.16 L3.6 8.27" />
      <Path d="M3.6 3.6 V8.27 H8.27" />
      <Path d="M12 7.6 V12 L15.7 13.9" />
    </Cadre>
  );
}

export function IconeCloche(props) {
  return (
    <Cadre {...props}>
      <Path d="M6.2 16.8 C7.6 15.4 8 13.5 8 10.8 A4 4 0 0 1 16 10.8 C16 13.5 16.4 15.4 17.8 16.8 Z" />
      <Path d="M9.9 19.9 A2.2 2.2 0 0 0 14.1 19.9" />
    </Cadre>
  );
}

// Un code à partager (programme partagé, code partenaire).
export function IconeCle(props) {
  return (
    <Cadre {...props}>
      <Circle cx="8" cy="8" r="4.3" />
      <Path d="M11.1 11.1 L20.4 20.4" />
      <Path d="M14.6 14.6 L12.3 16.9" />
      <Path d="M17.2 17.2 L14.9 19.5" />
    </Cadre>
  );
}

// Un modèle tout prêt, un partage : l'étoile. PLEINE (exception de la règle
// n°5) — en contour, ses cinq creux se bouchent dès 16 px.
export function IconeEtoile(props) {
  return (
    <Cadre {...props}>
      <Path
        d="M12 3 L14.29 8.84 L20.56 9.22 L15.71 13.21 L17.29 19.28 L12 15.9 L6.71 19.28 L8.29 13.21 L3.44 9.22 L9.71 8.84 Z"
        fill={props.couleur}
        stroke={props.couleur}
      />
    </Cadre>
  );
}

// Le catalogue : des feuilles empilées (programmes standards — et, passe 3, la
// bibliothèque d'exercices).
export function IconeBibliotheque(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 2.8 L21.2 7.4 L12 12 L2.8 7.4 Z" />
      <Path d="M3 12 L12 16.6 L21 12" />
      <Path d="M3 16.6 L12 21.2 L21 16.6" />
    </Cadre>
  );
}

// « Où compte cet exercice ? » — l'étiquette qu'on accroche à un mouvement.
export function IconeEtiquette(props) {
  return (
    <Cadre {...props}>
      <Path d="M3.6 5.6 H13.6 L20.4 12 L13.6 18.4 H3.6 Z" />
      <Circle cx="7.4" cy="12" r="1.1" />
    </Cadre>
  );
}

// Ce qui demande l'attention : le triangle. Le point du bas est un segment de
// longueur quasi nulle — sa terminaison ronde EST le point.
export function IconeAlerte(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 4 L21 19.6 H3 Z" />
      <Path d="M12 9.6 V13.8" />
      <Path d="M12 16.7 V16.9" />
    </Cadre>
  );
}

export function IconeQuestion(props) {
  return (
    <Cadre {...props}>
      <Circle cx="12" cy="12" r="8.8" />
      <Path d="M9.4 9.4 A2.7 2.7 0 0 1 14.6 10.3 C14.6 12.1 11.9 13 11.9 13" />
      <Path d="M12 16.9 V17.1" />
    </Cadre>
  );
}

// « Tu es ICI » : la semaine en cours d'un bloc. La goutte + son œil.
export function IconeRepere(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 21.4 C12 21.4 19 15.6 19 10.4 A7 7 0 0 0 5 10.4 C5 15.6 12 21.4 12 21.4 Z" />
      <Circle cx="12" cy="10.2" r="2.5" />
    </Cadre>
  );
}

// Une case à cocher : deux dessins, jamais un caractère ☐/☑, dont la taille
// varie énormément d'une police système à l'autre.
export function IconeCaseVide(props) {
  return (
    <Cadre {...props}>
      <Rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.2" />
    </Cadre>
  );
}

export function IconeCaseCochee(props) {
  return (
    <Cadre {...props}>
      <Rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.2" />
      <Path d="M7.8 12.2 L10.8 15.2 L16.4 8.8" />
    </Cadre>
  );
}

// Photographier son repas.
export function IconeAppareilPhoto(props) {
  return (
    <Cadre {...props}>
      <Path d="M3.4 8.6 A2 2 0 0 1 5.4 6.6 H8 L9.6 4 H14.4 L16 6.6 H18.6 A2 2 0 0 1 20.6 8.6 V18 A2 2 0 0 1 18.6 20 H5.4 A2 2 0 0 1 3.4 18 Z" />
      <Circle cx="12" cy="13.2" r="3.6" />
    </Cadre>
  );
}

// Choisir une photo déjà prise : le cadre, le soleil et la colline.
export function IconeImage(props) {
  return (
    <Cadre {...props}>
      <Rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.4" />
      <Circle cx="8.6" cy="9.4" r="1.6" />
      <Path d="M3.6 16.6 L8.8 12 L20.4 19.4" />
    </Cadre>
  );
}

// Réservé à l'admin (mode test) : le bouclier.
export function IconeBouclier(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 2.8 L20 5.8 V12 C20 17 16.6 19.6 12 21.2 C7.4 19.6 4 17 4 12 V5.8 Z" />
    </Cadre>
  );
}

// =============================================================================
// 5. MATÉRIEL (passe 3 — la bibliothèque d'exercices)
// =============================================================================
// Une ligne de la bibliothèque porte le pictogramme de son MATÉRIEL, pas un
// dessin de l'exercice : à 28 px, « développé couché » et « développé incliné »
// donneraient deux bonshommes identiques, alors qu'une barre, un haltère et une
// poulie se reconnaissent du premier coup (le raisonnement complet est en tête
// de `src/data/bibliothequeExercices.js`).
//
// ⚠️ LE PIÈGE DE CETTE SÉRIE : la barre et l'haltère sont le MÊME objet en deux
// tailles, donc deux icônes qui se ressemblent par construction. Ils sont
// départagés par leur SILHOUETTE, pas par un détail :
//   - la BARRE traverse toute la largeur, avec un gros disque de chaque côté ;
//   - l'HALTÈRE est ramassé au centre, avec deux petits disques empilés par
//     côté — la forme « poids court » classique.
// On les juge côte à côte à 28 px, jamais séparément.

// Barre — LONGUE ET FINE : la barre traverse tout le cadre et les disques
// sont de simples traits verticaux, comme une barre olympique vue de côté.
export function IconeMaterielBarre(props) {
  return (
    <Cadre {...props}>
      <Path d="M2.5 12 H21.5" />
      <Path d="M6.5 8 V16" />
      <Path d="M4.5 9.5 V14.5" />
      <Path d="M17.5 8 V16" />
      <Path d="M19.5 9.5 V14.5" />
    </Cadre>
  );
}

// Haltère court — RAMASSÉ ET ÉPAIS : deux blocs pleins reliés par une poignée
// courte. C'est la masse des blocs, pas la longueur, qui le distingue.
//
// ⚠️ LA PREMIÈRE VERSION AVAIT LES DEUX SILHOUETTES À L'ENVERS, et ça ne s'est
// vu qu'À L'ÉCRAN : la barre avait des disques en blocs épais rapprochés (donc
// elle ressemblait à un haltère) et l'haltère s'étalait sur toute la largeur
// en traits fins (donc à une barre). Les deux dessins étaient justes, chacun
// nommait l'autre. Rien dans le code ne pouvait le dire — c'est la règle n°6
// du fichier, on juge à 20 px.
export function IconeMaterielHalteres(props) {
  return (
    <Cadre {...props}>
      <Path d="M9.5 12 H14.5" />
      <Rect x="5" y="7" width="4.5" height="10" rx="1.5" />
      <Rect x="14.5" y="7" width="4.5" height="10" rx="1.5" />
    </Cadre>
  );
}

// Poulie — la POUTRE en haut, la roue suspendue, le câble, la barre de tirage.
//
// ⚠️ LA POUTRE N'EST PAS DÉCORATIVE. Sans elle, la première version (roue +
// câble en V + barre) se lisait comme un petit bonhomme — donc comme l'icône
// « poids du corps », sa voisine directe dans la liste (« Dips » et « Écarté à
// la poulie » se suivent chez les pectoraux). Vu à l'écran, pas dans le code.
// La poutre accroche l'icône au plafond : plus aucun doute possible.
export function IconeMaterielPoulie(props) {
  return (
    <Cadre {...props}>
      <Path d="M3.5 4 H20.5" />
      <Circle cx="12" cy="7.4" r="2.7" />
      <Path d="M12 10.1 V14.5" />
      <Path d="M7 17 H17" />
    </Cadre>
  );
}

// Machine — le montant et sa colonne de plaques.
export function IconeMaterielMachine(props) {
  return (
    <Cadre {...props}>
      <Path d="M4.5 20.5 V4 H19.5" />
      <Rect x="9" y="9" width="8" height="3.5" rx="1" />
      <Rect x="9" y="14.5" width="8" height="3.5" rx="1" />
    </Cadre>
  );
}

// Poids du corps — un personnage bras écartés.
// ⚠️ À NE PAS CONFONDRE avec l'icône Profil (un buste aux épaules droites) ni
// avec Clan (deux têtes) : celui-ci a des BRAS et des JAMBES, c'est un corps en
// mouvement, pas un portrait.
export function IconeMaterielCorps(props) {
  return (
    <Cadre {...props}>
      <Circle cx="12" cy="5" r="2.6" />
      <Path d="M12 7.8 V14" />
      <Path d="M6 10.5 H18" />
      <Path d="M12 14 L8.5 20.5" />
      <Path d="M12 14 L15.5 20.5" />
    </Cadre>
  );
}

// Élastique — une onde tendue. Un seul tracé : une boucle fermée se lirait
// « anneau », l'onde dit « ça s'étire ».
export function IconeMaterielElastique(props) {
  return (
    <Cadre {...props}>
      <Path d="M3 15.5 C 6 7.5, 10 7.5, 12 12 S 18 16.5, 21 8.5" />
    </Cadre>
  );
}

// Kettlebell — une cloche RONDE surmontée d'une anse nette.
//
// ⚠️ La première version dessinait la cloche en une seule courbe évasée : à
// 20 px elle se lisait comme une GOUTTE D'EAU, l'anse se perdant dans le
// corps. Un cercle franc plus une anse bien détachée tiennent la lecture.
export function IconeMaterielKettlebell(props) {
  return (
    <Cadre {...props}>
      <Path d="M8.5 10.5 A 3.6 3.6 0 1 1 15.5 10.5" />
      <Circle cx="12" cy="15" r="5" />
    </Cadre>
  );
}

// Cardio — la ligne de pouls. Un seul tracé, lisible jusqu'à 14 px.
export function IconeMaterielCardio(props) {
  return (
    <Cadre {...props}>
      <Path d="M2.5 13 H7 L9.5 7 L13 18 L15.5 13 H21.5" />
    </Cadre>
  );
}

// =============================================================================
// 6. LES AUTRES ONGLETS (Profil, Perfs, Paliers, Compétition, Clan) — 08/11/2026
// =============================================================================
// Demande de Hafiz : « change également la DA des autres onglets ainsi que les
// emojis en t'inspirant de l'onglet Entraînement ». Ces douze icônes remplacent
// les emojis d'INTERFACE de ces écrans. Mêmes six règles que tout le fichier.

// Médaille — un disque pendu à deux rubans. ⚠️ ELLE PREND LA COULEUR DU RANG :
// c'est tout l'intérêt de la dessiner plutôt que d'afficher 🥇🥈🥉, qui ne se
// teintent pas. L'écran la passe en or, argent ou bronze (couleurs de ligue).
export function IconeMedaille(props) {
  return (
    <Cadre {...props}>
      <Path d="M8 2.5 L10.5 9.2" />
      <Path d="M16 2.5 L13.5 9.2" />
      <Circle cx="12" cy="15" r="5.8" />
    </Cadre>
  );
}

// Salle de sport — un bâtiment au toit pointu, porte au milieu. Distinct du
// Profil (un buste) et du Clan (deux têtes) : ici c'est un LIEU, pas des gens.
export function IconeSalle(props) {
  return (
    <Cadre {...props}>
      <Path d="M3 10.5 L12 3.5 L21 10.5" />
      <Path d="M5.5 8.6 V20.5 H18.5 V8.6" />
      <Path d="M10 20.5 V15 H14 V20.5" />
    </Cadre>
  );
}

// Bulle de discussion — le chat du clan.
export function IconeBulle(props) {
  return (
    <Cadre {...props}>
      <Path d="M4.5 4.5 H19.5 A2 2 0 0 1 21.5 6.5 V14.5 A2 2 0 0 1 19.5 16.5 H10 L5.5 20.5 V16.5 H4.5 A2 2 0 0 1 2.5 14.5 V6.5 A2 2 0 0 1 4.5 4.5 Z" />
    </Cadre>
  );
}

// Globe — le classement « tout le monde », et le duel en ligne.
export function IconeGlobe(props) {
  return (
    <Cadre {...props}>
      <Circle cx="12" cy="12" r="9.5" />
      <Path d="M12 2.5 C 7.8 6.5, 7.8 17.5, 12 21.5 C 16.2 17.5, 16.2 6.5, 12 2.5" />
      <Path d="M2.5 12 H21.5" />
    </Cadre>
  );
}

// Balance — le classement par catégorie de poids.
export function IconeBalance(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 4 V20.5" />
      <Path d="M8 20.5 H16" />
      <Path d="M4.5 6.5 H19.5" />
      <Path d="M2.5 12.5 H6.5 L4.5 6.5 Z" />
      <Path d="M17.5 12.5 H21.5 L19.5 6.5 Z" />
    </Cadre>
  );
}

// Éclair — l'XP d'activité et le duel. ⚠️ POURQUOI PAS DEUX ÉPÉES pour le
// duel : c'est exactement le dessin qui est devenu un gribouillis à 20 px dans
// la barre d'onglets le 08/09/2026. L'éclair dit « affrontement rapide » en un
// seul tracé.
export function IconeEclair(props) {
  return (
    <Cadre {...props}>
      <Path d="M13.5 2.5 L4.5 13.5 H11.5 L10.5 21.5 L19.5 10.5 H12.5 Z" />
    </Cadre>
  );
}

// Caméra vidéo — preuve d'une perf en vidéo. Distincte de l'appareil photo
// (repas de la Nutrition) par son objectif en trapèze sur le côté.
export function IconeVideo(props) {
  return (
    <Cadre {...props}>
      <Rect x="2.5" y="6.5" width="13" height="11" rx="2" />
      <Path d="M15.5 10.5 L21.5 7 V17 L15.5 13.5" />
    </Cadre>
  );
}

// Cadenas — sécurité du compte, arène verrouillée.
export function IconeCadenas(props) {
  return (
    <Cadre {...props}>
      <Rect x="4.5" y="10.5" width="15" height="11" rx="2" />
      <Path d="M8 10.5 V7.5 A4 4 0 0 1 16 7.5 V10.5" />
      <Path d="M12 14.5 V17.5" />
    </Cadre>
  );
}

// Dé — ce qui est tiré au sort (le round de départage d'un duel).
// Les points sont des cercles minuscules : avec le trait de 2, ils deviennent
// des pastilles pleines sans enfreindre la règle « des contours ».
export function IconeDe(props) {
  return (
    <Cadre {...props}>
      <Rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <Circle cx="8.5" cy="8.5" r="0.4" />
      <Circle cx="12" cy="12" r="0.4" />
      <Circle cx="15.5" cy="15.5" r="0.4" />
    </Cadre>
  );
}

// Stop — « j'ai fini ma série ».
export function IconeStop(props) {
  return (
    <Cadre {...props}>
      <Rect x="6" y="6" width="12" height="12" rx="2.5" />
    </Cadre>
  );
}

// Drapeau — la fin (d'un test, d'un bloc).
export function IconeDrapeau(props) {
  return (
    <Cadre {...props}>
      <Path d="M5 21.5 V3.5" />
      <Path d="M5 4 H18.5 L16 8.5 L18.5 13 H5" />
    </Cadre>
  );
}

// Envoyer — un avion en papier, pour le chat.
export function IconeEnvoyer(props) {
  return (
    <Cadre {...props}>
      <Path d="M21.5 2.5 L2.5 10 L10 13.5 L13.5 21.5 Z" />
      <Path d="M21.5 2.5 L10 13.5" />
    </Cadre>
  );
}

// -----------------------------------------------------------------------------
// LES EMBLÈMES D'ARÈNE (08/11/2026) — ils remplacent 🚪 🌱 🔥 ⚔️ 🏆 💎 👑
// -----------------------------------------------------------------------------
// Sept arènes, sept emblèmes : quatre dessinés ici, trois déjà au répertoire
// (bouclier pour COLOSSE, trophée pour TITAN, couronne pour ROYALE). Ils se
// teintent à la COULEUR DE LA LIGUE — ce qu'un emoji ne savait pas faire : la
// pastille de la route des arènes et le badge de l'avatar parlent enfin la
// même couleur que l'anneau qui les entoure.
// ⚠️ COLOSSE N'EST PAS DEUX ÉPÉES CROISÉES comme son emoji d'origine : c'est
// le dessin qui est devenu un gribouillis à 20 px le 08/09/2026. Le bouclier
// du gladiateur garde l'idée en un seul contour.

// Porte — DÉBUT : on entre dans la salle.
export function IconePorte(props) {
  return (
    <Cadre {...props}>
      <Path d="M6 21.5 V4 A1.5 1.5 0 0 1 7.5 2.5 H16.5 A1.5 1.5 0 0 1 18 4 V21.5" />
      <Path d="M3.5 21.5 H20.5" />
      <Circle cx="14.6" cy="12.5" r="0.4" />
    </Cadre>
  );
}

// Pousse — INITIATION : ça commence à pousser.
export function IconePousse(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 21.5 V11" />
      <Path d="M12 14.5 C 7.2 14.5, 4.5 11.2, 4.5 7 C 9.2 7, 12 10.2, 12 14.5" />
      <Path d="M12 11 C 12 6.8, 14.8 3.5, 19.5 3.5 C 19.5 7.9, 16.7 11, 12 11" />
    </Cadre>
  );
}

// Flamme — FORGE, et la série de jours d'entraînement du Profil.
export function IconeFlamme(props) {
  return (
    <Cadre {...props}>
      <Path d="M12 21.5 C 7.6 21.5, 5 18.6, 5 14.8 C 5 10.8, 8.4 8.6, 9 3.5 C 12 5.6, 13.2 8.2, 13.2 10.6 C 14.4 9.9, 15.1 8.7, 15.3 7.3 C 17.8 9.2, 19 11.8, 19 14.8 C 19 18.6, 16.4 21.5, 12 21.5 Z" />
    </Cadre>
  );
}

// Diamant — OLYMPE : très haut, très rare.
export function IconeDiamant(props) {
  return (
    <Cadre {...props}>
      <Path d="M7 3.5 H17 L21.5 9 L12 21 L2.5 9 Z" />
      <Path d="M2.5 9 H21.5" />
      <Path d="M9.5 3.5 L8 9 L12 21 L16 9 L14.5 3.5" />
    </Cadre>
  );
}

// Loupe — pour le champ de recherche de la bibliothèque.
export function IconeRecherche(props) {
  return (
    <Cadre {...props}>
      <Circle cx="10.5" cy="10.5" r="6" />
      <Path d="M15 15 L20.5 20.5" />
    </Cadre>
  );
}

// =============================================================================
// LE RÉPERTOIRE
// =============================================================================
// Une icône se demande PAR SON NOM : c'est ce qui permet de la choisir au vol
// (`nom={ouvert ? 'chevron-haut' : 'chevron-bas'}`) sans importer vingt
// composants dans chaque écran.
export const NOMS_ICONES = {
  // onglets
  profil: IconeProfil,
  perfs: IconePerfs,
  paliers: IconePaliers,
  competition: IconeCompetition,
  entrainement: IconeEntrainement,
  clan: IconeClan,
  // actions
  lecture: IconeLecture,
  plus: IconePlus,
  croix: IconeCroix,
  valide: IconeValide,
  crayon: IconeCrayon,
  corbeille: IconeCorbeille,
  sortie: IconeSortie,
  telecharger: IconeTelecharger,
  recharger: IconeRecharger,
  recherche: IconeRecherche,
  // navigation
  'chevron-gauche': IconeChevronGauche,
  'chevron-droit': IconeChevronDroit,
  'chevron-bas': IconeChevronBas,
  'chevron-haut': IconeChevronHaut,
  // objets
  programme: IconeProgramme,
  calendrier: IconeCalendrier,
  tableau: IconeTableau,
  cible: IconeCible,
  couverts: IconeCouverts,
  horloge: IconeHorloge,
  historique: IconeHistorique,
  cloche: IconeCloche,
  cle: IconeCle,
  etoile: IconeEtoile,
  bibliotheque: IconeBibliotheque,
  etiquette: IconeEtiquette,
  repere: IconeRepere,
  'case-vide': IconeCaseVide,
  'case-cochee': IconeCaseCochee,
  'appareil-photo': IconeAppareilPhoto,
  image: IconeImage,
  alerte: IconeAlerte,
  question: IconeQuestion,
  bouclier: IconeBouclier,
  // matériel (bibliothèque d'exercices) — les clés sont celles de `MATERIELS`
  // dans `src/data/bibliothequeExercices.js` : les deux doivent rester
  // d'accord, un test le vérifie.
  'mat-barre': IconeMaterielBarre,
  'mat-halteres': IconeMaterielHalteres,
  'mat-poulie': IconeMaterielPoulie,
  'mat-machine': IconeMaterielMachine,
  'mat-corps': IconeMaterielCorps,
  'mat-elastique': IconeMaterielElastique,
  'mat-kettlebell': IconeMaterielKettlebell,
  'mat-cardio': IconeMaterielCardio,
  // autres onglets (08/11/2026)
  medaille: IconeMedaille,
  salle: IconeSalle,
  bulle: IconeBulle,
  globe: IconeGlobe,
  balance: IconeBalance,
  eclair: IconeEclair,
  video: IconeVideo,
  cadenas: IconeCadenas,
  de: IconeDe,
  stop: IconeStop,
  drapeau: IconeDrapeau,
  envoyer: IconeEnvoyer,
  // emblèmes d'arène
  porte: IconePorte,
  pousse: IconePousse,
  flamme: IconeFlamme,
  diamant: IconeDiamant,
};

// Le point d'entrée unique. Un nom inconnu ne dessine RIEN : une icône qui
// manque ne doit pas remplacer un écran par un message d'erreur.
export function Icone({ nom, taille = 18, couleur = '#ffffff' }) {
  const Dessin = NOMS_ICONES[nom];
  if (!Dessin) return null;
  return <Dessin taille={taille} couleur={couleur} />;
}

// -----------------------------------------------------------------------------
// LES DEUX RANGÉES « ICÔNE + TEXTE »
// -----------------------------------------------------------------------------
// Elles remplacent les « <Text>🎯 Attendu : …</Text> » d'avant. Le `style`
// passé est celui du TEXTE (on remplace un Text par une rangée, donc on garde
// exactement la même feuille de style) ; l'icône prend sa couleur, sauf si on
// lui en donne une autre.
//
// ⚠️ `flex: 1` SUR LE TEXTE ET `flexShrink: 0` SUR L'ICÔNE : c'est le texte
// qui doit se replier sur plusieurs lignes, jamais l'icône qui doit maigrir.
// (Le piège inverse a coûté une carte entièrement vide le 03/09/2026 : un
// texte en `flex: 1` écrasé à zéro par ses voisins.)
//
// ⚠️ ET SURTOUT : LES MARGES PASSENT SUR LA RANGÉE, PAS SUR LE TEXTE.
// Vu à l'écran, pas dans le code : le titre « Mes records » porte un
// `marginTop: 24`. Laissé sur le texte, il poussait le TEXTE vers le bas à
// l'intérieur de la rangée pendant que l'icône restait en haut — le trophée
// flottait 17 px au-dessus de son titre. Le style remplaçait un <Text> qui
// portait seul la mise en page : ses propriétés de PLACEMENT (marges, flex,
// largeur, alignement) appartiennent donc à la rangée maintenant, et seules
// les propriétés de TEXTE restent sur le texte.
const PROPS_DE_PLACEMENT = [
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'flex', 'alignSelf',
  'width', 'maxWidth', 'minWidth',
];

function separerPlacement(style) {
  const plat = StyleSheet.flatten(style) || {};
  const placement = {};
  const texte = {};
  Object.keys(plat).forEach((cle) => {
    if (PROPS_DE_PLACEMENT.indexOf(cle) >= 0) placement[cle] = plat[cle];
    else texte[cle] = plat[cle];
  });
  return { placement, texte };
}

// Pour un titre, un paragraphe, un message : l'icône est à gauche, le texte
// occupe le reste et se replie.
export function TexteIcone({
  nom, taille = 15, couleur, ecart = 7, hautAligne, style, children, ...reste
}) {
  const { placement, texte } = separerPlacement(style);
  return (
    <View
      style={[
        stylesRangee.rangee,
        placement,
        { gap: ecart, alignItems: hautAligne ? 'flex-start' : 'center' },
      ]}
    >
      <View style={[stylesRangee.boite, hautAligne && { marginTop: 2 }]}>
        <Icone nom={nom} taille={taille} couleur={couleur || texte.color} />
      </View>
      <Text style={[texte, stylesRangee.texteEtendu]} {...reste}>{children}</Text>
    </View>
  );
}

// Pour un libellé de bouton : la rangée est centrée et le texte NE s'étire pas,
// sinon l'ensemble « icône + mot » se collerait au bord gauche du bouton.
export function LibelleIcone({
  nom, taille = 15, couleur, ecart = 7, style, children, ...reste
}) {
  const { placement, texte } = separerPlacement(style);
  return (
    <View style={[stylesRangee.rangee, stylesRangee.centree, placement, { gap: ecart }]}>
      <View style={stylesRangee.boite}>
        <Icone nom={nom} taille={taille} couleur={couleur || texte.color} />
      </View>
      <Text style={texte} {...reste}>{children}</Text>
    </View>
  );
}

const stylesRangee = StyleSheet.create({
  rangee: { flexDirection: 'row' },
  centree: { alignItems: 'center', justifyContent: 'center' },
  boite: { flexShrink: 0 },
  texteEtendu: { flex: 1 },
});
