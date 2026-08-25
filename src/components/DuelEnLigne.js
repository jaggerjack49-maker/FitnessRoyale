// DUEL EN LIGNE (à deux téléphones, via le backend) : un joueur crée un duel
// et reçoit un CODE à partager (verbalement, message…), l'autre le rejoint
// avec ce code. Chacun joue depuis SON téléphone — mêmes règles que le duel
// en direct : charge fixe, le plus de reps gagne, BO3 (R1 challenger,
// R2 adversaire, R3 IA), premier à 2 victoires.
//
// Pas de WebSocket pour l'instant : l'app re-consulte le serveur toutes les
// 3 secondes (polling) pour voir si l'adversaire a joué son coup.
//
// STATUT EN DIRECT (chrono de série) : comme on ne peut pas taper "+1" les
// mains occupées sous la barre, chaque joueur signale juste "je commence" /
// puis entre son total à la fin. L'adversaire voit un chrono tourner pendant
// ce temps — pas une preuve à 100%, mais un vrai statut "en direct" sans
// avoir besoin de toucher le téléphone pendant l'effort (voir CLAUDE.md).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, espacement } from '../theme';
import { baremes } from '../data/clubSP';
import * as api from '../api';

const DELAI_POLLING_MS = 3000;

// Compte les rounds gagnés à partir du format serveur (reps_challenger/reps_adversaire).
function comptageVictoiresServeur(rounds) {
  let challenger = 0;
  let adversaire = 0;
  rounds.forEach((r) => {
    if (r.reps_challenger == null || r.reps_adversaire == null) return;
    if (r.reps_challenger > r.reps_adversaire) challenger++;
    else if (r.reps_adversaire > r.reps_challenger) adversaire++;
  });
  return { challenger, adversaire };
}

