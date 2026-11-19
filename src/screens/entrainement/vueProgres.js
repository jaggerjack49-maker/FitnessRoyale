// La vue « historique » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import { BarresActivite, CourbeProgres } from '../../components/GraphiquesProgres';
import { EnteteSousEcran, stylesHub } from './sousEcran';
import { Icone, TexteIcone } from '../../components/Icones';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { aujourdhui, dateCourteRecord, libelleDate, typeDeSeance } from './outils';
import { colors, espacement } from '../../theme';
import { courbeExercice, dureeSeanceLisible, exercicesSuivis, rangerExercicesParGroupe, seancesParSemaine, statistiques, variation, volumeLisible } from '../../logic/progres';
import { groupeDeLExercice, groupesMusculaires } from '../../data/groupesMusculaires';
import { recordPersonnel } from '../../logic/surchargeProgressive';
import { styles } from './styles';

// ================= SOUS-ÉCRAN : PROGRÈS =================
  // Ancien « Historique & records », renommé et enrichi le 08/11/2026 (demande
  // de Hafiz : « il va regrouper les statistiques avec aussi la possibilité de
  // voir les performances sous forme de graphique »). La clé de vue reste
  // 'historique' : c'est un nom interne, le changer aurait touché le retour
  // Android, la place de défilement et le détail d'une séance pour rien.
  // Tous les calculs : src/logic/progres.js (testés), depuis les séances déjà
  // chargées — aucun appel serveur de plus.
