// LES PARAMÈTRES (08/11/2026, demande de Hafiz : « un petit onglet flottant en
// haut à droite qui fera office de paramètres ; on va y intégrer la partie
// sécurité du compte ainsi que la déconnexion. On aura la partie compte, une
// partie préférences, une partie notifications »).
//
// Ouverts par le rouage flottant du Profil, ils recouvrent l'écran. Trois
// sections :
//  - COMPTE : qui je suis, ma salle (lien vers le Clan, où elle se change),
//    la SÉCURITÉ (mot de passe, code de secours — déménagés du Profil) et la
//    DÉCONNEXION (déménagée aussi, avec une confirmation en deux temps) ;
//  - PRÉFÉRENCES : le repos par défaut et la vibration du minuteur ;
//  - NOTIFICATIONS : le rappel d'entraînement et le point hebdo (déménagés de
//    l'onglet Entraînement), et la notification de fin de repos.
// Les réglages sont lus et écrits par src/reglages.js.
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch, Platform,
} from 'react-native';
import { colors, espacement } from '../theme';
import { da, monospace } from '../designSystem';
import * as api from '../api';
import * as reglages from '../reglages';
import { REPOS_PROPOSES } from '../logic/reglages';
import { dureeLisible } from '../logic/repos';
import { categoriePoids, ligueJoueur, lirePoidsSaisi } from '../logic/classement';
import { joursSemaine, abreviationsJours } from '../data/programmesStandards';
import { Icone, TexteIcone, LibelleIcone } from './Icones';
import AvatarJoueur from './AvatarJoueur';

const estWeb = Platform.OS === 'web';
const ZONE = { top: 8, bottom: 8, left: 8, right: 8 };

function Section({ titre, children }) {
  return (
    <>
      <Text style={styles.libelleSection}>{titre}</Text>
      <View style={styles.carte}>{children}</View>
    </>
  );
}

// Une ligne qui se déplie (sécurité) : le titre, une ligne d'aide, un chevron.
function LigneDepliable({ icone, titre, aide, ouverte, onBasculer, children, derniere }) {
  return (
    <View style={[styles.ligne, !derniere && styles.ligneSeparee]}>
      <TouchableOpacity style={styles.enteteLigne} onPress={onBasculer}>
        <Icone nom={icone} taille={18} couleur={colors.or} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titreLigne}>{titre}</Text>
          {aide ? <Text style={styles.aideLigne}>{aide}</Text> : null}
        </View>
        <Icone nom={ouverte ? 'chevron-haut' : 'chevron-bas'} taille={16} couleur={colors.texteGris} />
      </TouchableOpacity>
      {ouverte ? <View style={styles.corpsLigne}>{children}</View> : null}
    </View>
  );
}

// Un interrupteur avec son libellé et son explication.
function LigneInterrupteur({ titre, aide, valeur, onChanger, derniere }) {
  return (
    <View style={[styles.ligne, styles.enteteLigne, !derniere && styles.ligneSeparee]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.titreLigne}>{titre}</Text>
        {aide ? <Text style={styles.aideLigne}>{aide}</Text> : null}
      </View>
      <Switch
        value={valeur}
        onValueChange={onChanger}
        trackColor={{ false: colors.carteClaire, true: da.bordureOr }}
        thumbColor={valeur ? colors.or : colors.texteGris}
        activeThumbColor={colors.or}
      />
    </View>
  );
}

