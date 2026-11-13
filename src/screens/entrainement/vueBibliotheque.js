// La vue « bibliotheque » de l'onglet Entraînement.
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.
//
// C'est une FONCTION DE RENDU, pas un composant : EntrainementScreen
// l'appelle directement (`vueX(ctx)`) et lui passe tout ce qu'elle lit dans
// `ctx`. Elle ne contient aucun hook, l'arbre affiché est donc exactement le
// même qu'avant le découpage.

import ChoixExercice from '../../components/ChoixExercice';
import { EnteteSousEcran, stylesHub } from './sousEcran';
import { Icone } from '../../components/Icones';
import { MATERIELS, bibliothequeExercices, descriptionExercice, exerciceDeLaBibliotheque } from '../../data/bibliothequeExercices';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ZONE_TACTILE, libelleDate } from './outils';
import { colors, espacement } from '../../theme';
import { recordPersonnel } from '../../logic/surchargeProgressive';
import { styles } from './styles';

// ================= SOUS-ÉCRAN : SUIVI & OBJECTIFS =================
  // ---------------------------------------------------------------------------
  // SOUS-ÉCRAN « BIBLIOTHÈQUE » — parcourir les 96 exercices (07/11/2026)
  // ---------------------------------------------------------------------------
  // C'est le MÊME composant que le choisisseur branché aux éditeurs, en mode
  // consultation : toucher un exercice ouvre sa fiche au lieu de remplir un
  // champ. La fiche ne montre que ce qu'on sait déjà (groupe, matériel, mon
  // record) — elle n'invente aucune consigne d'exécution, et surtout aucun
  // chiffre : une charge conseillée se déduit de SON historique, pas d'un
  // catalogue.
export function vueBibliotheque(ctx) {
  const {
    entrainements, exoConsulte, placeBiblio, setExoConsulte, setVue,
  } = ctx;


  const fiche = exoConsulte ? exerciceDeLaBibliotheque(exoConsulte) : null;
  const materielFiche = fiche ? MATERIELS[fiche.materiel] : null;
  const recordFiche = fiche ? recordPersonnel(entrainements, fiche.nom) : null;
  return (
    <ScrollView
      key="bibliotheque"
      {...placeBiblio}
      style={styles.conteneur}
      contentContainerStyle={{ padding: espacement.m }}
    >
      <EnteteSousEcran
        titre="Bibliothèque d'exercices"
        sousTitre={`${bibliothequeExercices.length} exercices, rangés par groupe musculaire.`}
        onRetour={() => { setExoConsulte(null); setVue('programmes'); }}
      />

      {fiche && (
        <View style={stylesHub.ficheExo}>
          <View style={stylesHub.ficheEntete}>
            <View style={stylesHub.ficheIcone}>
              <Icone
                nom={materielFiche ? materielFiche.icone : 'question'}
                taille={28}
                couleur={colors.or}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={stylesHub.ficheNom}>{fiche.nom}</Text>
              <Text style={stylesHub.ficheDetail}>{descriptionExercice(fiche)}</Text>
            </View>
            <TouchableOpacity onPress={() => setExoConsulte(null)} hitSlop={ZONE_TACTILE}>
              <Icone nom="croix" taille={15} couleur={colors.texteGris} />
            </TouchableOpacity>
          </View>
          {/* La chasse fixe est faite pour des CHIFFRES alignés, pas pour
              une phrase : elle ne s'applique qu'au record. */}
          <Text style={[stylesHub.ficheRecord, recordFiche && stylesHub.ficheChiffres]}>
            {recordFiche
              ? `Ton record : ${recordFiche.poids} kg × ${recordFiche.reps} reps (${libelleDate(recordFiche.date)})`
              : 'Tu ne l’as jamais noté dans une séance.'}
          </Text>
          <Text style={stylesHub.ficheAide}>
            Pour l’ajouter, ouvre un programme ou une séance : le bouton
            « Bibliothèque » y propose cette même liste.
          </Text>
        </View>
      )}

      <ChoixExercice
        consultation
        onChoisir={(nomExo) => setExoConsulte(nomExo)}
        onFermer={() => { setExoConsulte(null); setVue('programmes'); }}
      />
    </ScrollView>
  );
}
