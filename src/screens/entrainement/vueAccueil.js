// La vue « accueil » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Icone, LibelleIcone, TexteIcone } from '../../components/Icones';
import { LigneExercicePrevu, ResumeSeanceFaite } from './composantsSeance';
import { LigneRaccourci, stylesHub } from './sousEcran';
import { abreviationsJours, jourDeLaDate, joursSemaine } from '../../data/programmesStandards';
import { aujourdhui, grilleDuMois, libelleDate, nomsMois, typeDeSeance } from './outils';
import { colors, espacement } from '../../theme';
import { da } from '../../designSystem';
import { enISO } from '../../logic/rattrapage';
import { styles } from './styles';

// ================= ACCUEIL =================
export function vueAccueil(ctx) {
  const {
    appliquerRenommages, bandeauEtat, changerMois, choixProgrammeOuvert,
    choixSeanceAFaire, cycles, cyclesPlacables, dateDuJour, datesManquees,
    demarrerSeance, entrainements, erreur, jourOuvert, manqueesVisibles,
    masquerRattrapages, mesRecords, modeleAPlacer, moisAffiche,
    nbNonClasses, placeAccueil, placerAuPlanning, placerModeleAuPlanning,
    prevuAfficheLe, programmes, programmesPlanifiesLe, programmesSeuls,
    renommageEnCours, renommages, retirerDuPlanning, seancesDeLaSemaine,
    seancesDuJour, seancesFaitesAujourdhui, semainesModele,
    setChoixProgrammeOuvert, setChoixSeanceAFaire,
    setEntrainementSelectionne, setJourOuvert, setModeleAPlacer,
    setPrevuAfficheLe, setRenommages, setSemainesModele, setVolumeOuvert,
    setVue, totalSeriesSemaine,
  } = ctx;

  return (
    <ScrollView
      // La `key` est indispensable pour garder sa place (voir usePlaceDefilement).
      key="accueil"
      {...placeAccueil}
      style={styles.conteneur}
      contentContainerStyle={{ padding: espacement.m }}
    >
      <TexteIcone nom="entrainement" taille={20} couleur={colors.or} style={styles.titre}>Entraînement</TexteIcone>
      {bandeauEtat}

      {/* ---- LES DEUX ENTRÉES, TOUT EN HAUT (26/10/2026) ----
          « Démarrer une séance libre » était enterré à la 10e section de la
          page : l'action la plus immédiate de l'onglet demandait de faire
          défiler trois écrans. Elle est désormais le premier bouton, à côté
          de l'accès aux programmes. */}
      <View style={stylesHub.ligneActionsPrincipales}>
        <TouchableOpacity
          style={[stylesHub.grandeAction, stylesHub.grandeActionOr]}
          onPress={() => demarrerSeance(null)}
        >
          <View style={[stylesHub.pastilleAction, stylesHub.pastilleActionOr]}>
            <Icone nom="lecture" taille={17} couleur={da.orSombre} />
          </View>
          <Text style={stylesHub.titreActionOr}>SÉANCE LIBRE</Text>
          <Text style={stylesHub.sousTitreActionOr}>Démarre tout de suite, sans plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesHub.grandeAction, stylesHub.grandeActionBordee]}
          onPress={() => setVue('programmes')}
        >
          <View style={[stylesHub.pastilleAction, stylesHub.pastilleActionBordee]}>
            <Icone nom="programme" taille={18} couleur={colors.or} />
          </View>
          <Text style={stylesHub.titreAction}>PROGRAMMES</Text>
          <Text style={stylesHub.sousTitreAction}>
            {cycles.length + programmesSeuls.length === 0
              ? 'Créer mon premier programme'
              : `${cycles.length + programmesSeuls.length} enregistré${cycles.length + programmesSeuls.length > 1 ? 's' : ''} · créer, modifier`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ---- CE QU'IL Y A À FAIRE AUJOURD'HUI ---- */}
      <View style={stylesHub.bandeauSection}>
        <Text style={stylesHub.libelleSection}>AUJOURD'HUI</Text>
        <Text style={stylesHub.libelleSection}>{libelleDate(dateDuJour).toUpperCase()}</Text>
      </View>

      {seancesFaitesAujourdhui.length > 0 && (
        <View style={[stylesHub.carteJour, stylesHub.carteJourFaite]}>
          <TexteIcone nom="valide" taille={17} couleur={colors.vert} style={stylesHub.nomSeanceJour}>
            {seancesFaitesAujourdhui.map((e) => typeDeSeance(e, programmes)).join(' · ')}
          </TexteIcone>
          <Text style={stylesHub.metaSeanceJour}>
            {seancesFaitesAujourdhui.length > 1
              ? `${seancesFaitesAujourdhui.length} séances enregistrées aujourd'hui`
              : 'Séance enregistrée aujourd\'hui'}
            {' · '}
            {(() => {
              const n = seancesFaitesAujourdhui.reduce((t, e) => t + (e.series || []).length, 0);
              return `${n} série${n > 1 ? 's' : ''}`;
            })()}
          </Text>
          <View style={stylesHub.ligneLiensJour}>
            <TouchableOpacity
              style={stylesHub.lienJour}
              onPress={() => {
                setEntrainementSelectionne(seancesFaitesAujourdhui[0]);
                setVue('historiqueDetail');
              }}
            >
              <Text style={stylesHub.texteLienJour}>Voir le détail</Text>
            </TouchableOpacity>
            {/* Une 2e séance dans la journée reste possible : on ouvre le jour
                dans le calendrier, qui porte déjà tout ce qu'il faut (le prévu,
                « Démarrer », « Faire une autre séance ce jour »). */}
            <TouchableOpacity
              style={stylesHub.lienJour}
              onPress={() => { setJourOuvert(dateDuJour); setPrevuAfficheLe(dateDuJour); }}
            >
              <Text style={stylesHub.texteLienJour}>Faire une autre séance</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {seancesFaitesAujourdhui.length === 0 && seancesDuJour.length === 0 && (
        <View style={stylesHub.carteJourVide}>
          <Text style={stylesHub.texteJourVide}>
            Rien de prévu aujourd'hui. Lance une séance libre ci-dessus, ou
            touche un jour du calendrier pour y poser un programme.
          </Text>
        </View>
      )}

      {/* Une carte par séance prévue : le nom, ses exercices en une phrase, et
          un GROS bouton « Démarrer ». Elles disparaissent une fois la journée
          bouclée (même règle que le ✅ du calendrier). */}
      {seancesFaitesAujourdhui.length === 0 && seancesDuJour.map((p) => (
        <View key={p.id} style={stylesHub.carteJour}>
          <Text style={stylesHub.nomSeanceJour}>{p.nom}</Text>
          <Text style={stylesHub.metaSeanceJour}>
            {p.exercices.length} exercice{p.exercices.length > 1 ? 's' : ''} prévu
            {p.exercices.length > 1 ? 's' : ''}
          </Text>
          {p.exercices.length > 0 && (
            <Text style={stylesHub.exercicesSeanceJour} numberOfLines={3}>
              {p.exercices.map((e) => e.exercice).join(', ')}
            </Text>
          )}
          <TouchableOpacity
            style={stylesHub.boutonDemarrerJour}
            onPress={() => demarrerSeance(p)}
          >
            <LibelleIcone nom="lecture" taille={14} style={stylesHub.texteDemarrerJour}>DÉMARRER</LibelleIcone>
          </TouchableOpacity>
        </View>
      ))}

      {/* ---- Les séances manquées de la semaine, et leur rattrapage ---- */}
      {manqueesVisibles.length > 0 && (
        <View style={styles.carteRattrapage}>
          <View style={styles.enteteRattrapage}>
            <TexteIcone nom="horloge" taille={16} style={styles.titreRattrapage}>
              À rattraper cette semaine ({manqueesVisibles.length})
            </TexteIcone>
            {/* « Masquer » (08/11/2026, « c'est encombrant ») : cache ces
                séances-là ; une NOUVELLE séance manquée fera revenir la
                section. Les jours restent marqués « ! » au calendrier. */}
            <TouchableOpacity
              style={styles.boutonMasquerRattrapage}
              onPress={masquerRattrapages}
              accessibilityLabel="Masquer les séances à rattraper"
            >
              <LibelleIcone nom="croix" taille={13} ecart={5} style={styles.texteMasquerRattrapage}>
                Masquer
              </LibelleIcone>
            </TouchableOpacity>
          </View>
          <Text style={styles.indice}>
            Ces séances étaient prévues et n'ont pas été faites. La rattraper
            l'enregistre à la date d'AUJOURD'HUI — on ne réécrit pas le
            calendrier, on comble le trou.
          </Text>
          {manqueesVisibles.map(({ date, programme }) => (
            <View key={`${date}-${programme.id}`} style={styles.detailJour}>
              <Text style={styles.nomProgrammeTexte}>{programme.nom}</Text>
              <Text style={styles.indice}>prévue {libelleDate(date)}</Text>
              <TouchableOpacity
                style={styles.boutonUtiliserModele}
                onPress={() => demarrerSeance(programme, date)}
              >
                <LibelleIcone nom="lecture" taille={13} style={styles.boutonDemarrerTexte}>Rattraper maintenant</LibelleIcone>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      {/* Proposition de propager un renommage d'exercice (04/09/2026). */}
      {renommages.length > 0 && (
        <View style={styles.carteRenommage}>
          <TexteIcone nom="crayon" taille={15} style={styles.titreRenommage}>Exercice renommé</TexteIcone>
          {renommages.map((r) => (
            <Text key={r.ancien} style={styles.ligneRenommage}>
              « {r.ancien} » → « {r.nouveau} »
            </Text>
          ))}
          <Text style={styles.indice}>
            Le renommer partout met à jour tes autres programmes, ton historique
            de séries, tes records et le comptage par groupe musculaire.
            Si tu as en fait REMPLACÉ l'exercice par un autre mouvement, garde
            le changement ici seulement — ton historique restera séparé.
          </Text>
          <View style={styles.ligneActionsProgramme}>
            <TouchableOpacity
              style={styles.boutonUtiliserModele}
              onPress={appliquerRenommages}
              disabled={renommageEnCours}
            >
              {renommageEnCours ? <ActivityIndicator color={da.orSombre} size="small" /> : (
                <Text style={styles.boutonDemarrerTexte}>Renommer partout</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonModifier} onPress={() => setRenommages([])}>
              <Text style={styles.boutonModifierTexte}>Seulement ici</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* ---- Calendrier mensuel interactif : touche une DATE pour voir son
           programme, en ajouter un, ou démarrer la séance du jour. ---- */}
      {/* LA LÉGENDE PASSE SOUS LE TITRE (08/11/2026, retour de Hafiz : « dans
          le calendrier on ne voit pas bien les parties prévu, fait et
          autres »). Collée au titre sur la même ligne, elle débordait de
          l'écran sur téléphone (« ! MANQU… » coupé), en petites capitales
          grises, avec des signes minuscules. Elle a maintenant sa propre
          ligne, et chaque entrée montre EXACTEMENT la marque de la case. */}
      <View style={stylesHub.bandeauSection}>
        <Text style={stylesHub.libelleSection}>CALENDRIER</Text>
      </View>
      <View style={stylesHub.legendeCalendrier}>
        <View style={stylesHub.entreeLegende}>
          <View style={[stylesHub.echantillonCase, stylesHub.echantillonPrevu]}>
            <View style={styles.pointPrevu} />
          </View>
          <Text style={stylesHub.texteLegende}>Prévu</Text>
        </View>
        <View style={stylesHub.entreeLegende}>
          <View style={[stylesHub.echantillonCase, styles.caseFaite]}>
            <Icone nom="valide" taille={11} couleur={colors.vert} />
          </View>
          <Text style={stylesHub.texteLegende}>Fait</Text>
        </View>
        <View style={stylesHub.entreeLegende}>
          <View style={[stylesHub.echantillonCase, styles.caseManquee]}>
            <Text style={styles.texteManque}>!</Text>
          </View>
          <Text style={stylesHub.texteLegende}>Manqué</Text>
        </View>
        <View style={stylesHub.entreeLegende}>
          <View style={[stylesHub.echantillonCase, styles.caseAujourdhui]} />
          <Text style={stylesHub.texteLegende}>Aujourd'hui</Text>
        </View>
      </View>
      {/* Largeur limitée : sans ça, les cases (1/7 de l'écran chacune)
          deviennent énormes sur un grand écran (retour de Hafiz). */}
      <View style={styles.blocCalendrier}>
      <View style={styles.enTeteMois}>
        <TouchableOpacity onPress={() => changerMois(-1)} style={styles.boutonMois}>
          <Icone nom="chevron-gauche" taille={17} couleur={colors.texte} />
        </TouchableOpacity>
        <Text style={styles.titreMois}>
          {nomsMois[moisAffiche.mois]} {moisAffiche.annee}
        </Text>
        <TouchableOpacity onPress={() => changerMois(1)} style={styles.boutonMois}>
          <Icone nom="chevron-droit" taille={17} couleur={colors.texte} />
        </TouchableOpacity>
      </View>
      <View style={styles.ligneSemaine}>
        {joursSemaine.map((j) => (
          <Text key={j} style={styles.enTeteCaseJour}>{abreviationsJours[j]}</Text>
        ))}
      </View>
      {grilleDuMois(moisAffiche.annee, moisAffiche.mois).map((semaine, i) => (
        <View key={i} style={styles.ligneSemaine}>
          {semaine.map((dateJs, k) => {
            if (!dateJs) return <View key={k} style={styles.caseJourVide} />;
            const dateISO = enISO(dateJs);
            const { recurrents, precis } = programmesPlanifiesLe(dateISO);
            const prevu = recurrents.length + precis.length > 0;
            const fait = entrainements.some((e) => e.date === dateISO);
            const manquee = datesManquees.has(dateISO);
            const estAujourdhui = dateISO === aujourdhui();
            const selectionne = jourOuvert === dateISO;
            return (
              <TouchableOpacity
                key={k}
                style={[
                  styles.caseJour,
                  // L'ÉTAT SE VOIT SUR TOUTE LA CASE (08/11/2026), plus
                  // seulement par un signe de 11 px : fond vert pour un jour
                  // fait, contour rouge pour un jour manqué. Aujourd'hui (or)
                  // et la sélection (bleu) passent par-dessus.
                  fait && styles.caseFaite,
                  !fait && manquee && styles.caseManquee,
                  estAujourdhui && styles.caseAujourdhui,
                  selectionne && styles.caseSelectionnee,
                ]}
                onPress={() => {
                  setJourOuvert(selectionne ? null : dateISO);
                  setChoixProgrammeOuvert(false);
                  setChoixSeanceAFaire(false);
                }}
              >
                <Text style={[styles.numeroJour, estAujourdhui && { color: colors.or, fontWeight: '800' }]}>
                  {dateJs.getDate()}
                </Text>
                {/* Le ✅ était un EMOJI : trop large pour sa case, il avait
                    déjà dû être rattrapé par un minHeight (03/09/2026), et il
                    gardait sa couleur verte quoi qu'on demande. Dessiné, il
                    tient dans 11 px et prend la couleur « fait » du thème. */}
                <View style={styles.marqueurJour}>
                  {fait ? <Icone nom="valide" taille={13} couleur={colors.vert} />
                    : manquee ? <Text style={styles.texteManque}>!</Text>
                      : prevu ? <View style={styles.pointPrevu} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      </View>

      {/* Détail de la date sélectionnée dans le calendrier. */}
      {jourOuvert && (() => {
        const { recurrents, precis } = programmesPlanifiesLe(jourOuvert);
        const dateJs = new Date(`${jourOuvert}T12:00:00`);
        const cestAujourdhui = jourOuvert === aujourdhui();
        const blocs = [
          ...recurrents.map(({ programme, plan }) => ({
            cle: `r-${programme.id}`, programme, planif: null,
            etiquette: plan.semaine
              ? `chaque ${jourDeLaDate(dateJs)} · sem. ${plan.semaine}/${programme.duree_semaines}`
              : `chaque ${jourDeLaDate(dateJs)}`,
          })),
          ...precis.map(({ planif, programme }) => ({
            cle: `p-${planif.id}`, programme, planif, etiquette: 'ce jour uniquement',
          })),
        ];
        // JOUR BOUCLÉ = au moins une séance enregistrée ce jour-là. C'est
        // EXACTEMENT la règle du ✅ de la case du calendrier et du rattrapage
        // (src/logic/rattrapage.js) : si le calendrier dit « fait », le détail
        // ne doit pas réclamer la séance en affichant attendu et « Démarrer ».
        const seancesFaites = entrainements.filter((e) => e && e.date === jourOuvert);
        const jourBoucle = seancesFaites.length > 0;
        const montrerPrevu = !jourBoucle || prevuAfficheLe === jourOuvert;
        return (
          <View style={styles.carteModele}>
            <TexteIcone nom="calendrier" taille={15} couleur={colors.or} style={styles.nomProgrammeTexte}>
              {jourDeLaDate(dateJs).charAt(0).toUpperCase() + jourDeLaDate(dateJs).slice(1)}{' '}
              {dateJs.getDate()} {nomsMois[dateJs.getMonth()]}
            </TexteIcone>
            {/* JOUR LIBRE : on doit pouvoir CHOISIR une séance et la FAIRE,
                pas seulement en planifier une pour plus tard (demande de Hafiz
                du 08/09/2026 : « en cliquant sur un jour on doit pouvoir
                choisir un workout du programme et le faire ce jour si on n'est
                pas dans un programme déjà fixé »).
                Jusqu'ici, toucher un jour vide ne proposait QUE « ➕ Placer un
                programme ce jour » — donc pour s'entraîner il fallait d'abord
                planifier, ressortir, retoucher le jour, puis démarrer. Trois
                gestes pour dire « aujourd'hui je fais ça ».
                Ce choix n'apparaît QUE si le jour n'a rien de prévu : quand une
                séance est déjà fixée, elle porte déjà son propre bouton
                « Démarrer » juste au-dessus. */}
            {seancesFaites.map((e, i) => (
              <ResumeSeanceFaite key={e.id ?? `faite-${i}`} entrainement={e} programmes={programmes} />
            ))}
            {/* Le prévu reste accessible, derrière un lien : on peut vouloir
                faire une 2e séance le même jour. Mais il ne s'affiche plus de
                lui-même sur une journée bouclée. */}
            {jourBoucle && !montrerPrevu && (
              <TouchableOpacity onPress={() => setPrevuAfficheLe(jourOuvert)}>
                <Text style={styles.lienAnnuler}>
                  {blocs.length > 0 ? 'Voir ce qui était prévu' : 'Faire une autre séance ce jour'}
                </Text>
              </TouchableOpacity>
            )}
            {montrerPrevu && blocs.length === 0 && (
              <>
                {!jourBoucle && (
                  <Text style={[styles.indice, { marginTop: 4 }]}>Rien de prévu ce jour-là.</Text>
                )}
                {!choixSeanceAFaire ? (
                  <TouchableOpacity
                    style={styles.boutonUtiliserModele}
                    onPress={() => { setChoixSeanceAFaire(true); setChoixProgrammeOuvert(false); }}
                  >
                    <LibelleIcone nom="lecture" taille={13} style={styles.boutonDemarrerTexte}>
                      Faire une séance de mes programmes
                    </LibelleIcone>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.detailJour}>
                    {programmes.length === 0 ? (
                      <Text style={styles.indice}>
                        Tu n'as encore aucune séance enregistrée — crée un programme,
                        ou lance une séance libre depuis le haut de l'onglet.
                      </Text>
                    ) : (
                      <>
                        <Text style={[styles.indice, { marginBottom: 4 }]}>
                          {cestAujourdhui
                            ? 'Choisis la séance à faire :'
                            : 'Choisis la séance — elle sera enregistrée au jour où tu la fais, pas à cette date :'}
                        </Text>
                        {programmes.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={styles.ligneChoixProgramme}
                            onPress={() => demarrerSeance(p)}
                          >
                            <TexteIcone nom="lecture" taille={11} ecart={6}
                              couleur={colors.or} style={styles.choixProgrammeTexte}>
                              {p.nom}{' '}
                              <Text style={styles.indice}>
                                ({p.exercices.length} exo{p.exercices.length > 1 ? 's' : ''})
                              </Text>
                            </TexteIcone>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    <TouchableOpacity onPress={() => setChoixSeanceAFaire(false)}>
                      <Text style={styles.lienAnnuler}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
            {/* Le calendrier ne fait plus QUE montrer et DÉMARRER (27/08/2026,
                demande de Hafiz). Modifier une séance se fait désormais dans
                « Mes programmes » — une seule place pour éditer, au lieu de
                deux éditeurs identiques qui se marchaient dessus. */}
            {montrerPrevu && blocs.map(({ cle, programme, planif, etiquette }) => (
              <View key={cle} style={styles.detailJour}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.nomProgrammeTexte, { flex: 1 }]}>
                    {programme.nom} <Text style={styles.indice}>({etiquette})</Text>
                  </Text>
                  {planif && (
                    <TouchableOpacity onPress={() => retirerDuPlanning(planif)} style={styles.boutonRetirer}>
                      <Icone nom="croix" taille={15} couleur={colors.rouge} />
                    </TouchableOpacity>
                  )}
                </View>
                {programme.exercices.map((exo, i) => (
                  <LigneExercicePrevu key={i} exo={exo} entrainements={entrainements}
                    numero={i + 1} />
                ))}
                {/* Le bouton n'apparaissait QUE sur la date du jour, donc
                    toucher n'importe quel autre jour ne proposait rien
                    (28/08/2026, retour de Hafiz : « si on clique sur un jour
                    c'est l'option démarrer la séance qui doit s'afficher »).
                    On peut désormais démarrer depuis n'importe quelle date —
                    la séance est simplement enregistrée au jour où on la fait. */}
                <TouchableOpacity
                  style={styles.boutonUtiliserModele}
                  onPress={() => demarrerSeance(programme)}
                >
                  <LibelleIcone nom="lecture" taille={13} style={styles.boutonDemarrerTexte}>
                    Démarrer cette séance{cestAujourdhui ? '' : ' maintenant'}
                  </LibelleIcone>
                </TouchableOpacity>
              </View>
            ))}
            {!choixProgrammeOuvert ? (
              <TouchableOpacity
                style={styles.boutonSecondaire}
                onPress={() => {
                  setChoixProgrammeOuvert(true);
                  setModeleAPlacer(null);
                  setChoixSeanceAFaire(false);
                }}
              >
                <LibelleIcone nom="plus" taille={13} style={styles.boutonSecondaireTexte}>Placer un programme ce jour</LibelleIcone>
              </TouchableOpacity>
            ) : modeleAPlacer ? (
              // Un cycle a été choisi : demander sur combien de semaines l'étaler.
              <View style={styles.detailJour}>
                <TexteIcone nom={modeleAPlacer.icone} taille={14} couleur={colors.or} style={styles.nomProgrammeTexte}>{modeleAPlacer.nom}</TexteIcone>
                <Text style={[styles.indice, { marginTop: 4 }]}>
                  Le cycle démarre le jour choisi : toutes ses séances se placent
                  automatiquement sur les jours concernés, semaine après semaine.
                </Text>
                <View style={[styles.ligneAjoutSerie, { marginTop: espacement.s }]}>
                  <Text style={styles.choixProgrammeTexte}>Nombre de semaines :</Text>
                  <TextInput
                    style={[styles.champ, { width: 60, textAlign: 'center' }]}
                    value={semainesModele}
                    onChangeText={setSemainesModele}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={styles.boutonUtiliserModele}
                  onPress={() => {
                    const n = Math.min(52, Math.max(1, parseInt(semainesModele, 10) || 4));
                    placerModeleAuPlanning(jourOuvert, modeleAPlacer, n);
                  }}
                >
                  <LibelleIcone nom="valide" taille={14} style={styles.boutonDemarrerTexte}>Placer le cycle</LibelleIcone>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModeleAPlacer(null)}>
                  <Text style={styles.lienAnnuler}>← Retour</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.detailJour}>
                <Text style={[styles.indice, { marginBottom: 4 }]}>Un seul jour :</Text>
                {programmes.length === 0 && (
                  <Text style={styles.indice}>Crée d'abord un programme.</Text>
                )}
                {programmes.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.ligneChoixProgramme}
                    onPress={() => placerAuPlanning(jourOuvert, p)}
                  >
                    <Text style={styles.choixProgrammeTexte}>○ {p.nom}</Text>
                  </TouchableOpacity>
                ))}
                <Text style={[styles.indice, { marginTop: espacement.s, marginBottom: 4 }]}>
                  Programme complet (remplit tous ses jours automatiquement) :
                </Text>
                {cyclesPlacables.map((modele) => (
                  <TouchableOpacity
                    key={modele.id}
                    style={styles.ligneChoixProgramme}
                    onPress={() => setModeleAPlacer(modele)}
                  >
                    <TexteIcone nom={modele.icone} taille={13} couleur={colors.or} style={styles.choixProgrammeTexte}>{modele.nom}</TexteIcone>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setChoixProgrammeOuvert(false)}>
                  <Text style={styles.lienAnnuler}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })()}

      {/* ---- Les trois sous-écrans, derrière une ligne chacun ----
          Le résumé chiffré reste visible ici, pour ne pas avoir à ouvrir pour
          savoir. Le titre « LE RESTE » qui les coiffait a été retiré le
          08/11/2026 (Hafiz : « ça ne fait pas pro ») ; un simple espace les
          détache du calendrier. */}
      <View style={stylesHub.espaceRaccourcis} />
      <LigneRaccourci
        icone="cible"
        titre="Suivi & objectifs"
        alerte={nbNonClasses > 0}
        resume={`${totalSeriesSemaine} série${totalSeriesSemaine > 1 ? 's' : ''} cette semaine · ${seancesDeLaSemaine} séance${seancesDeLaSemaine > 1 ? 's' : ''}${nbNonClasses > 0 ? ` · ${nbNonClasses} exo compté${nbNonClasses > 1 ? 's' : ''} nulle part` : ''}`}
        // On ouvre la section en arrivant : sur un écran qui ne contient
        // qu'elle, la trouver repliée n'aurait aucun sens.
        onPress={() => { setVolumeOuvert(true); setVue('suivi'); }}
      />
      <LigneRaccourci
        icone="couverts"
        titre="Nutrition"
        resume="Journal du jour · estimer un repas en photo"
        onPress={() => setVue('nutrition')}
      />
      <LigneRaccourci
        icone="perfs"
        titre="Progrès"
        resume={entrainements.length > 0
          ? `Stats, courbes · ${entrainements.length} séance${entrainements.length > 1 ? 's' : ''}${mesRecords.length > 0 ? ` · ${mesRecords.length} record${mesRecords.length > 1 ? 's' : ''}` : ''}`
          : 'Aucune séance enregistrée pour l\'instant'}
        onPress={() => setVue('historique')}
      />

      {erreur ? <TexteIcone nom="alerte" taille={13} hautAligne style={styles.messageErreur}>{erreur}</TexteIcone> : null}
    </ScrollView>

  );
}
