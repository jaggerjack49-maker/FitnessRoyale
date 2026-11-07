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
import TestPompes from '../components/TestPompes';
import useRetour from '../useRetour';
import AvatarJoueur from '../components/AvatarJoueur';
import usePlaceDefilement from '../usePlaceDefilement';
import { da } from '../designSystem';
import { couleurMedaille } from '../logic/titres';
import { Icone, TexteIcone, LibelleIcone } from '../components/Icones';

// UNE ENTRÉE DE L'ONGLET DÉFIS (08/11/2026) — même dessin que les lignes de
// raccourci de l'onglet Entraînement : une pastille d'icône, un titre, une
// phrase, un chevron. `principale` la passe en OR PLEIN, comme « SÉANCE
// LIBRE » : c'est l'action qu'on vient faire ici.
function EntreeDefi({ icone, titre, phrase, principale, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.entreeDefi, principale && styles.entreeDefiPrincipale]}
      onPress={onPress}
    >
      <View style={[styles.pastilleDefi, principale && styles.pastilleDefiPrincipale]}>
        <Icone nom={icone} taille={19} couleur={principale ? da.orSombre : colors.or} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.titreEntreeDefi, principale && { color: da.orSombre }]}>{titre}</Text>
        <Text style={[styles.phraseEntreeDefi, principale && { color: 'rgba(20,19,25,0.72)' }]}>
          {phrase}
        </Text>
      </View>
      <Icone nom="chevron-droit" taille={18} couleur={principale ? da.orSombre : colors.texteGris} />
    </TouchableOpacity>
  );
}

