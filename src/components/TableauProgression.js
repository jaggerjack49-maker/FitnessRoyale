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

const LARGEUR_NOMS = 116;   // la colonne figée
const LARGEUR_CASE = 54;    // une sous-colonne (séries / reps / charge)
const HAUTEUR_ENTETE = 46;
const HAUTEUR_JOUR = 34;
const HAUTEUR_LIGNE = 56;

const CHOIX_SEMAINES = [3, 4, 5, 6, 8];

function enTeteSemaine(semaine) {
  return semaine === 'decharge' ? 'Décharge' : `Semaine ${semaine}`;
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
      >
        <Text style={[styles.puceTexte, avecDeload && styles.puceTexteActif]}>
          {avecDeload ? '☑' : '☐'} Finir par une semaine de décharge
        </Text>
      </TouchableOpacity>

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
                    ]}
                  >
                    <Text style={styles.texteEntete} numberOfLines={1}>{enTeteSemaine(semaine)}</Text>
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
        ⚠️ C'est une PROJECTION : elle suppose que chaque semaine est réussie
        exactement comme prévu. La semaine 1 dit la même chose que le
        « 🎯 Attendu » de ta séance — c'est le même calcul.
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
  // Une case corrigée à la main se voit : c'est TA valeur, pas une proposition.
  celluleManuelle: { backgroundColor: 'rgba(85, 200, 240, 0.10)' },
  case: { width: LARGEUR_CASE, justifyContent: 'center', alignItems: 'center' },
  valeur: { color: colors.texte, fontSize: 13, fontFamily: monospace },
  valeurForte: { color: colors.or, fontWeight: '800', fontSize: 14 },
  suffixe: { color: colors.texteGris, fontSize: 10 },
  caseVide: { justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.carte,
    borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.bordure },
  texteVide: { color: colors.texteGris, fontSize: 11, fontStyle: 'italic' },

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
