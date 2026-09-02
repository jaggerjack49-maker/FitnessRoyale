// Écran Performances : ajouter ses perfs et suivre leur vérification.
// 3 statuts : 📝 Déclaré → 👥 Vérifié communauté (vidéo) → 🏋️ Vérifié salle.
// Si l'utilisateur est affilié à une salle partenaire, ses perfs sont
// validées automatiquement dès l'ajout.
//
// VALIDATION COMMUNAUTÉ (compte connecté) : on joint une VRAIE vidéo (choisie
// dans la pellicule du téléphone) à une perf non vérifiée. Elle attend alors
// qu'un AUTRE joueur la valide ou la refuse (voir plus bas "Vidéos à
// valider") — le premier vote décide, voir CLAUDE.md pour la règle exacte.
//
// DEUX AUTRES FAÇONS DE VALIDER SANS VIDÉO (voir "Validation sans vidéo"
// dans CLAUDE.md) : un CODE partagé avec un partenaire de salle présent
// (comme les duels en ligne — il le saisit sur son téléphone pour confirmer
// en direct, statut "salle"), ou un VOTE DE CONFIANCE de n'importe quel
// autre joueur, sans preuve jointe (statut "communauté").
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { colors, espacement } from '../theme';
import { baremes, nomsLigues, couleursLigues } from '../data/clubSP';
import { STATUTS, estVerifiee } from '../data/statuts';
import { palierExercice } from '../logic/classement';
import * as api from '../api';

const DELAI_RAFRAICHISSEMENT_MS = 10000;

