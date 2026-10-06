// LE TABLEAU DE PROGRESSION — demande de Hafiz du 04/10/2026, image de
// référence `icones/IMG_1703.PNG` : une ligne par exercice (groupée par jour),
// une colonne par semaine, et une semaine de décharge à la fin.
//
// CE QU'IL AFFICHE est entièrement CALCULÉ par `src/logic/projectionProgramme.js`,
// qui rejoue la règle de surcharge progressive semaine après semaine. Rien
// n'est stocké, rien n'est inventé : un exercice jamais loggé n'a pas de ligne.
//
// ⚠️ LA COLONNE DES EXERCICES EST FIGÉE à gauche pendant que les semaines
// défilent horizontalement — sinon, à la troisième semaine, on ne sait plus de
// quel exercice parle la ligne qu'on lit. C'est ce qui impose des HAUTEURS DE
// LIGNE FIXES : les deux colonnes sont deux listes séparées, elles ne
// s'alignent que si chaque ligne fait exactement la même hauteur des deux côtés.
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
} from 'react-native';
import { colors, espacement } from '../theme';
import { monospace } from '../designSystem';
import { projeterProgramme, SEMAINES_MAX } from '../logic/projectionProgramme';
import { semaineDuBloc, finDuBloc, blocADerive } from '../logic/bloc';

const LARGEUR_NOMS = 116;   // la colonne figée
const LARGEUR_CASE = 54;    // une sous-colonne (séries / reps / charge)
const HAUTEUR_ENTETE = 46;
const HAUTEUR_JOUR = 34;
const HAUTEUR_LIGNE = 56;

const CHOIX_SEMAINES = [3, 4, 5, 6, 8];

function enTeteSemaine(semaine) {
  return semaine === 'decharge' ? 'Décharge' : `Semaine ${semaine}`;
}