// Une ligne de classement de joueurs.
function LigneJoueur({ joueur, index }) {
  return (
    <View style={[styles.ligneClassement, joueur.moi && styles.ligneMoi]}>
      <View style={styles.rangBloc}>
        <Text style={styles.rang}>{index === 0 ? '1er' : `${index + 1}e`}</Text>
        {index < 3 && <Icone nom="medaille" taille={15} couleur={couleurMedaille(index + 1)} />}
      </View>
      <AvatarJoueur pseudo={joueur.pseudo} ligue={joueur.ligue} taille={36} />
      <View style={{ flex: 1, marginLeft: espacement.s }}>
        <Text style={[styles.nom, joueur.moi && { color: colors.or }]}>
          {joueur.pseudo} {joueur.moi ? '(moi)' : ''}
        </Text>
        <Text style={[styles.ligueBadge, { color: couleursLigues[joueur.ligue] }]}>
          {areneDeLaLigue(joueur.ligue).nom} • {joueur.poids} kg{joueur.salle ? ` • ${joueur.salle}` : ''}
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
        {index < 3 && <Icone nom="medaille" taille={15} couleur={couleurMedaille(index + 1)} />}
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
// UN DÉFI TEL QUE LE SERVEUR LE VOIT (24/09/2026).
// `fait` = déjà validé (la récompense est donnée) ; `reussi` = les conditions
// sont remplies. AUCUN bouton « Valider » : l'app valide toute seule dès que
// c'est gagné (demande de Hafiz). La simulation locale qui restait pour le mode
// hors-ligne a disparu avec lui le 26/09/2026 — sans serveur, personne ne peut
// vérifier qu'une séance a vraiment été faite.
function CarteDefiRecurrent({ defi, fait, reussi }) {
  return (
    <View style={[styles.carteRecurrent, fait && styles.carteRecurrentFait]}>
      <View style={{ flex: 1 }}>
        <TexteIcone nom="calendrier" taille={15} couleur={colors.or} style={styles.recurrentTitre}>
          {defi.titre}
        </TexteIcone>
        <Text style={styles.recurrentDescription}>{defi.description}</Text>
        <Text style={styles.recurrentRecompense}>
          +{defi.points} pts{defi.titreRecompense ? ` • Titre : « ${defi.titreRecompense} »` : ''}
        </Text>
        {!fait && (
          <TexteIcone
            nom={reussi ? 'valide' : 'horloge'}
            taille={13}
            hautAligne
            couleur={reussi ? colors.vert : colors.texteGris}
            style={styles.recurrentEtat}
          >
            {reussi
              ? 'Réussi — la récompense arrive…'
              : 'Pas encore : il se validera tout seul dès que ce sera fait.'}
          </TexteIcone>
        )}
      </View>
      {fait ? (
        <LibelleIcone nom="valide" taille={15} ecart={4} style={styles.recurrentFaitTexte}>Fait</LibelleIcone>
      ) : null}
    </View>
  );
}

export default function CompetitionScreen({
  joueurs, moi, duels, terminerDuelDirect,
  rafraichirMonProfil, demandeDuel, actif = true,
  etatDefis = null, verifierDefis,
}) {
  // On regarde les défis en arrivant sur l'onglet : si une séance a été faite
  // entre-temps, la récompense est donnée sans que rien ne soit à toucher.
  useEffect(() => {
    if (actif && verifierDefis) verifierDefis();
  }, [actif]);

  // LES DÉFIS VIENNENT DU SERVEUR, ET DE LUI SEUL (26/09/2026) : c'est lui qui
  // sait quelles séances ont été faites. `etatDefis` est null tant qu'on ne les
  // a pas lus — on le dit, au lieu d'afficher des défis « pas encore réussis »
  // qui seraient une pure invention.
  const defisAffiches = (etatDefis || []).map((d) => ({
    id: d.id, titre: d.titre, description: d.description, points: d.points,
    titreRecompense: d.titre_recompense,
    fait: d.deja_valide, reussi: d.reussi,
  }));
  const [onglet, setOnglet] = useState('classement'); // 'classement' ou 'defis'
  const [mode, setMode] = useState('global'); // 'global' | 'relatif' | 'exercice' | 'salles'
  const [exerciceChoisi, setExerciceChoisi] = useState(listeExercicesClassement[0]);
  const [selecteurExoOuvert, setSelecteurExoOuvert] = useState(false);
  const [duelDirectActif, setDuelDirectActif] = useState(false);
  const [duelEnLigneActif, setDuelEnLigneActif] = useState(false);
  // Prototype du compteur de pompes (15/09/2026) — étape 1 du duel de pompes.
  const [testPompesActif, setTestPompesActif] = useState(false);
  // Retour Android (16/09/2026) : ferme le test de pompes. Les DUELS, eux, ne
  // se ferment pas au retour — on perdrait une partie en cours ; le retour
  // passe alors à App.js (Profil), et le duel reste ouvert dans cet onglet.
  useRetour(actif && onglet === 'defis' && testPompesActif, () => {
    setTestPompesActif(false);
    return true;
  });

  // Garder sa place (14/09/2026) : chaque vue de la liste — un mode de
  // classement, les défis — retrouve son défilement quand on y revient. Avant,
  // fermer un duel ou revenir de « Défis » remettait la liste en haut.
  // Un duel ouvert, lui, repart toujours en haut (`memoriser: false`).
  const duelOuvert = onglet === 'defis' && (duelDirectActif || duelEnLigneActif || testPompesActif);
  const vueListe = onglet === 'classement'
    ? `classement-${mode}`
    : duelDirectActif ? 'duelDirect' : duelEnLigneActif ? 'duelEnLigne'
      : testPompesActif ? 'testPompes' : 'defis';
  const placeListe = usePlaceDefilement(vueListe, { memoriser: !duelOuvert });

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
    { cle: 'global', libelle: 'Global', icone: 'globe' },
    { cle: 'relatif', libelle: 'Par poids', icone: 'balance' },
    // L'haltère ramassé, pas la barre : à 18 px dans une puce, la barre longue
    // et fine se lisait comme une flèche ↔ (vu à l'écran, 08/11/2026).
    { cle: 'exercice', libelle: 'Exercice', icone: 'mat-halteres' },
    { cle: 'salles', libelle: 'Salles', icone: 'salle' },
  ];
  const EXPLICATIONS = {
    global: 'Tout le monde, classé sur les performances vérifiées (barème Fitness Royale).',
    relatif: 'Mêmes règles, mais par catégorie de poids : compare-toi aux gabarits similaires.',
    exercice: "Qui est le plus fort sur CET exercice précis (perfs vérifiées uniquement).",
    salles: 'Chaque salle est un clan, classé sur le niveau de ses membres. Quelle salle est la plus forte ?',
  };

  return (
    <View style={styles.conteneur}>
      <TexteIcone nom="competition" taille={20} couleur={colors.or} style={styles.titre}>
        Compétition
      </TexteIcone>
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
                <Icone nom={m.icone} taille={18} couleur={mode === m.cle ? colors.or : colors.texteGris} />
                <Text style={[styles.basculeTexte, mode === m.cle && styles.basculeTexteActif]} numberOfLines={1}>
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
                <Icone nom={selecteurExoOuvert ? 'chevron-haut' : 'chevron-bas'} taille={16} couleur={colors.texteGris} />
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

      <ScrollView key={vueListe} {...placeListe} contentContainerStyle={{ paddingBottom: espacement.xl }}>
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
        {onglet === 'defis' && !duelDirectActif && !duelEnLigneActif && testPompesActif && (
          // La caméra ne tourne QUE si l'onglet est à l'écran : les onglets
          // restent en place pour le glissement (voir App.js), et une caméra
          // allumée hors écran viderait la batterie pour rien.
          actif
            ? <TestPompes onFermer={() => setTestPompesActif(false)} />
            : <Text style={styles.explication}>Caméra en pause — reviens sur cet onglet pour reprendre.</Text>
        )}
        {onglet === 'defis' && !duelDirectActif && !duelEnLigneActif && !testPompesActif && (
          <>
            <EntreeDefi
              principale
              icone="eclair"
              titre="DUEL EN DIRECT"
              phrase="Vous êtes deux dans la salle ? Le téléphone arbitre."
              onPress={() => setDuelDirectActif(true)}
            />
            <EntreeDefi
              icone="globe"
              titre="Duel en ligne"
              phrase="À deux téléphones : crée un duel et partage un code, ou rejoins-en un."
              onPress={() => setDuelEnLigneActif(true)}
            />
            <EntreeDefi
              icone="appareil-photo"
              titre="Tester le compteur de pompes"
              phrase="Prototype : la caméra compte tes pompes, face au téléphone."
              onPress={() => setTestPompesActif(true)}
            />
            <Text style={styles.libelleSection}>DÉFIS RÉCURRENTS</Text>
            {etatDefis === null && (
              <Text style={styles.explication}>Chargement des défis…</Text>
            )}
            {defisAffiches.map((defi) => (
              <CarteDefiRecurrent
                key={defi.id}
                defi={defi}
                fait={defi.fait}
                reussi={defi.reussi}
              />
            ))}
            {/* L'historique des duels EN DIRECT joués depuis le lancement de
                l'app (les duels de démonstration ont disparu le 26/09/2026 avec
                le mode hors-ligne). Celui des duels EN LIGNE, que le serveur
                garde pourtant, n'est pas encore affiché — voir « À faire ». */}
            {duels.length > 0 && (
              <Text style={styles.libelleSection}>MES DUELS — PREMIER À 2 VICTOIRES</Text>
            )}
            {duels.map((duel) => (
              <CarteDuel key={duel.id} duel={duel} />
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
              <Text style={styles.libelleSection}>CATÉGORIE {String(groupe.categorie).toUpperCase()}</Text>
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
                {index < 3 && <Icone nom="medaille" taille={15} couleur={couleurMedaille(index + 1)} />}
              </View>
              <View style={{ flex: 1 }}>
                <TexteIcone nom="salle" taille={15} couleur={colors.or} style={styles.nom}>{s.salle}</TexteIcone>
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
  // Le sélecteur Classement / Défis reprend la PASTILLE de la barre d'onglets
  // (voile d'or + liseré d'or) au lieu du cyan plein : un même geste — choisir
  // une vue — se dessine pareil partout dans l'app (08/11/2026).
  ongletBtn: {
    flex: 1, minHeight: 42, justifyContent: 'center', borderRadius: 9, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  ongletActif: { backgroundColor: da.orVoileFort, borderColor: 'rgba(232, 178, 58, 0.22)' },
  ongletTexte: { color: colors.texteGris, fontWeight: '700' },
  ongletTexteActif: { color: colors.or, fontWeight: '800' },
  bascule: { flexDirection: 'row', gap: 6, marginBottom: espacement.s },
  // Icône AU-DESSUS du libellé, comme la barre d'onglets : quatre libellés
  // côte à côte ne tiendraient pas sur une ligne avec leur icône devant.
  basculeBtn: {
    flex: 1,
    minHeight: 54,
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.carte,
    borderWidth: 1,
    borderColor: colors.bordure,
  },
  basculeActif: { borderColor: da.bordureOr, backgroundColor: da.orVoile },
  basculeTexte: { color: colors.texteGris, fontSize: 11, fontWeight: '700' },
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
  // Les petites capitales espacées des titres de section de l'Entraînement.
  libelleSection: {
    color: colors.texteGris, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
    marginTop: espacement.m, marginBottom: espacement.s,
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
  nom: { color: colors.texte, fontWeight: '600' },
  ligueBadge: { fontSize: 12, fontWeight: '700', marginTop: 2, color: colors.texteGris },
  entreeDefi: {
    flexDirection: 'row', alignItems: 'center', gap: espacement.s + 2,
    backgroundColor: colors.carte, borderRadius: 16, padding: espacement.m,
    borderWidth: 1, borderColor: colors.bordure, marginBottom: espacement.s,
    minHeight: 68,
  },
  entreeDefiPrincipale: { backgroundColor: colors.or, borderColor: colors.or },
  pastilleDefi: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: da.orVoile,
  },
  pastilleDefiPrincipale: { backgroundColor: 'rgba(0,0,0,0.18)' },
  titreEntreeDefi: { color: colors.texte, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  phraseEntreeDefi: { color: colors.texteGris, fontSize: 12, marginTop: 2, lineHeight: 16 },
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
  recurrentEtat: { color: colors.texteGris, fontSize: 12, marginTop: 4 },
  recurrentFaitTexte: { color: colors.vert, fontWeight: '800', marginLeft: 8 },

});
