// ÉCRAN D'ACCUEIL (Profil) — refondu le 12/08/2026 d'après la maquette
// « Fitness Royale.dc.html » importée du designer (claude.ai/design).
//
// Direction artistique : fond quasi noir, or de marque, LOSANGES comme motif
// répété, titres très gras avec un mot en or, chiffres en chasse fixe.
// La palette vit dans `src/designSystem.js` ; le reste de l'app garde
// `src/theme.js` pour l'instant (voir le commentaire là-bas).
//
// La ligue/arène reste CALCULÉE à partir des performances VÉRIFIÉES : le
// design ne change que la présentation, jamais les règles.
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
} from 'react-native';
import { colors, espacement } from '../theme';
import { da, monospace } from '../designSystem';
import { ligueJoueur, palierExercice, categoriePoids, classer, classerParCategories } from '../logic/classement';
import { couleursLigues, nomsLigues, baremes } from '../data/clubSP';
import { STATUTS, estVerifiee } from '../data/statuts';
import CarteStat from '../components/CarteStat';
import BarreProgression from '../components/BarreProgression';
import AvatarJoueur from '../components/AvatarJoueur';
import Losange from '../components/Losange';
import CarteArenAccueil from '../components/CarteArenAccueil';
import { areneDuJoueur } from '../components/CarteArene';
import { areneDeLaLigue } from '../data/arenes';
import { mesTitresDExercice, titresAPortee } from '../logic/titres';
import PanneauModeTest from '../components/PanneauModeTest';
import * as api from '../api';

