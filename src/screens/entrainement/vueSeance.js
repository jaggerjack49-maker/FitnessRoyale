// La vue « seance » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ChoixExercice from '../../components/ChoixExercice';
import { ChronoSeance, ConfirmationSuppression, CreerProgrammeDepuisSeance } from './composantsSeance';
import { Icone, LibelleIcone, TexteIcone } from '../../components/Icones';
import MinuteurRepos from '../../components/MinuteurRepos';
import { ZONE_TACTILE, aujourdhui, dateCourteRecord, indicateurProgression, libelleDate, trouverDernieresSeries } from './outils';
import { dernieresSeancesExercice } from '../../logic/progres';
import { bat_le_record, recordPersonnel, suggererProchaineSerie } from '../../logic/surchargeProgressive';
import { ciblePrevueDansBloc } from '../../logic/bloc';
import { colors, espacement } from '../../theme';
import { da } from '../../designSystem';
import { exercicesPourProgramme, libelleSerie } from '../../logic/seanceLibre';
import { joursTravailles } from '../../logic/dateSeance';
import { libelleEtape, prochaineEtape } from '../../logic/repos';
import { resumeReglages } from '../../logic/lignesProgramme';
import { styles } from './styles';

// ---- Vue : logger une séance ----
export function vueSeance(ctx) {
  const {
    abandonnerSeance, actif, ajouterExerciceAuProgramme,
    ajouterExerciceLibre, ajouterSerie, ajusterRepos, biblioSeance,
    blocSeance, champsSaisie, ciblesSemaine, creerProgrammeDepuisSeance,
    daterAujourdhui, debutChrono, demanderRetraitExercice,
    enregistrementEnCours, entrainements, erreur, erreurSaisie,
    exerciceARetirer, exercicesSession, fermerEditionSerie,
    jourEnregistrement, majChampSaisie, modifierSerie, nouvelExerciceLibre,
    preferences, programmeActif, programmeNeDeLaSeance, rattrapageDe,
    repos, retirerExerciceDeSeance, semaineSeance, serieEnEdition,
    seriesDeLaSeance, seriesLoggees, setBiblioSeance, setDaterAujourdhui,
    setExerciceARetirer, setExercicesSession, setNouvelExerciceLibre,
    setRepos, setSerieEnEdition, supprimerSerie, terminerSeance,
    reduireSeance, demanderAbandon, confirmerAbandon, setConfirmerAbandon,
    journalExoOuvert, setJournalExoOuvert,
  } = ctx;


    const jour = aujourdhui();
    const joursAvecDuTravail = joursTravailles(seriesDeLaSeance);
    return (
      // LE CLAVIER CACHAIT LES CHAMPS DU BAS (retour de Hafiz du 02/09/2026,
      // capture à l'appui) : on saisit ses reps sans voir ce qu'on tape.
      // Deux garde-fous complémentaires :
      //  - KeyboardAvoidingView remonte le contenu sur iOS ;
      //  - une grande marge en bas laisse de quoi FAIRE DÉFILER le champ
      //    au-dessus du clavier sur Android, où la fenêtre est simplement
      //    redimensionnée.
      // `keyboardShouldPersistTaps` permet d'appuyer sur « + Série » du
      // premier coup, sans un premier tap qui ne sert qu'à fermer le clavier.
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={styles.conteneur}
        contentContainerStyle={{ padding: espacement.m, paddingBottom: 340 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* RÉDUIRE (15/11/2026) : revenir à l'onglet SANS arrêter la séance —
            pour aller voir son journal, ses records, ses programmes. Un
            bandeau « Séance en cours » permet de la reprendre de partout. */}
        <View style={styles.enteteSeance}>
          <TexteIcone nom="entrainement" taille={19} couleur={colors.or} style={[styles.titre, { flex: 1 }]}>
            {programmeActif ? programmeActif.nom : 'Séance libre'}
          </TexteIcone>
          <TouchableOpacity
            style={styles.boutonReduire}
            onPress={reduireSeance}
            accessibilityLabel="Réduire la séance (elle continue)"
          >
            <LibelleIcone nom="chevron-bas" taille={14} ecart={5} style={styles.boutonModifierTexte}>
              Réduire
            </LibelleIcone>
          </TouchableOpacity>
        </View>
        <Text style={styles.sousTitre}>
          {jourEnregistrement === jour
            ? libelleDate(jour)
            : `Sera enregistrée au ${libelleDate(jourEnregistrement)}`}
        </Text>
        <ChronoSeance debut={debutChrono} actif={actif} />
        {/* LE BLOC EN COURS (05/10/2026) : où j'en suis dans mon plan. On
            l'affiche AVANT tout le reste — c'est le cadre dans lequel la
            séance se fait, pas un détail. */}
        {semaineSeance !== null && (
          <View style={styles.bandeauBloc}>
            <TexteIcone nom="programme" taille={14} hautAligne style={styles.texteBandeauBloc}>
              {semaineSeance === 'decharge'
                ? 'Semaine de DÉCHARGE de ton bloc'
                : `Semaine ${semaineSeance} sur ${blocSeance.duree_semaines} de ton bloc`}
              {' '}— les charges ci-dessous viennent de ton plan.
            </TexteIcone>
          </View>
        )}
        {/* SÉANCE COMMENCÉE UN AUTRE JOUR (21/09/2026) : on le DIT, et on
            laisse le choix — l'app ne décide pas dans le dos de personne. */}
        {jourEnregistrement !== jour && (
          <View style={styles.bandeauJourSeance}>
            <TexteIcone nom="calendrier" taille={14} hautAligne style={styles.texteJourSeance}>
              Cette séance a été faite le {libelleDate(jourEnregistrement)} :
              c'est à ce jour-là qu'elle sera enregistrée, pas aujourd'hui.
              {joursAvecDuTravail.length > 1
                ? ' (Des séries ont été saisies sur plusieurs jours : on garde'
                  + ' celui où tu en as fait le plus.)'
                : ''}
            </TexteIcone>
            <TouchableOpacity onPress={() => setDaterAujourdhui(true)}>
              <Text style={styles.lienJourSeance}>
                L'enregistrer au {libelleDate(jour)} (aujourd'hui) ›
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {daterAujourdhui && joursAvecDuTravail.some((j) => j !== jour) && (
          <View style={styles.bandeauJourSeance}>
            <TexteIcone nom="calendrier" taille={14} style={styles.texteJourSeance}>
              Enregistrement forcé au {libelleDate(jour)} (aujourd'hui).
            </TexteIcone>
            <TouchableOpacity onPress={() => setDaterAujourdhui(false)}>
              <Text style={styles.lienJourSeance}>
                Revenir au jour où la séance a été faite ›
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {rattrapageDe && (
          <TexteIcone nom="horloge" taille={14} hautAligne style={styles.bandeauRattrapage}>
            Rattrapage de la séance du {libelleDate(rattrapageDe)} — elle sera
            enregistrée au jour où tu la fais, pas à cette date-là.
          </TexteIcone>
        )}
        {/* Le bandeau « N séances gardées sur ce téléphone » vivait ici, en
            pleine séance. Il est passé en haut de l'accueil (bandeauFile,
            08/11/2026) : c'est là qu'on peut agir dessus, et pendant l'effort
            il ne faisait qu'encombrer. */}

        {exercicesSession.map((exercice, indexExo) => {
          const dernieres = trouverDernieresSeries(entrainements, exercice, jour);
          const seriesFaites = seriesLoggees[exercice] || [];
          const indicateur = indicateurProgression(seriesFaites, dernieres?.series);
          const saisie = champsSaisie[exercice] || {};
          // ---- Surcharge progressive (calculée depuis l'historique) ----
          // On passe TOUT l'historique enregistré, sans filtrer sur la date :
          // la séance en cours n'y est pas encore (elle vit dans seriesLoggees
          // jusqu'à « Terminer »), donc aucun risque de se comparer à soi-même.
          // Et si une séance a déjà été loggée aujourd'hui, elle compte bien.
          const cibleExo = programmeActif?.exercices?.find((e) => e.exercice === exercice);
          const dansLeProgramme = !!cibleExo;
          const suggestion = suggererProchaineSerie(entrainements, exercice, cibleExo?.reps_cibles, {
            seriesCibles: cibleExo?.series_cibles,
          });
          const reglages = resumeReglages(cibleExo);
          // ---- LE PLAN DU BLOC (05/10/2026) ----
          // Si un bloc est en cours, c'est SON plan qui dit quoi faire — pas
          // un recalcul. C'est tout l'intérêt d'avoir figé le tableau : le
          // plan tient sa parole même après une semaine ratée, au lieu de se
          // réajuster en silence. Rien n'est écrit pour cet exercice (ou pas
          // de bloc) : on retombe sur la suggestion calculée, comme avant.
          const cibleDuPlan = blocSeance
            ? ciblePrevueDansBloc(blocSeance, programmeActif?.id, exercice,
              jourEnregistrement, ciblesSemaine)
            : null;
          const record = recordPersonnel(entrainements, exercice);
          const nouveauRecord = bat_le_record(seriesFaites, record);
          return (
            <View key={exercice} style={styles.carteExercice}>
              {/* L'ORDRE DU PROGRAMME se lit (« 1. », « 2. »…), et le repos /
                  RIR fixés sont rappelés sous le nom (08/11/2026). La croix
                  retire l'exercice de CETTE séance (11/11/2026). */}
              <View style={styles.enteteExerciceSeance}>
                <Text style={[styles.nomExercice, { flex: 1 }]}>
                  <Text style={styles.numeroExercice}>{indexExo + 1}. </Text>{exercice}
                </Text>
                <TouchableOpacity
                  style={styles.boutonRetirerExercice}
                  hitSlop={ZONE_TACTILE}
                  accessibilityLabel={`Retirer ${exercice} de la séance`}
                  onPress={() => demanderRetraitExercice(exercice)}
                >
                  <Icone nom="croix" taille={14} couleur={colors.texteGris} />
                </TouchableOpacity>
              </View>
              <ConfirmationSuppression
                actif={exerciceARetirer === exercice}
                question={`Retirer « ${exercice} » de la séance ? ${seriesFaites.length > 1 ? `Ses ${seriesFaites.length} séries notées seront effacées.` : 'Sa série notée sera effacée.'}${programmeActif ? ' Ton programme, lui, ne change pas.' : ''}`}
                libelleConfirmer="Oui, retirer"
                onConfirmer={() => retirerExerciceDeSeance(exercice)}
                onAnnuler={() => setExerciceARetirer(null)}
              />
              {reglages ? (
                <TexteIcone nom="horloge" taille={12} ecart={5} style={styles.reglagesSeance}>
                  {reglages.replace('repos', 'Repos')}{cibleExo?.rir_cible !== null
                    && cibleExo?.rir_cible !== undefined ? ' visé' : ''}
                </TexteIcone>
              ) : null}
              <Text style={styles.indiceDerniere}>
                {dernieres
                  ? `Dernière fois (${dateCourteRecord(dernieres.date)}) : ${dernieres.series
                      .map((s) => `${s.poids}kg×${s.reps}`)
                      .join(', ')}`
                  : 'Première fois sur cet exercice'}
                {indicateur && (
                  <Text style={{ color: indicateur.couleur, fontWeight: '800' }}> {indicateur.symbole}</Text>
                )}
              </Text>
              {/* LE JOURNAL DE L'EXERCICE (15/11/2026, demande de Hafiz : « avoir
                  accès au log d'entraînement pendant la séance afin de pouvoir
                  ajuster le poids ») : ses dernières séances, série par série,
                  sans quitter l'écran. Seulement s'il a un passé. */}
              {dernieres ? (
                <TouchableOpacity
                  style={styles.lienJournalExo}
                  onPress={() => setJournalExoOuvert(journalExoOuvert === exercice ? null : exercice)}
                >
                  <LibelleIcone nom={journalExoOuvert === exercice ? 'chevron-haut' : 'chevron-bas'}
                    taille={12} ecart={5} style={styles.lienJournalExoTexte}>
                    {journalExoOuvert === exercice ? 'Masquer mon journal' : 'Voir mes dernières séances'}
                  </LibelleIcone>
                </TouchableOpacity>
              ) : null}
              {journalExoOuvert === exercice ? (
                <View style={styles.journalExo}>
                  {dernieresSeancesExercice(entrainements, exercice).map((ligne) => (
                    <View key={`${ligne.id}-${ligne.date}`} style={styles.ligneJournalExo}>
                      <Text style={styles.dateJournalExo}>{dateCourteRecord(ligne.date)}</Text>
                      <Text style={styles.seriesJournalExo}>
                        {ligne.series.map((sj) => libelleSerie(sj)).join('  ·  ')}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Quoi faire aujourd'hui : LE PLAN s'il existe, sinon le calcul */}
              {cibleDuPlan ? (
                <TexteIcone nom="programme" taille={13} hautAligne style={styles.suggestion}>
                  {cibleDuPlan.semaine === 'decharge' ? 'Décharge'
                    : `Semaine ${cibleDuPlan.semaine}`} :{' '}
                  {cibleDuPlan.series
                    ? `${cibleDuPlan.series} série${cibleDuPlan.series > 1 ? 's' : ''} × `
                    : ''}
                  {cibleDuPlan.reps} reps
                  {cibleDuPlan.poids > 0 ? ` à ${cibleDuPlan.poids} kg` : ''}
                  <Text style={styles.raisonSuggestion}>
                    {cibleDuPlan.corrigee ? ' — ta valeur' : ' — ton plan'}
                  </Text>
                </TexteIcone>
              ) : suggestion ? (
                <TexteIcone nom="cible" taille={13} hautAligne style={styles.suggestion}>
                  Aujourd'hui : {suggestion.series ? `${suggestion.series} séries × ` : ''}
                  {suggestion.reps} reps{suggestion.poids > 0 ? ` à ${suggestion.poids} kg` : ''}
                  <Text style={styles.raisonSuggestion}> — {suggestion.raison}</Text>
                </TexteIcone>
              ) : null}

              {/* Record personnel + badge quand il tombe en direct */}
              {record && (
                <TexteIcone nom="competition" taille={13} hautAligne
                  style={nouveauRecord ? styles.recordBattu : styles.record}>
                  {nouveauRecord
                    ? `NOUVEAU RECORD ! (ancien : ${record.poids} kg × ${record.reps})`
                    : `Record : ${record.poids} kg × ${record.reps} (${record.date})`}
                </TexteIcone>
              )}
              {!record && nouveauRecord && (
                <TexteIcone nom="competition" taille={13} style={styles.recordBattu}>
                  Premier record sur cet exercice !
                </TexteIcone>
              )}

              {/* L'alerte « Bloqué à X kg depuis 3 séances » a été RETIRÉE le
                  08/11/2026 à la demande de Hafiz (« c'est encombrant ») :
                  elle s'ajoutait sous chaque exercice, en rouge, pendant
                  l'effort. `detecterStagnation` reste dans
                  src/logic/surchargeProgressive.js, prête si on veut la
                  remontrer ailleurs (un bilan, par exemple). */}

              {/* Toucher une série l'ouvre en modification (04/09/2026). */}
              {seriesFaites.map((s, i) => {
                const cle = `${exercice}#${i}`;
                const enEdition = serieEnEdition === cle;
                if (!enEdition) {
                  return (
                    <TouchableOpacity key={i} onPress={() => setSerieEnEdition(cle)}>
                      <View style={styles.ligneSerieFaite}>
                        <Text style={styles.serieFaite}>
                          Série {s.numero_serie} : {libelleSerie(s)}
                        </Text>
                        <Icone nom="crayon" taille={12} couleur={colors.texteGris} />
                      </View>
                    </TouchableOpacity>
                  );
                }
                return (
                  <View key={i} style={styles.ligneEditionSerie}>
                    <Text style={styles.numeroSerieEdition}>S{s.numero_serie}</Text>
                    <TextInput
                      style={[styles.champ, styles.champCourt]}
                      value={String(s.reps)}
                      onChangeText={(v) => modifierSerie(exercice, i, 'reps', v)}
                      keyboardType="numeric"
                      placeholder="Reps"
                      placeholderTextColor={colors.texteGris}
                    />
                    <TextInput
                      style={[styles.champ, styles.champCourt]}
                      value={String(s.poids)}
                      onChangeText={(v) => modifierSerie(exercice, i, 'poids', v)}
                      keyboardType="numeric"
                      placeholder="Kg"
                      placeholderTextColor={colors.texteGris}
                    />
                    <TextInput
                      style={[styles.champ, styles.champRir]}
                      value={s.rir === null || s.rir === undefined ? '' : String(s.rir)}
                      onChangeText={(v) => modifierSerie(exercice, i, 'rir', v)}
                      keyboardType="numeric"
                      placeholder="RIR"
                      placeholderTextColor={colors.texteGris}
                      maxLength={2}
                    />
                    <TouchableOpacity
                      style={styles.boutonAjouterSerie}
                      onPress={() => fermerEditionSerie(exercice, i)}
                    >
                      <Text style={styles.boutonAjouterSerieTexte}>OK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.boutonRetirer}
                      onPress={() => supprimerSerie(exercice, i)}
                    >
                      <Icone nom="corbeille" taille={16} couleur={colors.rouge} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Cet exercice ne fait pas partie du programme : on propose de
                  l'y ajouter POUR DE BON, sans quitter la séance. On propose,
                  on n'impose pas — un exercice de dépannage (machine prise) n'a
                  pas à entrer dans le programme. */}
              {programmeActif && !dansLeProgramme && (
                <TouchableOpacity
                  style={styles.boutonSecondaire}
                  onPress={() => ajouterExerciceAuProgramme(exercice)}
                >
                  <LibelleIcone nom="plus" taille={13} style={styles.boutonSecondaireTexte}>
                    Ajouter au programme « {programmeActif.nom} »
                  </LibelleIcone>
                </TouchableOpacity>
              )}

              <View style={styles.ligneAjoutSerie}>
                <View style={styles.colonneChampSerie}>
                  <Text style={styles.libelleChampSerie}>RÉPÉTITIONS</Text>
                  <TextInput
                    style={[styles.champ, styles.champSaisieSerie]}
                    value={saisie.reps || ''}
                    onChangeText={(v) => majChampSaisie(exercice, 'reps', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.texteGris}
                  />
                </View>
                <View style={styles.colonneChampSerie}>
                  <Text style={styles.libelleChampSerie}>CHARGE (KG)</Text>
                  <TextInput
                    style={[styles.champ, styles.champSaisieSerie]}
                    value={saisie.poids || ''}
                    onChangeText={(v) => majChampSaisie(exercice, 'poids', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.texteGris}
                  />
                </View>
                {/* Le RIR RESSENTI (11/11/2026) — facultatif, vidé après
                    chaque série. Plus étroit : un ou deux chiffres. */}
                <View style={styles.colonneChampRir}>
                  <Text style={styles.libelleChampSerie}>RIR</Text>
                  <TextInput
                    style={[styles.champ, styles.champSaisieSerie]}
                    value={saisie.rir || ''}
                    onChangeText={(v) => majChampSaisie(exercice, 'rir', v)}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.texteGris}
                    maxLength={2}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.boutonAjouterSerie, styles.boutonSerieAligne]}
                  onPress={() => ajouterSerie(exercice)}
                >
                  <LibelleIcone nom="plus" taille={13} ecart={5} style={styles.boutonAjouterSerieTexte}>Série</LibelleIcone>
                </TouchableOpacity>
              </View>
              {/* L'explication du RIR, sous le PREMIER exercice seulement :
                  répétée sous chacun, elle encombrerait l'écran de séance. */}
              {erreurSaisie && erreurSaisie.exercice === exercice ? (
                <TexteIcone nom="alerte" taille={13} hautAligne style={styles.erreurSaisie}>
                  {erreurSaisie.message}
                </TexteIcone>
              ) : null}
              {indexExo === 0 ? (
                <Text style={styles.aideRir}>
                  RIR = les reps que tu avais encore en réserve (0 = jusqu'à l'échec). Facultatif.
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* AJOUTER UN EXERCICE EN PLEINE SÉANCE — y compris quand on suit un
            programme (07/09/2026). Ce champ n'apparaissait qu'en séance LIBRE :
            avec un programme, une machine occupée ou un exercice ajouté au
            débotté n'avait aucune place où être noté. */}
        <View style={styles.ligneAjoutSerie}>
          <TextInput
            style={[styles.champ, { flex: 1 }]}
            value={nouvelExerciceLibre}
            onChangeText={setNouvelExerciceLibre}
            placeholder="Ajouter un exercice…"
            placeholderTextColor={colors.texteGris}
          />
          <TouchableOpacity style={styles.boutonAjouterSerie} onPress={ajouterExerciceLibre}>
            <LibelleIcone nom="plus" taille={13} ecart={5} style={styles.boutonAjouterSerieTexte}>Exo</LibelleIcone>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.boutonBiblioSeance}
          onPress={() => setBiblioSeance((o) => !o)}
        >
          <LibelleIcone nom="bibliotheque" taille={14} ecart={6} style={styles.boutonBiblioTexte}>
            {biblioSeance ? 'Fermer la bibliothèque' : 'Choisir dans la bibliothèque'}
          </LibelleIcone>
        </TouchableOpacity>
        {biblioSeance && (
          <ChoixExercice
            dejaPris={exercicesSession}
            onFermer={() => setBiblioSeance(false)}
            onChoisir={(nomExo) => {
              // Pas de `ajouterExerciceLibre` ici : cette fonction lit le
              // CHAMP de saisie, et l'exercice choisi n'y passe pas.
              setExercicesSession((l) => (l.includes(nomExo) ? l : [...l, nomExo]));
            }}
          />
        )}

        {/* Une séance libre peut devenir un programme (08/11/2026). Le
            composant reste affiché après la création pour montrer sa
            confirmation, même si la séance est désormais rattachée. */}
        {exercicesSession.length > 0
          && (!programmeActif || programmeActif.id === programmeNeDeLaSeance) ? (
          <CreerProgrammeDepuisSeance
            exercices={exercicesPourProgramme(exercicesSession, seriesDeLaSeance)}
            nomParDefaut={`Séance du ${libelleDate(jour)}`}
            explication="Les exercices de cette séance, avec comme objectif ce que tu viens de faire (séries faites × reps de la dernière). Tu pourras tout corriger ensuite."
            onCreer={(nom) => creerProgrammeDepuisSeance(
              nom, exercicesPourProgramme(exercicesSession, seriesDeLaSeance), true,
            )}
          />
        ) : null}

        {erreur ? <TexteIcone nom="alerte" taille={13} hautAligne style={styles.messageErreur}>{erreur}</TexteIcone> : null}

        <TouchableOpacity style={styles.boutonPrincipal} onPress={terminerSeance} disabled={enregistrementEnCours}>
          {enregistrementEnCours ? <ActivityIndicator color={da.orSombre} /> : (
            <LibelleIcone nom="valide" taille={15} style={styles.boutonPrincipalTexte}>Terminer la séance</LibelleIcone>
          )}
        </TouchableOpacity>
        {/* Sortir SANS enregistrer. C'était un lien gris discret (« Abandonner »)
            que Hafiz n'a pas trouvé — c'est maintenant un vrai bouton. */}
        {/* « Réduire » garde la séance ; ce bouton-ci l'EFFACE. Depuis le
            15/11/2026 il se confirme dès que des séries sont notées. */}
        <TouchableOpacity style={styles.boutonSortir} onPress={demanderAbandon}>
          <LibelleIcone nom="sortie" taille={14} style={styles.boutonSortirTexte}>
            {programmeActif
              ? 'Sortir du programme (sans enregistrer)'
              : 'Quitter la séance (sans enregistrer)'}
          </LibelleIcone>
        </TouchableOpacity>
        <ConfirmationSuppression
          actif={confirmerAbandon}
          question="Quitter SANS enregistrer ? Les séries notées seront effacées. Pour garder la séance et aller voir autre chose, utilise plutôt « Réduire » en haut."
          libelleConfirmer="Oui, tout effacer"
          onConfirmer={abandonnerSeance}
          onAnnuler={() => setConfirmerAbandon(false)}
        />
      </ScrollView>
      {/* LE MINUTEUR DE REPOS, posé PAR-DESSUS la page (08/11/2026) : on le
          voit où qu'on ait fait défiler. Il annonce la prochaine étape dans
          l'ORDRE du programme. */}
      <MinuteurRepos
        repos={repos}
        actif={actif}
        etape={repos ? libelleEtape(prochaineEtape(
          exercicesSession, seriesLoggees,
          Object.fromEntries((programmeActif?.exercices || [])
            .map((e) => [e.exercice, e.series_cibles])),
          repos.exercice,
        )) : null}
        onAjuster={ajusterRepos}
        onPasser={() => setRepos(null)}
        vibrer={preferences.vibrationRepos}
        notifier={preferences.notificationRepos}
      />
      </KeyboardAvoidingView>
    );
}
