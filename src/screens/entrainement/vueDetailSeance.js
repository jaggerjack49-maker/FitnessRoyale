// La vue « historiqueDetail » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import { ConfirmationSuppression, CreerProgrammeDepuisSeance } from './composantsSeance';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Icone, LibelleIcone, TexteIcone } from '../../components/Icones';
import { da } from '../../designSystem';
import { colors, espacement } from '../../theme';
import { dureeSeanceLisible } from '../../logic/progres';
import { exercicesPourProgramme, libelleSerie } from '../../logic/seanceLibre';
import { libelleDate, typeDeSeance } from './outils';
import { styles } from './styles';

export function vueDetailSeance(ctx) {
  const {
    creerProgrammeDepuisSeance, entrainementSelectionne, programmes,
    setEntrainementSelectionne, setVue, exerciceProgres, vueRetourDetail,
    correctionSeance, correctionEnCours, erreurCorrection, suppressionSeance,
    setSuppressionSeance, ouvrirCorrection, fermerCorrection, majLigneCorrection,
    retirerLigneCorrection, enregistrerCorrection, supprimerSeanceEnregistree,
  } = ctx;

  // CORRIGER UNE SÉANCE DÉJÀ ENREGISTRÉE (14/11/2026) : le brouillon remplace
  // l'affichage, une ligne éditable par série (reps, charge, RIR, croix).
  if (correctionSeance) {
    // Regroupe les lignes par exercice en gardant leur index dans le brouillon.
    const groupes = [];
    correctionSeance.series.forEach((l, index) => {
      let g = groupes.find((x) => x.exercice === l.exercice);
      if (!g) { g = { exercice: l.exercice, lignes: [] }; groupes.push(g); }
      g.lignes.push({ ...l, index });
    });
    return (
      <ScrollView
        key="correction-seance"
        style={styles.conteneur}
        contentContainerStyle={{ padding: espacement.m, paddingBottom: 340 }}
        keyboardShouldPersistTaps="handled"
      >
        <TexteIcone nom="crayon" taille={19} couleur={colors.or} style={styles.titre}>
          Corriger la séance
        </TexteIcone>
        <Text style={styles.sousTitre}>
          {typeDeSeance(entrainementSelectionne, programmes)} · {libelleDate(entrainementSelectionne.date)}
        </Text>
        <Text style={styles.indice}>
          Les records, les courbes et les charges suggérées suivront ta correction.
        </Text>
        {groupes.map((g) => (
          <View key={g.exercice} style={styles.carteExercice}>
            <Text style={styles.nomExercice}>{g.exercice}</Text>
            {g.lignes.map((l, n) => (
              <View key={l.index} style={styles.ligneAjoutSerie}>
                <Text style={stylesCorrection.numero}>{n + 1}</Text>
                <View style={styles.colonneChampSerie}>
                  {n === 0 ? <Text style={styles.libelleChampSerie}>RÉPÉTITIONS</Text> : null}
                  <TextInput
                    style={[styles.champ, styles.champSaisieSerie]}
                    value={l.reps}
                    onChangeText={(v) => majLigneCorrection(l.index, 'reps', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.texteGris}
                  />
                </View>
                <View style={styles.colonneChampSerie}>
                  {n === 0 ? <Text style={styles.libelleChampSerie}>CHARGE (KG)</Text> : null}
                  <TextInput
                    style={[styles.champ, styles.champSaisieSerie]}
                    value={l.poids}
                    onChangeText={(v) => majLigneCorrection(l.index, 'poids', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.texteGris}
                  />
                </View>
                <View style={styles.colonneChampRir}>
                  {n === 0 ? <Text style={styles.libelleChampSerie}>RIR</Text> : null}
                  <TextInput
                    style={[styles.champ, styles.champSaisieSerie]}
                    value={l.rir}
                    onChangeText={(v) => majLigneCorrection(l.index, 'rir', v)}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.texteGris}
                    maxLength={2}
                  />
                </View>
                <TouchableOpacity
                  style={styles.boutonRetirerExercice}
                  onPress={() => retirerLigneCorrection(l.index)}
                  accessibilityLabel={`Retirer la série ${n + 1} de ${g.exercice}`}
                >
                  <Icone nom="croix" taille={14} couleur={colors.texteGris} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
        <View style={styles.carteExercice}>
          <Text style={styles.libelleChampSerie}>DURÉE (MINUTES)</Text>
          <TextInput
            style={[styles.champ, styles.champSaisieSerie, stylesCorrection.champDuree]}
            value={correctionSeance.duree}
            onChangeText={(v) => majLigneCorrection(-1, 'duree', v)}
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor={colors.texteGris}
            maxLength={3}
          />
          <Text style={styles.indice}>Vide = estimée d'après le nombre de séries.</Text>
        </View>
        {erreurCorrection ? <Text style={styles.erreurSaisie}>{erreurCorrection}</Text> : null}
        <TouchableOpacity
          style={styles.boutonPrincipal}
          onPress={enregistrerCorrection}
          disabled={correctionEnCours}
        >
          {correctionEnCours ? (
            <ActivityIndicator color={da.orSombre} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>ENREGISTRER LA CORRECTION</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={fermerCorrection} style={stylesCorrection.lien}>
          <Text style={styles.lienAnnuler}>Annuler (rien n'est changé)</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }


  // Regroupe les séries par exercice, dans l'ordre où elles ont été loggées.
  const parExercice = [];
  entrainementSelectionne.series.forEach((s) => {
    let groupe = parExercice.find((g) => g.exercice === s.exercice);
    if (!groupe) { groupe = { exercice: s.exercice, series: [] }; parExercice.push(groupe); }
    groupe.series.push(s);
  });
  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
      <TexteIcone nom="calendrier" taille={19} couleur={colors.or} style={styles.titre}>
        {typeDeSeance(entrainementSelectionne, programmes)}
      </TexteIcone>
      <Text style={styles.sousTitre}>
        {libelleDate(entrainementSelectionne.date)}
        {dureeSeanceLisible(entrainementSelectionne.duree_minutes)
          ? ` · ${dureeSeanceLisible(entrainementSelectionne.duree_minutes)}` : ''}
      </Text>
      {parExercice.map((groupe) => (
        <View key={groupe.exercice} style={styles.carteExercice}>
          <Text style={styles.nomExercice}>{groupe.exercice}</Text>
          {groupe.series.map((s, i) => (
            <Text key={i} style={styles.serieFaite}>
              Série {s.numero_serie} : {libelleSerie(s)}
            </Text>
          ))}
        </View>
      ))}
      {/* CORRIGER / SUPPRIMER (14/11/2026). Supprimer se confirme en deux
          temps : c'est le seul geste de cet écran qui ne se rattrape pas. */}
      <View style={stylesCorrection.ligneActions}>
        <TouchableOpacity style={styles.boutonModifier} onPress={ouvrirCorrection}>
          <LibelleIcone nom="crayon" taille={13} ecart={5} style={styles.boutonModifierTexte}>Corriger la séance</LibelleIcone>
        </TouchableOpacity>
        <TouchableOpacity style={stylesCorrection.boutonSupprimer} onPress={() => setSuppressionSeance(true)}>
          <LibelleIcone nom="corbeille" taille={13} ecart={5} couleur={colors.rouge} style={stylesCorrection.boutonSupprimerTexte}>Supprimer</LibelleIcone>
        </TouchableOpacity>
      </View>
      <ConfirmationSuppression
        actif={suppressionSeance}
        question="Supprimer cette séance ? Ses séries disparaîtront de l'historique, des records et des courbes."
        onConfirmer={supprimerSeanceEnregistree}
        onAnnuler={() => setSuppressionSeance(false)}
      />
      {correctionEnCours ? <ActivityIndicator color={colors.or} style={{ marginTop: espacement.s }} /> : null}
      {erreurCorrection ? <Text style={styles.erreurSaisie}>{erreurCorrection}</Text> : null}
      {/* Une séance LIBRE passée peut encore devenir un programme : on n'y
          pense pas toujours pendant l'effort (08/11/2026). */}
      {!programmes.some((p) => p.id === entrainementSelectionne.programme_id) ? (
        <CreerProgrammeDepuisSeance
          key={entrainementSelectionne.id}
          exercices={exercicesPourProgramme(null, entrainementSelectionne.series)}
          nomParDefaut={`Séance du ${libelleDate(entrainementSelectionne.date)}`}
          explication="Les exercices de cette séance, avec comme objectif ce que tu avais fait (séries faites × reps de la dernière). Tu pourras tout corriger ensuite."
          onCreer={(nom) => creerProgrammeDepuisSeance(
            nom, exercicesPourProgramme(null, entrainementSelectionne.series), false,
          )}
        />
      ) : null}
      {/* Le retour ramène d'où l'on vient : la page d'un exercice
          (19/11/2026) ou « Progrès ». */}
      <TouchableOpacity onPress={() => { setVue(vueRetourDetail); setEntrainementSelectionne(null); }}>
        <Text style={styles.lienAnnuler}>
          {exerciceProgres ? `← Retour à « ${exerciceProgres} »` : '← Retour aux progrès'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const stylesCorrection = {
  numero: { color: colors.texteGris, fontWeight: '800', width: 16, textAlign: 'center', paddingBottom: 14 },
  champDuree: { width: 110 },
  lien: { minHeight: 44, justifyContent: 'center' },
  ligneActions: { flexDirection: 'row', flexWrap: 'wrap', gap: espacement.s, marginTop: espacement.s },
  boutonSupprimer: {
    borderWidth: 1, borderColor: colors.rouge, borderRadius: 8,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  boutonSupprimerTexte: { color: colors.rouge, fontWeight: '800', fontSize: 12 },
};
