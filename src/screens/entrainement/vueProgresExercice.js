// La vue « progresExercice » de l'onglet Entraînement : LA PAGE D'UN EXERCICE
// (19/11/2026, demande de Hafiz : « ajoute un rangement des progrès par
// exercice : on clique sur un exercice en particulier et on voit les perfs
// qu'on a déjà faites »).
//
// On y arrive depuis « Progrès » (section « Mes exercices », ou un record).
// Elle montre : le record, le meilleur 1RM estimé, la courbe, et TOUTES les
// séances où l'exercice a été fait, série par série. Toucher une séance ouvre
// son détail (et le retour ramène ici, pas à « Progrès »).
//
// Tous les calculs : `resumeExercice` et `courbeExercice` (src/logic/progres.js,
// testés), depuis les séances déjà chargées — aucun appel serveur.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement et lui passe tout ce qu'elle lit dans `ctx`. Elle ne
// contient AUCUN hook (voir verifier_vues_entrainement.cjs).

import { CourbeProgres } from '../../components/GraphiquesProgres';
import { EnteteSousEcran, stylesHub } from './sousEcran';
import { Icone } from '../../components/Icones';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { libelleDate, typeDeSeance } from './outils';
import { colors, espacement } from '../../theme';
import { courbeExercice, resumeExercice, variation } from '../../logic/progres';
import { libelleSerie } from '../../logic/seanceLibre';
import { styles } from './styles';

// « 102,5 kg × 8 » (ou « 15 reps » au poids du corps).
function resumeSerie(serie) {
  if (!serie) return '';
  return serie.poids > 0
    ? `${String(serie.poids).replace('.', ',')} kg × ${serie.reps}`
    : `${serie.reps} reps`;
}