export function vueProgres(ctx) {
  const {
    bandeauEtat, donneesIncertaines, entrainements, exerciceCourbe,
    mesRecords, mesureCourbe, placeHistorique, programmes, recordsOuverts,
    setEntrainementSelectionne, setExerciceCourbe, setMesureCourbe,
    setRecordsOuverts, setTousExercicesCourbe, setVue, tousExercicesCourbe,
    correctionsGroupes, setExerciceProgres,
  } = ctx;

  // LA PAGE D'UN EXERCICE (19/11/2026) : ouverte depuis « Mes exercices » ou
  // un record.
  const ouvrirExercice = (nom) => { setExerciceProgres(nom); setVue('progresExercice'); };
  // Rangés par groupe musculaire, avec la MÊME règle que le volume par groupe.
  const parGroupe = rangerExercicesParGroupe(entrainements,
    (nom) => groupeDeLExercice(nom, correctionsGroupes), groupesMusculaires);


  const stats = statistiques(entrainements, aujourdhui());
  const semainesActivite = seancesParSemaine(entrainements, aujourdhui(), 12);
  const suivis = exercicesSuivis(entrainements);
  const exoCourbe = suivis.some((e) => e.exercice === exerciceCourbe)
    ? exerciceCourbe : (suivis[0]?.exercice || null);
  const courbe = exoCourbe ? courbeExercice(entrainements, exoCourbe, mesureCourbe) : null;
  const evolution = courbe ? variation(courbe.points) : null;
  const chargee = courbe?.unite === 'kg';
  const MESURES = chargee
    ? [['charge', 'Charge max'], ['e1rm', '1RM estimé'], ['volume', 'Volume']]
    : [['charge', 'Reps max'], ['volume', 'Reps totales']];
  const exercicesAffiches = tousExercicesCourbe ? suivis : suivis.slice(0, 6);
  const tuiles = [
    ['JOURS ENTRAÎNÉS', String(stats.joursEntraines), `${stats.seriesTotal} séries au total`],
    ['PAR SEMAINE', String(stats.moyenneSemaine).replace('.', ','), 'moyenne des 8 dernières'],
    ['SEMAINES D\'AFFILÉE', String(stats.semainesDAffilee), 'avec au moins une séance'],
    ['VOLUME DU MOIS', volumeLisible(stats.volumeMois), 'charge × reps soulevées'],
    // La durée moyenne (10/11/2026) : seulement sur les séances CHRONOMÉTRÉES
    // — celles d'avant le chrono n'ont pas de durée, elles ne comptent pas.
    ['DURÉE MOYENNE',
      stats.dureeMoyenne ? dureeSeanceLisible(stats.dureeMoyenne) : '—',
      stats.nbChronometrees
        ? `sur ${stats.nbChronometrees} séance${stats.nbChronometrees > 1 ? 's' : ''} chronométrée${stats.nbChronometrees > 1 ? 's' : ''}`
        : 'mesurée à ta prochaine séance'],
  ];
  return (
    <ScrollView
      key="historique"
      {...placeHistorique}
      style={styles.conteneur}
      contentContainerStyle={{ padding: espacement.m }}
    >
      <EnteteSousEcran
        titre="Progrès"
        sousTitre="Tes chiffres, tes courbes, tes records."
        onRetour={() => setVue('accueil')}
      />
      {bandeauEtat}

      {entrainements.length > 0 && (
        <>
          {/* ---- Les chiffres clés ---- */}
          <View style={styles.grilleTuiles}>
            {tuiles.map(([titre, valeur, legende]) => (
              <View key={titre} style={styles.tuileStat}>
                <Text style={styles.titreTuile}>{titre}</Text>
                <Text style={styles.valeurTuile}>{valeur}</Text>
                <Text style={styles.legendeTuile}>{legende}</Text>
              </View>
            ))}
          </View>

          {/* ---- L'activité, semaine par semaine ---- */}
          <Text style={[stylesHub.libelleSection, styles.libelleProgres]}>ACTIVITÉ — 12 SEMAINES</Text>
          <View style={styles.carteModele}>
            <BarresActivite semaines={semainesActivite} libelleDate={libelleDate} />
          </View>

          {/* ---- MES EXERCICES (19/11/2026) : les progrès rangés par
              exercice, eux-mêmes rangés par groupe musculaire. Toucher un
              exercice ouvre sa page : record, courbe, toutes ses séances. ---- */}
          <Text style={[stylesHub.libelleSection, styles.libelleProgres]}>
            MES EXERCICES ({suivis.length})
          </Text>
          <View style={styles.carteModele}>
            {parGroupe.map(({ groupe, exercices }, indexGroupe) => (
              <View key={groupe} style={indexGroupe > 0 ? { marginTop: espacement.m } : null}>
                <Text style={stylesListe.groupe}>{groupe.toUpperCase()}</Text>
                {exercices.map((e) => {
                  const record = recordPersonnel(entrainements, e.exercice);
                  return (
                    <TouchableOpacity key={e.exercice} style={stylesListe.ligne}
                      onPress={() => ouvrirExercice(e.exercice)}
                      accessibilityLabel={`Voir mes perfs sur ${e.exercice}`}>
                      <View style={{ flex: 1 }}>
                        <Text style={stylesListe.nom} numberOfLines={2}>{e.exercice}</Text>
                        <Text style={stylesListe.resume}>
                          {e.nbSeances} séance{e.nbSeances > 1 ? 's' : ''}
                          {record ? ` · record ${record.poids > 0
                            ? `${String(record.poids).replace('.', ',')} kg × ${record.reps}`
                            : `${record.reps} reps`}` : ''}
                        </Text>
                      </View>
                      <Icone nom="chevron-droit" taille={16} couleur={colors.texteGris} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* ---- La courbe d'un exercice ---- */}
          <Text style={[stylesHub.libelleSection, styles.libelleProgres]}>COURBE PAR EXERCICE</Text>
          <View style={styles.carteModele}>
            <View style={styles.lignePuces}>
              {exercicesAffiches.map((e) => (
                <TouchableOpacity
                  key={e.exercice}
                  style={[styles.puceProgres, e.exercice === exoCourbe && styles.puceProgresActive]}
                  onPress={() => setExerciceCourbe(e.exercice)}
                >
                  <Text style={[styles.puceJourTexte, e.exercice === exoCourbe && styles.puceJourTexteActif]}
                    numberOfLines={1}>
                    {e.exercice}
                  </Text>
                </TouchableOpacity>
              ))}
              {suivis.length > 6 && (
                <TouchableOpacity style={styles.puceProgres}
                  onPress={() => setTousExercicesCourbe((o) => !o)}>
                  <Text style={[styles.puceJourTexte, { color: colors.or }]}>
                    {tousExercicesCourbe ? 'Moins' : `+ ${suivis.length - 6} autres`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[styles.lignePuces, { marginTop: espacement.s }]}>
              {MESURES.map(([cle, libelle]) => {
                // Le 1RM n'existe pas au poids du corps : on retombe sur la
                // mesure par défaut plutôt que d'afficher une puce morte.
                const active = mesureCourbe === cle || (!chargee && cle === 'charge' && mesureCourbe === 'e1rm');
                return (
                  <TouchableOpacity key={cle}
                    style={[styles.puceMesure, active && styles.puceProgresActive]}
                    onPress={() => setMesureCourbe(cle)}>
                    <Text style={[styles.puceJourTexte, active && styles.puceJourTexteActif]}>{libelle}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {courbe && courbe.points.length > 0 ? (
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
                <Text style={styles.noteProgres}>
                  {mesureCourbe === 'e1rm' && chargee
                    ? 'Le 1RM estimé est la charge que tu soulèverais une fois, déduite de ta meilleure série (formule d\'Epley) : une tendance, pas un test.'
                    : mesureCourbe === 'volume'
                      ? 'Le volume additionne toutes tes séries du jour sur cet exercice.'
                      : 'Un point par jour où tu as fait l\'exercice. Touche un point pour le lire.'}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}

      {/* ---- Records personnels (calculés depuis l'historique) ---- */}
      {mesRecords.length > 0 && (
        <>
          <TouchableOpacity style={styles.enTeteRepliableSection}
            onPress={() => setRecordsOuverts(!recordsOuverts)}>
            <TexteIcone nom="competition" taille={15} couleur={colors.or}
              style={[styles.sectionTitre, styles.titreSansMarge, { flex: 1 }]}>
              Mes records
            </TexteIcone>
            <Icone nom={recordsOuverts ? 'chevron-haut' : 'chevron-bas'} taille={16}
              couleur={colors.texteGris} />
          </TouchableOpacity>
          {recordsOuverts && (
            <View style={styles.carteModele}>
              <Text style={styles.indice}>
                Ta série la plus lourde sur chaque exercice, toutes séances
                confondues. Touche un exercice pour ouvrir sa page.
              </Text>
              {/* LECTURE SEULE (09/09/2026, demande de Hafiz : « au niveau des
                  records on ne doit pas pouvoir renommer les exercices »).
                  Toucher une ligne ouvrait un champ de renommage qui
                  réécrivait l'historique PARTOUT — un geste lourd derrière une
                  simple consultation de records, et déclenchable par erreur en
                  faisant défiler la liste. Renommer se fait maintenant
                  uniquement depuis l'éditeur d'un programme, où l'on est déjà
                  en train de modifier quelque chose. */}
              {/* Toucher un record affiche SA COURBE juste au-dessus
                  (08/11/2026) — toujours sans rien renommer. */}
              {mesRecords.map((r) => (
                <TouchableOpacity key={r.exercice} style={styles.ligneRecord}
                  // Depuis le 19/11/2026, un record ouvre la PAGE de son
                  // exercice (courbe + toutes ses séances).
                  onPress={() => ouvrirExercice(r.exercice)}>
                  <Text style={[styles.nomRecord, r.exercice === exoCourbe && { color: colors.or }]}
                    numberOfLines={1}>{r.exercice}</Text>
                  <Text style={styles.valeurRecord}>
                    {r.poids > 0 ? `${r.poids} kg × ` : ''}{r.reps} reps
                  </Text>
                  <Text style={styles.dateRecord}>{dateCourteRecord(r.date)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
      <Text style={styles.sectionTitre}>Historique des séances</Text>
      {!donneesIncertaines && entrainements.length === 0 && (
        <Text style={styles.indice}>Aucune séance loggée pour l'instant.</Text>
      )}
      {/* L'historique a maintenant son propre écran : on n'a plus de raison
          de s'arrêter aux 10 dernières séances comme quand il était coincé
          en bas de l'accueil. */}
      {entrainements.slice(0, 40).map((e) => {
        const nbSeries = e.series.length;
        const exercicesUniques = [...new Set(e.series.map((s) => s.exercice))];
        return (
          <TouchableOpacity
            key={e.id}
            style={styles.carteHistorique}
            onPress={() => { setEntrainementSelectionne(e); setVue('historiqueDetail'); }}
          >
            {/* La date reste le repère principal — c'est par elle qu'on
                retrouve une séance. Le TYPE la complète sur la ligne
                d'en dessous : mis à côté de la date, un nom de programme long
                (48 caractères déjà vus en test) se serait battu pour la
                largeur, et c'est toujours le texte qui perd (bug du
                03/09/2026). Là, il passe simplement à la ligne. */}
            <Text style={styles.dateHistorique}>{libelleDate(e.date)}</Text>
            <Text style={styles.indice}>
              <Text style={styles.typeHistorique}>{typeDeSeance(e, programmes)}</Text>
              {' · '}{exercicesUniques.length} exercice{exercicesUniques.length > 1 ? 's' : ''} · {nbSeries} série{nbSeries > 1 ? 's' : ''}
              {/* La durée réelle, quand le chrono l'a mesurée (10/11/2026). */}
              {dureeSeanceLisible(e.duree_minutes) ? ` · ${dureeSeanceLisible(e.duree_minutes)}` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// La liste « Mes exercices » (19/11/2026). Chaque ligne fait au moins 44 px :
// c'est une cible qu'on touche.
const stylesListe = {
  groupe: {
    color: colors.texteGris, fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    marginBottom: 2,
  },
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.bordure,
  },
  nom: { color: colors.texte, fontSize: 14, fontWeight: '700' },
  resume: { color: colors.texteGris, fontSize: 12, marginTop: 1 },
};
