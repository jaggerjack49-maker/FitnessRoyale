// Écran de connexion / inscription — OBLIGATOIRE pour utiliser l'app (chaque
// joueur a un compte protégé par mot de passe).
// Si le serveur est injoignable, App.js ne montre pas cet écran mais celui qui
// l'annonce, avec un bouton « Réessayer » : depuis le 26/09/2026 il n'y a plus
// de mode hors-ligne derrière.
//
// DIRECTION ARTISTIQUE (08/11/2026, demande de Hafiz : « la page de création
// du compte doit correspondre à la DA »). L'écran restait dans l'ancienne
// palette — bouton et onglet actif en CYAN, libellés en casse normale. Il
// reprend désormais :
//  - le fond quasi noir de l'app, avec une LUEUR DORÉE derrière le logo.
//    ⚠️ Un premier jet reprenait l'illustration de l'écran de chargement : elle
//    contient déjà un grand logo PEINT, et le logo de l'écran se posait dessus
//    (deux logos superposés, et leur décalage changeait avec la taille de
//    l'écran). Le fond uni ne dépend d'aucun format d'écran ;
//  - le LOGO de l'app (`assets/logo-connexion.png`, version légère de l'icône
//    fabriquée par scripts/generer_icone.py) et le slogan entre deux losanges ;
//  - le sélecteur en CAPSULE de la barre d'onglets (pastille or voilé) ;
//  - les libellés en petites capitales espacées et le grand bouton OR plein
//    du formulaire « NOUVELLE PERF ».
// La logique (validation, appels serveur, code de secours) n'a pas bougé.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors, espacement } from '../theme';
import { da, monospace } from '../designSystem';
import * as api from '../api';
import { Icone, TexteIcone } from '../components/Icones';
import Losange from '../components/Losange';

const LOGO = require('../../assets/logo-connexion.png');