export function vueProgresExercice(ctx) {
  const {
    bandeauEtat, entrainements, exerciceProgres, mesureCourbe, programmes,
    setEntrainementSelectionne, setExerciceProgres, setMesureCourbe, setVue,
  } = ctx;

  const fermer = () => { setExerciceProgres(null); setVue('historique'); };
  const resume = resumeExercice(entrainements, exerciceProgres);

  // L'exercice n'a plus aucune séance (la dernière vient d'être supprimée) :
  // on le dit, on n'affiche pas une page vide.
  if (!resume) {
    return (
      <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
        <EnteteSousEcran titre={exerciceProgres || 'Exercice'} sousTitre="Aucune séance"
          onRetour={fermer} />
        <Text style={styles.indice}>
          Plus aucune séance enregistrée sur cet exercice.
        </Text>
      </ScrollView>
    );
  }

  const chargee = !resume.auPoidsDuCorps;
  const mesure = !chargee && mesureCourbe === 'e1rm' ? 'charge' : mesureCourbe;
  const courbe = courbeExercice(entrainements, exerciceProgres, mesure);
  const evolution = variation(courbe.points);
  const MESURES = chargee
    ? [['charge', 'Charge max'], ['e1rm', '1RM estimé'], ['volume', 'Volume']]
    : [['charge', 'Reps max'], ['volume', 'Reps totales']];
  const nb = resume.nbSeances;
  const tuiles = [
    ['RECORD', resumeSerie(resume.record), `le ${libelleDate(resume.record.date)}`],
    chargee && resume.meilleur1RM
      ? ['1RM ESTIMÉ', `${String(resume.meilleur1RM.valeur).replace('.', ',')} kg`,
        `le ${libelleDate(resume.meilleur1RM.date)}`]
      : null,
    ['SÉANCES', String(nb), `depuis le ${libelleDate(resume.premiere)}`],
    ['DERNIÈRE FOIS', libelleDate(resume.derniere).replace(/^\S+ /, ''),
      resumeSerie(resume.seances[0].meilleure)],
  ].filter(Boolean);

  return (
    <ScrollView
      key={`exercice-${exerciceProgres}`}
      style={styles.conteneur}
      contentContainerStyle={{ padding: espacement.m }}
    >
      <EnteteSousEcran
        titre={exerciceProgres}
        sousTitre={`${nb} séance${nb > 1 ? 's' : ''} · depuis le ${libelleDate(resume.premiere)}`}
        onRetour={fermer}
      />
      {bandeauEtat}

      {/* ---- Les chiffres de l'exercice ---- */}
      <View style={styles.grilleTuiles}>
        {tuiles.map(([titre, valeur, legende]) => (
          <View key={titre} style={styles.tuileStat}>
            <Text style={styles.titreTuile}>{titre}</Text>
            <Text style={[styles.valeurTuile, { fontSize: 20 }]} numberOfLines={1}
              adjustsFontSizeToFit minimumFontScale={0.7}>{valeur}</Text>
            <Text style={styles.legendeTuile}>{legende}</Text>
          </View>
        ))}
      </View>

      {/* ---- La courbe ---- */}
      <Text style={[stylesHub.libelleSection, styles.libelleProgres]}>COURBE</Text>
      <View style={styles.carteModele}>
        <View style={styles.lignePuces}>
          {MESURES.map(([cle, libelle]) => (
            <TouchableOpacity key={cle}
              style={[styles.puceMesure, mesure === cle && styles.puceProgresActive]}
              onPress={() => setMesureCourbe(cle)}>
              <Text style={[styles.puceJourTexte, mesure === cle && styles.puceJourTexteActif]}>
                {libelle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ marginTop: espacement.m }}>
          <CourbeProgres points={courbe.points} unite={courbe.unite} libelleDate={libelleDate} />
          {evolution ? (
            <Text style={[styles.evolution, {
              color: evolution.ecart > 0 ? colors.vert : evolution.ecart < 0 ? colors.rouge : colors.texteGris,
            }]}>
              {evolution.ecart > 0 ? '+' : ''}{String(evolution.ecart).replace('.', ',')} {courbe.unite}
              {evolution.pourcent !== null ? ` (${evolution.pourcent > 0 ? '+' : ''}${evolution.pourcent} %)` : ''}
              <Text style={styles.indice}>{`  depuis le ${libelleDate(evolution.depuis)}`}</Text>
            </Text>
          ) : (
            <Text style={styles.indice}>
              Une seule séance sur cet exercice : la courbe se dessinera dès la prochaine.
            </Text>
          )}
        </View>
      </View>

      {/* ---- Toutes les séances, la plus récente d'abord ---- */}
      <Text style={[stylesHub.libelleSection, styles.libelleProgres]}>
        TOUTES TES SÉANCES ({nb})
      </Text>
      {resume.seances.map((ligne) => {
        const entrainement = (entrainements || []).find((e) => e && e.id === ligne.id);
        return (
          <TouchableOpacity
            key={`${ligne.id}-${ligne.date}`}
            style={[styles.carteHistorique, ligne.estRecord && stylesPage.carteRecord]}
            disabled={!entrainement}
            onPress={() => {
              setEntrainementSelectionne(entrainement);
              setVue('historiqueDetail');
            }}
          >
            <View style={stylesPage.entete}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateHistorique}>{libelleDate(ligne.date)}</Text>
                <Text style={styles.indice}>
                  {typeDeSeance(ligne, programmes)} · meilleure série{' '}
                  <Text style={stylesPage.meilleure}>{resumeSerie(ligne.meilleure)}</Text>
                </Text>
              </View>
              {ligne.estRecord ? (
                <View style={stylesPage.badgeRecord}>
                  <Icone nom="competition" taille={12} couleur={colors.or} />
                  <Text style={stylesPage.badgeRecordTexte}>RECORD</Text>
                </View>
              ) : null}
            </View>
            <View style={stylesPage.series}>
              {ligne.series.map((serie, i) => (
                <Text key={i} style={stylesPage.serie}>
                  <Text style={stylesPage.numero}>{i + 1}. </Text>
                  {/* Virgule décimale, comme le reste de la page (« 107,5 »). */}
                  {libelleSerie(serie).replace(/(\d)\.(\d)/g, '$1,$2')}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.noteProgres}>
        Touche une séance pour la voir en entier (et la corriger si besoin).
      </Text>

      <TouchableOpacity onPress={fermer} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={styles.lienAnnuler}>← Retour aux progrès</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const stylesPage = {
  carteRecord: { borderColor: colors.or },
  entete: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  meilleure: { color: colors.or, fontWeight: '800' },
  badgeRecord: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.or, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeRecordTexte: { color: colors.or, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  series: { marginTop: espacement.s, gap: 2 },
  serie: { color: colors.texte, fontSize: 13 },
  numero: { color: colors.texteGris, fontWeight: '700' },
};
