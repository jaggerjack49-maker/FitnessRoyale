// Petits composants de l'onglet Entraînement (séance, chrono, confirmations…).
// Découpé de EntrainementScreen.js le 13/11/2026 (le fichier faisait 5 600
// lignes). Le code est RECOPIÉ TEL QUEL : seul son emplacement a changé.

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Icone, LibelleIcone, TexteIcone } from '../../components/Icones';
import { abreviationsJours, joursSemaine } from '../../data/programmesStandards';
import { chronoLisible, secondesEcoulees } from '../../logic/seanceLibre';
import { colors, espacement } from '../../theme';
import { da, monospace } from '../../designSystem';
import { resumeReglages } from '../../logic/lignesProgramme';
import { styles } from './styles';
import { suggererProchaineSerie } from '../../logic/surchargeProgressive';
import { typeDeSeance } from './outils';

// UNE LIGNE D'EXERCICE PRÉVU, avec la PERFORMANCE ATTENDUE à la prochaine
// séance (demande de Hafiz du 01/09/2026 : « afficher les performances
// attendues pour la prochaine séance »).
//
// C'est exactement la même suggestion de surcharge progressive qu'on voit
// DÉJÀ pendant la séance (`suggererProchaineSerie`), mais montrée AVANT d'y
// aller : on sait quoi charger en arrivant à la salle, au lieu de le
// découvrir une fois la barre en main.
// Rien de nouveau côté calcul, donc rien à demander au serveur : tout se
// déduit de l'historique déjà chargé (marche hors-ligne).
// Pas de suggestion = exercice jamais loggé : on n'affiche rien plutôt
// qu'un chiffre inventé.
// Les puces « Faire progresser : Séries / Reps / Poids » (24/09/2026) ont
// été RETIRÉES le 08/11/2026 à la demande de Hafiz. Toutes les suggestions
// suivent désormais la double progression par défaut (reps, puis charge — voir
// src/logic/surchargeProgressive.js). Les réglages déjà enregistrés côté
// serveur (`progressions_exercices`) ne sont plus lus ; l'endpoint reste, rien
// ne l'appelle.
export function LigneExercicePrevu({ exo, entrainements, numero }) {
  // Même calcul que pendant la séance : les deux ne peuvent pas se contredire.
  const suggestion = suggererProchaineSerie(entrainements, exo.exercice, exo.reps_cibles, {
    seriesCibles: exo.series_cibles,
  });
  // L'ORDRE se voit (« 1. », « 2. »…) et le repos / RIR fixés aussi
  // (08/11/2026) : c'est ce qu'on relit avant d'aller à la salle.
  const reglages = resumeReglages(exo);
  return (
    <View style={{ marginTop: 3 }}>
      <Text style={styles.exerciceDetailJour}>
        {numero ? `${numero}.` : '•'} {exo.exercice} — {exo.series_cibles} × {exo.reps_cibles}
        {exo.reps_cibles_max ? `-${exo.reps_cibles_max}` : ''}
        {reglages ? <Text style={styles.reglagesExo}>{`  ·  ${reglages}`}</Text> : null}
      </Text>
      {suggestion && (
        <TexteIcone nom="cible" taille={12} ecart={5} style={styles.attenduDetailJour}>
          Attendu : {suggestion.series ? `${suggestion.series} × ` : ''}
          {suggestion.reps} reps{suggestion.poids > 0 ? ` à ${suggestion.poids} kg` : ''}
        </TexteIcone>
      )}
    </View>
  );
}

export function ResumeSeanceFaite({ entrainement, programmes }) {
  const parExercice = [];
  (entrainement.series || []).forEach((s) => {
    if (!s) return;
    let groupe = parExercice.find((g) => g.exercice === s.exercice);
    if (!groupe) { groupe = { exercice: s.exercice, series: [] }; parExercice.push(groupe); }
    groupe.series.push(s);
  });
  return (
    <View style={styles.detailJour}>
      <TexteIcone nom="valide" taille={14} style={[styles.nomProgrammeTexte, { color: colors.vert }]}>
        {typeDeSeance(entrainement, programmes)} <Text style={styles.indice}>(faite)</Text>
      </TexteIcone>
      {parExercice.map((g) => (
        <Text key={g.exercice} style={styles.exerciceDetailJour}>
          • {g.exercice} — {g.series
            .map((s) => (s.poids > 0 ? `${s.poids} kg × ${s.reps}` : `${s.reps} reps`))
            .join(' · ')}
        </Text>
      ))}
    </View>
  );
}

