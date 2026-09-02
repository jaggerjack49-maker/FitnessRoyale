// Écran Clan : TOUT ce qui touche à la salle de gym.
// Depuis le 01/09/2026 (demande de Hafiz : « ma salle doit être réservé à la
// partie clan »), il porte trois choses :
//  - MA SALLE : le champ où l'on choisit sa salle. Il vivait au Profil ; il
//    est ici parce que la salle EST le clan. Il est maintenant enregistré
//    CÔTÉ SERVEUR (api.changerSalle) : tant qu'il ne l'était pas, changer de
//    salle dans l'app faisait répondre 403 au chat.
//  - LES MEMBRES : le classement des joueurs de ma salle.
//  - LE CHAT : réservé aux membres (le serveur vérifie l'appartenance).
// Pas de WebSocket : les messages se rafraîchissent toutes les 4 secondes.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { colors, espacement } from '../theme';
import { classer, ligueJoueur } from '../logic/classement';
import { couleursLigues } from '../data/clubSP';
import { areneDeLaLigue } from '../data/arenes';
import AvatarJoueur from '../components/AvatarJoueur';
import * as api from '../api';

const DELAI_POLLING_MS = 4000;

export default function ClanScreen({ moi, joueurs, salle, setSalle, estConnecte }) {
  const [vue, setVue] = useState('membres'); // 'membres' | 'chat'
  const [salleSaisie, setSalleSaisie] = useState(salle || '');
  const [enregistrementSalle, setEnregistrementSalle] = useState(false);
  const [messageSalle, setMessageSalle] = useState(null);
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

  // Enregistre ma salle. En ligne, on l'envoie au serveur : le chat et le
  // classement des membres s'appuient sur la salle enregistrée LÀ-BAS.
  async function enregistrerSalle() {
    const nouvelle = salleSaisie.trim();
    setMessageSalle(null);
    setEnregistrementSalle(true);
    try {
      if (estConnecte) await api.changerSalle(moi.id, nouvelle);
      setSalle(nouvelle);
      setMessageSalle({
        texte: nouvelle
          ? `Tu fais maintenant partie de « ${nouvelle} ».`
          : 'Tu ne fais plus partie d\'une salle.',
        erreur: false,
      });
    } catch (e) {
      setMessageSalle({ texte: e.message || 'Enregistrement impossible.', erreur: true });
    } finally {
      setEnregistrementSalle(false);
    }
  }

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

  // La carte « ma salle » : toujours affichée, c'est la porte d'entrée du clan.
  const carteSalle = (
    <View style={styles.carteSalle}>
      <Text style={styles.carteTitre}>🏠 Ma salle de gym</Text>
      <Text style={styles.explicationGauche}>
        Ta salle EST ton clan : elle ouvre le chat, le classement de ses membres
        et le classement des salles dans Compétition.
      </Text>
      <View style={styles.ligneSalle}>
        <TextInput
          style={styles.champSalle}
          value={salleSaisie}
          onChangeText={setSalleSaisie}
          placeholder="Nom de ta salle…"
          placeholderTextColor={colors.texteGris}
        />
        <TouchableOpacity
          style={styles.boutonSalle}
          onPress={enregistrerSalle}
          disabled={enregistrementSalle || salleSaisie.trim() === (salle || '').trim()}
        >
          {enregistrementSalle ? <ActivityIndicator color={colors.texte} size="small" /> : (
            <Text style={styles.boutonSalleTexte}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>
      {messageSalle && (
        <Text style={[styles.messageSalle, messageSalle.erreur && { color: colors.rouge }]}>
          {messageSalle.texte}
        </Text>
      )}
    </View>
  );

  if (!peutDiscuter) {
    return (
      <ScrollView style={styles.conteneur} contentContainerStyle={{ paddingBottom: espacement.l }}>
        <Text style={styles.titre}>💬 Clan</Text>
        <Text style={styles.sousTitre}>
          {!estConnecte
            ? 'Connecte-toi avec un compte pour rejoindre un clan.'
            : 'Choisis ta salle pour rejoindre son clan.'}
        </Text>
        {carteSalle}
      </ScrollView>
    );
  }

  // ---- Les membres de ma salle, classés comme partout ailleurs dans l'app :
  // au palier moyen (`classer` fait déjà le tri et pose le rang `moi`). ----
  const membres = classer(
    (joueurs || []).filter((j) => (j.salle || '').trim() === (moi.salle || '').trim()),
    'global'
  );

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>💬 Clan {moi.salle}</Text>
      <Text style={styles.sousTitre}>Réservé aux membres de ta salle.</Text>

      <View style={styles.bascule}>
        {[
          { cle: 'membres', libelle: `🏆 Membres (${membres.length})` },
          { cle: 'chat', libelle: '💬 Chat' },
        ].map((v) => (
          <TouchableOpacity
            key={v.cle}
            style={[styles.basculeBtn, vue === v.cle && styles.basculeActif]}
            onPress={() => setVue(v.cle)}
          >
            <Text style={[styles.basculeTexte, vue === v.cle && styles.basculeTexteActif]}>
              {v.libelle}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {vue === 'membres' && (
        <ScrollView contentContainerStyle={{ paddingBottom: espacement.l }}>
          {carteSalle}
          <Text style={styles.explicationGauche}>
            Les membres de ta salle, classés sur leurs performances vérifiées —
            mêmes règles que le classement global.
          </Text>
          {membres.length === 0 && (
            <Text style={styles.indice}>Personne dans cette salle pour l'instant.</Text>
          )}
          {membres.map((j, i) => {
            const ligue = ligueJoueur(j);
            const couleur = couleursLigues[ligue] || colors.texteGris;
            return (
              <View key={j.pseudo} style={[styles.ligneMembre, j.moi && styles.ligneMembreMoi]}>
                <Text style={styles.rangMembre}>{i + 1}</Text>
                <AvatarJoueur pseudo={j.pseudo} ligue={ligue} taille={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nomMembre, j.moi && { color: colors.or }]} numberOfLines={1}>
                    {j.pseudo}{j.moi ? ' (toi)' : ''}
                  </Text>
                  {/* Nom d'ARÈNE, jamais de ligue : un seul vocabulaire à l'écran. */}
                  <Text style={[styles.areneMembre, { color: couleur }]}>
                    {areneDeLaLigue(ligue).nom}
                  </Text>
                </View>
                <Text style={styles.pointsMembre}>{j.points ?? 0} pts</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {vue === 'chat' && (chargement ? (
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
      ))}

      {vue === 'chat' && erreur && <Text style={styles.messageErreur}>⚠️ {erreur}</Text>}

      {vue === 'chat' && (
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
      )}
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
  explicationGauche: { color: colors.texteGris, fontSize: 12, lineHeight: 17, marginBottom: espacement.s },
  carteSalle: {
    backgroundColor: colors.carte, borderRadius: 14, padding: espacement.m,
    borderWidth: 1, borderColor: colors.bordure, marginBottom: espacement.m,
  },
  carteTitre: { color: colors.texte, fontWeight: '700', marginBottom: espacement.s },
  ligneSalle: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  champSalle: {
    flex: 1, backgroundColor: colors.carteClaire, borderRadius: 10, padding: 10,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure,
  },
  boutonSalle: {
    backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 11,
    paddingHorizontal: 14, alignItems: 'center',
  },
  boutonSalleTexte: { color: colors.texte, fontWeight: '700', fontSize: 12 },
  messageSalle: { color: colors.vert, fontSize: 12, marginTop: 6 },
  bascule: { flexDirection: 'row', gap: 8, marginBottom: espacement.m },
  basculeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
  },
  basculeActif: { backgroundColor: colors.accent, borderColor: colors.accent },
  basculeTexte: { color: colors.texteGris, fontWeight: '700', fontSize: 12 },
  basculeTexteActif: { color: colors.texte },
  ligneMembre: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.s,
    marginBottom: 6, borderWidth: 1, borderColor: colors.bordure,
  },
  ligneMembreMoi: { borderColor: colors.or },
  rangMembre: { color: colors.texteGris, fontWeight: '800', width: 22, textAlign: 'center' },
  nomMembre: { color: colors.texte, fontWeight: '700', fontSize: 14 },
  areneMembre: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  pointsMembre: { color: colors.texteGris, fontSize: 11 },
});
