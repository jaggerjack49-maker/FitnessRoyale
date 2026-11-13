// La vue « suivi » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import { EnteteSousEcran } from './sousEcran';
import { Icone, LibelleIcone, TexteIcone } from '../../components/Icones';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, espacement } from '../../theme';
import { dernieresSeriesDuGroupe, groupesMusculaires } from '../../data/groupesMusculaires';
import { libelleDate } from './outils';
import { styles } from './styles';

export function vueSuivi(ctx) {
  const {
    brouillonObjectifs, classerExercice, correctionsGroupes,
    debutSemaineISO, editionObjectifs, enregistrerObjectifs, entrainements,
    exerciceAClasser, exercicesSemaine, finSemaineISO, groupeDeploye,
    groupesSuivis, nbNonClasses, objectifsSeries, ouvrirEditionObjectifs,
    placeSuivi, seancesDeLaSemaine, seriesFaites, setBrouillonObjectifs,
    setEditionObjectifs, setExerciceAClasser, setGroupeDeploye,
    setVolumeOuvert, setVue, totalSeriesSemaine, volumeOuvert,
  } = ctx;


  return (
    <ScrollView
      key="suivi"
      {...placeSuivi}
      style={styles.conteneur}
      contentContainerStyle={{ padding: espacement.m }}
    >
      <EnteteSousEcran
        titre="Suivi & objectifs"
        sousTitre="Ton volume de la semaine et tes objectifs."
        onRetour={() => setVue('accueil')}
      />
      {/* ---- Volume : séries par groupe musculaire, semaine en cours ---- */}
      <TouchableOpacity style={styles.enTeteRepliableSection} onPress={() => setVolumeOuvert(!volumeOuvert)}>
        <TexteIcone nom="cible" taille={15} couleur={colors.or}
          style={[styles.sectionTitre, styles.titreSansMarge, { flex: 1 }]}>
          Séries par groupe musculaire
        </TexteIcone>
        <Icone nom={volumeOuvert ? 'chevron-haut' : 'chevron-bas'} taille={16}
          couleur={colors.texteGris} />
      </TouchableOpacity>
      <Text style={styles.totalSeries}>
        {totalSeriesSemaine} série{totalSeriesSemaine > 1 ? 's' : ''} cette semaine
        {seancesDeLaSemaine > 0
          ? ` · ${seancesDeLaSemaine} séance${seancesDeLaSemaine > 1 ? 's' : ''}`
          : ' · aucune séance encore'}
      </Text>
      {/* Résumé visible SANS déplier : on doit voir où on en est d'un coup d'œil. */}
      {!volumeOuvert && nbNonClasses > 0 && (
        <TexteIcone nom="question" taille={14} hautAligne style={styles.alerteNonClasses}>
          {nbNonClasses} exercice{nbNonClasses > 1 ? 's' : ''} n'{nbNonClasses > 1 ? 'ont' : 'a'} pas
          de groupe — leurs séries ne sont comptées nulle part. Déplie pour les classer.
        </TexteIcone>
      )}
      {!volumeOuvert && groupesSuivis.length > 0 && (
        <View style={styles.resumeVolume}>
          {groupesSuivis.map((groupe) => {
            const fait = seriesFaites[groupe] || 0;
            const cible = objectifsSeries[groupe] || 0;
            const atteint = cible > 0 && fait >= cible;
            return (
              // Toucher une puce OUVRE la section sur ce groupe : c'est le
              // chemin le plus court entre « Pectoraux 3/12 » et « lesquelles ? ».
              <TouchableOpacity
                key={groupe}
                style={[styles.pucheVolume, atteint && { borderColor: colors.vert }]}
                onPress={() => { setVolumeOuvert(true); setGroupeDeploye(groupe); }}
              >
                <Text style={styles.pucheGroupe}>{groupe}</Text>
                <Text style={[styles.pucheCompte, atteint && { color: colors.vert }]}>
                  {fait}{cible > 0 ? `/${cible}` : ''}
                </Text>
                {atteint ? <Icone nom="valide" taille={11} couleur={colors.vert} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {volumeOuvert && (
        <View style={styles.carteModele}>
          <Text style={styles.indice}>
            Semaine du {debutSemaineISO} au {finSemaineISO} — les séries sont
            comptées automatiquement depuis tes séances loggées.
          </Text>

          {!editionObjectifs && groupesSuivis.length === 0 && (
            <Text style={[styles.indice, { marginTop: espacement.s }]}>
              Fixe tes objectifs pour suivre ton volume d'entraînement.
            </Text>
          )}

          {/* Suivi : objectif vs séries réellement faites */}
          {!editionObjectifs && groupesSuivis.map((groupe) => {
            const fait = seriesFaites[groupe] || 0;
            const cible = objectifsSeries[groupe] || 0;
            const pourcent = cible > 0 ? Math.min(100, Math.round((fait / cible) * 100)) : 0;
            const atteint = cible > 0 && fait >= cible;
            const deploye = groupeDeploye === groupe;
            return (
              <View key={groupe}>
                {/* TOUCHER UN GROUPE MONTRE SES DERNIÈRES SÉRIES (09/09/2026).
                    Le compteur disait combien, jamais lesquelles — donc rien
                    ne permettait de vérifier ce qui avait été compté, ni de
                    repérer un exercice rangé dans le mauvais groupe. */}
                <TouchableOpacity
                  style={styles.ligneVolume}
                  onPress={() => setGroupeDeploye(deploye ? null : groupe)}
                >
                  <TexteIcone nom={deploye ? 'chevron-haut' : 'chevron-bas'}
                    taille={11} ecart={4} couleur={colors.texteGris} style={styles.nomGroupe}>
                    {groupe}
                  </TexteIcone>
                  <View style={styles.barreVolumeFond}>
                    <View
                      style={[
                        styles.barreVolumeRemplie,
                        { width: `${pourcent}%`, backgroundColor: atteint ? colors.vert : colors.accent },
                      ]}
                    />
                  </View>
                  <Text style={[styles.compteurVolume, atteint && { color: colors.vert }]}>
                    {fait}{cible > 0 ? `/${cible}` : ''}
                  </Text>
                  {atteint ? <Icone nom="valide" taille={12} couleur={colors.vert} /> : null}
                </TouchableOpacity>
                {deploye && (() => {
                  const lignes = dernieresSeriesDuGroupe(
                    entrainements, correctionsGroupes, groupe
                  );
                  if (lignes.length === 0) {
                    return (
                      <Text style={styles.detailGroupeVide}>
                        Aucune série sur ce groupe pour l'instant.
                      </Text>
                    );
                  }
                  return (
                    <View style={styles.detailGroupe}>
                      {lignes.map((l, i) => (
                        <View key={`${l.date}-${l.exercice}-${i}`} style={styles.ligneDetailGroupe}>
                          <Text style={styles.dateDetailGroupe}>
                            {libelleDate(l.date)} · {l.exercice}
                          </Text>
                          <Text style={styles.seriesDetailGroupe}>
                            {l.series
                              .map((s) => (s.poids > 0 ? `${s.poids} kg × ${s.reps}` : `${s.reps} reps`))
                              .join('  ·  ')}
                          </Text>
                        </View>
                      ))}
                      {/* La liste est volontairement bornée : on veut les
                          DERNIÈRES séries, pas tout l'historique. */}
                      <Text style={styles.indice}>
                        {lignes.length > 1
                          ? `Les ${lignes.length} dernières entrées de ce groupe`
                          : 'La dernière entrée de ce groupe'}, toutes semaines confondues.
                      </Text>
                    </View>
                  );
                })()}
              </View>
            );
          })}

          {/* Édition des objectifs : un champ par groupe (vide = pas suivi) */}
          {editionObjectifs && (
            <>
              <Text style={[styles.indice, { marginTop: espacement.s }]}>
                Nombre de séries visées par semaine. Laisse vide un groupe que
                tu ne veux pas suivre.
              </Text>
              {groupesMusculaires.map((groupe) => (
                <View key={groupe} style={styles.ligneObjectif}>
                  <Text style={styles.nomGroupe}>{groupe}</Text>
                  <TextInput
                    style={[styles.champ, { width: 64, textAlign: 'center' }]}
                    value={brouillonObjectifs[groupe] || ''}
                    onChangeText={(v) =>
                      setBrouillonObjectifs((b) => ({ ...b, [groupe]: v }))}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.texteGris}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.boutonUtiliserModele} onPress={enregistrerObjectifs}>
                <LibelleIcone nom="valide" taille={14} style={styles.boutonDemarrerTexte}>Enregistrer mes objectifs</LibelleIcone>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditionObjectifs(false)}>
                <Text style={styles.lienAnnuler}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}

          {!editionObjectifs && (
            <TouchableOpacity style={styles.boutonSecondaire} onPress={ouvrirEditionObjectifs}>
              <LibelleIcone nom="cible" taille={14} style={styles.boutonSecondaireTexte}>Fixer mes objectifs</LibelleIcone>
            </TouchableOpacity>
          )}

          {/* Le point hebdo sur le volume (une notification qui porte ces
              chiffres) se règle désormais dans Profil → Paramètres →
              Notifications (08/11/2026). */}
          {!editionObjectifs && (
            <TexteIcone nom="cloche" taille={13} hautAligne style={[styles.indice, { marginTop: espacement.s }]}>
              Pour recevoir ce point chaque semaine en notification : Profil
              → Paramètres → Notifications.
            </TexteIcone>
          )}

          {/* TOUS les exercices de la semaine, avec le groupe où ils sont
              comptés — et pas seulement ceux que l'app n'a pas reconnus.
              CORRECTIF DU 03/09/2026 : « unilateral raises » était classé à
              tort dans le Dos, donc absent de la liste des non classés, donc
              IMPOSSIBLE à corriger. Un exercice mal rangé est même plus
              gênant qu'un exercice non rangé : il fausse deux compteurs à la
              fois, en silence. */}
          {!editionObjectifs && exercicesSemaine.length > 0 && (
            <>
              <TexteIcone nom="etiquette" taille={13} hautAligne
                style={[styles.indice, { marginTop: espacement.s }]}>
                Où comptent mes exercices ? Touche-en un pour le changer de groupe.
              </TexteIcone>
              {exercicesSemaine.map(({ exercice, groupe, corrige }) => (
                <View key={exercice}>
                  <TouchableOpacity
                    style={styles.ligneChoixProgramme}
                    onPress={() => setExerciceAClasser(exerciceAClasser === exercice ? null : exercice)}
                  >
                    <TexteIcone nom={exerciceAClasser === exercice ? 'chevron-haut' : 'chevron-bas'}
                      taille={12} ecart={5} couleur={colors.texteGris} style={styles.choixProgrammeTexte}>
                      {exercice}
                    </TexteIcone>
                    {groupe ? (
                      <Text style={styles.groupeExercice}>
                        {groupe}{corrige ? ' · modifié' : ''}
                      </Text>
                    ) : (
                      <LibelleIcone nom="question" taille={12} ecart={4}
                        style={[styles.groupeExercice, { color: colors.rouge }]}>
                        compté nulle part
                      </LibelleIcone>
                    )}
                  </TouchableOpacity>
                  {exerciceAClasser === exercice && (
                    <View style={styles.lignePuces}>
                      {groupesMusculaires.map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.puceJour, g === groupe && styles.puceJourActive]}
                          onPress={() => classerExercice(exercice, g)}
                        >
                          <Text style={[styles.puceJourTexte, g === groupe && styles.puceJourTexteActif]}>
                            {g}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      )}
      {/* Le rappel d'entraînement a déménagé dans Profil → Paramètres →
          Notifications (08/11/2026). */}
    </ScrollView>
  );
}
