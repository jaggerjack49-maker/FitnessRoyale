// =============================================================================
// LE CHOISISSEUR D'EXERCICE (passe 3 de la refonte Entraînement)
// =============================================================================
//
// Un panneau qui s'ouvre LÀ OÙ ON EST, à côté du champ qu'on était en train de
// remplir. Il est branché aux TROIS endroits de l'app où l'on tape un nom
// d'exercice : l'éditeur d'une séance, le formulaire « Nouveau programme », et
// l'ajout d'un exercice en pleine séance. UN SEUL composant pour les trois —
// trois formulaires de recherche à maintenir finiraient par divergir.
//
// -----------------------------------------------------------------------------
// ⚠️ DEUX TEMPS, PAS UNE LISTE DE 97 LIGNES
// -----------------------------------------------------------------------------
// Sans filtre, la bibliothèque fait 96 lignes. On commence donc par les 12
// GROUPES (une grille qui tient sans défilement), et on n'affiche les exercices
// qu'une fois le groupe choisi — soit 3 à 13 lignes. Une recherche court-
// circuite les deux temps et cherche partout.
//
// POURQUOI PAS UNE LISTE UNIQUE AVEC SON PROPRE ASCENSEUR : ce panneau vit
// DANS la page de l'onglet, qui défile déjà verticalement. Imbriquer deux
// défilements verticaux marche… à peu près, selon la plateforme et selon
// l'endroit où le doigt se pose — et ce projet a déjà payé assez cher les
// comportements « à peu près » impossibles à vérifier depuis un navigateur
// (voir les pièges du volet masqué dans CLAUDE.md). Deux temps, aucun
// défilement imbriqué, le même comportement partout.

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { da, monospace } from '../designSystem';
import { Icone, TexteIcone } from './Icones';
import { groupesMusculaires } from '../data/groupesMusculaires';
import {
  MATERIELS, bibliothequeExercices, chercherExercices, nombreParGroupe,
  descriptionExercice, dejaChoisi,
} from '../data/bibliothequeExercices';

// Zone tactile élargie pour les petites cibles (même constante d'esprit que
// celle de l'écran Entraînement) : on touche plus large que le dessin.
const ZONE_TACTILE = { top: 8, bottom: 8, left: 8, right: 8 };