// Le fond, la lueur, le logo et la colonne centrée, communs aux deux écrans
// (le formulaire et « Compte créé »).
function Decor({ children }) {
  return (
    <View style={styles.fond}>
      {/* La lueur dorée : un dégradé RADIAL qui s'éteint progressivement (un
          aplat rond laisserait un contour net — le « cercle » déjà corrigé sur
          l'arène le 27/08/2026). */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id="lueurConnexion" cx="50%" cy="18%" r="60%">
            <Stop offset="0%" stopColor={colors.or} stopOpacity="0.22" />
            <Stop offset="45%" stopColor={colors.or} stopOpacity="0.06" />
            <Stop offset="100%" stopColor={colors.or} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lueurConnexion)" />
      </Svg>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.colonne}>
            <Image source={LOGO} style={styles.logo} accessibilityLabel="Fitness Royale" />
            <View style={styles.ligneSlogan}>
              <Losange couleur={colors.or} taille={7} />
              <Text style={styles.slogan}>FIGHT FOR IT</Text>
              <Losange couleur={colors.or} taille={7} />
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Un champ avec son libellé en petites capitales, au-dessus.
function Champ({ libelle, ...props }) {
  return (
    <>
      <Text style={styles.libelle}>{libelle}</Text>
      <TextInput style={styles.champ} placeholderTextColor={colors.texteGris} {...props} />
    </>
  );
}

// Le titre de la carte selon le mode : un mot en or, comme partout dans la DA.
const TITRES = {
  connexion: ['CONTENT DE TE ', 'REVOIR'],
  inscription: ['REJOINS ', "L'ARÈNE"],
  oubli: ['MOT DE PASSE ', 'OUBLIÉ'],
};

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

  function changerMode(nouveau) {
    setMode(nouveau);
    setErreur(null);
  }

  // Écran intermédiaire post-inscription : le code de secours, affiché une
  // seule fois (le serveur n'en garde qu'une empreinte, impossible de le revoir).
  if (inscriptionReussie) {
    return (
      <Decor>
        <View style={styles.formulaire}>
          <View style={styles.ligneReussite}>
            <Icone nom="valide" taille={20} couleur={colors.vert} />
            <Text style={[styles.titreCarte, { marginBottom: 0 }]}>
              COMPTE <Text style={{ color: colors.or }}>CRÉÉ</Text>
            </Text>
          </View>
          <Text style={styles.libelle}>TON CODE DE SECOURS</Text>
          <View style={styles.cadreCode}>
            <Text style={styles.codeSecours}>{inscriptionReussie.code}</Text>
          </View>
          <Text style={styles.explication}>
            Note-le précieusement (photo, carnet…) : c'est la SEULE façon de
            récupérer ton compte si tu oublies ton mot de passe. Il ne sera
            plus jamais affiché.
          </Text>
          <TouchableOpacity
            style={styles.bouton}
            onPress={() => onConnecte(inscriptionReussie.token, inscriptionReussie.joueur)}
          >
            <Text style={styles.boutonTexte}>C'EST NOTÉ, ENTRER</Text>
          </TouchableOpacity>
        </View>
      </Decor>
    );
  }

  return (
    <Decor>
      {mode !== 'oubli' && (
        <View style={styles.selecteur}>
          {[['connexion', 'Se connecter'], ['inscription', 'Créer un compte']].map(([cle, libelle]) => (
            <TouchableOpacity
              key={cle}
              style={[styles.ongletBtn, mode === cle && styles.ongletActif]}
              onPress={() => changerMode(cle)}
            >
              <Text style={[styles.ongletTexte, mode === cle && styles.ongletTexteActif]}>
                {libelle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.formulaire}>
        <Text style={styles.titreCarte}>
          {TITRES[mode][0]}<Text style={{ color: colors.or }}>{TITRES[mode][1]}</Text>
        </Text>
        {mode === 'oubli' && (
          <Text style={styles.explication}>
            Ton pseudo, le code de secours noté à l'inscription, puis ton
            nouveau mot de passe.
          </Text>
        )}

        <Champ
          libelle="PSEUDO"
          value={pseudo}
          onChangeText={setPseudo}
          placeholder="Ex. : Hafiz"
          autoCapitalize="none"
        />

        {mode === 'oubli' && (
          <Champ
            libelle="CODE DE SECOURS"
            value={codeSecours}
            onChangeText={setCodeSecours}
            placeholder="Ex. : K7XPQR2M"
            autoCapitalize="characters"
          />
        )}

        <Champ
          libelle={mode === 'oubli' ? 'NOUVEAU MOT DE PASSE' : 'MOT DE PASSE'}
          value={motDePasse}
          onChangeText={setMotDePasse}
          placeholder="Au moins 4 caractères"
          secureTextEntry
        />

        {mode === 'inscription' && (
          <>
            <Text style={styles.libelle}>SEXE · POUR LE BARÈME</Text>
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

            <Champ
              libelle="POIDS (KG)"
              value={poids}
              onChangeText={setPoids}
              placeholder="Ex. : 75"
              keyboardType="numeric"
            />

            <Champ
              libelle="SALLE DE GYM · FACULTATIF"
              value={salle}
              onChangeText={setSalle}
              placeholder="Ex. : Titan Gym"
            />
          </>
        )}

        {erreur ? (
          <TexteIcone nom="alerte" taille={14} hautAligne style={styles.erreur}>{erreur}</TexteIcone>
        ) : null}

        <TouchableOpacity style={styles.bouton} onPress={valider} disabled={enCours}>
          {enCours ? (
            <ActivityIndicator color={da.orSombre} />
          ) : (
            <Text style={styles.boutonTexte}>
              {mode === 'connexion' ? 'SE CONNECTER'
                : mode === 'oubli' ? 'RÉINITIALISER'
                : 'CRÉER MON COMPTE'}
            </Text>
          )}
        </TouchableOpacity>

        {mode === 'connexion' && (
          <TouchableOpacity style={styles.zoneLien} onPress={() => changerMode('oubli')}>
            <Text style={styles.lien}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        )}
        {mode === 'oubli' && (
          <TouchableOpacity style={styles.zoneLien} onPress={() => changerMode('connexion')}>
            <Text style={styles.lien}>‹ Retour à la connexion</Text>
          </TouchableOpacity>
        )}
      </View>
    </Decor>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, width: '100%', height: '100%', backgroundColor: colors.fond },
  scroll: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: espacement.m, paddingVertical: espacement.xl,
  },
  // Bornée sur grand écran et centrée : un formulaire de 1 000 px de large
  // n'a plus rien d'un écran de connexion.
  colonne: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  logo: {
    width: 104, height: 104, borderRadius: 24, alignSelf: 'center',
    borderWidth: 1, borderColor: da.bordureOr,
    shadowColor: colors.or, shadowOpacity: 0.35, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  ligneSlogan: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: espacement.m, marginBottom: espacement.l,
  },
  slogan: { color: colors.or, fontWeight: '900', fontSize: 12, letterSpacing: 4 },
  // Le sélecteur reprend la CAPSULE de la barre d'onglets.
  selecteur: {
    flexDirection: 'row', backgroundColor: colors.carte, borderRadius: 999,
    padding: 4, borderWidth: 1, borderColor: colors.bordure, marginBottom: espacement.m,
  },
  ongletBtn: {
    flex: 1, minHeight: 42, justifyContent: 'center', borderRadius: 999, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  ongletActif: { backgroundColor: da.orVoileFort, borderColor: da.bordureOrDouce },
  ongletTexte: { color: colors.texteGris, fontWeight: '700', fontSize: 13 },
  ongletTexteActif: { color: colors.or },
  formulaire: {
    backgroundColor: colors.carte, borderRadius: 18, padding: espacement.l,
    borderWidth: 1, borderColor: colors.bordure,
  },
  titreCarte: {
    color: colors.texte, fontSize: 20, fontWeight: '900', letterSpacing: 0.5,
    marginBottom: espacement.s,
  },
  ligneReussite: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: espacement.s },
  libelle: {
    color: colors.texteGris, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
    marginTop: espacement.m, marginBottom: 6,
  },
  champ: {
    backgroundColor: da.surfaceAlt, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14,
    color: colors.texte, fontSize: 15, borderWidth: 1, borderColor: colors.bordure,
  },
  bascule: { flexDirection: 'row', gap: 8 },
  basculeBtn: {
    flex: 1, minHeight: 46, justifyContent: 'center', borderRadius: 12, alignItems: 'center',
    backgroundColor: da.surfaceAlt, borderWidth: 1, borderColor: colors.bordure,
  },
  basculeActif: { borderColor: colors.or, backgroundColor: da.orVoile },
  basculeTexte: { color: colors.texteGris, fontWeight: '700' },
  basculeTexteActif: { color: colors.or },
  erreur: { color: colors.rouge, marginTop: espacement.m, fontSize: 13 },
  zoneLien: { minHeight: 44, justifyContent: 'center', marginTop: espacement.s },
  lien: { color: colors.or, textAlign: 'center', fontWeight: '700', fontSize: 13 },
  cadreCode: {
    borderWidth: 1, borderColor: da.bordureOr, backgroundColor: da.orVoile,
    borderRadius: 14, paddingVertical: espacement.m, marginBottom: espacement.m,
  },
  codeSecours: {
    color: colors.or, fontFamily: monospace, fontSize: 30, fontWeight: '900',
    textAlign: 'center', letterSpacing: 4,
  },
  explication: { color: colors.texteDoux, fontSize: 13, lineHeight: 19 },
  // Le grand bouton OR plein, comme « ENREGISTRER LA PERF ».
  bouton: {
    backgroundColor: colors.or, borderRadius: 14, minHeight: 52, justifyContent: 'center',
    alignItems: 'center', marginTop: espacement.l,
    shadowColor: colors.or, shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  boutonTexte: { color: da.orSombre, fontWeight: '900', fontSize: 15, letterSpacing: 1.5 },
});
