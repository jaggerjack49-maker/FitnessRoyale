// Écran de connexion / inscription — obligatoire pour utiliser l'app en ligne
// (chaque joueur a maintenant un compte protégé par mot de passe).
// Si le serveur est injoignable, App.js ne montre même pas cet écran :
// l'app bascule directement en mode hors-ligne avec les données locales.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, espacement } from '../theme';
import * as api from '../api';

export default function ConnexionScreen({ onConnecte }) {
  const [mode, setMode] = useState('connexion'); // 'connexion' | 'inscription' | 'oubli'
  const [pseudo, setPseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [sexe, setSexe] = useState('homme');
  const [poids, setPoids] = useState('');
  const [salle, setSalle] = useState('');
  const [codeSecours, setCodeSecours] = useState(''); // saisi en mode 'oubli'
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  // Après une inscription réussie : on affiche le code de secours UNE FOIS
  // (avec la connexion en attente) — l'utilisateur confirme l'avoir noté
  // avant d'entrer dans l'app. { token, joueur, code } ou null.
  const [inscriptionReussie, setInscriptionReussie] = useState(null);

  async function valider() {
    setErreur(null);
    if (pseudo.trim().length < 2) {
      setErreur('Le pseudo doit faire au moins 2 caractères.');
      return;
    }
    if (mode === 'oubli' && codeSecours.trim().length < 4) {
      setErreur('Saisis ton code de secours (noté à l’inscription).');
      return;
    }
    if (motDePasse.length < 4) {
      setErreur('Le mot de passe doit faire au moins 4 caractères.');
      return;
    }
    setEnCours(true);
    try {
      if (mode === 'connexion') {
        const { token, joueur } = await api.connexion(pseudo.trim(), motDePasse);
        onConnecte(token, joueur);
      } else if (mode === 'oubli') {
        // Le champ mot de passe sert ici de NOUVEAU mot de passe.
        const { token, joueur } = await api.motDePasseOublie(
          pseudo.trim(), codeSecours.trim(), motDePasse
        );
        onConnecte(token, joueur);
      } else {
        const poidsNombre = parseFloat(poids.replace(',', '.'));
        if (isNaN(poidsNombre) || poidsNombre <= 30) {
          setErreur('Indique ton poids en kg (nombre valide).');
          setEnCours(false);
          return;
        }
        const { token, joueur, codeRecuperation } = await api.inscription(
          pseudo.trim(), motDePasse, sexe, poidsNombre, salle.trim() || null
        );
        // Ne pas entrer tout de suite : montrer d'abord le code de secours.
        setInscriptionReussie({ token, joueur, code: codeRecuperation });
      }
    } catch (e) {
      setErreur(e.message || 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  }

  // Écran intermédiaire post-inscription : le code de secours, affiché une
  // seule fois (le serveur n'en garde qu'une empreinte, impossible de le revoir).
  if (inscriptionReussie) {
    return (
      <View style={[styles.conteneur, styles.scroll]}>
        <Text style={styles.titre}>🎉 Compte créé !</Text>
        <View style={[styles.formulaire, { marginTop: espacement.l }]}>
          <Text style={styles.libelle}>Ton CODE DE SECOURS</Text>
          <Text style={styles.codeSecours}>{inscriptionReussie.code}</Text>
          <Text style={styles.explication}>
            Note-le précieusement (photo, carnet…) : c'est la SEULE façon de
            récupérer ton compte si tu oublies ton mot de passe. Il ne sera
            plus jamais affiché.
          </Text>
          <TouchableOpacity
            style={styles.bouton}
            onPress={() => onConnecte(inscriptionReussie.token, inscriptionReussie.joueur)}
          >
            <Text style={styles.boutonTexte}>C'est noté, entrer dans l'app</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titre}>🏆 Fitness Royale</Text>
        <Text style={styles.sousTitre}>Club SP — FIGHT FOR IT</Text>

        <View style={styles.selecteur}>
          <TouchableOpacity
            style={[styles.ongletBtn, mode === 'connexion' && styles.ongletActif]}
            onPress={() => { setMode('connexion'); setErreur(null); }}
          >
            <Text style={[styles.ongletTexte, mode === 'connexion' && styles.ongletTexteActif]}>
              Se connecter
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ongletBtn, mode === 'inscription' && styles.ongletActif]}
            onPress={() => { setMode('inscription'); setErreur(null); }}
          >
            <Text style={[styles.ongletTexte, mode === 'inscription' && styles.ongletTexteActif]}>
              Créer un compte
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formulaire}>
          <Text style={styles.libelle}>Pseudo</Text>
          <TextInput
            style={styles.champ}
            value={pseudo}
            onChangeText={setPseudo}
            placeholder="Ex. : Hafiz"
            placeholderTextColor={colors.texteGris}
            autoCapitalize="none"
          />

          {mode === 'oubli' && (
            <>
              <Text style={styles.libelle}>Code de secours</Text>
              <TextInput
                style={styles.champ}
                value={codeSecours}
                onChangeText={setCodeSecours}
                placeholder="Ex. : K7XPQR2M (noté à l'inscription)"
                placeholderTextColor={colors.texteGris}
                autoCapitalize="characters"
              />
            </>
          )}

          <Text style={styles.libelle}>
            {mode === 'oubli' ? 'Nouveau mot de passe' : 'Mot de passe'}
          </Text>
          <TextInput
            style={styles.champ}
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="Au moins 4 caractères"
            placeholderTextColor={colors.texteGris}
            secureTextEntry
          />

          {mode === 'inscription' && (
            <>
              <Text style={styles.libelle}>Sexe (pour le barème Club SP)</Text>
              <View style={styles.bascule}>
                {['homme', 'femme'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.basculeBtn, sexe === s && styles.basculeActif]}
                    onPress={() => setSexe(s)}
                  >
                    <Text style={[styles.basculeTexte, sexe === s && styles.basculeTexteActif]}>
                      {s === 'homme' ? 'Homme' : 'Femme'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.libelle}>Poids (kg)</Text>
              <TextInput
                style={styles.champ}
                value={poids}
                onChangeText={setPoids}
                placeholder="Ex. : 75"
                placeholderTextColor={colors.texteGris}
                keyboardType="numeric"
              />

              <Text style={styles.libelle}>Salle de gym (optionnel)</Text>
              <TextInput
                style={styles.champ}
                value={salle}
                onChangeText={setSalle}
                placeholder="Ex. : Club SP"
                placeholderTextColor={colors.texteGris}
              />
            </>
          )}

          {erreur && <Text style={styles.erreur}>⚠️ {erreur}</Text>}

          <TouchableOpacity style={styles.bouton} onPress={valider} disabled={enCours}>
            {enCours ? (
              <ActivityIndicator color={colors.texte} />
            ) : (
              <Text style={styles.boutonTexte}>
                {mode === 'connexion' ? 'Se connecter'
                  : mode === 'oubli' ? 'Réinitialiser mon mot de passe'
                  : 'Créer mon compte'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'connexion' && (
            <TouchableOpacity onPress={() => { setMode('oubli'); setErreur(null); }}>
              <Text style={styles.lien}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}
          {mode === 'oubli' && (
            <TouchableOpacity onPress={() => { setMode('connexion'); setErreur(null); }}>
              <Text style={styles.lien}>← Retour à la connexion</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: colors.fond },
  scroll: { padding: espacement.l, flexGrow: 1, justifyContent: 'center' },
  titre: { color: colors.texte, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sousTitre: {
    color: colors.or, fontWeight: '700', textAlign: 'center',
    marginTop: 4, marginBottom: espacement.xl,
  },
  selecteur: {
    flexDirection: 'row',
    backgroundColor: colors.carte,
    borderRadius: 12,
    padding: 4,
    marginBottom: espacement.m,
  },
  ongletBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  ongletActif: { backgroundColor: colors.accent },
  ongletTexte: { color: colors.texteGris, fontWeight: '600' },
  ongletTexteActif: { color: colors.texte },
  formulaire: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  libelle: { color: colors.texte, fontWeight: '600', marginBottom: 6, marginTop: espacement.s },
  champ: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: 12,
    color: colors.texte,
  },
  bascule: { flexDirection: 'row', gap: 6 },
  basculeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.carteClaire,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  basculeActif: { borderColor: colors.or },
  basculeTexte: { color: colors.texteGris, fontWeight: '600' },
  basculeTexteActif: { color: colors.or },
  erreur: { color: colors.rouge, marginTop: espacement.m, fontSize: 13 },
  lien: {
    color: colors.or, textAlign: 'center', marginTop: espacement.m,
    fontWeight: '600', fontSize: 13,
  },
  codeSecours: {
    color: colors.or, fontSize: 32, fontWeight: '800', textAlign: 'center',
    letterSpacing: 4, marginVertical: espacement.m,
  },
  explication: { color: colors.texteGris, fontSize: 13, lineHeight: 19 },
  bouton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: espacement.l,
  },
  boutonTexte: { color: colors.texte, fontWeight: '700', fontSize: 16 },
});