// `consultation` : le même panneau, mais pour PARCOURIR la bibliothèque plutôt
// que remplir un champ (sous-écran « Bibliothèque »). Seuls le chevron de fin
// de ligne et la phrase de pied changent — tout le reste (recherche, groupes,
// pictogrammes) est le même code, sinon les deux listes finiraient par ne plus
// montrer la même chose.
export default function ChoixExercice({
  onChoisir, onFermer, dejaPris = [], consultation = false,
}) {
  const [recherche, setRecherche] = useState('');
  const [groupe, setGroupe] = useState(null);

  const compte = nombreParGroupe();
  const chercheQuelqueChose = recherche.trim().length > 0;
  // Une recherche cherche PARTOUT, même si un groupe était sélectionné : on
  // tape « curl » pour trouver un curl, pas pour trouver un curl de dos.
  const resultats = chercheQuelqueChose
    ? chercherExercices(recherche, null)
    : (groupe ? chercherExercices('', groupe) : []);

  // `dejaChoisi` vit dans la bibliothèque, pas ici : c'est une règle, et une
  // règle doit être testable par Node (un composant ne l'est pas).
  const dejaDansLaListe = (nom) => dejaChoisi(nom, dejaPris);

  return (
    <View style={styles.panneau}>
      {/* En consultation, le sous-écran porte DÉJÀ ce titre et sa flèche de
          retour : le répéter ici affichait « Bibliothèque d'exercices » deux
          fois de suite (vu à l'écran). */}
      {!consultation && (
        <View style={styles.entete}>
          <TexteIcone nom="bibliotheque" taille={15} couleur={colors.or} style={styles.titre}>
            Bibliothèque d’exercices
          </TexteIcone>
          <TouchableOpacity onPress={onFermer} hitSlop={ZONE_TACTILE} style={styles.fermer}>
            <Icone nom="croix" taille={15} couleur={colors.texteGris} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.ligneRecherche, consultation && { marginTop: 0 }]}>
        <Icone nom="recherche" taille={15} couleur={colors.texteGris} />
        <TextInput
          style={styles.champRecherche}
          value={recherche}
          onChangeText={setRecherche}
          placeholder={`Chercher parmi ${bibliothequeExercices.length} exercices…`}
          placeholderTextColor={colors.texteGris}
          autoCorrect={false}
        />
        {chercheQuelqueChose && (
          <TouchableOpacity onPress={() => setRecherche('')} hitSlop={ZONE_TACTILE}>
            <Icone nom="croix" taille={13} couleur={colors.texteGris} />
          </TouchableOpacity>
        )}
      </View>

      {/* TEMPS 1 — les groupes, tant qu'on ne cherche rien. */}
      {!chercheQuelqueChose && !groupe && (
        <>
          <Text style={styles.aide}>Choisis un groupe musculaire, ou cherche directement.</Text>
          <View style={styles.grilleGroupes}>
            {groupesMusculaires.map((g) => (
              <TouchableOpacity key={g} style={styles.tuileGroupe} onPress={() => setGroupe(g)}>
                <Text style={styles.tuileGroupeNom} numberOfLines={2}>{g}</Text>
                <Text style={styles.tuileGroupeCompte}>{compte[g] || 0}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* TEMPS 2 — les exercices du groupe choisi (ou les résultats de la
          recherche). */}
      {(chercheQuelqueChose || groupe) && (
        <>
          {!chercheQuelqueChose && (
            <TouchableOpacity style={styles.retourGroupes} onPress={() => setGroupe(null)}>
              <TexteIcone
                nom="chevron-gauche" taille={13} couleur={colors.or}
                style={styles.retourGroupesTexte}
              >
                {`${groupe} — tous les groupes`}
              </TexteIcone>
            </TouchableOpacity>
          )}

          {resultats.length === 0 ? (
            <Text style={styles.aide}>
              Aucun exercice de la bibliothèque ne correspond. Tape son nom à la
              main juste en dessous : tous les noms sont acceptés.
            </Text>
          ) : resultats.map((exo) => {
            const deja = dejaDansLaListe(exo.nom);
            const materiel = MATERIELS[exo.materiel];
            return (
              <TouchableOpacity
                key={exo.nom}
                style={[styles.ligne, deja && styles.lignePrise]}
                onPress={() => { if (!deja) onChoisir(exo.nom); }}
                disabled={deja}
              >
                <View style={styles.boiteMateriel}>
                  <Icone
                    nom={materiel ? materiel.icone : 'question'}
                    taille={20}
                    couleur={deja ? colors.texteGris : colors.or}
                  />
                </View>
                <View style={styles.ligneTextes}>
                  <Text style={[styles.ligneNom, deja && styles.texteGrise]}>{exo.nom}</Text>
                  <Text style={styles.ligneDetail}>
                    {descriptionExercice(exo)}
                    {deja ? ' · déjà dans la liste' : ''}
                  </Text>
                </View>
                {consultation
                  ? <Icone nom="chevron-droit" taille={15} couleur={colors.texteGris} />
                  : (!deja && <Icone nom="plus" taille={15} couleur={colors.texteGris} />)}
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* ⚠️ CETTE PHRASE N'EST PAS DÉCORATIVE : la bibliothèque est un
          raccourci, pas une cage. Il faut qu'on le lise ici, au moment précis
          où l'on ne trouve pas son exercice. */}
      <Text style={styles.piedDePage}>
        {consultation
          ? 'Cette liste est un raccourci : tu peux toujours écrire n’importe quel nom d’exercice dans tes programmes et tes séances.'
          : 'Ton exercice n’y est pas ? Écris simplement son nom dans le champ : l’app accepte n’importe quel nom.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panneau: {
    backgroundColor: da.carteBasse,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: da.bordureOrDouce,
    padding: espacement.m,
    marginTop: espacement.s,
  },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { color: colors.texte, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  fermer: { padding: 4 },

  ligneRecherche: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacement.s,
    backgroundColor: da.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordure,
    paddingHorizontal: espacement.s + 2,
    marginTop: espacement.m,
    minHeight: 46,
  },
  champRecherche: { flex: 1, color: colors.texte, fontSize: 14, paddingVertical: 10 },

  aide: { color: colors.texteGris, fontSize: 12, marginTop: espacement.m, lineHeight: 17 },

  grilleGroupes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacement.s,
    marginTop: espacement.s,
  },
  tuileGroupe: {
    // Trois par ligne sur un téléphone, sans calculer de pourcentage : une
    // largeur minimale + `flexGrow` laisse la rangée se remplir toute seule,
    // et la grille suit la largeur disponible sur grand écran.
    minWidth: 92,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacement.xs,
    minHeight: 46,
    paddingHorizontal: espacement.s + 2,
    paddingVertical: espacement.s,
    backgroundColor: da.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  tuileGroupeNom: { flex: 1, color: colors.texte, fontSize: 12, fontWeight: '700' },
  tuileGroupeCompte: { color: colors.texteGris, fontSize: 11, fontFamily: monospace },

  // 44 px : la seule cible du panneau qui passait en dessous (mesurée à 32).
  retourGroupes: {
    marginTop: espacement.s, paddingVertical: espacement.s,
    minHeight: 44, justifyContent: 'center',
  },
  retourGroupesTexte: { color: colors.or, fontSize: 12, fontWeight: '700' },

  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacement.s + 2,
    paddingVertical: espacement.s + 2,
    borderBottomWidth: 1,
    borderBottomColor: da.bordureFine,
    minHeight: 50,
  },
  lignePrise: { opacity: 0.45 },
  boiteMateriel: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: da.orVoile,
  },
  // `flex: 1` sur le bloc de textes, et uniquement là : c'est lui qui doit se
  // replier, jamais le pictogramme (piège du 03/09/2026).
  ligneTextes: { flex: 1 },
  ligneNom: { color: colors.texte, fontSize: 14, fontWeight: '600' },
  ligneDetail: { color: colors.texteGris, fontSize: 11, marginTop: 2 },
  texteGrise: { color: colors.texteGris },

  piedDePage: {
    color: colors.texteGris,
    fontSize: 11,
    lineHeight: 16,
    marginTop: espacement.m,
    fontStyle: 'italic',
  },
});
