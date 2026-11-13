// La vue « programmes » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChoixJoursSeance, ConfirmationSuppression, LigneExercicePrevu } from './composantsSeance';
import { EditeurSeance } from './EditeurSeance';
import { EnteteSousEcran, LigneRaccourci, stylesHub } from './sousEcran';
import { Icone, LibelleIcone, TexteIcone } from '../../components/Icones';
import { ZONE_TACTILE, joursDuCycle } from './outils';
import { abreviationsJours, joursSemaine, programmesStandards } from '../../data/programmesStandards';
import { bibliothequeExercices } from '../../data/bibliothequeExercices';
import { colors, espacement } from '../../theme';
import { da } from '../../designSystem';
import { styles } from './styles';

// ================= SOUS-ÉCRAN : MES PROGRAMMES =================
export function vueProgrammes(ctx) {
  const {
    ajouterSeanceAuCycle, appliquerModele, bandeauEtat,
    basculerDetailCycle, basculerJourProgramme, chercherParCode, codeSaisi,
    cycleEnService, cycleQuiRecoit, cycles, cyclesDeroules,
    demanderSuppression, donneesIncertaines, enModele, entrainements,
    erreur, erreurCode, jourSemaineOuvert, joursNouvelleSeance,
    messageAjoutSeance, messageOfficiel, modeleEnCours, modelesOuverts,
    moi, noteReutilisation, ouvrirTableau, placeProgrammes,
    programmeEnEdition, programmeEnService, programmeTrouve, programmes,
    programmesOfficiels, programmesSeuls, publicationEnCours, publierCycle,
    rechercheCode, retirerOfficiel, sauvegarderProgramme,
    sauvegarderSeanceJour, seanceDeroulee, setCodeSaisi, setCycleQuiRecoit,
    setExoConsulte, setJourSemaineOuvert, setJoursNouvelleSeance,
    setMessageAjoutSeance, setModelesOuverts, setProgrammeEnEdition,
    setProgrammeTrouve, setSeanceDeroulee, setSuppressionAConfirmer,
    setVue, sortirDuProgramme, suppressionAConfirmer, supprimerCycle,
    supprimerProgramme, viderJourSemaine,
  } = ctx;


  return (
    <ScrollView
      key="programmes"
      {...placeProgrammes}
      style={styles.conteneur}
      contentContainerStyle={{ padding: espacement.m }}
    >
      <EnteteSousEcran
        titre="Mes programmes"
        sousTitre="Créer, modifier, partager. Pour démarrer, reviens à l'accueil."
        onRetour={() => setVue('accueil')}
      />
      {bandeauEtat}
      <TouchableOpacity
        style={stylesHub.boutonCreer}
        onPress={() => setVue('nouveauProgramme')}
      >
        <LibelleIcone nom="plus" taille={15} style={stylesHub.texteBoutonCreer}>
          NOUVEAU PROGRAMME
        </LibelleIcone>
      </TouchableOpacity>
      <LigneRaccourci
        icone="bibliotheque"
        titre="Bibliothèque d'exercices"
        resume={`${bibliothequeExercices.length} exercices · 12 groupes musculaires`}
        onPress={() => { setExoConsulte(null); setVue('bibliotheque'); }}
      />
      {!donneesIncertaines && cycles.length === 0 && programmesSeuls.length === 0 && (
        <Text style={styles.indice}>Aucun programme pour l'instant.</Text>
      )}

      {/* « Mes programmes » est l'endroit où l'on MODIFIE (27/08/2026, demande
          de Hafiz) : le calendrier, lui, ne fait que montrer et démarrer.
          D'où « ✏️ Modifier » ici à la place de « Démarrer ». */}
      {(cycles.length > 0 || programmesSeuls.length > 0) && (
        <Text style={styles.indice}>
          C'est ici qu'on retouche une séance. Pour en démarrer une, retourne
          à l'accueil de l'onglet — elle t'y attend si elle est prévue
          aujourd'hui, sinon touche son jour dans le calendrier.
        </Text>
      )}

      {/* Les PROGRAMMES COMPLETS (cycles) : un nom + une séance par jour. */}
      {cycles.map((cycle) => {
        const detailOuvert = cyclesDeroules.includes(cycle.id);
        return (
        <View key={cycle.id} style={styles.carteModele}>
          {/* Le nom sur SA PROPRE LIGNE : avec trois boutons à côté de lui sur
              la même ligne, il était comprimé à une largeur nulle et se
              repliait sur des dizaines de lignes invisibles (d'où les grands
              vides de la capture), pendant que la croix débordait à droite. */}
          <TexteIcone nom="programme" taille={14} couleur={colors.or} style={styles.nomProgrammeTexte}>{cycle.nom}</TexteIcone>
          <View style={styles.ligneActionsProgramme}>
            <TouchableOpacity
              style={styles.boutonModifier}
              onPress={() => basculerDetailCycle(cycle.id)}
            >
              <LibelleIcone nom={detailOuvert ? 'chevron-haut' : 'chevron-bas'}
                taille={13} ecart={5} style={styles.boutonModifierTexte}>
                {detailOuvert ? 'Masquer le détail' : 'Voir le détail'}
              </LibelleIcone>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.boutonModifier}
              onPress={() => ouvrirTableau(cycle.nom, cycle.seances,
                { type: 'cycle', id: cycle.id, ...cycle })}
            >
              <LibelleIcone nom="tableau" taille={13} ecart={5} style={styles.boutonModifierTexte}>Tableau</LibelleIcone>
            </TouchableOpacity>
            {/* Publier : réservé à l'admin (le serveur renvoie 403 sinon).
                C'est ainsi qu'on alimente le catalogue — pas de formulaire
                séparé, l'admin construit un programme normalement puis le
                publie. */}
            {moi.admin ? (
              <TouchableOpacity
                style={styles.boutonPublier}
                onPress={() => publierCycle(cycle)}
                disabled={publicationEnCours !== null}
              >
                {publicationEnCours === cycle.id ? (
                  <ActivityIndicator color={colors.rouge} size="small" />
                ) : (
                  <LibelleIcone nom="cle" taille={13} ecart={5} style={styles.boutonPublierTexte}>Partager par code</LibelleIcone>
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => demanderSuppression('cycle-' + cycle.id)}
              style={styles.boutonRetirer}
              hitSlop={ZONE_TACTILE}
            >
              <Icone nom="croix" taille={15} couleur={colors.rouge} />
            </TouchableOpacity>
          </View>
          <ConfirmationSuppression
            actif={suppressionAConfirmer === 'cycle-' + cycle.id}
            question={`Supprimer « ${cycle.nom} » et ses ${cycle.seances.length} séances ?`}
            onConfirmer={() => { setSuppressionAConfirmer(null); supprimerCycle(cycle); }}
            onAnnuler={() => setSuppressionAConfirmer(null)}
          />
          {/* DÉTAIL REPLIÉ = juste le nom du programme et un résumé.
              La v4 ne repliait que les EXERCICES : les séances, elles,
              restaient listées, donc « on voit toujours le détail »
              (retour de Hafiz du 02/09/2026 sur l'APK). */}
          {!detailOuvert && (
            <Text style={styles.indice}>
              {cycle.seances.length} séance{cycle.seances.length > 1 ? 's' : ''}
              {joursDuCycle(cycle) ? ` · ${joursDuCycle(cycle)}` : ''}
            </Text>
          )}
          {detailOuvert && cycle.seances.map((seance) => {
            const enEdition = programmeEnEdition === seance.id;
            const deroulee = seanceDeroulee === seance.id;
            return (
              <View key={seance.id}>
                <View style={styles.ligneSeanceCycle}>
                  {/* Toucher la ligne DÉROULE la séance : on voit ses exercices
                      sans ouvrir l'éditeur (27/08/2026, demande de Hafiz). */}
                  <TouchableOpacity
                    style={styles.zoneDeroule}
                    onPress={() => setSeanceDeroulee(deroulee ? null : seance.id)}
                  >
                    <Text style={styles.jourSeanceCycle}>
                      {(seance.jours || []).map((j) => abreviationsJours[j]).join(' ')}
                    </Text>
                    <TexteIcone nom={deroulee ? 'chevron-haut' : 'chevron-bas'}
                      taille={12} ecart={5} couleur={colors.texteGris} style={styles.contenuCalendrier}>
                      {seance.nom} · {seance.exercices.length} exo{seance.exercices.length > 1 ? 's' : ''}
                    </TexteIcone>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.boutonModifier}
                    onPress={() => setProgrammeEnEdition(enEdition ? null : seance.id)}
                  >
                    {enEdition ? (
                      <Text style={styles.boutonModifierTexte}>Fermer</Text>
                    ) : (
                      <LibelleIcone nom="crayon" taille={13} ecart={5}
                        style={styles.boutonModifierTexte}>Modifier</LibelleIcone>
                    )}
                  </TouchableOpacity>
                </View>
                {deroulee && !enEdition && (
                  <View style={styles.detailJour}>
                    <Text style={styles.libelleJoursSeance}>
                      Jours de la semaine (projetés sur tout le calendrier) :
                    </Text>
                    <ChoixJoursSeance programme={seance} onBasculer={basculerJourProgramme} />
                    {seance.exercices.length === 0 ? (
                      <Text style={styles.indice}>Aucun exercice dans cette séance.</Text>
                    ) : seance.exercices.map((exo, i) => (
                      <LigneExercicePrevu key={i} exo={exo} entrainements={entrainements}
                        numero={i + 1} />
                    ))}
                  </View>
                )}
                {enEdition && (
                  <EditeurSeance
                    key={`edition-${seance.id}`}
                    programme={seance}
                    placeholderNom="Nom de la séance"
                    nomParDefaut={seance.nom}
                    libelleBouton="Enregistrer les modifications"
                    note={noteReutilisation(seance)}
                    onSauvegarder={(nom, exercices) => {
                      sauvegarderProgramme(seance, nom, exercices);
                      setProgrammeEnEdition(null);
                    }}
                  />
                )}
              </View>
            );
          })}
          {/* AJOUTER UNE SÉANCE à ce programme (24/09/2026). */}
          {cycleQuiRecoit === cycle.id ? (
            <View style={styles.blocNouvelleSeance}>
              <TexteIcone nom="plus" taille={13} couleur={colors.or} style={styles.titreNouvelleSeance}>Nouvelle séance de « {cycle.nom} »</TexteIcone>
              <Text style={styles.aideNouvelleSeance}>
                Choisis son ou ses jours, puis écris ses exercices.
              </Text>
              {messageAjoutSeance && (
                <Text style={styles.messageAjoutSeance}>{messageAjoutSeance}</Text>
              )}
              <ChoixJoursSeance
                programme={{ jours: joursNouvelleSeance }}
                onBasculer={(_, jour) => setJoursNouvelleSeance((actuels) => (
                  actuels.includes(jour)
                    ? actuels.filter((j) => j !== jour)
                    : [...actuels, jour]
                ))}
              />
              <EditeurSeance
                programme={null}
                placeholderNom="Nom de la séance (ex. Épaules)"
                libelleBouton="Ajouter cette séance"
                onSauvegarder={(nom, exercices) => ajouterSeanceAuCycle(cycle.id, nom, exercices)}
              />
              <TouchableOpacity onPress={() => { setCycleQuiRecoit(null); setJoursNouvelleSeance([]); setMessageAjoutSeance(null); }}>
                <Text style={styles.lienAnnuler}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.boutonAjouterSeance}
              onPress={() => { setCycleQuiRecoit(cycle.id); setJoursNouvelleSeance([]); setMessageAjoutSeance(null); }}
            >
              <LibelleIcone nom="plus" taille={13} ecart={5} style={styles.boutonAjouterSeanceTexte}>Ajouter une séance</LibelleIcone>
            </TouchableOpacity>
          )}
          {cycleEnService(cycle) && (
            <>
              <TouchableOpacity
                style={styles.boutonSortir}
                onPress={() => demanderSuppression('sortie-cycle-' + cycle.id)}
              >
                <LibelleIcone nom="sortie" taille={13} ecart={5} style={styles.boutonSortirTexte}>Sortir de ce programme</LibelleIcone>
              </TouchableOpacity>
              <ConfirmationSuppression
                actif={suppressionAConfirmer === 'sortie-cycle-' + cycle.id}
                question={`Sortir de « ${cycle.nom} » ? Il libère la semaine et ses dates du calendrier, mais reste ici : tu pourras le reposer quand tu veux.`}
                libelleConfirmer="Oui, sortir"
                couleur={colors.or}
                onConfirmer={() => { setSuppressionAConfirmer(null); sortirDuProgramme(cycle.seances); }}
                onAnnuler={() => setSuppressionAConfirmer(null)}
              />
            </>
          )}
        </View>
        );
      })}

      {/* Les séances isolées (créées depuis la semaine type, hors cycle). */}
      {programmesSeuls.map((programme) => {
        const enEdition = programmeEnEdition === programme.id;
        const deroulee = seanceDeroulee === programme.id;
        return (
          <View key={programme.id} style={styles.carteModele}>
            <TouchableOpacity
              style={{ paddingVertical: 3 }}
              onPress={() => setSeanceDeroulee(deroulee ? null : programme.id)}
            >
              <TexteIcone nom={deroulee ? 'chevron-haut' : 'chevron-bas'}
                taille={13} ecart={6} couleur={colors.texteGris} style={styles.nomProgrammeTexte}>
                {programme.nom}
              </TexteIcone>
              <Text style={styles.indice}>
                {programme.exercices.length} exercice{programme.exercices.length > 1 ? 's' : ''}
                {(programme.jours || []).length > 0 &&
                  ' · ' + programme.jours.map((j) => abreviationsJours[j]).join(' ')}
              </Text>
            </TouchableOpacity>
            <View style={styles.ligneActionsProgramme}>
              <TouchableOpacity
                style={styles.boutonModifier}
                onPress={() => setProgrammeEnEdition(enEdition ? null : programme.id)}
              >
                {enEdition ? (
                  <Text style={styles.boutonModifierTexte}>Fermer</Text>
                ) : (
                  <LibelleIcone nom="crayon" taille={13} ecart={5}
                    style={styles.boutonModifierTexte}>Modifier</LibelleIcone>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.boutonModifier}
                onPress={() => ouvrirTableau(programme.nom, [programme],
                  { type: 'programme', id: programme.id, ...programme })}
              >
                <LibelleIcone nom="tableau" taille={13} ecart={5} style={styles.boutonModifierTexte}>Tableau</LibelleIcone>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => demanderSuppression('prog-' + programme.id)}
                style={styles.boutonRetirer}
                hitSlop={ZONE_TACTILE}
              >
                <Icone nom="croix" taille={15} couleur={colors.rouge} />
              </TouchableOpacity>
            </View>
            <ConfirmationSuppression
              actif={suppressionAConfirmer === 'prog-' + programme.id}
              question={`Supprimer « ${programme.nom} » ?`}
              onConfirmer={() => { setSuppressionAConfirmer(null); supprimerProgramme(programme); }}
              onAnnuler={() => setSuppressionAConfirmer(null)}
            />
            {deroulee && !enEdition && (
              <View style={styles.detailJour}>
                <Text style={styles.libelleJoursSeance}>
                  Jours de la semaine (projetés sur tout le calendrier) :
                </Text>
                <ChoixJoursSeance programme={programme} onBasculer={basculerJourProgramme} />
                {programme.exercices.length === 0 ? (
                  <Text style={styles.indice}>Aucun exercice dans cette séance.</Text>
                ) : programme.exercices.map((exo, i) => (
                  <LigneExercicePrevu key={i} exo={exo} entrainements={entrainements}
                    numero={i + 1} />
                ))}
              </View>
            )}
            {enEdition && (
              <EditeurSeance
                key={`edition-${programme.id}`}
                programme={programme}
                placeholderNom="Nom de la séance"
                nomParDefaut={programme.nom}
                libelleBouton="Enregistrer les modifications"
                note={noteReutilisation(programme)}
                onSauvegarder={(nom, exercices) => {
                  sauvegarderProgramme(programme, nom, exercices);
                  setProgrammeEnEdition(null);
                }}
              />
            )}
            {cycleEnService({ seances: [programme] }) && (
              <>
                <TouchableOpacity
                  style={styles.boutonSortir}
                  onPress={() => demanderSuppression('sortie-prog-' + programme.id)}
                >
                  <LibelleIcone nom="sortie" taille={13} ecart={5} style={styles.boutonSortirTexte}>Sortir de ce programme</LibelleIcone>
                </TouchableOpacity>
                <ConfirmationSuppression
                  actif={suppressionAConfirmer === 'sortie-prog-' + programme.id}
                  question={`Sortir de « ${programme.nom} » ? Il libère ses jours et ses dates, mais reste ici : tu pourras le reposer quand tu veux.`}
                  libelleConfirmer="Oui, sortir"
                  couleur={colors.or}
                  onConfirmer={() => { setSuppressionAConfirmer(null); sortirDuProgramme([programme]); }}
                  onAnnuler={() => setSuppressionAConfirmer(null)}
                />
              </>
            )}
          </View>
        );
      })}
      {/* ---- Semaine type : écrire directement la séance de chaque jour.
           N'apparaît que TANT QU'AUCUN PROGRAMME N'EST EN SERVICE — après,
           c'est le programme qui pilote la semaine (voir programmeEnService). ---- */}
      {!programmeEnService && (
      <>
      <TexteIcone nom="calendrier" taille={15} couleur={colors.or} style={styles.sectionTitre}>Semaine type</TexteIcone>
      <Text style={styles.indice}>
        Touche un jour pour écrire sa séance : un nom, puis tes exercices avec
        leurs séries × reps. Elle se répète chaque semaine.
      </Text>
      {joursSemaine.map((jour) => {
        // La séance de ce jour = le programme qui porte ce jour. S'il y en a
        // plusieurs (ancien réglage), on édite le premier.
        const seanceDuJour = programmes.find((p) => (p.jours || []).includes(jour)) || null;
        const ouvert = jourSemaineOuvert === jour;
        return (
          <View key={jour}>
            <TouchableOpacity
              style={styles.ligneCalendrier}
              onPress={() => setJourSemaineOuvert(ouvert ? null : jour)}
            >
              <Text style={styles.jourCalendrier}>
                {jour.charAt(0).toUpperCase() + jour.slice(1)}
              </Text>
              <Text style={styles.contenuCalendrier}>
                {seanceDuJour
                  ? `${seanceDuJour.nom} · ${seanceDuJour.exercices.length} exo${seanceDuJour.exercices.length > 1 ? 's' : ''}`
                  : 'Repos — touche pour ajouter'}
              </Text>
              <Icone nom={ouvert ? 'chevron-haut' : 'chevron-bas'} taille={13} couleur={colors.texteGris} />
            </TouchableOpacity>
            {ouvert && (
              <EditeurSeance
                key={`jour-${jour}-${seanceDuJour ? seanceDuJour.id : 'vide'}`}
                programme={seanceDuJour}
                placeholderNom={`Ex. : Pecs / Biceps du ${jour}`}
                nomParDefaut={`Séance du ${jour}`}
                libelleBouton={`Enregistrer la séance du ${jour}`}
                onSauvegarder={(nom, exercices) =>
                  sauvegarderSeanceJour(jour, seanceDuJour, nom, exercices)}
                onVider={seanceDuJour ? () => viderJourSemaine(jour, seanceDuJour) : null}
                libelleVider="Vider ce jour (jour de repos)"
              />
            )}
          </View>
        );
      })}

      </>
      )}
      {/* ---- Modèles standards : Push Pull Legs, Full Body… ---- */}
      <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setModelesOuverts(!modelesOuverts)}>
        <View style={styles.enTeteRepliable}>
          <LibelleIcone nom="bibliotheque" taille={14} ecart={6}
            style={[styles.boutonSecondaireTexte, { flex: 1 }]}>
            Programmes standards
          </LibelleIcone>
          <Icone nom={modelesOuverts ? 'chevron-haut' : 'chevron-bas'} taille={15}
            couleur={colors.or} />
        </View>
      </TouchableOpacity>
      {modelesOuverts && programmesStandards.map((modele) => (
        <View key={modele.id} style={styles.carteModele}>
          <TexteIcone nom="bibliotheque" taille={14} couleur={colors.or} style={styles.nomProgrammeTexte}>{modele.nom}</TexteIcone>
          <Text style={[styles.indice, { marginTop: 4 }]}>{modele.description}</Text>
          <Text style={[styles.indice, { marginTop: 4 }]}>
            {modele.seances.map((s) =>
              `${s.nom} : ${s.jours.map((j) => abreviationsJours[j]).join(', ')}`
            ).join(' · ')}
          </Text>
          <TouchableOpacity
            style={styles.boutonUtiliserModele}
            onPress={() => appliquerModele(modele)}
            disabled={modeleEnCours !== null}
          >
            {modeleEnCours === modele.id ? (
              <ActivityIndicator color={da.orSombre} size="small" />
            ) : (
              <Text style={styles.boutonDemarrerTexte}>Utiliser ce modèle</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}
      {/* ---- Récupérer un programme AVEC UN CODE ----
           Les programmes partagés ne sont PAS publics (02/09/2026, demande de
           Hafiz) : sans le code, on ne peut même pas savoir qu'ils existent.
           Même geste que rejoindre un duel ou valider la perf d'un partenaire. */}
      <TexteIcone nom="cle" taille={15} couleur={colors.or} style={styles.sectionTitre}>Programme partagé</TexteIcone>
      <View style={styles.carteModele}>
        <Text style={styles.indice}>
          Quelqu'un t'a donné un code ? Entre-le pour voir son programme et en
          garder ta propre copie.
        </Text>
        <View style={[styles.ligneAjoutSerie, { marginTop: espacement.s }]}>
          <TextInput
            style={[styles.champ, { flex: 1 }]}
            value={codeSaisi}
            onChangeText={(t) => setCodeSaisi(t.toUpperCase())}
            placeholder="Ex. : K7XPQR"
            placeholderTextColor={colors.texteGris}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.boutonAjouterSerie}
            onPress={chercherParCode}
            disabled={rechercheCode || !codeSaisi.trim()}
          >
            {rechercheCode ? <ActivityIndicator color={da.orSombre} size="small" /> : (
              <Text style={styles.boutonAjouterSerieTexte}>Voir</Text>
            )}
          </TouchableOpacity>
        </View>
        {erreurCode ? <TexteIcone nom="alerte" taille={13} hautAligne style={styles.messageErreur}>{erreurCode}</TexteIcone> : null}

        {/* On montre le contenu AVANT de copier : personne ne récupère un
            programme sans savoir ce qu'il contient. */}
        {programmeTrouve && (
          <View style={[styles.detailJour, { borderColor: colors.or, borderWidth: 1 }]}>
            <TexteIcone nom="etoile" taille={14} couleur={colors.or} style={styles.nomProgrammeTexte}>{programmeTrouve.nom}</TexteIcone>
            <Text style={[styles.indice, { marginTop: 4 }]}>{programmeTrouve.description}</Text>
            {(programmeTrouve.seances || []).map((seance, i) => (
              <Text key={i} style={styles.exerciceDetailJour}>
                • {seance.nom} — {(seance.jours || []).map((j) => abreviationsJours[j]).join(' ') || 'sans jour fixe'}
                {' · '}{(seance.exercices || []).length} exo
                {(seance.exercices || []).length > 1 ? 's' : ''}
              </Text>
            ))}
            <TouchableOpacity
              style={styles.boutonUtiliserModele}
              onPress={() => {
                appliquerModele(enModele(programmeTrouve));
                setProgrammeTrouve(null);
                setCodeSaisi('');
              }}
              disabled={modeleEnCours !== null}
            >
              <LibelleIcone nom="telecharger" taille={14} style={styles.boutonDemarrerTexte}>Copier ce programme</LibelleIcone>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {/* ---- ADMIN : les programmes que J'AI partagés, avec leurs codes ---- */}
      {/* ⚠️ `? … : null` ET PAS `&& …` : `admin` arrive du serveur en ENTIER
          (0 ou 1), pas en booléen. `{0 && …}` affiche le NOMBRE 0 — invisible
          pour un compte admin, donc jamais vu en test. Voir CLAUDE.md,
          section du 01/10/2026. */}
      {moi.admin ? (
        <>
          <TexteIcone nom="bouclier" taille={15} couleur={colors.rouge} style={styles.sectionTitre}>Mes programmes partagés</TexteIcone>
          {messageOfficiel && (
            <Text style={[styles.indice, messageOfficiel.erreur && { color: colors.rouge }]}>
              {messageOfficiel.texte}
            </Text>
          )}
          {programmesOfficiels.length === 0 ? (
            <Text style={styles.indice}>
              Aucun pour l'instant. Utilise « Partager par code » sur un de tes
              programmes ci-dessus.
            </Text>
          ) : programmesOfficiels.map((o) => (
            <View key={o.id} style={[styles.carteModele, styles.carteOfficielle]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TexteIcone nom="etoile" taille={14} couleur={colors.or} style={[styles.nomProgrammeTexte, { flex: 1 }]}>{o.nom}</TexteIcone>
                <TouchableOpacity onPress={() => retirerOfficiel(o)} style={styles.boutonRetirer}>
                  <Icone nom="croix" taille={15} couleur={colors.rouge} />
                </TouchableOpacity>
              </View>
              <Text style={styles.codePartage}>{o.code}</Text>
              <Text style={styles.indice}>
                Donne ce code aux personnes à qui tu veux offrir le programme.
                Il fonctionne autant de fois que tu veux, jusqu'à ce que tu le retires.
              </Text>
            </View>
          ))}
        </>
      ) : null}
      {erreur ? <TexteIcone nom="alerte" taille={13} hautAligne style={styles.messageErreur}>{erreur}</TexteIcone> : null}
    </ScrollView>
  );
}