// Le formulaire d'un rappel : les jours (un seul ou plusieurs), l'heure, et
// les boutons. Partagé par le rappel d'entraînement et le point hebdo.
function FormulaireRappel({
  joursChoisis, onBasculerJour, heure, onHeure, actif, onActiver, onDesactiver, message,
}) {
  return (
    <>
      <View style={styles.puces}>
        {joursSemaine.map((jour) => {
          const choisi = joursChoisis.includes(jour);
          return (
            <TouchableOpacity key={jour} style={[styles.puceJour, choisi && styles.puceActive]}
              onPress={() => onBasculerJour(jour)}>
              <Text style={[styles.puceTexte, choisi && styles.puceTexteActif]}>{abreviationsJours[jour]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.ligneHeure}>
        <TextInput
          style={styles.champHeure}
          value={heure}
          onChangeText={onHeure}
          placeholder="18:00"
          placeholderTextColor={colors.texteGris}
          keyboardType="numbers-and-punctuation"
        />
        <TouchableOpacity style={[styles.bouton, { flex: 1 }]} onPress={onActiver}>
          <Text style={styles.boutonTexte}>{actif ? 'METTRE À JOUR' : 'ACTIVER'}</Text>
        </TouchableOpacity>
        {actif && (
          <TouchableOpacity style={styles.boutonCouper} onPress={onDesactiver}
            accessibilityLabel="Désactiver ce rappel">
            <Icone nom="croix" taille={15} couleur={colors.rouge} />
          </TouchableOpacity>
        )}
      </View>
      {message ? (
        <Text style={[styles.message, !message.ok && { color: colors.rouge }]}>{message.message}</Text>
      ) : null}
    </>
  );
}

// Un poids affiché à la française : « 78,5 ».
function poidsLisible(poids) {
  return String(poids).replace('.', ',');
}

export default function Parametres({ moi, salle, onFermer, seDeconnecter, allerA, onCompteChange }) {
  // ---- Compte : sécurité (logique identique à celle qui vivait au Profil) ----
  const [ouverte, setOuverte] = useState(null); // 'poids' | 'mdp' | 'code' | null
  // ---- Compte : le poids de corps (13/11/2026) ----
  const [poidsSaisi, setPoidsSaisi] = useState('');
  const [messagePoids, setMessagePoids] = useState(null); // { texte, erreur }
  const [poidsEnCours, setPoidsEnCours] = useState(false);
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [messageSecurite, setMessageSecurite] = useState(null); // { texte, erreur }
  const [codeSecoursAffiche, setCodeSecoursAffiche] = useState(null);
  const [securiteEnCours, setSecuriteEnCours] = useState(false);
  const [confirmerDeconnexion, setConfirmerDeconnexion] = useState(false);

  // ---- Préférences et rappels ----
  const [prefs, setPrefs] = useState(null);
  const [rappel, setRappel] = useState({ jours: [], heure: '18:00', actif: false });
  const [suivi, setSuivi] = useState({ jour: 'dimanche', heure: '19:00', actif: false });
  const [messageRappel, setMessageRappel] = useState(null);
  const [messageSuivi, setMessageSuivi] = useState(null);

  useEffect(() => {
    const desabonner = reglages.ecouterPreferences(setPrefs);
    reglages.lireRappel().then(setRappel);
    reglages.lireRappelSuivi().then(setSuivi);
    return desabonner;
  }, []);

  function basculer(cle) {
    setMessageSecurite(null);
    setMessagePoids(null);
    // Le champ du poids s'ouvre PRÉ-REMPLI avec le poids actuel : on corrige
    // un chiffre, on ne retape pas tout.
    if (cle === 'poids') setPoidsSaisi(poidsLisible(moi.poids));
    setOuverte((o) => (o === cle ? null : cle));
  }

  async function enregistrerPoids() {
    setMessagePoids(null);
    const poids = lirePoidsSaisi(poidsSaisi);
    if (poids === null) {
      setMessagePoids({ texte: 'Entre un poids en kg, entre 30 et 300 (ex. 78,5).', erreur: true });
      return;
    }
    setPoidsEnCours(true);
    try {
      await api.changerPoids(moi.id, poids);
      // Recharge le profil ET le classement : la catégorie de poids suit.
      if (onCompteChange) await onCompteChange();
      setMessagePoids({ texte: `Poids enregistré : ${poidsLisible(poids)} kg.`, erreur: false });
    } catch (e) {
      setMessagePoids({ texte: `Poids NON enregistré (${e.message || 'erreur inconnue'}).`, erreur: true });
    } finally {
      setPoidsEnCours(false);
    }
  }

  async function validerChangementMdp() {
    setMessageSecurite(null);
    if (nouveauMdp.length < 4) {
      setMessageSecurite({ texte: 'Le nouveau mot de passe doit faire au moins 4 caractères.', erreur: true });
      return;
    }
    setSecuriteEnCours(true);
    try {
      await api.changerMotDePasse(ancienMdp, nouveauMdp);
      setAncienMdp('');
      setNouveauMdp('');
      setMessageSecurite({ texte: 'Mot de passe changé !', erreur: false });
    } catch (e) {
      setMessageSecurite({ texte: e.message || 'Changement impossible.', erreur: true });
    } finally {
      setSecuriteEnCours(false);
    }
  }

  async function regenererCodeSecours() {
    setMessageSecurite(null);
    setSecuriteEnCours(true);
    try {
      const { code_recuperation } = await api.regenererCodeRecuperation();
      setCodeSecoursAffiche(code_recuperation);
    } catch (e) {
      setMessageSecurite({ texte: e.message || 'Génération impossible.', erreur: true });
    } finally {
      setSecuriteEnCours(false);
    }
  }

  const categorie = categoriePoids(moi.poids);
  // Ce que deviendrait la catégorie avec le poids en train d'être tapé.
  const poidsLu = lirePoidsSaisi(poidsSaisi);
  const nouvelleCategorie = poidsLu !== null ? categoriePoids(poidsLu) : null;
  const messageSec = messageSecurite ? (
    <Text style={[styles.message, messageSecurite.erreur && { color: colors.rouge }]}>
      {messageSecurite.texte}
    </Text>
  ) : null;

  return (
    <View style={styles.fond}>
      <View style={styles.entete}>
        <TouchableOpacity style={styles.boutonRetour} onPress={onFermer} hitSlop={ZONE}
          accessibilityLabel="Fermer les paramètres">
          <Icone nom="chevron-gauche" taille={20} couleur={colors.texte} />
        </TouchableOpacity>
        <Text style={styles.titre}>PARA<Text style={{ color: colors.or }}>MÈTRES</Text></Text>
      </View>

      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {/* ================= COMPTE ================= */}
        <Section titre="COMPTE">
          <View style={[styles.ligne, styles.ligneSeparee, styles.enteteLigne]}>
            <AvatarJoueur pseudo={moi.pseudo} ligue={ligueJoueur(moi)} taille={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pseudo}>{moi.pseudo}</Text>
              <Text style={styles.aideLigne}>
                {moi.sexe === 'femme' ? 'Femme' : 'Homme'} · {poidsLisible(moi.poids)} kg
                {categorie ? ` · catégorie ${categorie}` : ''}
              </Text>
            </View>
          </View>

          <LigneDepliable
            icone="balance"
            titre="Mon poids de corps"
            aide={`${poidsLisible(moi.poids)} kg · catégorie ${categorie} au classement`}
            ouverte={ouverte === 'poids'}
            onBasculer={() => basculer('poids')}
          >
            <Text style={styles.libelleChamp}>POIDS (KG)</Text>
            <TextInput
              style={styles.champ}
              value={poidsSaisi}
              onChangeText={(t) => { setPoidsSaisi(t); setMessagePoids(null); }}
              placeholder="ex. 78,5"
              placeholderTextColor={colors.texteGris}
              keyboardType="decimal-pad"
              maxLength={6}
            />
            {nouvelleCategorie && nouvelleCategorie !== categorie ? (
              <Text style={styles.aideLigne}>
                Tu passeras de la catégorie {categorie} à la catégorie{' '}
                <Text style={{ color: colors.or, fontWeight: '800' }}>{nouvelleCategorie}</Text>.
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.bouton, poidsEnCours && { opacity: 0.6 }]}
              onPress={enregistrerPoids}
              disabled={poidsEnCours}
            >
              <Text style={styles.boutonTexte}>{poidsEnCours ? 'ENREGISTREMENT…' : 'ENREGISTRER MON POIDS'}</Text>
            </TouchableOpacity>
            {messagePoids ? (
              <Text style={[styles.message, messagePoids.erreur && { color: colors.rouge }]}>
                {messagePoids.texte}
              </Text>
            ) : null}
          </LigneDepliable>

          {allerA ? (
            <TouchableOpacity
              style={[styles.ligne, styles.ligneSeparee, styles.enteteLigne]}
              onPress={() => { onFermer(); allerA('clan'); }}
            >
              <Icone nom="salle" taille={18} couleur={colors.or} />
              <View style={{ flex: 1 }}>
                <Text style={styles.titreLigne}>Ma salle de gym</Text>
                <Text style={styles.aideLigne}>{salle || 'Aucune'} · se change dans l'onglet Clan</Text>
              </View>
              <Icone nom="chevron-droit" taille={16} couleur={colors.texteGris} />
            </TouchableOpacity>
          ) : null}

          <LigneDepliable
            icone="cadenas"
            titre="Changer mon mot de passe"
            ouverte={ouverte === 'mdp'}
            onBasculer={() => basculer('mdp')}
          >
            <TextInput
              style={styles.champ}
              value={ancienMdp}
              onChangeText={setAncienMdp}
              placeholder="Mot de passe actuel"
              placeholderTextColor={colors.texteGris}
              secureTextEntry
            />
            <TextInput
              style={styles.champ}
              value={nouveauMdp}
              onChangeText={setNouveauMdp}
              placeholder="Nouveau mot de passe (4 caractères min.)"
              placeholderTextColor={colors.texteGris}
              secureTextEntry
            />
            <TouchableOpacity style={styles.bouton} onPress={validerChangementMdp} disabled={securiteEnCours}>
              <Text style={styles.boutonTexte}>CHANGER LE MOT DE PASSE</Text>
            </TouchableOpacity>
            {messageSec}
          </LigneDepliable>

          <LigneDepliable
            icone="cle"
            titre="Code de secours"
            aide="Pour récupérer ton compte si tu oublies ton mot de passe"
            ouverte={ouverte === 'code'}
            onBasculer={() => basculer('code')}
          >
            <Text style={styles.explication}>
              Il se saisit dans « Mot de passe oublié ? » sur l'écran de
              connexion. En regénérer un nouveau annule l'ancien.
            </Text>
            {codeSecoursAffiche ? (
              <View style={styles.cadreCode}>
                <Text style={styles.codeSecours}>{codeSecoursAffiche}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.boutonSecondaire} onPress={regenererCodeSecours}
              disabled={securiteEnCours}>
              <Text style={styles.boutonSecondaireTexte}>
                {codeSecoursAffiche ? 'Regénérer encore' : 'Regénérer mon code de secours'}
              </Text>
            </TouchableOpacity>
            {messageSec}
          </LigneDepliable>

          {/* La déconnexion se CONFIRME : touchée par erreur dans une liste de
              réglages, elle renvoyait sans prévenir à l'écran de connexion. */}
          <View style={styles.ligne}>
            {!confirmerDeconnexion ? (
              <TouchableOpacity style={styles.boutonDeconnexion} onPress={() => setConfirmerDeconnexion(true)}>
                <LibelleIcone nom="sortie" taille={15} style={styles.boutonDeconnexionTexte}>Se déconnecter</LibelleIcone>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.explication}>
                  Te déconnecter de ce téléphone ? Il faudra retaper ton pseudo
                  et ton mot de passe pour revenir.
                </Text>
                <View style={styles.ligneHeure}>
                  <TouchableOpacity style={[styles.boutonSecondaire, { flex: 1, marginTop: 0 }]}
                    onPress={() => setConfirmerDeconnexion(false)}>
                    <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.boutonDeconnexion, { flex: 1, marginTop: 0 }]}
                    onPress={seDeconnecter}>
                    <Text style={styles.boutonDeconnexionTexte}>Me déconnecter</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Section>

        {/* ================= PRÉFÉRENCES ================= */}
        <Section titre="PRÉFÉRENCES">
          <View style={[styles.ligne, styles.ligneSeparee]}>
            <Text style={styles.titreLigne}>Repos par défaut</Text>
            <Text style={styles.aideLigne}>
              Lancé après chaque série quand le programme ne fixe pas de repos
              (séance libre, exercice ajouté…).
            </Text>
            <View style={[styles.puces, { marginTop: espacement.s }]}>
              {REPOS_PROPOSES.map((s) => {
                const choisi = prefs?.reposDefaut === s;
                return (
                  <TouchableOpacity key={s} style={[styles.puceRepos, choisi && styles.puceActive]}
                    onPress={() => reglages.changerPreferences({ reposDefaut: s })}>
                    <Text style={[styles.puceTexte, choisi && styles.puceTexteActif]}>{dureeLisible(s)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <LigneInterrupteur
            titre="Vibrer à la fin du repos"
            aide="Le téléphone vibre quand il est temps d'attaquer la série suivante."
            valeur={prefs?.vibrationRepos ?? true}
            onChanger={(v) => reglages.changerPreferences({ vibrationRepos: v })}
            derniere
          />
        </Section>

        {/* ================= NOTIFICATIONS ================= */}
        <Section titre="NOTIFICATIONS">
          {estWeb ? (
            <View style={styles.ligne}>
              <TexteIcone nom="cloche" taille={16} couleur={colors.or} hautAligne style={styles.explication}>
                Les notifications (rappels, fin de repos) se règlent dans l'app
                sur téléphone : un navigateur ne sait pas les programmer.
              </TexteIcone>
            </View>
          ) : (
            <>
              <View style={[styles.ligne, styles.ligneSeparee]}>
                <TexteIcone nom="cloche" taille={16} couleur={colors.or} style={styles.titreLigne}>
                  Rappel d'entraînement
                </TexteIcone>
                <Text style={styles.aideLigne}>
                  Tes jours et ton heure : le téléphone te prévient, même app
                  fermée (comme un réveil).
                </Text>
                <FormulaireRappel
                  joursChoisis={rappel.jours}
                  onBasculerJour={(jour) => setRappel((r) => ({
                    ...r,
                    jours: r.jours.includes(jour) ? r.jours.filter((j) => j !== jour) : [...r.jours, jour],
                  }))}
                  heure={rappel.heure}
                  onHeure={(h) => setRappel((r) => ({ ...r, heure: h }))}
                  actif={rappel.actif}
                  onActiver={async () => {
                    const res = await reglages.activerRappel(rappel.jours, rappel.heure);
                    setMessageRappel(res);
                    if (res.ok) setRappel((r) => ({ ...r, actif: true }));
                  }}
                  onDesactiver={async () => {
                    setMessageRappel(await reglages.desactiverRappel(rappel.jours, rappel.heure));
                    setRappel((r) => ({ ...r, actif: false }));
                  }}
                  message={messageRappel}
                />
              </View>

              <View style={[styles.ligne, styles.ligneSeparee]}>
                <TexteIcone nom="cible" taille={16} couleur={colors.or} style={styles.titreLigne}>
                  Point hebdo sur mes séries
                </TexteIcone>
                <Text style={styles.aideLigne}>
                  Une notification par semaine avec ton avancement par groupe
                  musculaire — pour ne pas découvrir le dimanche soir qu'il te
                  manque 8 séries de dos.
                </Text>
                <FormulaireRappel
                  joursChoisis={[suivi.jour]}
                  onBasculerJour={(jour) => setSuivi((s) => ({ ...s, jour }))}
                  heure={suivi.heure}
                  onHeure={(h) => setSuivi((s) => ({ ...s, heure: h }))}
                  actif={suivi.actif}
                  onActiver={async () => {
                    const res = await reglages.activerRappelSuivi(suivi.jour, suivi.heure);
                    setMessageSuivi(res);
                    if (res.ok) setSuivi((s) => ({ ...s, actif: true }));
                  }}
                  onDesactiver={async () => {
                    setMessageSuivi(await reglages.desactiverRappelSuivi(suivi.jour, suivi.heure));
                    setSuivi((s) => ({ ...s, actif: false }));
                  }}
                  message={messageSuivi}
                />
              </View>

              <LigneInterrupteur
                titre="Fin du repos"
                aide="Si tu poses le téléphone pendant le repos, une notification te prévient quand il est fini."
                valeur={prefs?.notificationRepos ?? true}
                onChanger={(v) => reglages.changerPreferences({ notificationRepos: v })}
                derniere
              />
            </>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFillObject, backgroundColor: da.fond },
  entete: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: espacement.m, paddingTop: espacement.m, paddingBottom: espacement.s,
  },
  boutonRetour: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
  },
  titre: { color: colors.texte, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  contenu: { padding: espacement.m, paddingBottom: espacement.xl },
  libelleSection: {
    color: colors.texteGris, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
    marginTop: espacement.m, marginBottom: espacement.s,
  },
  carte: {
    backgroundColor: colors.carte, borderRadius: 16, borderWidth: 1, borderColor: colors.bordure,
    overflow: 'hidden',
  },
  ligne: { padding: espacement.m },
  ligneSeparee: { borderBottomWidth: 1, borderBottomColor: colors.bordure },
  enteteLigne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  corpsLigne: { marginTop: espacement.s },
  pseudo: { color: colors.texte, fontSize: 17, fontWeight: '900' },
  titreLigne: { color: colors.texte, fontSize: 14, fontWeight: '800' },
  aideLigne: { color: colors.texteGris, fontSize: 12, lineHeight: 17, marginTop: 2 },
  explication: { color: colors.texteDoux, fontSize: 13, lineHeight: 19, marginBottom: espacement.s },
  libelleChamp: {
    color: colors.texteGris, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4,
  },
  champ: {
    backgroundColor: da.surfaceAlt, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    color: colors.texte, fontSize: 14, borderWidth: 1, borderColor: colors.bordure, marginTop: espacement.s,
  },
  bouton: {
    backgroundColor: colors.or, borderRadius: 12, minHeight: 46, justifyContent: 'center',
    alignItems: 'center', marginTop: espacement.s, paddingHorizontal: 12,
  },
  boutonTexte: { color: da.orSombre, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  boutonSecondaire: {
    borderWidth: 1, borderColor: da.bordureOrDouce, backgroundColor: da.orVoile, borderRadius: 12,
    minHeight: 46, justifyContent: 'center', alignItems: 'center', marginTop: espacement.s,
    paddingHorizontal: 12,
  },
  boutonSecondaireTexte: { color: colors.or, fontWeight: '800', fontSize: 13 },
  boutonDeconnexion: {
    borderWidth: 1, borderColor: colors.rouge, borderRadius: 12, minHeight: 46,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12,
  },
  boutonDeconnexionTexte: { color: colors.rouge, fontWeight: '800', fontSize: 14 },
  message: { color: colors.vert, fontSize: 12, marginTop: espacement.s },
  cadreCode: {
    borderWidth: 1, borderColor: da.bordureOr, backgroundColor: da.orVoile,
    borderRadius: 12, paddingVertical: espacement.s, marginBottom: espacement.s,
  },
  codeSecours: {
    color: colors.or, fontFamily: monospace, fontSize: 24, fontWeight: '900',
    textAlign: 'center', letterSpacing: 3,
  },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espacement.s },
  puceJour: {
    minWidth: 40, minHeight: 38, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.carteClaire,
    borderWidth: 1, borderColor: colors.bordure,
  },
  puceRepos: {
    minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 1, borderColor: colors.bordure,
  },
  puceActive: { borderColor: colors.or, backgroundColor: da.orVoile },
  puceTexte: { color: colors.texteGris, fontWeight: '700', fontSize: 12 },
  puceTexteActif: { color: colors.or },
  ligneHeure: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: espacement.s },
  champHeure: {
    width: 84, backgroundColor: da.surfaceAlt, borderRadius: 12, paddingVertical: 12,
    color: colors.texte, textAlign: 'center', fontSize: 15, fontWeight: '700',
    borderWidth: 1, borderColor: colors.bordure, marginTop: espacement.s,
  },
  boutonCouper: {
    width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.rouge, marginTop: espacement.s,
  },
});
