// Écran Compétition : classements Fitness Royale (Global / Par poids / Salles) et défis.
// Les classements n'affichent QUE le rang — le palier moyen est un calcul interne.
// Les points (duels + défis) servent uniquement à départager les égalités.
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import {
  classer, classerParCategories, classerSalles, classerParExercice, listeExercicesClassement,
} from '../logic/classement';
import { couleursLigues, nomsLigues, baremes } from '../data/clubSP';
import { areneDeLaLigue } from '../data/arenes';
import CarteDuel from '../components/CarteDuel';
import DuelDirect from '../components/DuelDirect';
import DuelEnLigne from '../components/DuelEnLigne';
import AvatarJoueur from '../components/AvatarJoueur';

// Une ligne de classement de joueurs.
function LigneJoueur({ joueur, index }) {
  return (
    <View style={[styles.ligneClassement, joueur.moi && styles.ligneMoi]}>
      <View style={styles.rangBloc}>
        <Text style={styles.rang}>{index === 0 ? '1er' : `${index + 1}e`}</Text>
        {index < 3 && <Text style={styles.medaille}>{['🥇', '🥈', '🥉'][index]}</Text>}
      </View>
      <AvatarJoueur pseudo={joueur.pseudo} ligue={joueur.ligue} taille={36} />
      <View style={{ flex: 1, marginLeft: espacement.s }}>
        <Text style={[styles.nom, joueur.moi && { color: colors.or }]}>
          {joueur.pseudo} {joueur.moi ? '(moi)' : ''}
        </Text>
        <Text style={[styles.ligueBadge, { color: couleursLigues[joueur.ligue] }]}>
          {areneDeLaLigue(joueur.ligue).nom} • {joueur.poids} kg{joueur.salle ? ` • 🏠 ${joueur.salle}` : ''}
        </Text>
      </View>
    </View>
  );
}

// Une ligne de classement PAR EXERCICE : montre la valeur brute (kg ou reps)
// et le palier atteint SUR CET EXERCICE, plutôt que la ligue globale.
function LigneJoueurExercice({ joueur, index, unite }) {
  const nomLigueExo = joueur.palierExo === 0 ? 'Aucune' : nomsLigues[joueur.palierExo - 1];
  return (
    <View style={[styles.ligneClassement, joueur.moi && styles.ligneMoi]}>
      <View style={styles.rangBloc}>
        <Text style={styles.rang}>{index === 0 ? '1er' : `${index + 1}e`}</Text>
        {index < 3 && <Text style={styles.medaille}>{['🥇', '🥈', '🥉'][index]}</Text>}
      </View>
      <AvatarJoueur pseudo={joueur.pseudo} ligue={joueur.ligue} taille={36} />
      <View style={{ flex: 1, marginLeft: espacement.s }}>
        <Text style={[styles.nom, joueur.moi && { color: colors.or }]}>
          {joueur.pseudo} {joueur.moi ? '(moi)' : ''}
        </Text>
        <Text style={[styles.ligueBadge, { color: couleursLigues[nomLigueExo] }]}>
          {joueur.valeurExo} {unite === 'kg' ? 'kg' : 'reps'} • {nomLigueExo}
        </Text>
      </View>
    </View>
  );
}

