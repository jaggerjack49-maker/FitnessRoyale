// Filet de sécurité : si un écran plante au rendu, affiche le message ET la
// pile des COMPOSANTS (pas la pile technique de React) directement dans
// l'app, pour diagnostiquer sans avoir besoin d'un ordinateur de dev à côté.
// Un "Error Boundary" DOIT être une classe (React ne permet pas les hooks ici).
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';

export default class LimiteErreur extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null, infos: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, infos) {
    this.setState({ infos });
  }

  render() {
    if (this.state.erreur) {
      return (
        <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
          <Text style={styles.titre}>💥 Erreur d'affichage</Text>
          <Text style={styles.message}>{String(this.state.erreur?.message || this.state.erreur)}</Text>
          <Text style={styles.sousTitre}>Composants concernés :</Text>
          <Text style={styles.pile}>{this.state.infos?.componentStack || 'inconnue'}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: colors.fond },
  titre: { color: colors.rouge, fontSize: 20, fontWeight: '800', marginBottom: espacement.m },
  message: { color: colors.texte, fontSize: 14, marginBottom: espacement.l },
  sousTitre: { color: colors.texteGris, fontWeight: '700', marginBottom: espacement.s },
  pile: { color: colors.texteGris, fontSize: 11, fontFamily: 'monospace' },
});