// « 2026-10-05 » → « lundi 5 octobre ». On n'affiche jamais une date au format
// machine à l'utilisateur (défaut corrigé le 01/10/2026 dans l'écran de séance).
function libelleJour(dateISO) {
  if (!dateISO) return '';
  const d = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Le lundi qui vient (ou aujourd'hui si on EST lundi) : un bloc se commence
// presque toujours en début de semaine, autant le proposer.
function prochainLundi(aujourdhuiISO) {
  const d = new Date(`${aujourdhuiISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return aujourdhuiISO;
  const versLundi = (8 - (d.getDay() || 7)) % 7;
  d.setDate(d.getDate() + versLundi);
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

// LES CASES À FIGER, construites depuis le tableau DÉJÀ AFFICHÉ.
//
// ⚠️ C'EST LE COMPOSANT QUI LES FABRIQUE, PAS L'ÉCRAN, et c'est volontaire :
// figer le plan doit enregistrer EXACTEMENT ce que Hafiz a sous les yeux. Si
// l'écran refaisait le calcul de son côté, les deux pourraient divergir — le
// motif que ce projet paie en boucle (voir `cycleEnService` le 28/08/2026).
function casesDuTableau(tableau) {
  const cases = [];
  tableau.forEach((bloc) => bloc.lignes.forEach((ligne) => {
    ligne.semaines.forEach((semaine) => {
      // Un exercice jamais fait n'a pas de ligne : on ne fige pas du vide.
      if (!Number.isFinite(semaine.reps) || semaine.reps <= 0) return;
      cases.push({
        programme_id: bloc.seance.id,
        exercice: ligne.exercice,
        semaine: String(semaine.semaine),
        // Le serveur refuse 0 (une série de zéro n'existe pas) : on envoie
        // `null`, qui veut dire « laisse le calcul décider ».
        series: Number.isFinite(semaine.series) && semaine.series > 0 ? semaine.series : null,
        reps: semaine.reps,
        poids: Number.isFinite(semaine.poids) && semaine.poids >= 0 ? semaine.poids : null,
      });
    });
  }));
  return cases;
}

// LE PANNEAU DU BLOC — trois états, jamais deux à la fois :
//  - pas démarré : on propose de FIGER le plan à une date ;
//  - en cours    : on dit où on en est (« semaine 2 sur 4 ») ;
//  - en cours ET écarté du plan : on le DIT et on propose de recalculer
//    la suite (choix de Hafiz : « le plan, mais qui se rattrape »).
function PanneauBloc({
  dateDebut, nbSemaines, avecDeload, aujourdhui, ecarts,
  onDemarrer, onArreter, onRecalculer, occupe,
}) {
  const [dateChoisie, setDateChoisie] = useState(null);
  const programme = { id: 0, date_debut: dateDebut, duree_semaines: nbSemaines,
    avec_deload: avecDeload };
  const semaine = dateDebut ? semaineDuBloc(programme, aujourdhui) : null;

  if (!dateDebut) {
    const lundi = prochainLundi(aujourdhui);
    const propositions = lundi === aujourdhui
      ? [{ date: aujourdhui, libelle: "Aujourd'hui" }]
      : [{ date: aujourdhui, libelle: "Aujourd'hui" },
         { date: lundi, libelle: 'Lundi prochain' }];
    return (
      <View style={styles.panneauBloc}>
        <Text style={styles.panneauTitre}>▶️ DÉMARRER CE BLOC</Text>
        <Text style={styles.panneauTexte}>
          Tant que le bloc n'est pas démarré, ce tableau est une PROJECTION :
          il se recalcule à chaque fois que tu l'ouvres. Le démarrer FIGE ces
          {' '}{nbSemaines} semaines : elles deviennent ton plan, ta séance saura
          en quelle semaine tu es, et tu pourras toujours corriger une case.
        </Text>
        <View style={styles.panneauChoix}>
          {propositions.map((p) => (
            <TouchableOpacity
              key={p.date}
              style={[styles.puce, dateChoisie === p.date && styles.puceActive]}
              onPress={() => setDateChoisie(p.date)}
            >
              <Text style={[styles.puceTexte, dateChoisie === p.date && styles.puceTexteActif]}>
                {p.libelle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.boutonDemarrer, !dateChoisie && styles.boutonEteint]}
          disabled={!dateChoisie || occupe}
          onPress={() => onDemarrer(dateChoisie)}
        >
          <Text style={styles.boutonDemarrerTexte}>
            {occupe ? 'Enregistrement…'
              : dateChoisie ? `Démarrer le ${libelleJour(dateChoisie)}`
                : "Choisis d'abord une date de début"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const derive = blocADerive(ecarts);
  return (
    <View style={[styles.panneauBloc, derive && styles.panneauAlerte]}>
      <Text style={styles.panneauTitre}>
        {semaine === null ? '🏁 BLOC TERMINÉ'
          : semaine === 'decharge' ? '🪶 SEMAINE DE DÉCHARGE'
            : `📍 SEMAINE ${semaine} SUR ${nbSemaines}`}
      </Text>
      <Text style={styles.panneauTexte}>
        Démarré le {libelleJour(dateDebut)}, jusqu'au{' '}
        {libelleJour(finDuBloc(programme))}.
      </Text>

      {derive ? (
        <View>
          {ecarts.semainesSautees.length > 0 ? (
            <Text style={styles.panneauEcart}>
              ⚠️ Aucune séance de ce programme en semaine{' '}
              {ecarts.semainesSautees.join(', ')}.
            </Text>
          ) : null}
          {ecarts.chargesDifferentes.slice(0, 4).map((e) => (
            <Text key={`${e.exercice}-${e.semaine}`} style={styles.panneauEcart}>
              ⚠️ {e.exercice} : {e.fait} kg en semaine {e.semaine}, le plan
              disait {e.prevu} kg.
            </Text>
          ))}
          <Text style={styles.panneauTexte}>
            La suite du plan part donc d'une base fausse. La recalculer repart
            de ce que tu as VRAIMENT soulevé — tes cases corrigées à la main
            sont conservées, et les semaines déjà passées ne sont pas touchées.
          </Text>
          <TouchableOpacity
            style={[styles.boutonRecalculer, occupe && styles.boutonEteint]}
            disabled={occupe}
            onPress={onRecalculer}
          >
            <Text style={styles.boutonRecalculerTexte}>
              {occupe ? 'Recalcul…' : '↻ Recalculer la suite du bloc'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.panneauTexte}>
          Tu suis le plan. Si tu sautes une semaine ou que tu charges autre
          chose que prévu, l'app te le dira ici.
        </Text>
      )}

      <TouchableOpacity onPress={onArreter} disabled={occupe}>
        <Text style={styles.lienArreter}>Arrêter ce bloc (le plan reste écrit)</Text>
      </TouchableOpacity>
    </View>
  );
}

// Une case de valeur. La CHARGE est mise en avant (en or, en chasse fixe) :
// c'est le chiffre qu'on vient chercher avant de s'approcher de la barre.
function Case({ valeur, fort, suffixe }) {
  return (
    <View style={styles.case}>
      <Text style={[styles.valeur, fort && styles.valeurForte]} numberOfLines={1}>
        {valeur}{suffixe ? <Text style={styles.suffixe}>{suffixe}</Text> : null}
      </Text>
    </View>
  );
}

// CORRIGER UNE CASE — « l'app propose, je corrige » (choix de Hafiz).
// Les trois champs partent PRÉ-REMPLIS avec la valeur calculée : on ne
// redemande pas de retaper ce qui est déjà juste. Tout vider rend la case au
// calcul, ce que le bouton dit en toutes lettres.
function EditeurCase({ ligne, exercice, onEnregistrer, onFermer }) {
  const [series, setSeries] = useState(ligne.series ? String(ligne.series) : '');
  const [reps, setReps] = useState(ligne.reps ? String(ligne.reps) : '');
  const [poids, setPoids] = useState(ligne.poids > 0 ? String(ligne.poids) : '');

  // Une virgule décimale passe aussi : on tape « 102,5 » au clavier français.
  const nombre = (texte) => {
    const v = parseFloat(String(texte).replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  const champs = [
    ['SÉRIES', series, setSeries],
    ['REPS', reps, setReps],
    ['KG', poids, setPoids],
  ];

  return (
    <View style={styles.editeur}>
      <Text style={styles.titreEditeur}>
        {exercice} — {ligne.semaine === 'decharge' ? 'décharge' : `semaine ${ligne.semaine}`}
      </Text>
      <View style={styles.ligneChamps}>
        {champs.map(([libelle, valeur, poser]) => (
          <View key={libelle} style={styles.colonneChamp}>
            <Text style={styles.libelleChamp}>{libelle}</Text>
            <TextInput
              style={styles.champ}
              value={valeur}
              onChangeText={poser}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={colors.texteGris}
            />
          </View>
        ))}
      </View>
      <View style={styles.ligneBoutonsEditeur}>
        <TouchableOpacity
          style={styles.boutonOr}
          onPress={() => onEnregistrer({
            series: nombre(series), reps: nombre(reps), poids: nombre(poids),
          })}
        >
          <Text style={styles.boutonOrTexte}>Enregistrer cette case</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.boutonBorde} onPress={() => onEnregistrer(null)}>
          <Text style={styles.boutonBordeTexte}>↺ Rendre au calcul</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onFermer}>
        <Text style={styles.lienAnnuler}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TableauProgression({
  nom, seances, entrainements, progressions, cibles,
  nbSemaines, avecDeload, onChangerSemaines, onBasculerDecharge, onCorriger, onFermer,
  // Le BLOC (05/10/2026) : sa date de début, l'état constaté, et les actions.
  dateDebut, aujourdhui, ecarts, onDemarrer, onArreter, onRecalculer, occupe,
}) {
  // La case ouverte en correction : { programmeId, exercice, ligne }.
  const [caseOuverte, setCaseOuverte] = useState(null);
  const tableau = projeterProgramme(seances, entrainements, {
    progressions, cibles, nbSemaines, avecDeload,
  });

  // Les en-têtes de semaines : on les prend sur la PREMIÈRE ligne qui a une
  // projection — toutes les lignes ont le même nombre de colonnes.
  const premiere = tableau
    .flatMap((bloc) => bloc.lignes)
    .find((ligne) => ligne.semaines.length > 0);
  const colonnes = premiere ? premiere.semaines.map((s) => s.semaine) : [];

  const lignesVides = tableau.every((bloc) => bloc.lignes.every((l) => l.semaines.length === 0));

  // En quelle semaine du bloc on est — UNE SEULE définition, utilisée par
  // l'en-tête de colonne comme par le panneau.
  const semaineEnCours = dateDebut
    ? semaineDuBloc({ id: 0, date_debut: dateDebut, duree_semaines: nbSemaines,
      avec_deload: avecDeload }, aujourdhui)
    : null;

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
      <Text style={styles.titre}>📊 {nom}</Text>
      <Text style={styles.sousTitre}>
        Ce que l'app te propose semaine après semaine, à partir de tes dernières
        séances et de la façon dont chaque exercice progresse.
      </Text>

      {/* ---- Les réglages du bloc ---- */}
      <View style={styles.reglages}>
        <Text style={styles.libelleReglage}>Durée du bloc :</Text>
        {CHOIX_SEMAINES.filter((n) => n <= SEMAINES_MAX).map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.puce, nbSemaines === n && styles.puceActive]}
            onPress={() => onChangerSemaines(n)}
          >
            <Text style={[styles.puceTexte, nbSemaines === n && styles.puceTexteActif]}>
              {n} sem.
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.puceLarge, avecDeload && styles.puceActive]}
        onPress={onBasculerDecharge}
        disabled={!!dateDebut}
      >
        <Text style={[styles.puceTexte, avecDeload && styles.puceTexteActif]}>
          {avecDeload ? '☑' : '☐'} Finir par une semaine de décharge
        </Text>
      </TouchableOpacity>
      {dateDebut ? (
        <Text style={styles.aideReglages}>
          Le bloc est démarré : sa durée est fixée. Arrête-le plus bas pour la changer.
        </Text>
      ) : null}

      {onDemarrer ? (
        <PanneauBloc
          dateDebut={dateDebut}
          nbSemaines={nbSemaines}
          avecDeload={avecDeload}
          aujourdhui={aujourdhui}
          ecarts={ecarts}
          onDemarrer={(date) => onDemarrer(date, casesDuTableau(tableau))}
          onArreter={onArreter}
          // ⚠️ RECALCULER IGNORE LE PLAN EN PLACE (`cibles: {}`) et repart de
          // l'historique RÉEL. Sans ça, on rejouerait le plan figé sur
          // lui-même et le « recalcul » ne changerait jamais rien — tout
          // l'intérêt est justement de repartir de ce qui a vraiment été
          // soulevé. Les cases corrigées à la main, elles, sont préservées
          // par le serveur.
          onRecalculer={() => onRecalculer(casesDuTableau(projeterProgramme(
            seances, entrainements,
            { progressions, cibles: {}, nbSemaines, avecDeload },
          )))}
          occupe={occupe}
        />
      ) : null}

      {lignesVides ? (
        <Text style={styles.rienAMontrer}>
          Aucun exercice de ce programme n'a encore été fait. Le tableau se
          remplit tout seul dès la première séance enregistrée : il part de ce
          que tu as vraiment soulevé, il n'invente pas de charge de départ.
        </Text>
      ) : (
        <View style={styles.grille}>
          {/* ---- Colonne FIGÉE : les exercices ---- */}
          <View style={{ width: LARGEUR_NOMS }}>
            <View style={[styles.celluleEntete, { height: HAUTEUR_ENTETE }]}>
              <Text style={styles.texteEntete}>EXERCICE</Text>
            </View>
            {tableau.map((bloc) => (
              <View key={bloc.seance.id}>
                <View style={[styles.celluleJour, { height: HAUTEUR_JOUR }]}>
                  <Text style={styles.texteJour} numberOfLines={1}>{bloc.seance.nom}</Text>
                </View>
                {bloc.lignes.map((ligne) => (
                  <View key={ligne.exercice} style={[styles.celluleNom, { height: HAUTEUR_LIGNE }]}>
                    <Text style={styles.texteNom} numberOfLines={2}>{ligne.exercice}</Text>
                    {ligne.fourchette ? (
                      <Text style={styles.texteFourchette}>{ligne.fourchette} reps</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* ---- Les semaines, qui défilent ---- */}
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingRight: 4 }}>
            <View>
              {/* En-tête : une semaine = trois sous-colonnes */}
              <View style={{ flexDirection: 'row' }}>
                {colonnes.map((semaine) => (
                  <View
                    key={semaine}
                    style={[
                      styles.celluleEntete,
                      { width: LARGEUR_CASE * 3, height: HAUTEUR_ENTETE },
                      semaine === 'decharge' && styles.celluleDecharge,
                      String(semaine) === String(semaineEnCours) && styles.celluleCourante,
                    ]}
                  >
                    <Text style={[styles.texteEntete,
                      String(semaine) === String(semaineEnCours) && styles.texteEnteteCourante,
                    ]} numberOfLines={1}>
                      {String(semaine) === String(semaineEnCours) ? '📍 ' : ''}
                      {enTeteSemaine(semaine)}
                    </Text>
                    <Text style={styles.texteSousEntete}>Séries · Reps · Kg</Text>
                  </View>
                ))}
              </View>

              {tableau.map((bloc) => (
                <View key={bloc.seance.id}>
                  <View style={[styles.celluleJour, {
                    height: HAUTEUR_JOUR, width: LARGEUR_CASE * 3 * Math.max(1, colonnes.length),
                  }]}>
                    <Text style={styles.texteJour} numberOfLines={1}>
                      {(bloc.seance.jours || []).join(' · ') || 'sans jour fixé'}
                    </Text>
                  </View>
                  {bloc.lignes.map((ligne) => (
                    <View key={ligne.exercice} style={{ flexDirection: 'row' }}>
                      {ligne.semaines.length === 0 ? (
                        <View style={[styles.caseVide, {
                          height: HAUTEUR_LIGNE, width: LARGEUR_CASE * 3 * Math.max(1, colonnes.length),
                        }]}>
                          <Text style={styles.texteVide}>
                            jamais fait — rien à projeter
                          </Text>
                        </View>
                      ) : ligne.semaines.map((s) => (
                        <TouchableOpacity
                          key={s.semaine}
                          style={[
                            styles.groupeSemaine,
                            { height: HAUTEUR_LIGNE },
                            s.semaine === 'decharge' && styles.celluleDecharge,
                            s.source === 'manuel' && styles.celluleManuelle,
                          ]}
                          onPress={() => setCaseOuverte({
                            programmeId: bloc.seance.id, exercice: ligne.exercice, ligne: s,
                          })}
                        >
                          <Case valeur={s.series ?? '—'} />
                          <Case valeur={s.reps} />
                          <Case valeur={s.poids > 0 ? s.poids : '—'} fort />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {caseOuverte ? (
        <EditeurCase
          ligne={caseOuverte.ligne}
          exercice={caseOuverte.exercice}
          onFermer={() => setCaseOuverte(null)}
          onEnregistrer={(valeurs) => {
            onCorriger(caseOuverte.programmeId, caseOuverte.exercice,
              caseOuverte.ligne.semaine, valeurs);
            setCaseOuverte(null);
          }}
        />
      ) : (
        <Text style={styles.aideCorrection}>
          Touche une case pour la corriger : ta valeur remplace celle que l'app
          propose, et les cases bleutées sont celles que tu as écrites.
        </Text>
      )}

      <Text style={styles.note}>
        {dateDebut
          ? "📋 C'est ton PLAN : il est écrit, il ne se recalcule plus tout seul. Ta séance lit la case de la semaine où tu es."
          : "⚠️ C'est une PROJECTION : elle suppose que chaque semaine est réussie exactement comme prévu. La semaine 1 dit la même chose que le « 🎯 Attendu » de ta séance — c'est le même calcul."}
      </Text>

      <TouchableOpacity style={styles.boutonFermer} onPress={onFermer}>
        <Text style={styles.boutonFermerTexte}>← Revenir à mes programmes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: colors.fond },
  titre: { color: colors.texte, fontSize: 22, fontWeight: '800' },
  sousTitre: {
    color: colors.texteGris, fontSize: 13, marginTop: 4,
    marginBottom: espacement.m, lineHeight: 18,
  },
  reglages: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  libelleReglage: { color: colors.texteGris, fontSize: 12, marginRight: 2 },
  puce: {
    borderWidth: 1, borderColor: colors.bordure, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  puceLarge: {
    borderWidth: 1, borderColor: colors.bordure, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11, alignItems: 'center',
    marginTop: espacement.s, marginBottom: espacement.m,
  },
  // Un réglage actif se marque d'un voile + d'un contour (l'or plein reste le
  // signal des ACTIONS, décision du 01/10/2026).
  puceActive: { backgroundColor: 'rgba(232, 178, 58, 0.14)', borderColor: colors.or },
  puceTexte: { color: colors.texteGris, fontSize: 12, fontWeight: '700' },
  puceTexteActif: { color: colors.or },

  grille: { flexDirection: 'row', borderWidth: 1, borderColor: colors.bordure, borderRadius: 10 },
  celluleEntete: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.carteClaire,
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.bordure,
  },
  texteEntete: {
    color: colors.or, fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },
  texteSousEntete: { color: colors.texteGris, fontSize: 9, marginTop: 2 },
  // Le bandeau du JOUR : c'est la barre rouge de l'image, en couleur de marque.
  celluleJour: {
    justifyContent: 'center', paddingHorizontal: 8,
    backgroundColor: 'rgba(232, 178, 58, 0.12)',
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.bordure,
  },
  texteJour: { color: colors.or, fontSize: 11, fontWeight: '800' },
  celluleNom: {
    justifyContent: 'center', paddingHorizontal: 8,
    backgroundColor: colors.carte,
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.bordure,
  },
  texteNom: { color: colors.texte, fontSize: 11, fontWeight: '700' },
  texteFourchette: { color: colors.texteGris, fontSize: 10, marginTop: 2 },

  groupeSemaine: {
    flexDirection: 'row', borderBottomWidth: 1, borderRightWidth: 1,
    borderColor: colors.bordure, backgroundColor: colors.carte,
  },
  celluleDecharge: { backgroundColor: colors.carteClaire },
  // La semaine où l'on est, repérable d'un coup d'œil dans la grille.
  celluleCourante: { backgroundColor: 'rgba(232, 178, 58, 0.12)' },
  texteEnteteCourante: { color: colors.or },
  // Une case corrigée à la main se voit : c'est TA valeur, pas une proposition.
  celluleManuelle: { backgroundColor: 'rgba(85, 200, 240, 0.10)' },
  case: { width: LARGEUR_CASE, justifyContent: 'center', alignItems: 'center' },
  valeur: { color: colors.texte, fontSize: 13, fontFamily: monospace },
  valeurForte: { color: colors.or, fontWeight: '800', fontSize: 14 },
  suffixe: { color: colors.texteGris, fontSize: 10 },
  caseVide: { justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.carte,
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.bordure },
  texteVide: { color: colors.texteGris, fontSize: 11, fontStyle: 'italic' },

  // ---- Le panneau du bloc (05/10/2026) ----
  panneauBloc: {
    borderWidth: 1, borderColor: colors.or, borderRadius: 12,
    backgroundColor: colors.carte, padding: espacement.m,
    marginBottom: espacement.m,
  },
  // Un bloc dont on s'est écarté se signale, sans crier : c'est une
  // information, pas une faute.
  panneauAlerte: { borderColor: colors.accent },
  panneauTitre: {
    color: colors.or, fontSize: 12, fontWeight: '800', letterSpacing: 1.5,
    marginBottom: espacement.s,
  },
  panneauTexte: {
    color: colors.texteGris, fontSize: 12, lineHeight: 18,
    marginBottom: espacement.s,
  },
  panneauEcart: {
    color: colors.accent, fontSize: 12, lineHeight: 18, marginBottom: espacement.xs,
  },
  panneauChoix: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.s,
    marginBottom: espacement.s },
  // 44 px minimum : c'est une action, et on la touche souvent debout
  // (règle posée le 01/10/2026).
  boutonDemarrer: {
    backgroundColor: colors.or, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  boutonDemarrerTexte: {
    color: '#1a1408', fontSize: 13, fontWeight: '800', letterSpacing: 0.5,
  },
  boutonEteint: { opacity: 0.45 },
  boutonRecalculer: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginTop: espacement.xs,
  },
  boutonRecalculerTexte: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  lienArreter: {
    color: colors.texteGris, fontSize: 12, textAlign: 'center',
    paddingVertical: 12, marginTop: espacement.xs,
  },
  aideReglages: {
    color: colors.texteGris, fontSize: 11, fontStyle: 'italic',
    marginTop: -espacement.s, marginBottom: espacement.m,
  },

  aideCorrection: {
    color: colors.texteGris, fontSize: 12, lineHeight: 17,
    marginTop: espacement.s,
  },
  editeur: {
    backgroundColor: colors.carte, borderRadius: 12, borderWidth: 1,
    borderColor: colors.or, padding: espacement.m, marginTop: espacement.s,
  },
  titreEditeur: { color: colors.texte, fontWeight: '800', marginBottom: espacement.s },
  ligneChamps: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  colonneChamp: { flex: 1 },
  libelleChamp: {
    color: colors.texteGris, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, marginBottom: 4,
  },
  champ: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: 12,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure,
    textAlign: 'center', fontSize: 16, fontWeight: '700',
  },
  ligneBoutonsEditeur: { flexDirection: 'row', gap: 8, marginTop: espacement.m },
  boutonOr: {
    flex: 1, backgroundColor: colors.or, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  boutonOrTexte: { color: colors.fond, fontWeight: '800', fontSize: 13 },
  boutonBorde: {
    flex: 1, borderWidth: 1, borderColor: colors.texteGris, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  boutonBordeTexte: { color: colors.texteGris, fontWeight: '700', fontSize: 13 },
  lienAnnuler: {
    color: colors.texteGris, fontSize: 12, textAlign: 'center',
    paddingVertical: 10, marginTop: 4,
  },
  rienAMontrer: {
    color: colors.texteGris, fontSize: 13, lineHeight: 19,
    backgroundColor: colors.carte, padding: espacement.m, borderRadius: 10,
  },
  note: {
    color: colors.texteGris, fontSize: 11, lineHeight: 16,
    marginTop: espacement.m,
  },
  boutonFermer: {
    borderWidth: 1, borderColor: colors.texteGris, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    marginTop: espacement.m, marginBottom: espacement.xl,
  },
  boutonFermerTexte: { color: colors.texteGris, fontWeight: '700' },
});