export default function ProfilScreen({
  // `setSeances` n'est plus reçu : cet écran ne fait que LIRE les séances
  // depuis le retrait de la saisie manuelle (elles s'ajoutent désormais
  // uniquement depuis l'onglet Entraînement).
  moi, joueurs, seances, salle, estConnecte, seDeconnecter,
  allerA, rafraichir,
}) {
  const u = moi;

  // ----- Sécurité du compte (changer le mot de passe, code de secours) -----
  const [perfsOuvertes, setPerfsOuvertes] = useState(false);
  const [titresOuverts, setTitresOuverts] = useState(false);
  const [securiteOuverte, setSecuriteOuverte] = useState(false);
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [messageSecurite, setMessageSecurite] = useState(null); // { texte, erreur }
  const [codeSecoursAffiche, setCodeSecoursAffiche] = useState(null);
  const [securiteEnCours, setSecuriteEnCours] = useState(false);

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
      setMessageSecurite({ texte: '✅ Mot de passe changé !', erreur: false });
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

  // Stats de la semaine, calculées depuis les séances enregistrées dans
  // l'onglet Entraînement (il n'y a plus de saisie manuelle ici).
  const nbSeances = seances.length;
  const minutesSemaine = seances.reduce((total, minutes) => total + minutes, 0);
  const caloriesEstimees = minutesSemaine * 8; // ~8 kcal/min de musculation

  const ligue = ligueJoueur(u);
  // Mon arène (nom, progression, paliers manquants) — même calcul que l'écran
  // Paliers, via le helper partagé : les deux écrans ne peuvent pas diverger.
  const arene = areneDuJoueur(u);
  // Mon RANG : position dans le classement global et dans ma catégorie de poids.
  function enOrdinal(n) {
    return n === 1 ? '1er' : `${n}e`;
  }
  const classementGlobal = classer(joueurs, 'global');
  const rangGlobal = classementGlobal.findIndex((j) => j.moi) + 1;
  const top3 = classementGlobal.slice(0, 3);
  const maCategorie = categoriePoids(u.poids);
  const groupe = classerParCategories(joueurs).find((g) => g.categorie === maCategorie);
  const rangCategorie = groupe ? groupe.joueurs.findIndex((j) => j.moi) + 1 : 0;

  // Progression vers la ligue suivante :
  // part des exercices VÉRIFIÉS déjà au niveau de la ligue suivante.
  const indexLigue = nomsLigues.indexOf(ligue);
  const ligueSuivante = nomsLigues[indexLigue + 1] || null;
  const exercices = Object.entries(u.performances);
  // Les titres se LISENT dans le classement par exercice — rien n'est stocké.
  const titresGagnes = mesTitresDExercice(classementGlobal);
  const titresProches = titresAPortee(classementGlobal, 5);
  const verifies = exercices.filter(([, perf]) => estVerifiee(perf));
  const nbVerifiees = verifies.length;
  const nbAuNiveauSuivant = verifies.filter(
    ([exo, perf]) => palierExercice(u.sexe, exo, perf.valeur) >= indexLigue + 2
  ).length;
  const progression =
    ligueSuivante && verifies.length > 0
      ? Math.round((nbAuNiveauSuivant / verifies.length) * 100)
      : ligueSuivante ? 0 : 100;

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={styles.contenu}>
      {/* ---- En-tête de marque ---- */}
      <View style={styles.enteteMarque}>
        <View>
          {/* Le surtitre « CLUB SP » a été retiré le 26/08/2026 (demande de
              Hafiz) : la marque affichée est FITNESS ROYALE, sans mention
              au-dessus. On garde le slogan comme surtitre pour ne pas laisser
              le titre flotter seul en haut de l'écran. */}
          <Text style={styles.surtitre}>FIGHT FOR IT</Text>
          <Text style={styles.titreMarque}>
            FITNESS <Text style={{ color: da.or }}>ROYALE</Text>
          </Text>
        </View>
        <View style={styles.badgeSaison}>
          <Text style={styles.badgeSaisonTitre}>SÉRIE</Text>
          <Text style={styles.badgeSaisonValeur}>🔥 {u.serieJours} j</Text>
        </View>
      </View>

      {/* ---- MON ARÈNE : la mise en scène du palier ---- */}
      <CarteArenAccueil joueur={u} arene={arene} salle={salle} />

      {/* ---- Trois chiffres clés ---- */}
      <View style={styles.ligneTuiles}>
        <View style={styles.tuile}>
          <Text style={[styles.tuileValeur, { color: da.or }]}>{nbVerifiees}</Text>
          <Text style={styles.tuileLibelle}>PERFS VÉRIFIÉES</Text>
        </View>
        <View style={styles.tuile}>
          <Text style={styles.tuileValeur}>{exercices.length}</Text>
          <Text style={styles.tuileLibelle}>EXOS SUIVIS</Text>
        </View>
        <View style={styles.tuile}>
          <Text style={styles.tuileValeur}>{rangGlobal > 0 ? `#${rangGlobal}` : '—'}</Text>
          <Text style={styles.tuileLibelle}>RANG GLOBAL</Text>
        </View>
      </View>

      {/* ---- L'appel à l'action : entrer dans l'arène ---- */}
      <TouchableOpacity
        style={styles.carteDuel}
        onPress={() => allerA?.('competition', { duel: true })}
        disabled={!allerA}
      >
        <View style={styles.pastilleVS}>
          <Text style={styles.pastilleVSTexte}>VS</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.duelTitre}>ARÈNE — LANCER UN DUEL</Text>
          <Text style={styles.duelSousTitre}>Charge fixe imposée · le plus de reps gagne</Text>
        </View>
        <Text style={styles.duelChevron}>›</Text>
      </TouchableOpacity>

      {/* ---- Le haut du classement ---- */}
      <View style={styles.carteTop}>
        <View style={styles.ligneEnteteTop}>
          <Text style={styles.titreBloc}>CLASSEMENT — TOP 3</Text>
          {allerA && (
            <TouchableOpacity onPress={() => allerA('competition')}>
              {/* « Voir tout » plutôt que « Classements » : le mot était répété
                  juste à côté du titre du bloc (demande de Hafiz du 25/08/2026). */}
              <Text style={styles.lienTop}>Voir tout ›</Text>
            </TouchableOpacity>
          )}
        </View>
        {top3.map((j, i) => {
          const ligueJ = ligueJoueur(j);
          const couleurJ = couleursLigues[ligueJ] || da.texteMuet;
          return (
            <View key={j.pseudo} style={styles.ligneTop}>
              <Text style={styles.rangTop}>{i + 1}</Text>
              <Losange couleur={couleurJ} taille={9} />
              <Text style={[styles.nomTop, j.moi && { color: da.or }]} numberOfLines={1}>
                {j.pseudo}{j.moi ? ' (toi)' : ''}
              </Text>
              {/* Nom d'ARÈNE, pas de ligue : un seul vocabulaire dans l'app. */}
              <Text style={[styles.ligueTop, { color: couleurJ }]}>
                {areneDeLaLigue(ligueJ).nom}
              </Text>
            </View>
          );
        })}
      </View>

      {/* La carte « 🏠 Ma salle de gym » a DÉMÉNAGÉ dans l'onglet Clan le
          01/09/2026 (demande de Hafiz : la salle appartient à la partie clan).
          Le Profil garde juste la salle en lecture, dans la carte d'arène. */}

      {/* Mon rang dans ma catégorie de poids.
          (L'ancienne carte « Progression vers la ligue » a été retirée : la
          carte d'arène ci-dessus dit la même chose en mieux.) */}
      <View style={styles.carteCategorie}>
        <Text style={styles.libelleCategorie}>CATÉGORIE {maCategorie.toUpperCase()}</Text>
        <Text style={styles.valeurCategorie}>
          {rangCategorie > 0 ? enOrdinal(rangCategorie) : '—'}
        </Text>
      </View>

      {/* Points et titres de compétition */}
      <View style={styles.carteCompetition}>
        <Text style={styles.carteTitre}>🏆 Compétition</Text>
        <Text style={styles.pointsCompetition}>{u.points} points (duels + défis)</Text>
        <Text style={styles.indice}>
          Les points départagent les égalités au classement — tes perfs restent reines.
        </Text>
        {u.titres.length > 0 ? (
          <View style={styles.listeTitres}>
            {u.titres.map((titre) => (
              <View key={titre} style={styles.chipTitre}>
                <Text style={styles.chipTitreTexte}>🏅 {titre}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.indice}>Aucun titre pour l'instant — termine le défi de la semaine !</Text>
        )}
      </View>

      {/* Mes performances Fitness Royale — REPLIÉE PAR DÉFAUT (27/08/2026,
          retour de Hafiz : « mes performances prend trop de place »). La liste
          fait 15 lignes, elle repoussait tout le reste du profil très bas.
          Même principe que « Sécurité du compte » plus bas et que les objectifs
          de séries de l'onglet Entraînement : un résumé chiffré reste visible
          sans rien déplier, le détail s'ouvre à la demande. */}
      <TouchableOpacity
        style={styles.enteteRepliable}
        onPress={() => setPerfsOuvertes(!perfsOuvertes)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitreRepliable}>Mes performances (Fitness Royale)</Text>
          <Text style={styles.resumeRepliable}>
            {nbVerifiees} vérifiée{nbVerifiees > 1 ? 's' : ''} sur {exercices.length} saisie
            {exercices.length > 1 ? 's' : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{perfsOuvertes ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {perfsOuvertes && exercices.map(([exo, perf]) => {
        const palier = palierExercice(u.sexe, exo, perf.valeur);
        const nomPalier = palier === 0 ? 'Aucune' : nomsLigues[palier - 1];
        const bareme = baremes[u.sexe][exo];
        const st = STATUTS[perf.statut];
        return (
          <View key={exo} style={styles.lignePerf}>
            <View style={{ flex: 1 }}>
              <Text style={styles.perfNom}>{exo}</Text>
              <Text style={styles.perfValeur}>
                {bareme.unite === 'kg' ? `${bareme.reps} x ${perf.valeur} kg` : `${perf.valeur} reps`}
                {'  '}
                <Text style={{ color: st.couleur }}>{st.emoji}</Text>
              </Text>
            </View>
            <Text style={[styles.perfLigue, { color: couleursLigues[nomPalier] }]}>{nomPalier}</Text>
          </View>
        );
      })}

      {/* ---- Mes titres ----
          Gagnés en montant sur le podium d'un exercice (classement par
          exercice de l'onglet Compétition). Recalculés à la lecture : aucun
          stockage, donc jamais désynchronisés du classement. */}
      <TouchableOpacity
        style={styles.enteteRepliable}
        onPress={() => setTitresOuverts(!titresOuverts)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitreRepliable}>🏅 Mes titres</Text>
          <Text style={styles.resumeRepliable}>
            {titresGagnes.length === 0
              ? 'Aucun titre — monte sur un podium par exercice'
              : `${titresGagnes.length} titre${titresGagnes.length > 1 ? 's' : ''} · ${
                  titresGagnes.filter((t) => t.rang === 1).length} en or`}
          </Text>
        </View>
        <Text style={styles.chevron}>{titresOuverts ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {titresOuverts && (
        <View style={styles.carteTitres}>
          <Text style={styles.explicationTitres}>
            Un titre se gagne en entrant dans les 3 premiers d'un exercice
            (perfs vérifiées uniquement). Il change de main dès que quelqu'un
            fait mieux — rien n'est acquis.
          </Text>

          {titresGagnes.length === 0 ? (
            <Text style={styles.indice}>
              Tu n'as encore aucun titre. Fais vérifier une perf sur un exercice
              où le podium est à ta portée.
            </Text>
          ) : (
            titresGagnes.map((t) => (
              <View key={`${t.exercice}-${t.rang}`} style={styles.ligneTitre}>
                <Text style={styles.emblemeTitre}>{t.embleme}</Text>
                <Text style={styles.libelleTitre}>{t.libelle}</Text>
              </View>
            ))
          )}

          {titresProches.length > 0 && (
            <>
              <Text style={styles.sousTitreTitres}>À ta portée</Text>
              {titresProches.map((c) => (
                <View key={c.exercice} style={styles.ligneTitre}>
                  <Text style={styles.emblemeTitre}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.libelleTitre}>{c.exercice}</Text>
                    <Text style={styles.indiceTitre}>
                      {c.rangActuel
                        ? `Tu es ${c.rangActuel}e · le podium est au palier ${c.palierAViser}`
                        : `Pas encore classé · le podium est au palier ${c.palierAViser}`}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Stats de la semaine */}
      <Text style={styles.sectionTitre}>Cette semaine</Text>
      <View style={styles.ligneStats}>
        <CarteStat emoji="💪" valeur={nbSeances} libelle="Séances" />
        <CarteStat emoji="🔥" valeur={`≈${caloriesEstimees}`} libelle="Calories (est.)" />
        <CarteStat emoji="⏱️" valeur={`${minutesSemaine} min`} libelle="Entraînement" />
      </View>

      {/* La saisie manuelle « ➕ Séance » a été retirée le 26/08/2026 (demande
          de Hafiz). Les compteurs ci-dessus continuent de se remplir tout
          seuls : chaque séance enregistrée dans l'onglet Entraînement appelle
          `ajouterSeanceLocale()` (App.js), qui alimente le même état. */}

      {/* Bilan compétition */}
      <Text style={styles.sectionTitre}>Bilan compétition</Text>
      <View style={styles.ligneStats}>
        <CarteStat emoji="✅" valeur={u.stats.victoires} libelle="Victoires" />
        <CarteStat emoji="❌" valeur={u.stats.defaites} libelle="Défaites" />
        <CarteStat
          emoji="📈"
          valeur={
            u.stats.victoires + u.stats.defaites > 0
              ? `${Math.round((u.stats.victoires / (u.stats.victoires + u.stats.defaites)) * 100)}%`
              : '—'
          }
          libelle="Taux de victoire"
        />
      </View>

      {/* Sécurité du compte : repliée par défaut pour ne pas encombrer le profil. */}
      {estConnecte && (
        <View style={styles.carteSecurite}>
          <TouchableOpacity onPress={() => setSecuriteOuverte(!securiteOuverte)}>
            <Text style={styles.titreSecurite}>
              🔒 Sécurité du compte {securiteOuverte ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {securiteOuverte && (
            <>
              <Text style={styles.libelleSecurite}>Changer mon mot de passe</Text>
              <TextInput
                style={styles.champSecurite}
                value={ancienMdp}
                onChangeText={setAncienMdp}
                placeholder="Mot de passe actuel"
                placeholderTextColor={colors.texteGris}
                secureTextEntry
              />
              <TextInput
                style={styles.champSecurite}
                value={nouveauMdp}
                onChangeText={setNouveauMdp}
                placeholder="Nouveau mot de passe (4 caractères min.)"
                placeholderTextColor={colors.texteGris}
                secureTextEntry
              />
              <TouchableOpacity
                style={styles.boutonSecurite}
                onPress={validerChangementMdp}
                disabled={securiteEnCours}
              >
                <Text style={styles.boutonSecuriteTexte}>Changer le mot de passe</Text>
              </TouchableOpacity>

              <Text style={styles.libelleSecurite}>Code de secours</Text>
              <Text style={styles.explicationSecurite}>
                Il sert à récupérer ton compte si tu oublies ton mot de passe
                (« Mot de passe oublié ? » sur l'écran de connexion). En
                regénérer un nouveau annule l'ancien.
              </Text>
              {codeSecoursAffiche && (
                <Text style={styles.codeSecours}>{codeSecoursAffiche}</Text>
              )}
              <TouchableOpacity
                style={styles.boutonSecurite}
                onPress={regenererCodeSecours}
                disabled={securiteEnCours}
              >
                <Text style={styles.boutonSecuriteTexte}>
                  {codeSecoursAffiche ? 'Regénérer encore' : '🔑 Regénérer mon code de secours'}
                </Text>
              </TouchableOpacity>

              {messageSecurite && (
                <Text style={[styles.messageSecurite, messageSecurite.erreur && { color: colors.rouge }]}>
                  {messageSecurite.texte}
                </Text>
              )}
            </>
          )}
        </View>
      )}

      {/* MODE TEST — n'apparaît que sur un compte administrateur (drapeau
          `admin` renvoyé par le serveur, activable uniquement en base). */}
      {estConnecte && u.admin ? <PanneauModeTest onChangement={rafraichir} /> : null}

      {estConnecte && (
        <TouchableOpacity style={styles.boutonDeconnexion} onPress={seDeconnecter}>
          <Text style={styles.boutonDeconnexionTexte}>🚪 Se déconnecter</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: da.fond },
  contenu: { padding: espacement.m, gap: 14 },

  // ---- En-tête de marque ----
  enteteMarque: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  surtitre: { color: da.texteGris, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  titreMarque: { color: da.texte, fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  badgeSaison: {
    borderWidth: 1, borderColor: da.bordureOrDouce, borderRadius: 6,
    paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center',
  },
  badgeSaisonTitre: { color: da.or, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  badgeSaisonValeur: { color: da.texteGris, fontSize: 10, marginTop: 2 },

  // ---- Trois chiffres clés ----
  ligneTuiles: { flexDirection: 'row', gap: 10 },
  tuile: {
    flex: 1, backgroundColor: da.carte, borderWidth: 1, borderColor: da.bordureFine,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center',
  },
  tuileValeur: { color: da.texte, fontSize: 22, fontWeight: '900', fontFamily: monospace },
  tuileLibelle: { color: da.texteGris, fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },

  // ---- Appel à l'action : l'arène ----
  carteDuel: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: da.duelFond, borderWidth: 1, borderColor: da.bordureOr,
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18,
  },
  pastilleVS: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: da.or,
    alignItems: 'center', justifyContent: 'center',
  },
  pastilleVSTexte: { color: da.orSombre, fontWeight: '900', fontSize: 15 },
  duelTitre: { color: da.or, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  duelSousTitre: { color: da.texteDoux, fontSize: 11.5, marginTop: 2 },
  duelChevron: { color: da.or, fontSize: 20, fontWeight: '900' },

  // ---- Top 3 du classement ----
  carteTop: {
    backgroundColor: da.carte, borderWidth: 1, borderColor: da.bordureFine,
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
  },
  ligneEnteteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  titreBloc: { color: da.texte, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  lienTop: { color: da.or, fontSize: 11, fontWeight: '700' },
  ligneTop: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: da.bordureFine, marginTop: 6,
  },
  rangTop: { color: da.texteGris, fontSize: 11, width: 16, fontFamily: monospace },
  nomTop: { flex: 1, color: da.texte, fontSize: 13, fontWeight: '700' },
  ligueTop: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  carteCategorie: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: da.carte, borderWidth: 1, borderColor: da.bordureFine,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
  },
  libelleCategorie: { color: da.texteGris, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  valeurCategorie: { color: da.or, fontSize: 16, fontWeight: '900', fontFamily: monospace },

  entete: { flexDirection: 'row', alignItems: 'center', marginBottom: espacement.l },
  pseudo: { color: colors.texte, fontSize: 24, fontWeight: '800' },
  sousTitre: { color: colors.texteGris, fontSize: 14, marginTop: 2 },
  badgeSerie: {
    backgroundColor: colors.carte,
    borderRadius: 12,
    paddingHorizontal: espacement.s,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  badgeSerieTexte: { color: colors.or, fontWeight: '700' },
  carteCompetition: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
    marginBottom: espacement.l,
  },
  pointsCompetition: { color: colors.or, fontWeight: '800', fontSize: 16 },
  listeTitres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espacement.s },
  chipTitre: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.or,
  },
  chipTitreTexte: { color: colors.or, fontSize: 12, fontWeight: '700' },
  carteLigue: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
    marginBottom: espacement.l,
  },
  carteTitre: { color: colors.texte, fontWeight: '700', marginBottom: espacement.s },
  ligneProgression: { flexDirection: 'row', alignItems: 'center' },
  pointsTexte: { color: colors.texteGris, fontSize: 12, marginLeft: espacement.s },
  indice: { color: colors.texteGris, fontSize: 12, marginTop: espacement.s },
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
  carteTitres: {
    backgroundColor: colors.carte, borderRadius: 14, padding: espacement.m,
    borderWidth: 1, borderColor: colors.bordure, marginBottom: espacement.m,
  },
  explicationTitres: { color: colors.texteGris, fontSize: 12, lineHeight: 17, marginBottom: espacement.s },
  sousTitreTitres: {
    color: colors.texte, fontWeight: '700', fontSize: 13,
    marginTop: espacement.m, marginBottom: 4,
  },
  ligneTitre: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  emblemeTitre: { fontSize: 16, width: 22, textAlign: 'center' },
  libelleTitre: { color: colors.texte, fontSize: 13, fontWeight: '600', flex: 1 },
  indiceTitre: { color: colors.texteGris, fontSize: 11, marginTop: 1 },
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
  perfLigue: { fontWeight: '800' },
  // La marge basse passe ici : c'est maintenant le dernier bloc avant
  // « Bilan compétition » (la ligne de saisie de séance a été retirée).
  ligneStats: { flexDirection: 'row', marginBottom: espacement.l },
  boutonDeconnexion: {
    marginTop: espacement.l,
    marginBottom: espacement.xl,
    paddingVertical: 12,
    alignItems: 'center',
  },
  boutonDeconnexionTexte: { color: colors.texteGris, fontWeight: '600', fontSize: 13 },
  carteSecurite: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    borderWidth: 1,
    borderColor: colors.bordure,
    marginTop: espacement.m,
  },
  titreSecurite: { color: colors.texte, fontWeight: '700', fontSize: 15 },
  libelleSecurite: {
    color: colors.texte, fontWeight: '600', marginTop: espacement.m, marginBottom: 6,
  },
  explicationSecurite: { color: colors.texteGris, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  champSecurite: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: 12,
    color: colors.texte,
    marginBottom: 8,
  },
  boutonSecurite: {
    backgroundColor: colors.carteClaire,
    borderWidth: 1,
    borderColor: colors.or,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  boutonSecuriteTexte: { color: colors.or, fontWeight: '700', fontSize: 13 },
  codeSecours: {
    color: colors.or, fontSize: 26, fontWeight: '800', textAlign: 'center',
    letterSpacing: 3, marginVertical: espacement.s,
  },
  messageSecurite: { color: colors.vert, marginTop: espacement.s, fontSize: 13 },
});