// LES JOURS D'UNE SÉANCE, MODIFIABLES D'UNE TOUCHE (07/09/2026).
// Demande de Hafiz : « on doit pouvoir configurer les jours du programme sur
// une semaine, et ceux-ci seront projetés sur le mois ».
//
// LA PROJECTION EST AUTOMATIQUE, il n'y a rien à « appliquer » : le calendrier
// mensuel demande à `planificationProgramme` si la séance tombe ce jour-là, et
// cette fonction ne regarde que les jours cochés ici. Cocher « lundi » remplit
// donc TOUS les lundis du mois affiché — et des mois suivants — d'un seul geste.
//
// Ce qui manquait n'était pas la projection (elle existait depuis la v2) mais
// le moyen de CHANGER ces jours après coup : il fallait supprimer le programme
// et le recréer.
export function ChoixJoursSeance({ programme, onBasculer }) {
  const jours = programme.jours || [];
  return (
    <View style={styles.lignePucesJoursSeance}>
      {joursSemaine.map((jour) => {
        const actif = jours.includes(jour);
        return (
          <TouchableOpacity
            key={jour}
            style={[styles.puceJourPetite, actif && styles.puceJourActive]}
            onPress={() => onBasculer(programme, jour)}
          >
            <Text style={[styles.puceJourTexte, actif && styles.puceJourTexteActif]}>
              {abreviationsJours[jour]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// LE CHRONO DE SÉANCE (08/11/2026, demande de Hafiz : « un chrono qui se lance
// automatiquement au début de la séance »).
// Un composant À PART, qui tient sa propre horloge : s'il vivait dans
// l'écran, l'écran entier (plus de 5 000 lignes) se redessinerait chaque
// seconde pendant toute la séance — au risque de faire ramer la saisie des
// séries. Ici, seul ce petit bloc bouge.
// Il n'additionne PAS des secondes : il affiche l'écart entre MAINTENANT et
// l'instant de départ (`debut`, mémorisé avec la séance). Il reste donc juste
// après un changement d'onglet, une mise en veille ou une relance de l'app.
// `actif` coupe l'horloge quand l'onglet n'est pas à l'écran (batterie).
export function ChronoSeance({ debut, actif }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    if (!actif || !debut) return undefined;
    setMaintenant(Date.now());
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [actif, debut]);
  if (!debut) return null;
  return (
    <View style={stylesChrono.pastille}>
      <Icone nom="horloge" taille={16} couleur={colors.or} />
      <Text style={stylesChrono.temps}>{chronoLisible(secondesEcoulees(debut, maintenant))}</Text>
      <Text style={stylesChrono.legende}>depuis le début</Text>
    </View>
  );
}

export const stylesChrono = StyleSheet.create({
  pastille: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: da.orVoile, borderWidth: 1, borderColor: da.bordureOrDouce,
    borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14,
    marginBottom: espacement.m,
  },
  temps: { color: colors.or, fontFamily: monospace, fontWeight: '800', fontSize: 20 },
  legende: { color: colors.texteGris, fontSize: 11 },
});

// UNE SÉANCE DEVIENT UN PROGRAMME (08/11/2026, demande de Hafiz : « la
// possibilité d'ajouter les exercices d'une séance libre à un nouveau
// programme qu'on veut créer »).
// Utilisé à DEUX endroits avec le même composant : pendant une séance libre,
// et dans le détail d'une séance libre passée (historique) — pour le cas où
// l'on n'y pense qu'après coup.
// `exercices` arrive déjà calculé (`exercicesPourProgramme`) : on affiche ce
// qui sera créé AVANT de le créer, objectifs compris.
// `onCreer(nom)` renvoie { ok, message } : le message reste affiché ici.
export function CreerProgrammeDepuisSeance({ exercices, nomParDefaut, explication, onCreer }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);

  if (resultat?.ok) {
    return (
      <View style={stylesCreation.carte}>
        <TexteIcone nom="valide" taille={14} hautAligne couleur={colors.vert} style={stylesCreation.reussi}>
          {resultat.message}
        </TexteIcone>
      </View>
    );
  }
  if (!ouvert) {
    return (
      <TouchableOpacity style={stylesCreation.bouton} onPress={() => setOuvert(true)}>
        <LibelleIcone nom="plus" taille={14} ecart={6} style={stylesCreation.boutonTexte}>
          Créer un programme avec ces exercices
        </LibelleIcone>
      </TouchableOpacity>
    );
  }
  return (
    <View style={stylesCreation.carte}>
      <Text style={stylesCreation.titre}>NOUVEAU PROGRAMME</Text>
      <Text style={stylesCreation.aide}>{explication}</Text>
      {exercices.map((e) => (
        <Text key={e.exercice} style={stylesCreation.ligne}>
          • {e.exercice} — {e.series_cibles} × {e.reps_cibles}
        </Text>
      ))}
      <Text style={stylesCreation.libelle}>NOM DU PROGRAMME</Text>
      <TextInput
        style={stylesCreation.champ}
        value={nom}
        onChangeText={setNom}
        placeholder={nomParDefaut}
        placeholderTextColor={colors.texteGris}
        maxLength={60}
      />
      {resultat && !resultat.ok ? (
        <TexteIcone nom="alerte" taille={13} hautAligne style={stylesCreation.erreur}>
          {resultat.message}
        </TexteIcone>
      ) : null}
      <TouchableOpacity
        style={[stylesCreation.boutonOr, enCours && { opacity: 0.5 }]}
        disabled={enCours}
        onPress={async () => {
          setEnCours(true);
          setResultat(await onCreer(nom.trim() || nomParDefaut));
          setEnCours(false);
        }}
      >
        {enCours ? <ActivityIndicator color={da.orSombre} /> : (
          <Text style={stylesCreation.boutonOrTexte}>Créer le programme</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setOuvert(false); setResultat(null); }}>
        <Text style={stylesCreation.annuler}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );
}

export const stylesCreation = StyleSheet.create({
  bouton: {
    minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12,
    borderWidth: 1, borderColor: da.bordureOrDouce, backgroundColor: da.orVoile,
    paddingHorizontal: 12, marginTop: espacement.s, marginBottom: espacement.s,
  },
  boutonTexte: { color: colors.or, fontWeight: '800', fontSize: 13 },
  carte: {
    backgroundColor: colors.carte, borderRadius: 12, borderWidth: 1,
    borderColor: da.bordureOrDouce, padding: espacement.m,
    marginTop: espacement.s, marginBottom: espacement.s,
  },
  titre: { color: colors.or, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  aide: { color: colors.texteGris, fontSize: 12, lineHeight: 17, marginBottom: espacement.s },
  ligne: { color: colors.texte, fontSize: 13, marginBottom: 3 },
  libelle: {
    color: colors.texteGris, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
    marginTop: espacement.m, marginBottom: 6,
  },
  champ: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: 12,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure,
  },
  erreur: { color: colors.rouge, fontSize: 12, marginTop: espacement.s, lineHeight: 17 },
  boutonOr: {
    minHeight: 46, backgroundColor: colors.or, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: espacement.m,
  },
  boutonOrTexte: { color: da.orSombre, fontWeight: '900', fontSize: 13 },
  annuler: { color: colors.texteGris, fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  reussi: { color: colors.texte, fontSize: 13, lineHeight: 18 },
});

// Demande de confirmation avant une suppression, affichée DANS la carte.
//
// La croix supprimait jusqu'ici sur-le-champ (27/08/2026, retour de Hafiz :
// « la croix ne doit pas la supprimer immédiatement ») — un programme d'une
// semaine entière pouvait disparaître sur une fausse manœuvre.
// PAS d'`Alert.alert` : il est MUET sur le web, où Hafiz teste (voir la
// convention du projet — les messages passent par des états React affichés).
export function ConfirmationSuppression({
  actif, question, onConfirmer, onAnnuler,
  libelleConfirmer = 'Oui, supprimer', couleur,
}) {
  if (!actif) return null;
  const teinte = couleur || colors.rouge;
  return (
    <View style={[stylesConfirmation.carte, { borderColor: teinte }]}>
      <Text style={stylesConfirmation.question}>{question}</Text>
      <View style={stylesConfirmation.ligne}>
        <TouchableOpacity
          style={[stylesConfirmation.boutonSupprimer, { borderColor: teinte }]}
          onPress={onConfirmer}
        >
          <Text style={[stylesConfirmation.texteSupprimer, { color: teinte }]}>{libelleConfirmer}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={stylesConfirmation.boutonAnnuler} onPress={onAnnuler}>
          <Text style={stylesConfirmation.texteAnnuler}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const stylesConfirmation = StyleSheet.create({
  carte: {
    backgroundColor: colors.fond, borderRadius: 10, padding: espacement.s,
    marginTop: espacement.s, borderWidth: 1, borderColor: colors.rouge,
  },
  question: { color: colors.texte, fontSize: 12, fontWeight: '600', marginBottom: espacement.s },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boutonSupprimer: {
    borderWidth: 1, borderColor: colors.rouge, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12,
  },
  texteSupprimer: { color: colors.rouge, fontWeight: '800', fontSize: 12 },
  boutonAnnuler: { paddingVertical: 7, paddingHorizontal: 8 },
  texteAnnuler: { color: colors.texteGris, fontSize: 12 },
});
