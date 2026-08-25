// Écran Clan : chat entre membres d'une même salle de gym.
// Réservé aux comptes connectés ayant renseigné une salle (le serveur
// vérifie que tu es bien membre de la salle avant de te laisser lire/écrire).
// Pas de WebSocket : la liste des messages se rafraîchit toutes les 4 secondes.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { colors, espacement } from '../theme';
import * as api from '../api';

const DELAI_POLLING_MS = 4000;

export default function ClanScreen({ moi, estConnecte }) {
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [chargement, setChargement] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const intervalleRef = useRef(null);
  const scrollRef = useRef(null);

  const peutDiscuter = estConnecte && !!moi.salle;

  useEffect(() => {
    if (!peutDiscuter) {
      setChargement(false);
      return;
    }
    charger();
    intervalleRef.current = setInterval(charger, DELAI_POLLING_MS);
    return () => clearInterval(intervalleRef.current);
  }, [peutDiscuter, moi.salle]);

  async function charger() {
    try {
      const liste = await api.messagesClan(moi.salle);
      setMessages(liste);
      setErreur(null);
    } catch (e) {
      setErreur(e.message || 'Impossible de charger le chat.');
    } finally {
      setChargement(false);
    }
  }

  async function envoyer() {
    const contenu = texte.trim();
    if (!contenu) return;
    setEnvoiEnCours(true);
    try {
      await api.envoyerMessageClan(moi.salle, contenu);
      setTexte('');
      await charger();
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setErreur(e.message || "Impossible d'envoyer le message.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (!peutDiscuter) {
    return (
      <View style={[styles.conteneur, styles.centre]}>
        <Text style={styles.titre}>💬 Chat de clan</Text>
        <Text style={styles.explication}>
          {!estConnecte
            ? 'Connecte-toi avec un compte pour discuter avec ton clan.'
            : "Renseigne une salle de gym dans ton profil pour rejoindre son clan."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>💬 Clan {moi.salle}</Text>
      <Text style={styles.sousTitre}>Réservé aux membres de ta salle.</Text>

      {chargement ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: espacement.l }} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.listeMessages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 && (
            <Text style={styles.indice}>Aucun message pour l'instant — lance la discussion !</Text>
          )}
          {messages.map((m) => {
            const estMoi = m.pseudo === moi.pseudo;
            return (
              <View key={m.id} style={[styles.bulle, estMoi && styles.bulleMoi]}>
                <Text style={styles.bulleAuteur}>{estMoi ? 'Toi' : m.pseudo}</Text>
                <Text style={styles.bulleTexte}>{m.texte}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {erreur && <Text style={styles.messageErreur}>⚠️ {erreur}</Text>}

      <View style={styles.ligneSaisie}>
        <TextInput
          style={styles.champ}
          value={texte}
          onChangeText={setTexte}
          placeholder="Écris un message…"
          placeholderTextColor={colors.texteGris}
          multiline
        />
        <TouchableOpacity style={styles.boutonEnvoyer} onPress={envoyer} disabled={envoiEnCours}>
          {envoiEnCours ? <ActivityIndicator color={colors.texte} size="small" /> : (
            <Text style={styles.boutonEnvoyerTexte}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: colors.fond, padding: espacement.m },
  centre: { alignItems: 'center', justifyContent: 'center' },
  titre: { color: colors.texte, fontSize: 24, fontWeight: '800' },
  sousTitre: { color: colors.texteGris, fontSize: 13, marginTop: 4, marginBottom: espacement.m },
  explication: { color: colors.texteGris, fontSize: 14, textAlign: 'center', marginTop: espacement.s },
  indice: { color: colors.texteGris, fontSize: 13, textAlign: 'center', marginTop: espacement.l },
  listeMessages: { flex: 1 },
  bulle: {
    backgroundColor: colors.carte,
    borderRadius: 14,
    padding: espacement.s,
    marginBottom: espacement.s,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  bulleMoi: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  bulleAuteur: { color: colors.or, fontWeight: '700', fontSize: 12, marginBottom: 2 },
  bulleTexte: { color: colors.texte, fontSize: 14 },
  messageErreur: { color: colors.rouge, fontSize: 12, marginTop: espacement.s },
  ligneSaisie: { flexDirection: 'row', alignItems: 'flex-end', marginTop: espacement.s, gap: 8 },
  champ: {
    flex: 1,
    backgroundColor: colors.carte,
    borderRadius: 14,
    padding: 12,
    color: colors.texte,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  boutonEnvoyer: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonEnvoyerTexte: { color: colors.texte, fontWeight: '800', fontSize: 18 },
});