export default function DuelEnLigne({ moi, onFermer, onDuelTermine }) {
  const [etape, setEtape] = useState('menu'); // 'menu' | 'code_saisie' | 'jeu'
  const [duel, setDuel] = useState(null);
  const [codeSaisi, setCodeSaisi] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  // Champs du round en cours (choix d'exercice + mes reps).
  const [exerciceChoisi, setExerciceChoisi] = useState(null);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [chargeSaisie, setChargeSaisie] = useState('');
  const [repsSaisies, setRepsSaisies] = useState('');
  // true une fois que j'ai appuyé sur "Terminé" -> affiche le champ de reps.
  const [montrerSaisieReps, setMontrerSaisieReps] = useState(false);
  // Horloge locale (tick chaque seconde) pour afficher les chronos en direct.
  const [maintenant, setMaintenant] = useState(Date.now());

  const intervalleRef = useRef(null);
  const exercicesKg = Object.keys(baremes[moi.sexe]).filter(
    (exo) => baremes[moi.sexe][exo].unite === 'kg'
  );

  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Secondes écoulées depuis un horodatage ISO envoyé par le serveur.
  // Garde-fou : si jamais la date est illisible (Invalid Date), on affiche 0
  // plutôt que "NaNs" — voir CLAUDE.md, bug de précision ISO sur Android.
  function secondesDepuis(isoDebut) {
    if (!isoDebut) return 0;
    const debut = new Date(isoDebut).getTime();
    if (isNaN(debut)) return 0;
    return Math.max(0, Math.floor((maintenant - debut) / 1000));
  }

  // Polling : tant qu'un duel est en cours (attente d'adversaire ou en jeu),
  // on re-consulte le serveur régulièrement pour voir les coups de l'autre.
  useEffect(() => {
    if (!duel || duel.statut === 'termine') {
      clearInterval(intervalleRef.current);
      return;
    }
    intervalleRef.current = setInterval(async () => {
      try {
        const frais = await api.lireDuel(duel.id);
        setDuel(frais);
        if (frais.statut === 'en_cours' && etape !== 'jeu') setEtape('jeu');
        if (frais.statut === 'termine') onDuelTermine?.();
      } catch {
        // Coupure passagère : on retentera au prochain tick, rien à faire ici.
      }
    }, DELAI_POLLING_MS);
    return () => clearInterval(intervalleRef.current);
  }, [duel?.id, duel?.statut]);

  async function rejoindre() {
    if (!codeSaisi.trim()) return;
    setChargement(true);
    setErreur(null);
    try {
      const duelRejoint = await api.rejoindreDuel(codeSaisi.trim());
      setDuel(duelRejoint);
      setEtape('jeu');
    } catch (e) {
      setErreur(e.message || 'Code invalide.');
    } finally {
      setChargement(false);
    }
  }

  function viderChampsRound() {
    setExerciceChoisi(null);
    setListeOuverte(false);
    setChargeSaisie('');
    setRepsSaisies('');
    setMontrerSaisieReps(false);
  }

  async function validerExercice(numero) {
    const charge = parseFloat(chargeSaisie.replace(',', '.'));
    if (!exerciceChoisi || isNaN(charge) || charge <= 0) {
      setErreur('Choisis un exercice et une charge valide.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const frais = await api.choisirExercice(duel.id, numero, exerciceChoisi, charge);
      setDuel(frais);
      viderChampsRound();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  async function tirerIA() {
    setChargement(true);
    setErreur(null);
    try {
      const frais = await api.tirerIA(duel.id);
      setDuel(frais);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  // Signale "je commence ma série" -> l'adversaire voit un chrono en direct.
  async function demarrerMaSerie(numero) {
    setChargement(true);
    setErreur(null);
    try {
      const frais = await api.commencerRound(duel.id, numero);
      setDuel(frais);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  async function soumettreReps(numero) {
    const reps = parseInt(repsSaisies, 10);
    if (isNaN(reps) || reps < 0) {
      setErreur('Entre un nombre de répétitions valide.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const frais = await api.soumettreMesReps(duel.id, numero, reps);
      setDuel(frais);
      viderChampsRound();
      if (frais.statut === 'termine') onDuelTermine?.();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  // ----- Étape : menu (créer ou rejoindre) -----
  if (etape === 'menu') {
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>🌐 Duel en ligne</Text>
        <Text style={styles.explication}>
          Toi et ton adversaire jouez chacun depuis votre téléphone. Crée un
          duel et partage le code, ou rejoins un duel avec un code reçu.
        </Text>
        <TouchableOpacity
          style={styles.boutonPrincipal}
          onPress={async () => {
            setChargement(true);
            setErreur(null);
            try {
              const nouveauDuel = await api.creerDuelEnLigne(150);
              setDuel(nouveauDuel);
              setEtape('attente');
            } catch (e) {
              setErreur(e.message || 'Impossible de créer le duel.');
            } finally {
              setChargement(false);
            }
          }}
          disabled={chargement}
        >
          {chargement ? <ActivityIndicator color={colors.texte} /> : (
            <Text style={styles.boutonPrincipalTexte}>➕ Créer un duel</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape('rejoindre')}>
          <Text style={styles.boutonSecondaireTexte}>🔑 Rejoindre avec un code</Text>
        </TouchableOpacity>
        {erreur && <Text style={styles.message}>⚠️ {erreur}</Text>}
        <TouchableOpacity onPress={onFermer}>
          <Text style={styles.lienAnnuler}>Fermer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ----- Étape : saisir le code pour rejoindre -----
  if (etape === 'rejoindre') {
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>🔑 Rejoindre un duel</Text>
        <Text style={styles.libelle}>Code reçu de ton adversaire</Text>
        <TextInput
          style={styles.champ}
          value={codeSaisi}
          onChangeText={(t) => setCodeSaisi(t.toUpperCase())}
          placeholder="Ex. : K7XPQR"
          placeholderTextColor={colors.texteGris}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.boutonPrincipal} onPress={rejoindre} disabled={chargement}>
          {chargement ? <ActivityIndicator color={colors.texte} /> : (
            <Text style={styles.boutonPrincipalTexte}>Rejoindre</Text>
          )}
        </TouchableOpacity>
        {erreur && <Text style={styles.message}>⚠️ {erreur}</Text>}
        <TouchableOpacity onPress={() => setEtape('menu')}>
          <Text style={styles.lienAnnuler}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ----- Étape : en attente que l'adversaire rejoigne -----
  if (etape === 'attente') {
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>⏳ En attente d'un adversaire…</Text>
        <Text style={styles.explication}>Partage ce code avec ton adversaire :</Text>
        <Text style={styles.codeAffiche}>{duel.code}</Text>
        <ActivityIndicator color={colors.or} style={{ marginTop: espacement.m }} />
        <TouchableOpacity onPress={onFermer}>
          <Text style={styles.lienAnnuler}>Fermer (le duel reste ouvert)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ----- Étape : en jeu -----
  const estChallenger = duel.challenger_id === moi.id;
  const victoires = comptageVictoiresServeur(duel.rounds);
  const mesVictoires = estChallenger ? victoires.challenger : victoires.adversaire;
  const sesVictoires = estChallenger ? victoires.adversaire : victoires.challenger;

  if (duel.statut === 'termine') {
    const gagne = duel.gagnant_id === moi.id;
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>{gagne ? '🏆 Victoire !' : '💀 Défaite…'}</Text>
        <Text style={styles.scoreFinal}>{mesVictoires} — {sesVictoires}</Text>
        <Text style={styles.explication}>
          {gagne ? `+${duel.recompense} points pour toi !` : 'Pas de points cette fois — prends ta revanche !'}
        </Text>
        <TouchableOpacity style={styles.boutonPrincipal} onPress={onFermer}>
          <Text style={styles.boutonPrincipalTexte}>Fermer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Round actif = le premier qui n'a pas encore de résultat décisif.
  const roundActif = duel.rounds.find((r) => {
    const decisif = r.reps_challenger != null && r.reps_adversaire != null
      && r.reps_challenger !== r.reps_adversaire;
    return !decisif;
  });
  const numero = roundActif.numero;
  const cote = estChallenger ? 'challenger' : 'adversaire';
  const coteAdverse = estChallenger ? 'adversaire' : 'challenger';
  const mesReps = roundActif[`reps_${cote}`];
  const jaiDejaJoue = mesReps != null;
  const monDebut = roundActif[`${cote}_debut`];
  const sonDebut = roundActif[`${coteAdverse}_debut`];
  const sesReps = roundActif[`reps_${coteAdverse}`];

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>Round {numero} / 3</Text>
      <Text style={styles.score}>{mesVictoires} — {sesVictoires}</Text>

      {roundActif.exercice === null ? (
        // L'exercice n'est pas encore choisi pour ce round.
        numero === 3 ? (
          <>
            <Text style={styles.libelle}>Départage : l'IA choisit l'exercice</Text>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={tirerIA} disabled={chargement}>
              {chargement ? <ActivityIndicator color={colors.accent} /> : (
                <Text style={styles.boutonSecondaireTexte}>🎲 Tirer l'exercice au sort</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (numero === 1) === estChallenger ? (
          <>
            <Text style={styles.libelle}>C'est à toi de choisir l'exercice</Text>
            <TouchableOpacity style={styles.selecteurExo} onPress={() => setListeOuverte(!listeOuverte)}>
              <Text style={{ color: exerciceChoisi ? colors.texte : colors.texteGris }}>
                {exerciceChoisi || 'Choisir un exercice…'}
              </Text>
              <Text style={{ color: colors.texteGris }}>{listeOuverte ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {listeOuverte && exercicesKg.map((exo) => (
              <TouchableOpacity
                key={exo}
                style={styles.choixExo}
                onPress={() => { setExerciceChoisi(exo); setListeOuverte(false); }}
              >
                <Text style={{ color: colors.texte }}>{exo}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.libelle}>Charge (kg)</Text>
            <TextInput
              style={styles.champ}
              value={chargeSaisie}
              onChangeText={setChargeSaisie}
              keyboardType="numeric"
              placeholder="Ex. : 80"
              placeholderTextColor={colors.texteGris}
            />
            <TouchableOpacity
              style={styles.boutonPrincipal}
              onPress={() => validerExercice(numero)}
              disabled={chargement}
            >
              {chargement ? <ActivityIndicator color={colors.texte} /> : (
                <Text style={styles.boutonPrincipalTexte}>Valider l'exercice</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.explication}>
              ⏳ En attente que ton adversaire choisisse l'exercice de ce round…
            </Text>
            <ActivityIndicator color={colors.or} />
          </>
        )
      ) : jaiDejaJoue ? (
        <>
          <Text style={styles.choixIA}>{roundActif.exercice} @ {roundActif.charge} kg</Text>
          <Text style={styles.explication}>
            ✅ Tes reps sont enregistrées ({mesReps}). En attente de l'adversaire…
          </Text>
          <View style={styles.blocAdversaire}>
            {sonDebut ? (
              <Text style={styles.indiceAdversaire}>
                🏋️ Il/elle est en train de faire sa série… {secondesDepuis(sonDebut)}s
              </Text>
            ) : (
              <Text style={styles.indiceAdversaire}>⏳ N'a pas encore commencé sa série.</Text>
            )}
          </View>
          <ActivityIndicator color={colors.or} />
        </>
      ) : (
        <>
          <Text style={styles.choixIA}>{roundActif.exercice} @ {roundActif.charge} kg</Text>

          {!monDebut ? (
            <TouchableOpacity
              style={styles.boutonPrincipal}
              onPress={() => demarrerMaSerie(numero)}
              disabled={chargement}
            >
              {chargement ? <ActivityIndicator color={colors.texte} /> : (
                <Text style={styles.boutonPrincipalTexte}>🔴 Je commence ma série</Text>
              )}
            </TouchableOpacity>
          ) : !montrerSaisieReps ? (
            <>
              <View style={styles.blocChrono}>
                <Text style={styles.chronoTexte}>⏱ {secondesDepuis(monDebut)}s</Text>
                <Text style={styles.indiceChrono}>Ta série est en cours… pose le téléphone !</Text>
              </View>
              <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setMontrerSaisieReps(true)}>
                <Text style={styles.boutonPrincipalTexte}>⏹ Terminé</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.libelle}>Combien de répétitions as-tu faites ?</Text>
              <TextInput
                style={styles.champ}
                value={repsSaisies}
                onChangeText={setRepsSaisies}
                keyboardType="numeric"
                placeholder="Ex. : 12"
                placeholderTextColor={colors.texteGris}
                autoFocus
              />
              <TouchableOpacity
                style={styles.boutonPrincipal}
                onPress={() => soumettreReps(numero)}
                disabled={chargement}
              >
                {chargement ? <ActivityIndicator color={colors.texte} /> : (
                  <Text style={styles.boutonPrincipalTexte}>Valider mes reps</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.blocAdversaire}>
            {sesReps != null ? (
              <Text style={styles.indiceAdversaire}>✅ Ton adversaire a déjà fini ce round.</Text>
            ) : sonDebut ? (
              <Text style={styles.indiceAdversaire}>
                🏋️ Ton adversaire est en train de faire sa série… {secondesDepuis(sonDebut)}s
              </Text>
            ) : (
              <Text style={styles.indiceAdversaire}>⏳ Ton adversaire n'a pas encore commencé.</Text>
            )}
          </View>
        </>
      )}

      {erreur && <Text style={styles.message}>⚠️ {erreur}</Text>}
      <TouchableOpacity onPress={onFermer}>
        <Text style={styles.lienAnnuler}>Fermer (le duel reste ouvert)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.carte,
    borderRadius: 16,
    padding: espacement.m,
    marginBottom: espacement.m,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  titre: { color: colors.texte, fontSize: 20, fontWeight: '800' },
  score: { color: colors.or, fontWeight: '800', fontSize: 18, marginVertical: espacement.s },
  scoreFinal: { color: colors.or, fontWeight: '800', fontSize: 22, marginVertical: espacement.s },
  explication: { color: colors.texteGris, fontSize: 13, marginVertical: espacement.s },
  libelle: { color: colors.texte, fontWeight: '600', marginTop: espacement.s, marginBottom: 6 },
  champ: {
    backgroundColor: colors.carteClaire,
    borderRadius: 10,
    padding: 12,
    color: colors.texte,
  },
  codeAffiche: {
    color: colors.or,
    fontWeight: '800',
    fontSize: 32,
    letterSpacing: 4,
    textAlign: 'center',
    marginVertical: espacement.m,
  },
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
  choixIA: { color: colors.accent, fontWeight: '800', fontSize: 16, marginVertical: espacement.s },
  blocChrono: {
    backgroundColor: colors.carteClaire,
    borderRadius: 12,
    padding: espacement.m,
    alignItems: 'center',
    marginTop: espacement.s,
  },
  chronoTexte: { color: colors.or, fontWeight: '800', fontSize: 28 },
  indiceChrono: { color: colors.texteGris, fontSize: 12, marginTop: 4 },
  blocAdversaire: { marginTop: espacement.s, alignItems: 'center' },
  indiceAdversaire: { color: colors.texteGris, fontSize: 13, textAlign: 'center' },
  boutonPrincipal: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: espacement.m,
  },
  boutonPrincipalTexte: { color: colors.texte, fontWeight: '700' },
  boutonSecondaire: {
    backgroundColor: colors.carteClaire,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: espacement.s,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  boutonSecondaireTexte: { color: colors.accent, fontWeight: '700' },
  message: { color: colors.or, fontWeight: '700', marginTop: espacement.s, textAlign: 'center' },
  lienAnnuler: { color: colors.texteGris, textAlign: 'center', marginTop: espacement.m, fontSize: 13 },
});
