// Carte affichant une statistique (valeur + libellé).
//
// DEPUIS LE 08/11/2026 elle reçoit le NOM D'UNE ICÔNE (`icone`), plus un
// emoji : même passage que l'onglet Entraînement (passe 2 de la refonte).
// L'icône se pose dans une pastille voilée d'or — le traitement des grandes
// entrées de l'Entraînement — pour que les deux écrans se ressemblent.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { da } from '../designSystem';
import { Icone } from './Icones';

export default function CarteStat({ valeur, libelle, icone, couleur = colors.or }) {
  return (
    <View style={styles.carte}>
      <View style={styles.pastille}>
        <Icone nom={icone} taille={17} couleur={couleur} />
      </View>
      <Text style={styles.valeur}>{valeur}</Text>
      <Text style={styles.libelle}>{libelle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: espacement.xs,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  pastille: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: da.orVoile,
    marginBottom: espacement.s,
  },
  valeur: { color: colors.texte, fontSize: 20, fontWeight: '800' },
  libelle: { color: colors.texteGris, fontSize: 12, marginTop: 2, textAlign: 'center' },
});