export default function PerformancesScreen({ moi, mesPerfs, ajouterPerf, validerPerf, estConnecte }) {
  const [exerciceChoisi, setExerciceChoisi] = useState(null);
  const [valeur, setValeur] = useState('');
  const [listeOuverte, setListeOuverte] = useState(false);

  // Upload vidéo (compte connecté uniquement).
  const [videosEnvoyees, setVideosEnvoyees] = useState({}); // { exercice: true } — envoyées cette session
  const [envoiEnCours, setEnvoiEnCours] = useState(null); // nom de l'exercice en cours d'envoi
  const [erreurVideo, setErreurVideo] = useState(null);

  // Vidéos des AUTRES joueurs en attente d'un vote.
  const [videosAValider, setVideosAValider] = useState([]);
  const [chargementVideos, setChargementVideos] = useState(false);

  // Validation par CODE partenaire (sans vidéo).
  const [codeGenere, setCodeGenere] = useState(null); // { exercice, code } | null
  const [genererCodeEnCours, setGenererCodeEnCours] = useState(null); // exercice en cours
  // MODE TEST (admin) : exercice en cours d'auto-validation.
  const [validationAdminEnCours, setValidationAdminEnCours] = useState(null);
  const [codeSaisi, setCodeSaisi] = useState('');
  const [validationEnCours, setValidationEnCours] = useState(false);
  const [messageValidation, setMessageValidation] = useState(null);

  const [enregistreesOuvertes, setEnregistreesOuvertes] = useState(false);

  const listeExercices = Object.keys(baremes[moi.sexe]);
  // Résumé affiché sans déplier : « 4 vérifiées sur 11 saisies ».
  const nbPerfs = Object.keys(mesPerfs).length;
  const nbVerifiees = Object.values(mesPerfs).filter(estVerifiee).length;
  const bareme = exerciceChoisi ? baremes[moi.sexe][exerciceChoisi] : null;

  useEffect(() => {
    if (!estConnecte) return;
    chargerVideosAValider();
    // Pas de WebSocket (voir CLAUDE.md) : on re-consulte le serveur
    // régulièrement pour voir apparaître les nouvelles vidéos/perfs des autres
    // (silencieux = pas de spinner, pour ne pas faire clignoter la liste).
    const id = setInterval(() => chargerVideosAValider(true), DELAI_RAFRAICHISSEMENT_MS);
    return () => clearInterval(id);
  }, [estConnecte]);

  async function chargerVideosAValider(silencieux) {
    if (!silencieux) setChargementVideos(true);
    try {
      const liste = await api.videosEnAttente();
      setVideosAValider(liste);
    } catch {
      // Pas grave : la liste reste vide, on pourra réessayer plus tard.
    } finally {
      setChargementVideos(false);
    }
  }

  function soumettrePerf() {
    const nombre = parseFloat(valeur.replace(',', '.'));
    if (!exerciceChoisi || isNaN(nombre) || nombre <= 0) return;
    // Affilié à une salle partenaire → validation automatique.
    ajouterPerf(exerciceChoisi, nombre, moi.affilieSalle ? 'salle' : 'non_verifie');
    setExerciceChoisi(null);
    setValeur('');
    setListeOuverte(false);
  }

  // Simulation locale (mode hors-ligne uniquement, voir estConnecte plus bas).
  function validerParCommunaute(exo) {
    validerPerf(exo);
  }

  // Choisit une vidéo dans la pellicule et l'envoie au serveur pour cette perf.
  async function choisirEtEnvoyerVideo(exercice) {
    setErreurVideo(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErreurVideo("Autorise l'accès à tes vidéos pour pouvoir en envoyer une.");
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
    });
    if (resultat.canceled || !resultat.assets?.[0]) return;
    setEnvoiEnCours(exercice);
    try {
      await api.joindreVideo(moi.id, exercice, resultat.assets[0].uri);
      setVideosEnvoyees((v) => ({ ...v, [exercice]: true }));
    } catch (e) {
      setErreurVideo(e.message || "Impossible d'envoyer la vidéo.");
    } finally {
      setEnvoiEnCours(null);
    }
  }

  async function voter(videoId, valide) {
    try {
      await api.voterVideo(videoId, valide);
      setVideosAValider((liste) => liste.filter((v) => v.id !== videoId));
    } catch (e) {
      setErreurVideo(e.message || 'Vote impossible.');
    }
  }

  // MODE TEST : l'admin valide sa propre perf sans passer par un autre joueur.
  // Le serveur refuse (403) si le compte n'est pas administrateur.
  async function validerAdmin(exercice) {
    setErreurVideo(null);
    setValidationAdminEnCours(exercice);
    try {
      await api.verifierPerformance(moi.id, exercice, 'communaute');
      validerPerf(exercice); // met à jour l'affichage tout de suite
    } catch (e) {
      setErreurVideo(e.message || 'Validation impossible.');
    } finally {
      setValidationAdminEnCours(null);
    }
  }

  // Génère un code à partager avec un partenaire PRÉSENT (voir CLAUDE.md).
  async function genererCode(exercice) {
    setErreurVideo(null);
    setGenererCodeEnCours(exercice);
    try {
      const resultat = await api.creerCodeValidation(moi.id, exercice);
      setCodeGenere(resultat);
    } catch (e) {
      setErreurVideo(e.message || 'Impossible de générer un code.');
    } finally {
      setGenererCodeEnCours(null);
    }
  }

  // Saisie du code reçu d'un partenaire (valide SA perf, pas la mienne).
  async function validerAvecCode() {
    if (!codeSaisi.trim()) return;
    setValidationEnCours(true);
    setMessageValidation(null);
    setErreurVideo(null);
    try {
      const resultat = await api.rejoindreValidation(codeSaisi.trim());
      setMessageValidation(`✅ Perf de ${resultat.pseudo} (${resultat.exercice}) validée !`);
      setCodeSaisi('');
    } catch (e) {
      setErreurVideo(e.message || 'Code invalide.');
    } finally {
      setValidationEnCours(false);
    }
  }

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
      {/* L'emoji 📊 a été remplacé le 26/08/2026 par le badge dessiné fourni
          par Hafiz (icones/ → assets/icones/perfs.png). Titre et image sont
          alignés sur la même ligne pour garder la mise en page des autres
          écrans. */}
      <View style={styles.ligneTitre}>
        <Image source={require('../../assets/icones/perfs.png')} style={styles.iconeTitre} />
        <Text style={styles.titre}>Mes performances</Text>
      </View>
      <Text style={styles.sousTitre}>
        {moi.affilieSalle
          ? '🏋️ Affilié salle partenaire : tes perfs sont validées automatiquement.'
          : 'Non affilié : fais vérifier tes perfs par vidéo, par un partenaire (code), ou par un vote de confiance.'}
      </Text>

      {/* ---- Formulaire d'ajout ---- */}
      <View style={styles.formulaire}>
        <Text style={styles.libelle}>Exercice</Text>
        <TouchableOpacity style={styles.selecteurExo} onPress={() => setListeOuverte(!listeOuverte)}>
          <Text style={{ color: exerciceChoisi ? colors.texte : colors.texteGris }}>
            {exerciceChoisi || 'Choisir un exercice…'}
          </Text>
          <Text style={{ color: colors.texteGris }}>{listeOuverte ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {listeOuverte &&
          listeExercices.map((exo) => (
            <TouchableOpacity
              key={exo}
              style={styles.choixExo}
              onPress={() => { setExerciceChoisi(exo); setListeOuverte(false); }}
            >
              <Text style={{ color: colors.texte }}>{exo}</Text>
            </TouchableOpacity>
          ))}

        {bareme && (
          <Text style={styles.indice}>
            {bareme.unite === 'kg'
              ? `Charge en kg pour ${bareme.reps} répétitions`
              : 'Nombre de répétitions au poids du corps'}
          </Text>
        )}

        <Text style={styles.libelle}>{bareme && bareme.unite === 'reps' ? 'Répétitions' : 'Charge (kg)'}</Text>
        <TextInput
          style={styles.champ}
          value={valeur}
          onChangeText={setValeur}
          keyboardType="numeric"
          placeholder="Ex. : 100"
          placeholderTextColor={colors.texteGris}
        />

        <TouchableOpacity style={styles.boutonAjouter} onPress={soumettrePerf}>
          <Text style={styles.boutonAjouterTexte}>➕ Ajouter ma performance</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Les 3 paliers de vérification ---- */}
      <View style={styles.cartePaliers}>
        {Object.values(STATUTS).map((s) => (
          <View key={s.libelle} style={styles.lignePalier}>
            <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
            <Text style={[styles.palierTexte, { color: s.couleur }]}>{s.libelle}</Text>
          </View>
        ))}
        <Text style={styles.indice}>Déclaré = suivi perso. Seules les perfs vérifiées comptent au classement.</Text>
      </View>

      {/* ---- Liste des performances ---- */}
      {/* REPLIÉE PAR DÉFAUT (01/09/2026, « réduis l'onglet enregistrées ») :
          la liste fait jusqu'à 15 lignes, chacune avec ses boutons de
          validation — elle repoussait tout le reste de l'écran très bas.
          Même en-tête cliquable que « Mes performances » au Profil, avec un
          résumé chiffré visible sans déplier. */}
      <TouchableOpacity
        style={styles.enteteRepliable}
        onPress={() => setEnregistreesOuvertes(!enregistreesOuvertes)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitreRepliable}>Enregistrées</Text>
          <Text style={styles.resumeRepliable}>
            {nbVerifiees} vérifiée{nbVerifiees > 1 ? 's' : ''} sur {nbPerfs} saisie
            {nbPerfs > 1 ? 's' : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{enregistreesOuvertes ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {enregistreesOuvertes && Object.entries(mesPerfs).map(([exo, perf]) => {
        const st = STATUTS[perf.statut];
        const b = baremes[moi.sexe][exo];
        const palier = palierExercice(moi.sexe, exo, perf.valeur);
        const nomPalier = palier === 0 ? 'Aucune' : nomsLigues[palier - 1];
        return (
          <View key={exo} style={styles.lignePerf}>
            <View style={{ flex: 1 }}>
              <Text style={styles.perfNom}>{exo}</Text>
              <Text style={styles.perfValeur}>
                {b.unite === 'kg' ? `${b.reps} x ${perf.valeur} kg` : `${perf.valeur} reps`}
                {'  •  '}
                <Text style={{ color: couleursLigues[nomPalier] }}>{nomPalier}</Text>
              </Text>
              <Text style={[styles.perfStatut, { color: st.couleur }]}>
                {st.emoji} {st.libelle}
              </Text>
            </View>
            {perf.statut === 'non_verifie' && !estConnecte && (
              <TouchableOpacity style={styles.boutonValider} onPress={() => validerParCommunaute(exo)}>
                <Text style={styles.boutonValiderTexte}>📹 Envoyer{'\n'}une vidéo</Text>
              </TouchableOpacity>
            )}
            {perf.statut === 'non_verifie' && estConnecte && codeGenere?.exercice === exo && (
              <View style={styles.blocCode}>
                <Text style={styles.codeTexte}>{codeGenere.code}</Text>
                <TouchableOpacity onPress={() => setCodeGenere(null)}>
                  <Text style={styles.fermerCode}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}
            {perf.statut === 'non_verifie' && estConnecte && codeGenere?.exercice !== exo && (
              <View style={{ gap: 6 }}>
                {videosEnvoyees[exo] ? (
                  <Text style={styles.perfEnAttente}>🕒 Vidéo{'\n'}envoyée</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.boutonValider}
                    onPress={() => choisirEtEnvoyerVideo(exo)}
                    disabled={envoiEnCours === exo}
                  >
                    {envoiEnCours === exo ? (
                      <ActivityIndicator color={colors.accent} size="small" />
                    ) : (
                      <Text style={styles.boutonValiderTexte}>📹 Vidéo</Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.boutonValider}
                  onPress={() => genererCode(exo)}
                  disabled={genererCodeEnCours === exo}
                >
                  {genererCodeEnCours === exo ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <Text style={styles.boutonValiderTexte}>🔑 Code{'\n'}partenaire</Text>
                  )}
                </TouchableOpacity>

                {/* MODE TEST : un compte administrateur valide sa perf tout
                    seul. Sans ça, tester le classement obligerait à jongler
                    entre deux comptes pour chaque perf saisie. Le serveur
                    n'accepte cet auto-vote QUE pour un admin (403 sinon). */}
                {moi.admin && (
                  <TouchableOpacity
                    style={styles.boutonAdmin}
                    onPress={() => validerAdmin(exo)}
                    disabled={validationAdminEnCours === exo}
                  >
                    {validationAdminEnCours === exo ? (
                      <ActivityIndicator color={colors.rouge} size="small" />
                    ) : (
                      <Text style={styles.boutonAdminTexte}>🛠 Valider{'\n'}(admin)</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}
      {erreurVideo && <Text style={styles.messageErreur}>⚠️ {erreurVideo}</Text>}

      {/* ---- Valider la perf d'un partenaire avec un code ---- */}
      {estConnecte && (
        <View style={styles.carteCode}>
          <Text style={styles.sectionTitre}>🔑 Valider la perf d'un partenaire</Text>
          <Text style={styles.indice}>
            Ton partenaire de salle t'a donné un code juste après sa perf ? Entre-le ici pour la confirmer.
          </Text>
          <TextInput
            style={styles.champ}
            value={codeSaisi}
            onChangeText={(t) => setCodeSaisi(t.toUpperCase())}
            placeholder="Ex. : K7XPQR"
            placeholderTextColor={colors.texteGris}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.boutonAjouter} onPress={validerAvecCode} disabled={validationEnCours}>
            {validationEnCours ? <ActivityIndicator color={colors.texte} /> : (
              <Text style={styles.boutonAjouterTexte}>Valider avec ce code</Text>
            )}
          </TouchableOpacity>
          {messageValidation && <Text style={styles.messageSucces}>{messageValidation}</Text>}
        </View>
      )}

      {/* La section « 🤝 Perfs à valider (sans preuve) » a été RETIRÉE le
          01/09/2026 (demande de Hafiz). C'était le chemin de validation le plus
          facile à abuser — un vote de confiance sans aucune preuve. Restent les
          deux chemins qui en demandent une : la VIDÉO (ci-dessous) et le CODE
          PARTENAIRE (un joueur présent au moment de la perf).
          Le backend, lui, garde ses endpoints `/performances/a-valider-sans-video`
          et `/voter-sans-video` : rien ne les appelle plus, mais les retirer
          casserait `test_api_validation.py` sans rien gagner. */}

      {/* ---- Vidéos des autres joueurs à valider ---- */}
      {estConnecte && (
        <>
          <Text style={styles.sectionTitre}>🎥 Vidéos à valider</Text>
          <Text style={styles.indice}>
            Le premier avis compte : valide si la perf te semble réelle, refuse sinon.
          </Text>
          {chargementVideos && <ActivityIndicator color={colors.accent} style={{ marginTop: espacement.s }} />}
          {!chargementVideos && videosAValider.length === 0 && (
            <Text style={styles.indice}>Aucune vidéo en attente pour l'instant.</Text>
          )}
          {videosAValider.map((v) => (
            <View key={v.id} style={styles.carteVideo}>
              <Text style={styles.perfNom}>{v.pseudo} · {v.exercice}</Text>
              <Video
                source={{ uri: api.urlVideo(v.id) }}
                style={styles.lecteurVideo}
                useNativeControls
                resizeMode="contain"
              />
              <View style={styles.ligneVoteBoutons}>
                <TouchableOpacity style={styles.boutonRefuser} onPress={() => voter(v.id, false)}>
                  <Text style={styles.boutonRefuserTexte}>❌ Refuser</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.boutonValiderVideo} onPress={() => voter(v.id, true)}>
                  <Text style={styles.boutonValiderVideoTexte}>✅ Valider</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: colors.fond },
  titre: { color: colors.texte, fontSize: 24, fontWeight: '800' },
  ligneTitre: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Le badge est un peu plus haut que le texte pour rester lisible malgré ses
  // détails (couronne, étoiles) ; `contain` garde ses proportions.
  iconeTitre: { width: 40, height: 34, resizeMode: 'contain' },
  sousTitre: { color: colors.texteGris, fontSize: 13, marginTop: 4, marginBottom: espacement.m },
  formulaire: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
    marginBottom: espacement.m,
  },
  libelle: { color: colors.texte, fontWeight: '600', marginBottom: 6, marginTop: espacement.s },
  selecteurExo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: 12,
  },
  choixExo: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
    backgroundColor: colors.carteClaire,
  },
  indice: { color: colors.texteGris, fontSize: 12, marginTop: espacement.s },
  champ: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: 12,
    color: colors.texte,
  },
  boutonAjouter: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: espacement.m,
  },
  boutonAjouterTexte: { color: colors.texte, fontWeight: '700' },
  cartePaliers: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
    marginBottom: espacement.m,
  },
  lignePalier: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  palierTexte: { fontWeight: '700', marginLeft: 8 },
  sectionTitre: { color: colors.texte, fontSize: 18, fontWeight: '700', marginBottom: espacement.s },
  enteteRepliable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carte,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bordure,
    paddingVertical: espacement.s,
    paddingHorizontal: espacement.m,
    marginBottom: espacement.s,
  },
  sectionTitreRepliable: { color: colors.texte, fontSize: 16, fontWeight: '700' },
  resumeRepliable: { color: colors.texteGris, fontSize: 12, marginTop: 2 },
  chevron: { color: colors.texteGris, fontSize: 14, marginLeft: espacement.s },
  lignePerf: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carte,
    borderRadius: 12,
    padding: espacement.m,
    marginBottom: espacement.s,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  perfNom: { color: colors.texte, fontWeight: '600' },
  perfValeur: { color: colors.texteGris, fontSize: 12, marginTop: 2 },
  perfStatut: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  boutonValider: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  boutonValiderTexte: { color: colors.accent, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  // Bouton du MODE TEST : bordure rouge pour qu'on ne le confonde jamais avec
  // les vrais chemins de validation (vidéo, code partenaire).
  boutonAdmin: {
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderWidth: 1, borderColor: colors.rouge,
  },
  boutonAdminTexte: { color: colors.rouge, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  perfEnAttente: { color: colors.texteGris, fontSize: 10, textAlign: 'center', maxWidth: 90 },
  messageErreur: { color: colors.rouge, fontSize: 13, marginTop: espacement.s, marginBottom: espacement.s },
  messageSucces: { color: colors.vert, fontSize: 13, fontWeight: '700', marginTop: espacement.s },
  blocCode: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  codeTexte: { color: colors.or, fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  fermerCode: { color: colors.texteGris, fontSize: 10, marginTop: 4 },
  carteCode: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
    marginBottom: espacement.m,
  },
  carteVideo: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    marginBottom: espacement.s,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  lecteurVideo: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#000',
    marginTop: espacement.s,
  },
  ligneVoteBoutons: { flexDirection: 'row', gap: 10, marginTop: espacement.s },
  boutonRefuser: {
    flex: 1,
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.rouge,
  },
  boutonRefuserTexte: { color: colors.rouge, fontWeight: '700' },
  boutonValiderVideo: {
    flex: 1,
    backgroundColor: colors.vert,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  boutonValiderVideoTexte: { color: colors.fond, fontWeight: '800' },
});