// Carte d'un défi récurrent (journalier / hebdomadaire).
function CarteDefiRecurrent({ defi, fait, onValider }) {
  return (
    <View style={[styles.carteRecurrent, fait && styles.carteRecurrentFait]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.recurrentTitre}>
          {defi.id === 'jour' ? '📅' : '🗓️'} {defi.titre}
        </Text>
        <Text style={styles.recurrentDescription}>{defi.description}</Text>
        <Text style={styles.recurrentRecompense}>
          +{defi.points} pts{defi.titreRecompense ? ` • Titre : « ${defi.titreRecompense} »` : ''}
        </Text>
      </View>
      {fait ? (
        <Text style={styles.recurrentFaitTexte}>✅ Fait</Text>
      ) : (
        <TouchableOpacity style={styles.boutonValider} onPress={onValider}>
          <Text style={styles.boutonValiderTexte}>Valider</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CompetitionScreen({
  joueurs, moi, duels, jouerDepartage, terminerDuelDirect, defisRecurrents, defisFaits, validerDefi,
  estConnecte, rafraichirMonProfil, demandeDuel,
}) {
  const [onglet, setOnglet] = useState('classement'); // 'classement' ou 'defis'
  const [mode, setMode] = useState('global'); // 'global' | 'relatif' | 'exercice' | 'salles'
  const [exerciceChoisi, setExerciceChoisi] = useState(listeExercicesClassement[0]);
  const [selecteurExoOuvert, setSelecteurExoOuvert] = useState(false);
  const [duelDirectActif, setDuelDirectActif] = useState(false);
  const [duelEnLigneActif, setDuelEnLigneActif] = useState(false);

  // La touche VS du Profil amène ICI et doit proposer un duel tout de suite,
  // pas le classement (demande de Hafiz du 01/09/2026). `demandeDuel` est un
  // compteur incrémenté par App.js à chaque appui : on bascule sur l'onglet
  // Défis, où vivent les deux façons de jouer (en direct / en ligne).
  // On ignore la valeur initiale (0), sinon l'écran s'ouvrirait toujours là.
  useEffect(() => {
    if (demandeDuel) setOnglet('defis');
  }, [demandeDuel]);

  const lignesGlobal = classer(joueurs, 'global');
  const groupes = classerParCategories(joueurs);
  const salles = classerSalles(joueurs);
  const lignesExercice = classerParExercice(lignesGlobal, exerciceChoisi);
  const uniteExercice = (baremes.homme[exerciceChoisi] || baremes.femme[exerciceChoisi] || {}).unite;

  const MODES = [
    { cle: 'global', libelle: '🌍 Global' },
    { cle: 'relatif', libelle: '⚖️ Par poids' },
    { cle: 'exercice', libelle: '🏋️ Par exercice' },
    { cle: 'salles', libelle: '🏠 Salles' },
  ];
  const EXPLICATIONS = {
    global: 'Tout le monde, classé sur les performances vérifiées (barème Fitness Royale).',
    relatif: 'Mêmes règles, mais par catégorie de poids : compare-toi aux gabarits similaires.',
    exercice: "Qui est le plus fort sur CET exercice précis (perfs vérifiées uniquement).",
    salles: 'Chaque salle est un clan, classé sur le niveau de ses membres. Quelle salle est la plus forte ?',
  };

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>⚔️ Compétition</Text>
      <Text style={styles.sousTitre}>Classement Fitness Royale</Text>

      {/* Sélecteur Classement / Défis */}
      <View style={styles.selecteur}>
        <TouchableOpacity
          style={[styles.ongletBtn, onglet === 'classement' && styles.ongletActif]}
          onPress={() => setOnglet('classement')}
        >
          <Text style={[styles.ongletTexte, onglet === 'classement' && styles.ongletTexteActif]}>
            Classement
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ongletBtn, onglet === 'defis' && styles.ongletActif]}
          onPress={() => setOnglet('defis')}
        >
          <Text style={[styles.ongletTexte, onglet === 'defis' && styles.ongletTexteActif]}>
            Défis
          </Text>
        </TouchableOpacity>
      </View>

      {onglet === 'classement' && (
        <>
          <View style={styles.bascule}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.cle}
                style={[styles.basculeBtn, mode === m.cle && styles.basculeActif]}
                onPress={() => setMode(m.cle)}
              >
                <Text style={[styles.basculeTexte, mode === m.cle && styles.basculeTexteActif]}>
                  {m.libelle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.explication}>{EXPLICATIONS[mode]}</Text>
          {mode === 'exercice' && (
            <>
              {/* Liste OUVERTE : l'en-tête n'affiche plus le nom de l'exercice
                  choisi, sinon il apparaissait deux fois à l'écran — une fois
                  ici, une fois dans la liste juste en dessous (retour de Hafiz
                  du 01/09/2026 : « développé couché est affiché deux fois »).
                  Le choix courant est repéré par un point plein dans la liste. */}
              <TouchableOpacity style={styles.selecteurExo} onPress={() => setSelecteurExoOuvert(!selecteurExoOuvert)}>
                <Text style={{ color: selecteurExoOuvert ? colors.texteGris : colors.texte }}>
                  {selecteurExoOuvert ? 'Choisis un exercice…' : exerciceChoisi}
                </Text>
                <Text style={{ color: colors.texteGris }}>{selecteurExoOuvert ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {selecteurExoOuvert && (
                <View style={styles.listeExoDeroulante}>
                  <ScrollView style={{ maxHeight: 220 }}>
                    {listeExercicesClassement.map((exo) => {
                      const actif = exo === exerciceChoisi;
                      return (
                        <TouchableOpacity
                          key={exo}
                          style={styles.choixExo}
                          onPress={() => { setExerciceChoisi(exo); setSelecteurExoOuvert(false); }}
                        >
                          <Text style={{ color: actif ? colors.or : colors.texte, fontWeight: actif ? '700' : '400' }}>
                            {actif ? '● ' : '○ '}{exo}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: espacement.xl }}>
        {/* ----- DÉFIS ----- */}
        {onglet === 'defis' && duelDirectActif && (
          <DuelDirect
            moi={moi}
            onTerminer={(duel) => { terminerDuelDirect(duel); setDuelDirectActif(false); }}
            onAnnuler={() => setDuelDirectActif(false)}
          />
        )}
        {onglet === 'defis' && !duelDirectActif && duelEnLigneActif && (
          <DuelEnLigne
            moi={moi}
            onFermer={() => setDuelEnLigneActif(false)}
            onDuelTermine={rafraichirMonProfil}
          />
        )}
        {onglet === 'defis' && !duelDirectActif && !duelEnLigneActif && (
          <>
            <TouchableOpacity style={styles.boutonDuelDirect} onPress={() => setDuelDirectActif(true)}>
              <Text style={styles.boutonDuelDirectTexte}>⚡ Lancer un duel en direct</Text>
              <Text style={styles.boutonDuelDirectSousTexte}>
                Vous êtes deux dans la salle ? Le téléphone arbitre.
              </Text>
            </TouchableOpacity>
            {estConnecte && (
              <TouchableOpacity style={styles.boutonDuelEnLigne} onPress={() => setDuelEnLigneActif(true)}>
                <Text style={styles.boutonDuelDirectTexte}>🌐 Duel en ligne (à deux téléphones)</Text>
                <Text style={styles.boutonDuelDirectSousTexte}>
                  Crée un duel et partage un code, ou rejoins-en un.
                </Text>
              </TouchableOpacity>
            )}
            {defisRecurrents.map((defi) => (
              <CarteDefiRecurrent
                key={defi.id}
                defi={defi}
                fait={!!defisFaits[defi.id]}
                onValider={() => validerDefi(defi)}
              />
            ))}
            <Text style={styles.sectionTitre}>Mes duels — premier à 2 victoires</Text>
            {duels.map((duel) => (
              <CarteDuel key={duel.id} duel={duel} onJouerRoundIA={() => jouerDepartage(duel.id)} />
            ))}
          </>
        )}

        {/* ----- CLASSEMENTS ----- */}
        {onglet === 'classement' && mode === 'global' &&
          lignesGlobal.map((joueur, index) => (
            <LigneJoueur key={joueur.id} joueur={joueur} index={index} />
          ))}

        {onglet === 'classement' && mode === 'relatif' &&
          groupes.map((groupe) => (
            <View key={groupe.categorie}>
              <Text style={styles.titreCategorie}>🏋️ Catégorie {groupe.categorie}</Text>
              {groupe.joueurs.map((joueur, index) => (
                <LigneJoueur key={joueur.id} joueur={joueur} index={index} />
              ))}
            </View>
          ))}

        {onglet === 'classement' && mode === 'exercice' && lignesExercice.length === 0 && (
          <Text style={styles.explication}>Personne n'a encore de perf vérifiée sur cet exercice.</Text>
        )}
        {onglet === 'classement' && mode === 'exercice' &&
          lignesExercice.map((joueur, index) => (
            <LigneJoueurExercice key={joueur.id} joueur={joueur} index={index} unite={uniteExercice} />
          ))}

        {onglet === 'classement' && mode === 'salles' &&
          salles.map((s, index) => (
            <View key={s.salle} style={styles.ligneClassement}>
              <View style={styles.rangBloc}>
                <Text style={styles.rang}>{index === 0 ? '1er' : `${index + 1}e`}</Text>
                {index < 3 && <Text style={styles.medaille}>{['🥇', '🥈', '🥉'][index]}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nom}>🏠 {s.salle}</Text>
                <Text style={styles.ligueBadge}>
                  {s.nbMembres} membre{s.nbMembres > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: colors.fond, padding: espacement.m },
  titre: { color: colors.texte, fontSize: 24, fontWeight: '800' },
  sousTitre: { color: colors.texteGris, marginBottom: espacement.m },
  selecteur: {
    flexDirection: 'row',
    backgroundColor: colors.carte,
    borderRadius: 12,
    padding: 4,
    marginBottom: espacement.s,
  },
  ongletBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  ongletActif: { backgroundColor: colors.accent },
  ongletTexte: { color: colors.texteGris, fontWeight: '600' },
  ongletTexteActif: { color: colors.texte },
  bascule: { flexDirection: 'row', gap: 6, marginBottom: espacement.s },
  basculeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.carte,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  basculeActif: { borderColor: colors.or },
  basculeTexte: { color: colors.texteGris, fontSize: 12, fontWeight: '600' },
  basculeTexteActif: { color: colors.or },
  explication: { color: colors.texteGris, fontSize: 12, marginBottom: espacement.m },
  selecteurExo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.carte,
    borderRadius: 10,
    padding: 12,
    marginBottom: espacement.s,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  listeExoDeroulante: {
    backgroundColor: colors.carte,
    borderRadius: 10,
    marginBottom: espacement.s,
    overflow: 'hidden',
  },
  choixExo: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.bordure,
  },
  sectionTitre: {
    color: colors.texte,
    fontSize: 18,
    fontWeight: '700',
    marginTop: espacement.s,
    marginBottom: espacement.s,
  },
  titreCategorie: {
    color: colors.texte,
    fontWeight: '800',
    fontSize: 15,
    marginTop: espacement.s,
    marginBottom: espacement.s,
  },
  ligneClassement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carte,
    borderRadius: 12,
    padding: espacement.m,
    marginBottom: espacement.s,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  ligneMoi: { borderColor: colors.or },
  rangBloc: { width: 44, alignItems: 'center' },
  rang: { fontSize: 14, color: colors.texte, fontWeight: '800' },
  medaille: { fontSize: 12, marginTop: 1 },
  nom: { color: colors.texte, fontWeight: '600' },
  ligueBadge: { fontSize: 12, fontWeight: '700', marginTop: 2, color: colors.texteGris },
  boutonDuelDirect: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: espacement.m,
    alignItems: 'center',
    marginBottom: espacement.s,
  },
  boutonDuelDirectTexte: { color: colors.texte, fontWeight: '800', fontSize: 16 },
  boutonDuelDirectSousTexte: { color: '#DCE6F5', fontSize: 12, marginTop: 2 },
  boutonDuelEnLigne: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    alignItems: 'center',
    marginBottom: espacement.s,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  carteRecurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    marginBottom: espacement.s,
    borderWidth: 1,
    borderColor: colors.or,
  },
  carteRecurrentFait: { borderColor: colors.bordure, opacity: 0.7 },
  recurrentTitre: { color: colors.texte, fontWeight: '800', fontSize: 15 },
  recurrentDescription: { color: colors.texteGris, fontSize: 13, marginTop: 2 },
  recurrentRecompense: { color: colors.or, fontSize: 12, fontWeight: '700', marginTop: 4 },
  recurrentFaitTexte: { color: colors.vert, fontWeight: '800', marginLeft: 8 },
  boutonValider: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginLeft: 8,
  },
  boutonValiderTexte: { color: colors.texte, fontWeight: '700' },
});
