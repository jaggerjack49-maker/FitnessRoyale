// PANNEAU MODE TEST — visible UNIQUEMENT sur un compte administrateur.
//
// Sert à tester le RANKING sans saisir 15 exercices à la main : se placer à un
// palier, remplir le classement de joueurs factices, ajuster ses points.
//
// Le drapeau `admin` vient du serveur (`joueur.admin`) et ne s'active qu'en
// base — ce panneau n'apparaît donc jamais chez un joueur normal, et même s'il
// y accédait, le serveur refuserait chaque appel (403).
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, espacement } from '../theme';
import { da, monospace } from '../designSystem';
import { arenes } from '../data/arenes';
import * as api from '../api';

export default function PanneauModeTest({ onChangement }) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null); // { texte, erreur }

  const [nbExercices, setNbExercices] = useState('');
  const [points, setPoints] = useState('');
  const [nbJoueurs, setNbJoueurs] = useState('8');

  async function lancer(action, libelleSucces) {
    setEnCours(true);
    setMessage(null);
    try {
      const resultat = await action();
      setMessage({ texte: libelleSucces(resultat), erreur: false });
      onChangement?.(); // recharge le profil et le classement
    } catch (e) {
      setMessage({ texte: e.message || 'Action impossible.', erreur: true });
    } finally {
      setEnCours(false);
    }
  }

  function nombreOuNull(valeur) {
    const n = parseInt(valeur, 10);
    return isNaN(n) ? null : n;
  }

  return (
    <View style={styles.carte}>
      <TouchableOpacity onPress={() => setOuvert(!ouvert)}>
        <Text style={styles.titre}>🛠 MODE TEST {ouvert ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {ouvert && (
        <>
          <Text style={styles.avertissement}>
            Compte administrateur. Ces actions modifient de VRAIES données —
            elles servent à tester le classement, pas à jouer.
          </Text>

          {/* ---- Me placer à un palier ---- */}
          <Text style={styles.libelle}>ME PLACER À UN PALIER</Text>
          <Text style={styles.indice}>
            Remplit mes perfs, déjà vérifiées. Le nombre d'exercices compte
            autant que le palier : la moyenne se calcule sur les 15 du barème.
          </Text>
          <TextInput
            style={styles.champ}
            value={nbExercices}
            onChangeText={setNbExercices}
            keyboardType="numeric"
            placeholder="Sur combien d'exercices ? (vide = les 15)"
            placeholderTextColor={colors.texteGris}
          />
          {/* Les boutons portent les noms d'ARÈNES (ceux que l'app affiche
              partout), pas les noms de ligues internes : cliquer « Titan »
              alors qu'on arrivait dans l'arène OLYMPE était déroutant.
              arene.index 1-6 correspond exactement au palier à remplir. */}
          <View style={styles.grillePaliers}>
            {arenes.filter((a) => a.index > 0).map((arene) => (
              <TouchableOpacity
                key={arene.index}
                style={styles.boutonPalier}
                disabled={enCours}
                onPress={() => lancer(
                  () => api.adminRemplirMesPerfs(arene.index, nombreOuNull(nbExercices)),
                  (r) => `${arene.embleme} ${arene.nom} → ${r.perfs_ecrites} perfs`
                )}
              >
                <Text style={styles.boutonPalierTexte}>{arene.embleme} {arene.nom}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.boutonPalier, styles.boutonDanger]}
              disabled={enCours}
              onPress={() => lancer(
                () => api.adminRemplirMesPerfs(0),
                (r) => `${r.perfs_effacees} perfs effacées`
              )}
            >
              <Text style={[styles.boutonPalierTexte, { color: colors.rouge }]}>Effacer</Text>
            </TouchableOpacity>
          </View>

          {/* ---- Mes points (départage au classement) ---- */}
          <Text style={styles.libelle}>MES POINTS DE COMPÉTITION</Text>
          <Text style={styles.indice}>
            Ils départagent les égalités de palier moyen — utile pour tester
            deux joueurs au même niveau.
          </Text>
          <View style={styles.ligne}>
            <TextInput
              style={[styles.champ, { flex: 1 }]}
              value={points}
              onChangeText={setPoints}
              keyboardType="numeric"
              placeholder="Ex. : 500"
              placeholderTextColor={colors.texteGris}
            />
            <TouchableOpacity
              style={styles.bouton}
              disabled={enCours}
              onPress={() => lancer(
                () => api.adminFixerMesPoints(nombreOuNull(points) ?? 0),
                (r) => `Points fixés à ${r.points}`
              )}
            >
              <Text style={styles.boutonTexte}>Fixer</Text>
            </TouchableOpacity>
          </View>

          {/* ---- Remplir le classement ---- */}
          <Text style={styles.libelle}>REMPLIR LE CLASSEMENT</Text>
          <Text style={styles.indice}>
            Crée des joueurs factices (préfixe TEST-) à des niveaux variés.
            Sans mot de passe : personne ne peut s'y connecter.
          </Text>
          <View style={styles.ligne}>
            <TextInput
              style={[styles.champ, { width: 70 }]}
              value={nbJoueurs}
              onChangeText={setNbJoueurs}
              keyboardType="numeric"
              placeholder="8"
              placeholderTextColor={colors.texteGris}
            />
            <TouchableOpacity
              style={styles.bouton}
              disabled={enCours}
              onPress={() => lancer(
                () => api.adminGenererJoueurs(nombreOuNull(nbJoueurs) ?? 8, 1, 6, 'homme'),
                (r) => `${r.crees} joueurs de test créés`
              )}
            >
              <Text style={styles.boutonTexte}>Générer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bouton, styles.boutonDanger]}
              disabled={enCours}
              onPress={() => lancer(
                () => api.adminSupprimerJoueursTest(),
                (r) => `${r.supprimes} joueurs de test supprimés`
              )}
            >
              <Text style={[styles.boutonTexte, { color: colors.rouge }]}>Tout supprimer</Text>
            </TouchableOpacity>
          </View>

          {enCours && <ActivityIndicator color={colors.or} style={{ marginTop: espacement.s }} />}
          {message && (
            <Text style={[styles.message, message.erreur && { color: colors.rouge }]}>
              {message.texte}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: da.carteBasse,
    borderWidth: 1,
    borderColor: colors.rouge,
    borderRadius: 16,
    padding: espacement.m,
    marginTop: espacement.m,
  },
  titre: { color: colors.rouge, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
  avertissement: {
    color: da.texteMuet, fontSize: 11, lineHeight: 16, marginTop: espacement.s,
  },
  libelle: {
    color: colors.texte, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
    marginTop: espacement.m,
  },
  indice: { color: da.texteMuet, fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 6 },
  champ: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: 11,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure, fontSize: 13,
  },
  ligne: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  grillePaliers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  boutonPalier: {
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12,
  },
  boutonPalierTexte: { color: colors.texte, fontWeight: '700', fontSize: 12 },
  bouton: {
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.or,
    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14,
  },
  boutonTexte: { color: colors.or, fontWeight: '800', fontSize: 12 },
  boutonDanger: { borderColor: colors.rouge },
  message: { color: colors.vert, fontSize: 12, marginTop: espacement.s, fontFamily: monospace },
});
