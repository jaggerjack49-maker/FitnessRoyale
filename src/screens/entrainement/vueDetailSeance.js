// La vue « historiqueDetail » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import { CreerProgrammeDepuisSeance } from './composantsSeance';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { TexteIcone } from '../../components/Icones';
import { colors, espacement } from '../../theme';
import { dureeSeanceLisible } from '../../logic/progres';
import { exercicesPourProgramme, libelleSerie } from '../../logic/seanceLibre';
import { libelleDate, typeDeSeance } from './outils';
import { styles } from './styles';

export function vueDetailSeance(ctx) {
  const {
    creerProgrammeDepuisSeance, entrainementSelectionne, programmes,
    setEntrainementSelectionne, setVue,
  } = ctx;


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
      <TouchableOpacity onPress={() => { setVue('historique'); setEntrainementSelectionne(null); }}>
        <Text style={styles.lienAnnuler}>← Retour aux progrès</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
