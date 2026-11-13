// La vue « nouveauProgramme » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import ChoixExercice from '../../components/ChoixExercice';
import { Icone, LibelleIcone, TexteIcone } from '../../components/Icones';
import LigneExerciceEditable from '../../components/LigneExerciceEditable';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { abreviationsJours, joursSemaine } from '../../data/programmesStandards';
import { colors, espacement } from '../../theme';
import { ligneVide } from '../../logic/lignesProgramme';
import { placerExerciceChoisi } from '../../logic/choixExercice';
import { styles } from './styles';

// ---- Vue : nouveau programme ----
export function vueNouveauProgramme(ctx) {
  const {
    ajouterLigneJour, basculerJour, biblioJour, deplacerLigneJour,
    enregistrerProgramme, erreur, jourEnEdition, joursChoisis,
    majSeanceJour, modifierLigneJour, nomProgramme,
    reinitialiserFormulaireProgramme, retirerLigneJour, seancesParJour,
    setBiblioJour, setJourEnEdition, setNomProgramme, setVue,
  } = ctx;


  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
      <TexteIcone nom="plus" taille={19} couleur={colors.or} style={styles.titre}>Nouveau programme</TexteIcone>
      <Text style={styles.sousTitre}>
        Un programme complet : ses jours de la semaine, et pour chaque jour
        ses exercices. Il suffira ensuite de le poser dans le calendrier —
        tous ses jours se rempliront automatiquement.
      </Text>

      <Text style={styles.libelle}>1. Nom du programme</Text>
      <TextInput
        style={styles.champ}
        value={nomProgramme}
        onChangeText={setNomProgramme}
        placeholder="Ex. : Mon PPL"
        placeholderTextColor={colors.texteGris}
      />

      <Text style={[styles.libelle, { marginTop: espacement.m }]}>
        2. Jours d'entraînement
      </Text>
      <View style={styles.lignePuces}>
        {joursSemaine.map((jour) => (
          <TouchableOpacity
            key={jour}
            style={[styles.puceJour, joursChoisis.includes(jour) && styles.puceJourActive]}
            onPress={() => basculerJour(jour)}
          >
            <Text style={[styles.puceJourTexte, joursChoisis.includes(jour) && styles.puceJourTexteActif]}>
              {abreviationsJours[jour]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {joursChoisis.length > 0 && (
        <>
          <Text style={[styles.libelle, { marginTop: espacement.m }]}>
            3. La séance de chaque jour
          </Text>
          {joursSemaine.filter((j) => joursChoisis.includes(j)).map((jour) => {
            const brouillon = seancesParJour[jour] || { nom: '', lignes: [] };
            const ouvert = jourEnEdition === jour;
            const nbExos = brouillon.lignes.filter((l) => l.exercice.trim()).length;
            return (
              <View key={jour}>
                <TouchableOpacity
                  style={styles.ligneCalendrier}
                  onPress={() => setJourEnEdition(ouvert ? null : jour)}
                >
                  <Text style={styles.jourCalendrier}>
                    {jour.charAt(0).toUpperCase() + jour.slice(1)}
                  </Text>
                  {nbExos === 0 ? (
                    <TexteIcone nom="alerte" taille={12} ecart={5}
                      style={[styles.contenuCalendrier, { color: colors.rouge }]}>
                      à remplir
                    </TexteIcone>
                  ) : (
                    <Text style={styles.contenuCalendrier}>
                      {`${brouillon.nom.trim() || 'Sans nom'} · ${nbExos} exo${nbExos > 1 ? 's' : ''}`}
                    </Text>
                  )}
                  <Icone nom={ouvert ? 'chevron-haut' : 'chevron-bas'} taille={13} couleur={colors.texteGris} />
                </TouchableOpacity>

                {ouvert && (
                  <View style={styles.detailJour}>
                    <TextInput
                      style={styles.champ}
                      value={brouillon.nom}
                      onChangeText={(v) => majSeanceJour(jour, { nom: v })}
                      placeholder={`Nom de la séance du ${jour} (ex. : Push)`}
                      placeholderTextColor={colors.texteGris}
                    />
                    <Text style={styles.aideLignesJour}>
                      Dans l'ordre de la séance (flèches pour le changer). REPOS
                      (« 90 » ou « 1:30 », vide = 1:30) et RIR sont facultatifs.
                    </Text>
                    {brouillon.lignes.map((ligne, i) => (
                      <LigneExerciceEditable
                        key={i}
                        ligne={ligne}
                        index={i}
                        total={brouillon.lignes.length}
                        onModifier={(champ, valeur) => modifierLigneJour(jour, i, champ, valeur)}
                        onDeplacer={(sens) => deplacerLigneJour(jour, i, sens)}
                        onRetirer={brouillon.lignes.length > 1 ? () => retirerLigneJour(jour, i) : null}
                      />
                    ))}
                    <View style={styles.deuxBoutons}>
                      <TouchableOpacity
                        style={[styles.boutonSecondaire, styles.boutonMoitie]}
                        onPress={() => ajouterLigneJour(jour)}
                      >
                        <LibelleIcone nom="plus" taille={13} ecart={5} style={styles.boutonSecondaireTexte}>Ligne vide</LibelleIcone>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.boutonSecondaire, styles.boutonMoitie, styles.boutonBiblio]}
                        onPress={() => setBiblioJour((j) => (j === jour ? null : jour))}
                      >
                        <LibelleIcone nom="bibliotheque" taille={13} ecart={5} style={styles.boutonBiblioTexte}>
                          Bibliothèque
                        </LibelleIcone>
                      </TouchableOpacity>
                    </View>

                    {biblioJour === jour && (
                      <ChoixExercice
                        dejaPris={brouillon.lignes.map((l) => l.exercice)}
                        onFermer={() => setBiblioJour(null)}
                        onChoisir={(nomExo) => majSeanceJour(jour, {
                          lignes: placerExerciceChoisi(brouillon.lignes, nomExo, ligneVide()),
                        })}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      {erreur ? <TexteIcone nom="alerte" taille={13} hautAligne style={styles.messageErreur}>{erreur}</TexteIcone> : null}

      <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerProgramme}>
        <Text style={styles.boutonPrincipalTexte}>Enregistrer le programme</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { reinitialiserFormulaireProgramme(); setVue('programmes'); }}>
        <Text style={styles.lienAnnuler}>Annuler</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
