// L'éditeur d'une séance (nom + exercices), partagé par la semaine type et Mes programmes.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.

import { useState } from 'react';
import ChoixExercice from '../../components/ChoixExercice';
import { LibelleIcone } from '../../components/Icones';
import LigneExerciceEditable from '../../components/LigneExerciceEditable';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, espacement } from '../../theme';
import { da } from '../../designSystem';
import { deplacerLigne, exercicesDepuisLignes, ligneDepuisExercice, ligneVide } from '../../logic/lignesProgramme';
import { placerExerciceChoisi } from '../../logic/choixExercice';

// Éditeur d'une SÉANCE : un nom + autant d'exercices qu'on veut, chacun avec
// ses séries × reps. Utilisé à DEUX endroits (même composant, pas de doublon) :
// - la SEMAINE TYPE, pour écrire la séance d'un jour ;
// - le CALENDRIER, pour retoucher la séance prévue une date donnée.
// `programme` = la séance déjà enregistrée (ou null pour en créer une).
// `onSauvegarder(nom, exercices)` remonte la version normalisée au parent.
export function EditeurSeance({
  programme, placeholderNom, libelleBouton, onSauvegarder,
  onVider, libelleVider, note, nomParDefaut,
}) {
  const [nom, setNom] = useState(programme ? programme.nom : '');
  // Forme et conversion des lignes : src/logic/lignesProgramme.js (partagée
  // avec « Nouveau programme », 08/11/2026).
  const [lignes, setLignes] = useState(
    programme && programme.exercices.length > 0
      ? programme.exercices.map(ligneDepuisExercice)
      : [ligneVide()]
  );
  const [message, setMessage] = useState(null);
  const [biblioOuverte, setBiblioOuverte] = useState(false);

  function modifier(index, champ, valeur) {
    setMessage(null);
    setLignes((l) => l.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)));
  }

  function valider() {
    const nomFinal = nom.trim() || nomParDefaut || 'Séance';
    const exercices = exercicesDepuisLignes(lignes);
    if (exercices.length === 0) {
      setMessage("Ajoute au moins un exercice (avec son nom).");
      return;
    }
    onSauvegarder(nomFinal, exercices);
    setMessage('Séance enregistrée');
  }

  return (
    <View style={stylesEditeur.carte}>
      {note && <Text style={stylesEditeur.note}>{note}</Text>}
      <Text style={stylesEditeur.libelle}>Nom de la séance</Text>
      <TextInput
        style={stylesEditeur.champNom}
        value={nom}
        onChangeText={(v) => { setNom(v); setMessage(null); }}
        placeholder={placeholderNom}
        placeholderTextColor={colors.texteGris}
      />

      <Text style={stylesEditeur.libelle}>Exercices, dans l'ordre de la séance</Text>
      <Text style={stylesEditeur.aide}>
        Les flèches changent l'ordre. « → MAX » est une fourchette facultative
        (« 5 → 10 » : on monte les reps jusqu'à 10 avant d'ajouter de la charge).
        REPOS : le temps entre deux séries (« 90 » ou « 1:30 ») — le minuteur se
        lancera tout seul après chaque série ; vide = 1:30. RIR : les reps que
        tu gardes en réserve (0 = jusqu'à l'échec), facultatif.
      </Text>
      {lignes.map((ligne, i) => (
        <LigneExerciceEditable
          key={i}
          ligne={ligne}
          index={i}
          total={lignes.length}
          onModifier={(champ, valeur) => modifier(i, champ, valeur)}
          onDeplacer={(sens) => { setMessage(null); setLignes((l) => deplacerLigne(l, i, sens)); }}
          onRetirer={lignes.length > 1
            ? () => setLignes((l) => l.filter((_, k) => k !== i))
            : null}
        />
      ))}

      <View style={stylesEditeur.deuxBoutons}>
        <TouchableOpacity
          style={[stylesEditeur.boutonAjout, stylesEditeur.boutonMoitie]}
          onPress={() => setLignes((l) => [...l, ligneVide()])}
        >
          <LibelleIcone nom="plus" taille={13} ecart={5} style={stylesEditeur.boutonAjoutTexte}>Ligne vide</LibelleIcone>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesEditeur.boutonAjout, stylesEditeur.boutonMoitie, stylesEditeur.boutonBiblio]}
          onPress={() => { setBiblioOuverte((o) => !o); setMessage(null); }}
        >
          <LibelleIcone nom="bibliotheque" taille={13} ecart={5} style={stylesEditeur.boutonBiblioTexte}>
            Bibliothèque
          </LibelleIcone>
        </TouchableOpacity>
      </View>

      {biblioOuverte && (
        <ChoixExercice
          dejaPris={lignes.map((l) => l.exercice)}
          onFermer={() => setBiblioOuverte(false)}
          onChoisir={(nomExo) => setLignes((l) => placerExerciceChoisi(l, nomExo, ligneVide()))}
        />
      )}

      {message && <Text style={stylesEditeur.message}>{message}</Text>}

      <TouchableOpacity style={stylesEditeur.bouton} onPress={valider}>
        <Text style={stylesEditeur.boutonTexte}>{libelleBouton}</Text>
      </TouchableOpacity>
      {onVider && (
        <TouchableOpacity onPress={onVider}>
          <Text style={stylesEditeur.lienVider}>{libelleVider}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export const stylesEditeur = StyleSheet.create({
  carte: {
    backgroundColor: colors.fond, borderRadius: 10, padding: espacement.s,
    marginTop: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  libelle: { color: colors.texte, fontWeight: '600', fontSize: 12, marginTop: 4, marginBottom: 4 },
  champNom: {
    backgroundColor: colors.carteClaire, borderRadius: 8, padding: 10,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure, fontSize: 13,
  },
  aide: { color: colors.texteGris, fontSize: 11, lineHeight: 16, marginBottom: 6 },
  // « Ligne vide » reste NEUTRE (08/11/2026) : à côté de « Bibliothèque » en
  // or, c'est le chemin de repli — deux boutons de même couleur n'auraient
  // plus dit lequel préférer.
  boutonAjout: {
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
    borderRadius: 8, padding: 8, alignItems: 'center', marginTop: 2,
  },
  boutonAjoutTexte: { color: colors.texteDoux, fontWeight: '700', fontSize: 12 },
  // Les deux façons d'ajouter un exercice, côte à côte : une ligne vide (on
  // tape son nom) ou la bibliothèque. La seconde est en OR — c'est le chemin
  // qu'on veut voir en premier, puisqu'il évite les fautes de frappe.
  deuxBoutons: { flexDirection: 'row', gap: espacement.s, marginTop: 2 },
  boutonMoitie: { flex: 1, minHeight: 44, justifyContent: 'center' },
  boutonBiblio: { borderColor: da.bordureOrDouce },
  boutonBiblioTexte: { color: colors.or, fontWeight: '700', fontSize: 12 },
  bouton: {
    backgroundColor: colors.or, borderRadius: 8, padding: 10, minHeight: 44, justifyContent: 'center',
    alignItems: 'center', marginTop: espacement.s,
  },
  boutonTexte: { color: da.orSombre, fontWeight: '900', fontSize: 13 },
  message: { color: colors.vert, fontSize: 12, marginTop: 6 },
  lienVider: { color: colors.texteGris, fontSize: 11, textAlign: 'center', marginTop: 8 },
  note: { color: colors.or, fontSize: 11, marginBottom: 4, lineHeight: 15 },
});
