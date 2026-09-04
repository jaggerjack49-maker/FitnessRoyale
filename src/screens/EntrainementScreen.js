// Écran Entraînement : programmes créés par l'utilisateur + journal de séance
// (workout log) + surcharge progressive.
//
// IMPORTANT : cette section est INDÉPENDANTE du système de paliers Fitness Royale.
// Rien ici ne touche aux perfs officielles (onglet Perfs) — c'est un outil de
// suivi perso pur. Les exercices sont en texte libre, pas besoin de coller
// au barème.
//
// Mode hors-ligne : programmes et séances vivent d'abord en état local
// (fonctionne sans serveur) ; si connecté, chaque création est synchronisée
// au serveur en tâche de fond (comme le reste de l'app).
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, espacement } from '../theme';
import * as api from '../api';
import {
  programmesStandards, joursSemaine, abreviationsJours, jourDeLaDate,
} from '../data/programmesStandards';
import {
  groupesMusculaires, groupeDeLExercice, lundiDeLaSemaine,
  compterSeriesParGroupe, exercicesDeLaPeriode,
} from '../data/groupesMusculaires';
import {
  suggererProchaineSerie, recordPersonnel, bat_le_record,
  detecterStagnation, tousLesRecords,
} from '../logic/surchargeProgressive';
import * as notifications from '../notifications';

// La date locale 'AAAA-MM-JJ' d'un objet Date (sans passer par l'UTC de
// toISOString, qui peut décaler d'un jour selon le fuseau horaire).
function enISO(date) {
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}`;
}

// BUG CORRIGÉ (03/09/2026) : cette fonction renvoyait la date UTC
// (`toISOString`), alors que les cases du calendrier utilisent la date LOCALE
// (`enISO`) — l'avertissement était pourtant écrit juste au-dessus, mais
// n'avait été appliqué qu'à `enISO`. Les deux ne tombent pas le même jour
// aux heures où le fuseau et l'UTC divergent (avant 2 h du matin en France) :
// une séance terminée à ce moment-là était datée de la VEILLE, et le ✅
// apparaissait donc sur une case où l'on n'avait encore rien fait.
// Les deux passent maintenant par le même calcul.
function aujourdhui() {
  return enISO(new Date());
}

const nomsMois = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// La grille d'un mois pour le calendrier : un tableau de SEMAINES (rangées de
// 7 cases, lundi en premier), avec null pour les cases hors du mois.
function grilleDuMois(annee, mois) {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // 0 = lundi
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const cases = [];
  for (let i = 0; i < decalage; i++) cases.push(null);
  for (let j = 1; j <= nbJours; j++) cases.push(new Date(annee, mois, j));
  while (cases.length % 7 !== 0) cases.push(null);
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

// Un programme est-il "actif" ce jour-là, et si planifié, à quelle semaine en
// est-il ? (pour le calendrier et le badge "Semaine 2/4" des programmes)
function planificationProgramme(programme, dateISO) {
  const jours = programme.jours || [];
  if (jours.length === 0) return { prevuCeJour: false, semaine: null };
  const dateJs = new Date(`${dateISO}T12:00:00`); // midi : à l'abri des fuseaux
  const prevuCeJour = jours.includes(jourDeLaDate(dateJs));
  if (!programme.date_debut) return { prevuCeJour, semaine: null };
  if (dateISO < programme.date_debut) return { prevuCeJour: false, semaine: null };
  const debut = new Date(`${programme.date_debut}T12:00:00`);
  const numSemaine = Math.floor((dateJs - debut) / (7 * 24 * 3600 * 1000)) + 1;
  if (programme.duree_semaines && numSemaine > programme.duree_semaines) {
    return { prevuCeJour: false, semaine: null }; // programme terminé
  }
  return { prevuCeJour, semaine: numSemaine };
}

// Cherche les dernières séries loggées pour un exercice, AVANT une date donnée
// (jamais la séance en cours) — calcul 100% local, marche même hors-ligne.
function trouverDernieresSeries(entrainements, exercice, avantDate) {
  const candidats = entrainements
    .filter((e) => e.date < avantDate && e.series.some((s) => s.exercice === exercice))
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  if (candidats.length === 0) return null;
  const dernier = candidats[0];
  return { date: dernier.date, series: dernier.series.filter((s) => s.exercice === exercice) };
}

// ↑ / = / ↓ : compare la charge la plus lourde d'aujourd'hui à la fois précédente.
function indicateurProgression(seriesAujourdhui, seriesPrecedentes) {
  if (!seriesAujourdhui?.length || !seriesPrecedentes?.length) return null;
  const maxAujourdhui = Math.max(...seriesAujourdhui.map((s) => s.poids));
  const maxPrecedent = Math.max(...seriesPrecedentes.map((s) => s.poids));
  if (maxAujourdhui > maxPrecedent) return { symbole: '↑', couleur: colors.vert };
  if (maxAujourdhui < maxPrecedent) return { symbole: '↓', couleur: colors.rouge };
  return { symbole: '=', couleur: colors.texteGris };
}

// Les jours occupés par un cycle, en abrégé (« Lun Mar Jeu ») — le résumé
// affiché quand le détail du programme est replié.
function joursDuCycle(cycle) {
  const jours = [];
  cycle.seances.forEach((seance) => {
    (seance.jours || []).forEach((jour) => {
      if (!jours.includes(jour)) jours.push(jour);
    });
  });
  return joursSemaine
    .filter((jour) => jours.includes(jour))
    .map((jour) => abreviationsJours[jour])
    .join(' ');
}

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
function LigneExercicePrevu({ exo, entrainements }) {
  const suggestion = suggererProchaineSerie(entrainements, exo.exercice, exo.reps_cibles);
  return (
    <View style={{ marginTop: 3 }}>
      <Text style={styles.exerciceDetailJour}>
        • {exo.exercice} — {exo.series_cibles} × {exo.reps_cibles}
      </Text>
      {suggestion && (
        <Text style={styles.attenduDetailJour}>
          {'    '}🎯 Attendu : {suggestion.poids > 0 ? `${suggestion.poids} kg × ` : ''}
          {suggestion.reps} reps
        </Text>
      )}
    </View>
  );
}

// Éditeur d'une SÉANCE : un nom + autant d'exercices qu'on veut, chacun avec
// ses séries × reps. Utilisé à DEUX endroits (même composant, pas de doublon) :
// - la SEMAINE TYPE, pour écrire la séance d'un jour ;
// - le CALENDRIER, pour retoucher la séance prévue une date donnée.
// `programme` = la séance déjà enregistrée (ou null pour en créer une).
// `onSauvegarder(nom, exercices)` remonte la version normalisée au parent.
function EditeurSeance({
  programme, placeholderNom, libelleBouton, onSauvegarder,
  onVider, libelleVider, note, nomParDefaut,
}) {
  const [nom, setNom] = useState(programme ? programme.nom : '');
  const [lignes, setLignes] = useState(
    programme && programme.exercices.length > 0
      ? programme.exercices.map((exo) => ({
          exercice: exo.exercice,
          series: String(exo.series_cibles),
          reps: String(exo.reps_cibles),
        }))
      : [{ exercice: '', series: '3', reps: '10' }]
  );
  const [message, setMessage] = useState(null);

  function modifier(index, champ, valeur) {
    setMessage(null);
    setLignes((l) => l.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)));
  }

  function valider() {
    const nomFinal = nom.trim() || nomParDefaut || 'Séance';
    const exercices = lignes
      .filter((ligne) => ligne.exercice.trim())
      .map((ligne) => ({
        exercice: ligne.exercice.trim(),
        series_cibles: Math.max(1, parseInt(ligne.series, 10) || 1),
        reps_cibles: Math.max(1, parseInt(ligne.reps, 10) || 1),
      }));
    if (exercices.length === 0) {
      setMessage("Ajoute au moins un exercice (avec son nom).");
      return;
    }
    onSauvegarder(nomFinal, exercices);
    setMessage('✅ Séance enregistrée');
  }

  return (
    <View style={stylesEditeur.carte}>
      {note && <Text style={stylesEditeur.note}>{note}</Text>}
      <Text style={stylesEditeur.libelle}>Nom de la séance</Text>
      <TextInput
        style={stylesEditeur.champNom}
        value={nom}
        onChangeText={(v) => { setNom(v); setMessage(null); }}
        placeholder={placeholderNom}
        placeholderTextColor={colors.texteGris}
      />

      <Text style={stylesEditeur.libelle}>Exercices (nom · séries × reps)</Text>
      {lignes.map((ligne, i) => (
        <View key={i} style={stylesEditeur.ligne}>
          <TextInput
            style={stylesEditeur.champExo}
            value={ligne.exercice}
            onChangeText={(v) => modifier(i, 'exercice', v)}
            placeholder="Nom de l'exercice"
            placeholderTextColor={colors.texteGris}
          />
          <TextInput
            style={stylesEditeur.champ}
            value={ligne.series}
            onChangeText={(v) => modifier(i, 'series', v)}
            keyboardType="numeric"
          />
          <Text style={stylesEditeur.croix}>×</Text>
          <TextInput
            style={stylesEditeur.champ}
            value={ligne.reps}
            onChangeText={(v) => modifier(i, 'reps', v)}
            keyboardType="numeric"
          />
          {lignes.length > 1 && (
            <TouchableOpacity
              style={stylesEditeur.retirer}
              onPress={() => setLignes((l) => l.filter((_, k) => k !== i))}
            >
              <Text style={stylesEditeur.retirerTexte}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={stylesEditeur.boutonAjout}
        onPress={() => setLignes((l) => [...l, { exercice: '', series: '3', reps: '10' }])}
      >
        <Text style={stylesEditeur.boutonAjoutTexte}>+ Ajouter un exercice</Text>
      </TouchableOpacity>

      {message && <Text style={stylesEditeur.message}>{message}</Text>}

      <TouchableOpacity style={stylesEditeur.bouton} onPress={valider}>
        <Text style={stylesEditeur.boutonTexte}>{libelleBouton}</Text>
      </TouchableOpacity>
      {onVider && (
        <TouchableOpacity onPress={onVider}>
          <Text style={stylesEditeur.lienVider}>{libelleVider}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const stylesEditeur = StyleSheet.create({
  carte: {
    backgroundColor: colors.fond, borderRadius: 10, padding: espacement.s,
    marginTop: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  libelle: { color: colors.texte, fontWeight: '600', fontSize: 12, marginTop: 4, marginBottom: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  champNom: {
    backgroundColor: colors.carteClaire, borderRadius: 8, padding: 10,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure, fontSize: 13,
  },
  champExo: {
    backgroundColor: colors.carteClaire, borderRadius: 8, paddingVertical: 6,
    paddingHorizontal: 8, color: colors.texte, flex: 1,
    borderWidth: 1, borderColor: colors.bordure, fontSize: 12,
  },
  champ: {
    backgroundColor: colors.carteClaire, borderRadius: 8, paddingVertical: 6,
    paddingHorizontal: 4, color: colors.texte, width: 40, textAlign: 'center',
    borderWidth: 1, borderColor: colors.bordure, fontSize: 12,
  },
  croix: { color: colors.texteGris, fontSize: 12 },
  retirer: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.rouge,
  },
  retirerTexte: { color: colors.rouge, fontWeight: '800', fontSize: 11 },
  boutonAjout: {
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 8, padding: 8, alignItems: 'center', marginTop: 2,
  },
  boutonAjoutTexte: { color: colors.accent, fontWeight: '700', fontSize: 12 },
  bouton: {
    backgroundColor: colors.accent, borderRadius: 8, padding: 10,
    alignItems: 'center', marginTop: espacement.s,
  },
  boutonTexte: { color: colors.texte, fontWeight: '700', fontSize: 12 },
  message: { color: colors.vert, fontSize: 12, marginTop: 6 },
  lienVider: { color: colors.texteGris, fontSize: 11, textAlign: 'center', marginTop: 8 },
  note: { color: colors.or, fontSize: 11, marginBottom: 4, lineHeight: 15 },
});

// Demande de confirmation avant une suppression, affichée DANS la carte.
//
// La croix supprimait jusqu'ici sur-le-champ (27/08/2026, retour de Hafiz :
// « la croix ne doit pas la supprimer immédiatement ») — un programme d'une
// semaine entière pouvait disparaître sur une fausse manœuvre.
// PAS d'`Alert.alert` : il est MUET sur le web, où Hafiz teste (voir la
// convention du projet — les messages passent par des états React affichés).
function ConfirmationSuppression({
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

const stylesConfirmation = StyleSheet.create({
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

export default function EntrainementScreen({ moi, estConnecte, ajouterSeanceLocale }) {
  const [vue, setVue] = useState('accueil'); // 'accueil' | 'nouveauProgramme' | 'seance'
  const [programmes, setProgrammes] = useState([]);
  const [entrainements, setEntrainements] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  // ---- Formulaire NOUVEAU PROGRAMME (= un CYCLE complet sur la semaine) ----
  // On choisit obligatoirement les JOURS travaillés, puis pour CHAQUE jour sa
  // séance (nom + exercices). Poser ce programme dans le calendrier remplit
  // ensuite tous ces jours automatiquement.
  const [nomProgramme, setNomProgramme] = useState('');
  const [joursChoisis, setJoursChoisis] = useState([]); // ['lundi', ...]
  // { lundi: { nom: 'Push', lignes: [{exercice, seriesCibles, repsCibles}] }, ... }
  const [seancesParJour, setSeancesParJour] = useState({});
  const [jourEnEdition, setJourEnEdition] = useState(null); // jour déplié dans le formulaire
  const [cycles, setCycles] = useState([]);

  // Quelle séance est DÉROULÉE dans « Mes programmes » (on voit ses exercices
  // sans ouvrir l'éditeur).
  const [seanceDeroulee, setSeanceDeroulee] = useState(null);
  // Les programmes complets dont on affiche le détail en entier (28/08/2026,
  // demande de Hafiz : « une option pour afficher le détail du programme ou
  // non »). Dérouler séance par séance restait possible, mais il fallait le
  // faire une par une pour voir sa semaine.
  const [cyclesDeroules, setCyclesDeroules] = useState([]);

  function basculerDetailCycle(id) {
    setCyclesDeroules((liste) =>
      liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
  }

  // Suppression en DEUX temps : la croix arme la question, un second geste
  // confirme. Contient la clé de l'élément visé ('cycle-3', 'prog-7'…).
  const [suppressionAConfirmer, setSuppressionAConfirmer] = useState(null);

  // ---- Volume : objectif de séries par groupe musculaire (« body part ») ----
  // objectifs = { Pectoraux: 12, ... } ; correctionsGroupes = { 'Mon exo': 'Dos' }
  const [objectifsSeries, setObjectifsSeries] = useState({});
  const [correctionsGroupes, setCorrectionsGroupes] = useState({});
  const [volumeOuvert, setVolumeOuvert] = useState(false);
  const [editionObjectifs, setEditionObjectifs] = useState(false);
  const [brouillonObjectifs, setBrouillonObjectifs] = useState({}); // saisie en cours (texte)
  const [exerciceAClasser, setExerciceAClasser] = useState(null);
  const [recordsOuverts, setRecordsOuverts] = useState(false);

  // ---- Rappel de SUIVI : le point hebdo sur le volume (≠ rappel de séance) ----
  const [suiviJour, setSuiviJour] = useState('dimanche');
  const [suiviHeure, setSuiviHeure] = useState('19:00');
  const [suiviActif, setSuiviActif] = useState(false);
  const [suiviMessage, setSuiviMessage] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('fitnessRoyale.rappelSuivi').then((brut) => {
      if (!brut) return;
      try {
        const config = JSON.parse(brut);
        setSuiviJour(config.jour || 'dimanche');
        setSuiviHeure(config.heure || '19:00');
        setSuiviActif(!!config.actif);
      } catch {
        // Config illisible : valeurs par défaut.
      }
    });
  }, []);

  // ---- Modèles standards (dépliés/repliés) ----
  const [modelesOuverts, setModelesOuverts] = useState(false);
  const [modeleEnCours, setModeleEnCours] = useState(null); // id du modèle en création

  // ---- Semaine type : jour de la semaine déplié ('lundi'…) pour choisir
  // le(s) programme(s) qui s'y répètent chaque semaine — null = replié.
  const [jourSemaineOuvert, setJourSemaineOuvert] = useState(null);

  // ---- Calendrier mensuel interactif ----
  // planning = les programmes posés sur des DATES PRÉCISES (table planning du
  // serveur) ; jourOuvert = la date sélectionnée dans la grille (détail affiché
  // sous le calendrier) ; moisAffiche = le mois montré (navigable ◀ ▶).
  const [planning, setPlanning] = useState([]);
  const [jourOuvert, setJourOuvert] = useState(null);
  const maintenant = new Date();
  const [moisAffiche, setMoisAffiche] = useState({
    annee: maintenant.getFullYear(), mois: maintenant.getMonth(),
  });
  const [choixProgrammeOuvert, setChoixProgrammeOuvert] = useState(false);
  // Séance en cours de retouche DANS le calendrier (id du programme) — permet
  // de corriger exercices/séries/reps sans repasser par la semaine type.
  const [programmeEnEdition, setProgrammeEnEdition] = useState(null);
  // Modèle (cycle complet) en cours de placement depuis le calendrier + durée choisie.
  const [modeleAPlacer, setModeleAPlacer] = useState(null);
  const [semainesModele, setSemainesModele] = useState('4');

  // ---- Rappel d'entraînement (notification locale, voir src/notifications.js) ----
  // Config persistée dans AsyncStorage pour survivre au redémarrage de l'app.
  const [rappelJours, setRappelJours] = useState([]);
  const [rappelHeure, setRappelHeure] = useState('18:00');
  const [rappelActif, setRappelActif] = useState(false);
  const [rappelMessage, setRappelMessage] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('fitnessRoyale.rappel').then((brut) => {
      if (!brut) return;
      try {
        const config = JSON.parse(brut);
        setRappelJours(config.jours || []);
        setRappelHeure(config.heure || '18:00');
        setRappelActif(!!config.actif);
      } catch {
        // Config illisible : on repart des valeurs par défaut.
      }
    });
  }, []);

  // ---- Séance en cours de log ----
  const [programmeActif, setProgrammeActif] = useState(null); // null = séance libre
  const [exercicesSession, setExercicesSession] = useState([]); // [nomExercice, ...]
  const [nouvelExerciceLibre, setNouvelExerciceLibre] = useState('');
  const [seriesLoggees, setSeriesLoggees] = useState({}); // { exercice: [{numero_serie, reps, poids}] }
  const [champsSaisie, setChampsSaisie] = useState({}); // { exercice: { reps, poids } }
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  // Quelle série est ouverte en modification : `${exercice}#${index}` ou null.
  const [serieEnEdition, setSerieEnEdition] = useState(null);

  // Renommages d'exercices détectés au dernier enregistrement d'une séance,
  // en attente de la réponse « partout ou seulement ici ? ».
  const [renommages, setRenommages] = useState([]);
  const [renommageEnCours, setRenommageEnCours] = useState(false);
  // Renommage lancé depuis la liste des records (exercice + saisie en cours).
  const [recordARenommer, setRecordARenommer] = useState(null);
  const [nomRecordSaisi, setNomRecordSaisi] = useState('');

  // ---- Programmes OFFICIELS (publiés par l'admin, voir CLAUDE.md) ----
  // Un joueur ordinaire ne fait que les LIRE et les copier ; l'admin peut en
  // plus publier un de ses propres programmes et le retirer du catalogue.
  const [programmesOfficiels, setProgrammesOfficiels] = useState([]); // ADMIN : ce que j'ai partagé
  const [publicationEnCours, setPublicationEnCours] = useState(null);
  const [messageOfficiel, setMessageOfficiel] = useState(null);
  // Récupérer un programme AVEC UN CODE (tout le monde).
  const [codeSaisi, setCodeSaisi] = useState('');
  const [rechercheCode, setRechercheCode] = useState(false);
  const [programmeTrouve, setProgrammeTrouve] = useState(null);
  const [erreurCode, setErreurCode] = useState(null);

  // ---- Détail d'une séance passée (historique) ----
  const [entrainementSelectionne, setEntrainementSelectionne] = useState(null);

  useEffect(() => {
    if (!estConnecte) return;
    chargerTout();
  }, [estConnecte]);

  async function chargerTout() {
    setChargement(true);
    try {
      const [p, e, pl, c, obj, grp] = await Promise.all([
        api.programmesDuJoueur(moi.id),
        api.entrainementsDuJoueur(moi.id),
        api.planningDuJoueur(moi.id),
        api.cyclesDuJoueur(moi.id),
        api.objectifsSeries(moi.id),
        api.groupesExercices(moi.id),
      ]);
      setProgrammes(p);
      setEntrainements(e);
      setPlanning(pl);
      setCycles(c);
      setObjectifsSeries(Object.fromEntries(obj.map((o) => [o.groupe, o.series_cibles])));
      setCorrectionsGroupes(Object.fromEntries(grp.map((g) => [g.exercice, g.groupe])));
      // Seul l'admin a une liste à voir : celle de SES propres partages, avec
      // leurs codes. Personne d'autre ne peut lister quoi que ce soit.
      if (moi.admin) {
        try {
          setProgrammesOfficiels(await api.mesProgrammesPartages());
        } catch {
          // Pas bloquant : le reste de l'écran fonctionne sans.
        }
      }
    } catch (err) {
      setErreur(err.message || 'Impossible de charger tes données.');
    } finally {
      setChargement(false);
    }
  }

  // Tout ce qui est prévu une date donnée : les programmes RÉCURRENTS (jours
  // de la semaine type) + ceux posés sur cette DATE PRÉCISE via le calendrier.
  function programmesPlanifiesLe(dateISO) {
    const recurrents = programmes
      .map((p) => ({ programme: p, plan: planificationProgramme(p, dateISO) }))
      .filter(({ plan }) => plan.prevuCeJour);
    const precis = planning
      .filter((pl) => pl.date === dateISO)
      .map((pl) => ({ planif: pl, programme: programmes.find((p) => p.id === pl.programme_id) }))
      .filter((x) => x.programme);
    return { recurrents, precis };
  }

  // Semaine type : enregistre LA SÉANCE d'un jour (nom + exercices écrits sur
  // place). Crée un nouveau programme si le jour était vide, sinon met à jour
  // celui qui y est déjà attaché.
  async function sauvegarderSeanceJour(jour, programmeExistant, nom, exercices) {
    setErreur(null);
    // Chaque jour doit rester INDÉPENDANT : si la séance de ce jour est aussi
    // utilisée d'autres jours (ex. un ancien "Push" sur lundi ET jeudi),
    // éditer lundi ne doit pas modifier jeudi à son insu. On détache donc ce
    // jour de l'ancienne séance et on lui en crée une bien à lui.
    const partageeAvecDautresJours = programmeExistant && (programmeExistant.jours || []).length > 1;
    if (partageeAvecDautresJours) {
      const restants = programmeExistant.jours.filter((j) => j !== jour);
      setProgrammes((liste) =>
        liste.map((p) => (p.id === programmeExistant.id ? { ...p, jours: restants } : p))
      );
      if (estConnecte && !String(programmeExistant.id).startsWith('local-')) {
        try {
          await api.changerJoursProgramme(programmeExistant.id, restants);
        } catch (err) {
          setErreur(err.message || "Changement gardé en local, l'envoi au serveur a échoué.");
        }
      }
    } else if (programmeExistant) {
      setProgrammes((liste) =>
        liste.map((p) => (p.id === programmeExistant.id ? { ...p, nom, exercices } : p))
      );
      if (!estConnecte || String(programmeExistant.id).startsWith('local-')) return;
      try {
        if (nom !== programmeExistant.nom) await api.renommerProgramme(programmeExistant.id, nom);
        await api.changerExercicesProgramme(programmeExistant.id, exercices);
      } catch (err) {
        setErreur(err.message || "Séance gardée en local, l'envoi au serveur a échoué.");
      }
      return;
    }
    const local = {
      id: `local-${Date.now()}`, nom, exercices, jours: [jour],
      duree_semaines: null, date_debut: null, cree_le: new Date().toISOString(),
    };
    setProgrammes((liste) => [local, ...liste]);
    if (!estConnecte) return;
    try {
      const cree = await api.creerProgramme(moi.id, nom, exercices, [jour]);
      setProgrammes((liste) => liste.map((p) => (p.id === local.id ? cree : p)));
    } catch (err) {
      setErreur(err.message || "Séance gardée en local, l'envoi au serveur a échoué.");
    }
  }

  // ----- Volume : objectifs de séries par groupe musculaire -----

  function ouvrirEditionObjectifs() {
    // On part des objectifs actuels, en texte (champs de saisie).
    const brouillon = {};
    groupesMusculaires.forEach((g) => {
      brouillon[g] = objectifsSeries[g] ? String(objectifsSeries[g]) : '';
    });
    setBrouillonObjectifs(brouillon);
    setEditionObjectifs(true);
  }

  async function enregistrerObjectifs() {
    setErreur(null);
    // Un champ vide = pas d'objectif sur ce groupe (il disparaît du suivi).
    const objectifs = [];
    const nouveaux = {};
    for (const groupe of groupesMusculaires) {
      const saisie = (brouillonObjectifs[groupe] || '').trim();
      if (!saisie) continue;
      const nombre = parseInt(saisie, 10);
      if (isNaN(nombre) || nombre <= 0 || nombre > 100) {
        setErreur(`Objectif invalide pour ${groupe} (1 à 100 séries).`);
        return;
      }
      objectifs.push({ groupe, series_cibles: nombre });
      nouveaux[groupe] = nombre;
    }
    setObjectifsSeries(nouveaux);
    setEditionObjectifs(false);
    if (!estConnecte) return;
    try {
      await api.definirObjectifsSeries(moi.id, objectifs);
    } catch (err) {
      setErreur(err.message || "Objectifs gardés en local, l'envoi au serveur a échoué.");
    }
  }

  // ----- Rappel de SUIVI hebdomadaire du volume -----

  // Le texte que portera la notification : l'état réel des objectifs.
  // Recalculé à chaque programmation pour que le message reste juste.
  function resumeVolume(seriesFaites, objectifs) {
    const lignes = groupesMusculaires
      .filter((g) => objectifs[g])
      .map((g) => `${g} ${seriesFaites[g] || 0}/${objectifs[g]}`);
    if (lignes.length === 0) return 'Fixe tes objectifs de séries pour suivre ton volume.';
    return lignes.slice(0, 4).join(' · ') + (lignes.length > 4 ? '…' : '');
  }

  async function activerRappelSuivi() {
    setSuiviMessage(null);
    const correspondance = suiviHeure.trim().match(/^(\d{1,2})[:hH](\d{2})$/);
    if (!correspondance) {
      setSuiviMessage({ texte: 'Heure invalide — utilise le format 19:00.', erreur: true });
      return;
    }
    const heure = parseInt(correspondance[1], 10);
    const minute = parseInt(correspondance[2], 10);
    if (heure > 23 || minute > 59) {
      setSuiviMessage({ texte: 'Heure invalide (0-23 h, 0-59 min).', erreur: true });
      return;
    }
    const accorde = await notifications.demanderPermission();
    if (!accorde) {
      setSuiviMessage({
        texte: 'Notifications refusées — autorise-les dans les réglages du téléphone.',
        erreur: true,
      });
      return;
    }
    await notifications.programmerRappelSuivi(
      suiviJour, heure, minute, resumeVolume(seriesFaites, objectifsSeries)
    );
    setSuiviActif(true);
    await AsyncStorage.setItem('fitnessRoyale.rappelSuivi', JSON.stringify({
      jour: suiviJour, heure: suiviHeure.trim(), actif: true,
    }));
    setSuiviMessage({
      texte: `✅ Point hebdo activé : chaque ${suiviJour} à ${suiviHeure.trim()}.`,
      erreur: false,
    });
  }

  async function desactiverRappelSuivi() {
    await notifications.annulerRappelSuivi();
    setSuiviActif(false);
    await AsyncStorage.setItem('fitnessRoyale.rappelSuivi', JSON.stringify({
      jour: suiviJour, heure: suiviHeure.trim(), actif: false,
    }));
    setSuiviMessage({ texte: 'Point hebdo désactivé.', erreur: false });
  }

  // Après une séance, le compte a changé : on reprogramme le rappel pour que
  // son message porte les nouveaux chiffres (le contenu d'une notification
  // locale est figé au moment où on la programme).
  async function rafraichirRappelSuivi(entrainementsAJour) {
    if (!suiviActif) return;
    const correspondance = suiviHeure.trim().match(/^(\d{1,2})[:hH](\d{2})$/);
    if (!correspondance) return;
    const compte = compterSeriesParGroupe(
      entrainementsAJour, correctionsGroupes, debutSemaineISO, finSemaineISO
    );
    await notifications.programmerRappelSuivi(
      suiviJour,
      parseInt(correspondance[1], 10),
      parseInt(correspondance[2], 10),
      resumeVolume(compte, objectifsSeries)
    );
  }

  // Classe manuellement un exercice que la détection automatique n'a pas su
  // rattacher à un groupe musculaire.
  async function classerExercice(exercice, groupe) {
    setCorrectionsGroupes((c) => ({ ...c, [exercice]: groupe }));
    setExerciceAClasser(null);
    if (!estConnecte) return;
    try {
      await api.definirGroupeExercice(moi.id, exercice, groupe);
    } catch (err) {
      setErreur(err.message || "Classement gardé en local, l'envoi au serveur a échoué.");
    }
  }

  // Modifie une séance EXISTANTE (nom + exercices) — utilisé par le calendrier.
  // La séance est le même objet partout : la modifier mets à jour toutes les
  // dates et tous les jours où elle est prévue (l'éditeur prévient si c'est le cas).
  // Un exercice a-t-il été RENOMMÉ (par opposition à remplacé par un autre) ?
  // On ne compare que si la liste garde la même longueur et le même ordre :
  // dans ce cas, un nom qui change à la même position est un renommage.
  // Si des lignes ont été ajoutées ou retirées, on ne devine rien — mieux vaut
  // ne rien proposer qu'aller réécrire l'historique sur une fausse piste.
  function detecterRenommages(ancienne, nouvelle) {
    if (!ancienne || ancienne.length !== nouvelle.length) return [];
    const trouves = [];
    ancienne.forEach((exo, i) => {
      const apres = nouvelle[i].exercice.trim();
      if (exo.exercice !== apres && apres) {
        trouves.push({ ancien: exo.exercice, nouveau: apres });
      }
    });
    return trouves;
  }

  async function sauvegarderProgramme(programme, nom, exercices) {
    setErreur(null);
    // À PROPOSER, PAS À FAIRE TOUT SEUL : renommer réécrit l'historique, et
    // « remplacer un exercice par un autre » ressemble de l'extérieur à un
    // renommage. C'est à l'utilisateur de trancher (demande de Hafiz du
    // 04/09/2026 : le renommage doit se propager — mais lui seul sait s'il
    // s'agit du même mouvement sous un autre nom).
    const trouves = detecterRenommages(programme.exercices, exercices);
    if (trouves.length > 0) setRenommages(trouves);
    setProgrammes((liste) =>
      liste.map((p) => (p.id === programme.id ? { ...p, nom, exercices } : p))
    );
    setCycles((liste) =>
      liste.map((c) => ({
        ...c,
        seances: c.seances.map((s) => (s.id === programme.id ? { ...s, nom, exercices } : s)),
      }))
    );
    if (!estConnecte || String(programme.id).startsWith('local-')) return;
    try {
      if (nom !== programme.nom) await api.renommerProgramme(programme.id, nom);
      await api.changerExercicesProgramme(programme.id, exercices);
    } catch (err) {
      setErreur(err.message || "Modification gardée en local, l'envoi au serveur a échoué.");
    }
  }

  // Semaine type : ce jour redevient un jour de repos. Le programme n'est PAS
  // supprimé (il peut servir ailleurs / rester dans "Mes programmes") — on lui
  // retire seulement ce jour.
  async function viderJourSemaine(jour, programme) {
    const restants = (programme.jours || []).filter((j) => j !== jour);
    setProgrammes((liste) => liste.map((p) => (p.id === programme.id ? { ...p, jours: restants } : p)));
    setJourSemaineOuvert(null);
    if (!estConnecte || String(programme.id).startsWith('local-')) return;
    try {
      await api.changerJoursProgramme(programme.id, restants);
    } catch (err) {
      setErreur(err.message || "Changement gardé en local, l'envoi au serveur a échoué.");
    }
  }

  // Calendrier : pose un CYCLE COMPLET (modèle type PPL) à partir d'une date.
  // La date cliquée devient le « jour 1 » du cycle : toutes les séances du
  // modèle sont posées sur leurs jours respectifs, semaine après semaine.
  async function placerModeleAuPlanning(dateISO, modele, nbSemaines) {
    // 1. Chaque séance du modèle doit exister comme programme (réutilisée par
    //    NOM si déjà là, créée sinon — sans jours récurrents : la répétition
    //    vient ici des dates posées, pas de la semaine type).
    const programmesParNom = {};
    let listeProgrammes = [...programmes];
    for (const seance of modele.seances) {
      let prog = listeProgrammes.find((p) => p.nom === seance.nom);
      if (!prog) {
        prog = {
          id: `local-${Date.now()}-${seance.nom}`, nom: seance.nom,
          exercices: seance.exercices, jours: [], duree_semaines: null,
          date_debut: null, cree_le: new Date().toISOString(),
        };
        listeProgrammes = [prog, ...listeProgrammes];
        if (estConnecte) {
          try {
            const cree = await api.creerProgramme(moi.id, seance.nom, seance.exercices, []);
            listeProgrammes = listeProgrammes.map((p) => (p.id === prog.id ? cree : p));
            prog = cree;
          } catch (err) {
            setErreur(err.message || "Programme gardé en local, l'envoi au serveur a échoué.");
          }
        }
      }
      programmesParNom[seance.nom] = prog;
    }
    setProgrammes(listeProgrammes);

    // 2. Générer toutes les dates : la date cliquée = « lundi » du cycle.
    //
    // BUG CORRIGÉ (28/08/2026) : si les séances n'ont PLUS de jours — l'état
    // exact d'un cycle dont on vient de « sortir », et celui des cycles créés
    // par cette fonction — la boucle ne tournait pas une seule fois : aucune
    // date n'était posée et rien ne le signalait. On répartit maintenant ces
    // séances sur des jours CONSÉCUTIFS à partir de la date choisie, dans
    // leur ordre : poser un programme fait toujours quelque chose.
    const sansJours = modele.seances.every((seance) => (seance.jours || []).length === 0);
    const debut = new Date(`${dateISO}T12:00:00`);
    const elements = [];
    for (let semaine = 0; semaine < nbSemaines; semaine++) {
      modele.seances.forEach((seance, rang) => {
        const decalages = sansJours
          ? [rang]
          : (seance.jours || []).map((jour) => joursSemaine.indexOf(jour));
        for (const decalage of decalages) {
          const dateJs = new Date(debut);
          dateJs.setDate(dateJs.getDate() + decalage + semaine * 7);
          elements.push({ date: enISO(dateJs), programme: programmesParNom[seance.nom] });
        }
      });
    }
    if (elements.length === 0) {
      setErreur("Ce programme n'a aucune séance à placer.");
      return;
    }

    // 3. Mise à jour locale immédiate (sans doublons), puis envoi GROUPÉ.
    const nouveaux = elements
      .filter((el) => !planning.some((pl) => pl.date === el.date && pl.programme_id === el.programme.id))
      .map((el, i) => ({ id: `local-${Date.now()}-${i}`, date: el.date, programme_id: el.programme.id }));
    setPlanning((l) => [...l, ...nouveaux]);
    setChoixProgrammeOuvert(false);
    setModeleAPlacer(null);
    setJourOuvert(dateISO);   // on reste sur le jour posé, pour voir le résultat

    if (!estConnecte) return;
    const envoyables = nouveaux.filter((pl) => !String(pl.programme_id).startsWith('local-'));
    if (envoyables.length === 0) return;
    try {
      await api.planifierLot(moi.id, envoyables.map((pl) => ({ date: pl.date, programme_id: pl.programme_id })));
      // Recharge le planning du serveur : remplace les entrées locales par les vraies.
      setPlanning(await api.planningDuJoueur(moi.id));
    } catch (err) {
      setErreur(err.message || "Cycle gardé en local, l'envoi au serveur a échoué.");
    }
  }

  // Calendrier : pose un programme sur une date précise.
  async function placerAuPlanning(dateISO, programme) {
    if (planning.some((pl) => pl.date === dateISO && pl.programme_id === programme.id)) {
      setChoixProgrammeOuvert(false);
      return; // déjà planifié ce jour-là
    }
    const local = { id: `local-${Date.now()}`, date: dateISO, programme_id: programme.id };
    setPlanning((l) => [...l, local]);
    setChoixProgrammeOuvert(false);
    if (!estConnecte || String(programme.id).startsWith('local-')) return;
    try {
      const cree = await api.planifierJour(moi.id, dateISO, programme.id);
      setPlanning((l) => l.map((pl) => (pl.id === local.id ? cree : pl)));
    } catch (err) {
      setErreur(err.message || "Planification gardée en local, l'envoi au serveur a échoué.");
    }
  }

  // ⚠️ QUAND LE SERVEUR REFUSE UNE SUPPRESSION (correctif du 04/09/2026) :
  // ces trois fonctions retiraient l'élément à l'écran puis AVALAIENT l'erreur
  // réseau (« pas grave, supprimé localement »). L'élément revenait donc tout
  // seul au prochain chargement, sans la moindre explication — l'app et le
  // serveur divergeaient en silence.
  // On fait maintenant deux choses : on le DIT, et on RESYNCHRONISE tout de
  // suite (`chargerTout`) pour que l'écran remontre la vérité du serveur
  // immédiatement, plutôt qu'au prochain passage sur l'onglet.
  async function retirerDuPlanning(planif) {
    setPlanning((l) => l.filter((pl) => pl.id !== planif.id));
    if (!estConnecte || String(planif.id).startsWith('local-')) return;
    try {
      await api.deplanifierJour(planif.id);
    } catch (err) {
      setErreur(
        err.message
        || "Le serveur n'a pas pu retirer cette date — elle est toujours là."
      );
      await chargerTout();
    }
  }

  function changerMois(direction) {
    setJourOuvert(null);
    setChoixProgrammeOuvert(false);
    setMoisAffiche(({ annee, mois }) => {
      const date = new Date(annee, mois + direction, 1);
      return { annee: date.getFullYear(), mois: date.getMonth() };
    });
  }

  // ----- Créer un PROGRAMME COMPLET (cycle sur la semaine) -----
  // Jours OBLIGATOIRES : chaque jour coché reçoit sa propre séance (nom +
  // exercices). Poser ce programme dans le calendrier remplira ensuite tous
  // ces jours automatiquement.
  function basculerJour(jour) {
    setJoursChoisis((l) => {
      if (l.includes(jour)) {
        setJourEnEdition((actuel) => (actuel === jour ? null : actuel));
        return l.filter((j) => j !== jour);
      }
      // Premier clic sur un jour : on prépare sa séance et on l'ouvre.
      setSeancesParJour((s) =>
        s[jour] ? s : { ...s, [jour]: { nom: '', lignes: [{ exercice: '', seriesCibles: '3', repsCibles: '10' }] } }
      );
      setJourEnEdition(jour);
      return [...l, jour];
    });
  }

  function majSeanceJour(jour, modif) {
    setSeancesParJour((s) => ({ ...s, [jour]: { ...s[jour], ...modif } }));
  }

  function modifierLigneJour(jour, index, champ, valeur) {
    setSeancesParJour((s) => ({
      ...s,
      [jour]: {
        ...s[jour],
        lignes: s[jour].lignes.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)),
      },
    }));
  }

  function ajouterLigneJour(jour) {
    setSeancesParJour((s) => ({
      ...s,
      [jour]: { ...s[jour], lignes: [...s[jour].lignes, { exercice: '', seriesCibles: '3', repsCibles: '10' }] },
    }));
  }

  function retirerLigneJour(jour, index) {
    setSeancesParJour((s) => ({
      ...s,
      [jour]: { ...s[jour], lignes: s[jour].lignes.filter((_, i) => i !== index) },
    }));
  }

  function reinitialiserFormulaireProgramme() {
    setNomProgramme('');
    setJoursChoisis([]);
    setSeancesParJour({});
    setJourEnEdition(null);
  }

  async function enregistrerProgramme() {
    setErreur(null);
    const nom = nomProgramme.trim();
    if (!nom) { setErreur('Donne un nom à ton programme.'); return; }
    if (joursChoisis.length === 0) {
      setErreur('Choisis au moins un jour de la semaine pour ce programme.');
      return;
    }
    // Les jours sont remis dans l'ordre de la semaine (peu importe l'ordre des clics).
    const joursOrdonnes = joursSemaine.filter((j) => joursChoisis.includes(j));
    const seances = [];
    for (const jour of joursOrdonnes) {
      const brouillon = seancesParJour[jour] || { nom: '', lignes: [] };
      const exercices = brouillon.lignes
        .filter((l) => l.exercice.trim())
        .map((l) => ({
          exercice: l.exercice.trim(),
          series_cibles: parseInt(l.seriesCibles, 10) || 1,
          reps_cibles: parseInt(l.repsCibles, 10) || 1,
        }));
      if (exercices.length === 0) {
        setErreur(`Ajoute au moins un exercice pour le ${jour}.`);
        setJourEnEdition(jour);
        return;
      }
      seances.push({ jours: [jour], nom: brouillon.nom.trim() || `${nom} — ${jour}`, exercices });
    }

    // Affichage immédiat (marche hors-ligne), puis envoi au serveur.
    const cycleLocal = {
      id: `local-${Date.now()}`, nom,
      seances: seances.map((s, i) => ({
        id: `local-${Date.now()}-${i}`, nom: s.nom, jours: s.jours,
        exercices: s.exercices, duree_semaines: null, date_debut: null,
      })),
    };
    setCycles((c) => [cycleLocal, ...c]);
    setProgrammes((p) => [...cycleLocal.seances, ...p]);
    reinitialiserFormulaireProgramme();
    setVue('accueil');

    if (!estConnecte) return;
    try {
      const cree = await api.creerCycle(moi.id, nom, seances);
      setCycles((c) => c.map((cy) => (cy.id === cycleLocal.id ? cree : cy)));
      setProgrammes(await api.programmesDuJoueur(moi.id));
    } catch (err) {
      setErreur(err.message || "Programme gardé en local, l'envoi au serveur a échoué.");
    }
  }

  // SORTIR D'UN PROGRAMME (27/08/2026, demande de Hafiz) — sans le supprimer.
  // On lui retire ses jours récurrents ET ses dates posées au calendrier : il
  // ne pilote plus la semaine, donc `programmeEnService` retombe à faux et la
  // semaine type réapparaît. Le programme reste dans « Mes programmes »,
  // prêt à être reposé au calendrier plus tard.
  async function sortirDuProgramme(seances) {
    const ids = seances.map((s) => s.id);
    const datesARetirer = planning.filter((pl) => ids.includes(pl.programme_id));

    setProgrammes((liste) =>
      liste.map((p) => (ids.includes(p.id) ? { ...p, jours: [] } : p)));
    setCycles((liste) => liste.map((c) => ({
      ...c,
      seances: c.seances.map((s) => (ids.includes(s.id) ? { ...s, jours: [] } : s)),
    })));
    setPlanning((liste) => liste.filter((pl) => !ids.includes(pl.programme_id)));
    setSeanceDeroulee(null);
    setProgrammeEnEdition(null);

    if (!estConnecte) return;
    try {
      for (const seance of seances) {
        if (!String(seance.id).startsWith('local-')) {
          await api.changerJoursProgramme(seance.id, []);
        }
      }
      for (const planif of datesARetirer) {
        if (!String(planif.id).startsWith('local-')) {
          await api.deplanifierJour(planif.id);
        }
      }
    } catch (err) {
      setErreur(err.message || "Sortie gardée en local, l'envoi au serveur a échoué.");
    }
  }

  // La croix n'efface plus rien toute seule : elle pose la question.
  function demanderSuppression(cle) {
    setProgrammeEnEdition(null);   // pas de question posée sous un éditeur ouvert
    setSuppressionAConfirmer((actuelle) => (actuelle === cle ? null : cle));
  }

  // Avertissement affiché dans l'éditeur : une séance est le MÊME objet partout
  // où elle est prévue, donc la retoucher change tous ses jours et toutes ses
  // dates posées.
  function noteReutilisation(programme) {
    const dates = planning.filter((pl) => pl.programme_id === programme.id).length;
    const jours = (programme.jours || []).length;
    if (dates === 0 && jours <= 1) return null;
    const morceaux = [];
    if (jours > 1) morceaux.push(`${jours} jours de la semaine`);
    if (dates > 0) morceaux.push(`${dates} date${dates > 1 ? 's' : ''} du calendrier`);
    return `⚠️ Cette séance est utilisée sur ${morceaux.join(' et ')} : tes modifications s'y appliqueront partout.`;
  }

  async function supprimerCycle(cycle) {
    const idsSeances = cycle.seances.map((s) => s.id);
    setCycles((c) => c.filter((cy) => cy.id !== cycle.id));
    setProgrammes((p) => p.filter((prog) => !idsSeances.includes(prog.id)));
    if (!estConnecte || String(cycle.id).startsWith('local-')) return;
    try {
      await api.supprimerCycle(cycle.id);
    } catch (err) {
      setErreur(
        err.message
        || `Le serveur n'a pas pu supprimer « ${cycle.nom} » — le programme est toujours là.`
      );
      await chargerTout();
    }
  }

  // Applique un MODÈLE STANDARD : l'ajoute comme un PROGRAMME COMPLET à moi
  // (même chose qu'un programme créé à la main, mais pré-rempli) — ensuite
  // modifiable jour par jour dans la semaine type, et posable au calendrier.
  async function appliquerModele(modele) {
    setErreur(null);
    setModeleEnCours(modele.id);
    const cycleLocal = {
      id: `local-${Date.now()}`, nom: modele.nom,
      seances: modele.seances.map((s, i) => ({
        id: `local-${Date.now()}-${i}`, nom: s.nom, jours: s.jours,
        exercices: s.exercices, duree_semaines: null, date_debut: null,
      })),
    };
    setCycles((c) => [cycleLocal, ...c]);
    setProgrammes((p) => [...cycleLocal.seances, ...p]);
    if (estConnecte) {
      try {
        const cree = await api.creerCycle(moi.id, modele.nom, modele.seances);
        setCycles((c) => c.map((cy) => (cy.id === cycleLocal.id ? cree : cy)));
        setProgrammes(await api.programmesDuJoueur(moi.id));
      } catch (err) {
        setErreur(err.message || "Programme gardé en local, l'envoi au serveur a échoué.");
      }
    }
    setModeleEnCours(null);
    setModelesOuverts(false);
  }

  // ----- Rappel d'entraînement (notifications locales) -----
  function basculerJourRappel(jour) {
    setRappelJours((l) => (l.includes(jour) ? l.filter((j) => j !== jour) : [...l, jour]));
  }

  async function activerRappel() {
    setRappelMessage(null);
    const correspondance = rappelHeure.trim().match(/^(\d{1,2})[:hH](\d{2})$/);
    if (!correspondance) {
      setRappelMessage({ texte: "Heure invalide — utilise le format 18:00 (ou 18h00).", erreur: true });
      return;
    }
    const heure = parseInt(correspondance[1], 10);
    const minute = parseInt(correspondance[2], 10);
    if (heure > 23 || minute > 59) {
      setRappelMessage({ texte: 'Heure invalide (0-23 h, 0-59 min).', erreur: true });
      return;
    }
    if (rappelJours.length === 0) {
      setRappelMessage({ texte: 'Choisis au moins un jour de rappel.', erreur: true });
      return;
    }
    const accorde = await notifications.demanderPermission();
    if (!accorde) {
      setRappelMessage({
        texte: "Notifications refusées — autorise-les dans les réglages du téléphone.",
        erreur: true,
      });
      return;
    }
    await notifications.programmerRappels(rappelJours, heure, minute);
    setRappelActif(true);
    await AsyncStorage.setItem('fitnessRoyale.rappel', JSON.stringify({
      jours: rappelJours, heure: rappelHeure.trim(), actif: true,
    }));
    setRappelMessage({ texte: `✅ Rappel activé : ${rappelJours.join(', ')} à ${rappelHeure.trim()}.`, erreur: false });
  }

  async function desactiverRappel() {
    await notifications.annulerRappels();
    setRappelActif(false);
    await AsyncStorage.setItem('fitnessRoyale.rappel', JSON.stringify({
      jours: rappelJours, heure: rappelHeure.trim(), actif: false,
    }));
    setRappelMessage({ texte: 'Rappel désactivé.', erreur: false });
  }

  async function supprimerProgramme(programme) {
    setProgrammes((p) => p.filter((prog) => prog.id !== programme.id));
    if (!estConnecte || String(programme.id).startsWith('local-')) return;
    try {
      await api.supprimerProgramme(programme.id);
    } catch (err) {
      setErreur(
        err.message
        || `Le serveur n'a pas pu supprimer « ${programme.nom} » — la séance est toujours là.`
      );
      await chargerTout();
    }
  }

  // ----- Programmes officiels -----

  // L'admin publie UN DE SES PROPRES CYCLES pour tous les joueurs.
  // DÉCISION : pas de formulaire séparé pour ça. L'admin construit un
  // programme normalement (il connaît déjà cet écran), puis le publie d'un
  // bouton — c'est un programme ordinaire jusqu'à ce qu'il soit publié.
  async function publierCycle(cycle) {
    setMessageOfficiel(null);
    setPublicationEnCours(cycle.id);
    try {
      const seances = cycle.seances.map((s) => ({
        nom: s.nom,
        jours: s.jours || [],
        exercices: s.exercices.map((e) => ({
          exercice: e.exercice,
          series_cibles: e.series_cibles,
          reps_cibles: e.reps_cibles,
        })),
      }));
      const cree = await api.publierProgrammeOfficiel(
        cycle.nom, `Programme partagé — ${cycle.nom}`, seances
      );
      setProgrammesOfficiels(await api.mesProgrammesPartages());
      setMessageOfficiel({
        texte: `« ${cycle.nom} » est partagé. Code à donner : ${cree.code}`,
        erreur: false,
      });
    } catch (err) {
      setMessageOfficiel({ texte: err.message || 'Publication impossible.', erreur: true });
    } finally {
      setPublicationEnCours(null);
    }
  }

  async function retirerOfficiel(officiel) {
    setMessageOfficiel(null);
    try {
      await api.retirerProgrammeOfficiel(officiel.id);
      setProgrammesOfficiels((liste) => liste.filter((o) => o.id !== officiel.id));
    } catch (err) {
      setMessageOfficiel({ texte: err.message || 'Retrait impossible.', erreur: true });
    }
  }

  // Récupérer un programme à partir d'un code reçu. On l'AFFICHE d'abord :
  // on ne copie rien tant que la personne n'a pas vu ce qu'elle récupère.
  async function chercherParCode() {
    const code = codeSaisi.trim();
    if (!code) return;
    setErreurCode(null);
    setProgrammeTrouve(null);
    setRechercheCode(true);
    try {
      const trouve = await api.programmeParCode(code);
      setProgrammeTrouve(trouve);
    } catch (err) {
      setErreurCode(err.message || "Aucun programme ne correspond à ce code.");
    } finally {
      setRechercheCode(false);
    }
  }

  // RENOMMER UN EXERCICE DEPUIS SES RECORDS (04/09/2026, point 5 de l'audit).
  // Le renommage n'était atteignable que depuis l'éditeur d'un programme :
  // un exercice qui ne vit PLUS que dans l'historique — parce qu'il a été
  // retiré du programme, ou parce que son nom a été mal tapé une fois — était
  // donc impossible à corriger. Il restait à jamais dans « Mes records » et
  // dans le comptage de séries, sous son nom fautif.
  async function renommerDepuisRecord(ancien) {
    const nouveau = nomRecordSaisi.trim();
    if (!nouveau || nouveau === ancien) {
      setRecordARenommer(null);
      return;
    }
    if (!estConnecte) {
      setErreur('Renommage impossible hors-ligne : reconnecte-toi.');
      return;
    }
    setRenommageEnCours(true);
    try {
      await api.renommerExercicePartout(moi.id, ancien, nouveau);
      setRecordARenommer(null);
      setNomRecordSaisi('');
      await chargerTout();
    } catch (err) {
      setErreur(err.message || 'Renommage impossible.');
    } finally {
      setRenommageEnCours(false);
    }
  }

  // Applique les renommages en attente PARTOUT, puis recharge tout : les
  // records, la suggestion de charge et le comptage de séries se calculent
  // depuis l'historique, ils doivent repartir des nouveaux noms.
  async function appliquerRenommages() {
    if (!estConnecte) {
      setErreur('Renommage partout impossible hors-ligne : reconnecte-toi.');
      setRenommages([]);
      return;
    }
    setRenommageEnCours(true);
    try {
      for (const { ancien, nouveau } of renommages) {
        await api.renommerExercicePartout(moi.id, ancien, nouveau);
      }
      setRenommages([]);
      await chargerTout();
    } catch (err) {
      setErreur(err.message || 'Renommage impossible.');
    } finally {
      setRenommageEnCours(false);
    }
  }

  // ----- Logger une séance -----
  function demarrerSeance(programme) {
    setProgrammeActif(programme);
    setExercicesSession(programme ? programme.exercices.map((e) => e.exercice) : []);
    setSeriesLoggees({});
    setChampsSaisie({});
    setNouvelExerciceLibre('');
    setErreur(null);
    setVue('seance');
  }

  function ajouterExerciceLibre() {
    const nom = nouvelExerciceLibre.trim();
    if (!nom || exercicesSession.includes(nom)) return;
    setExercicesSession((l) => [...l, nom]);
    setNouvelExerciceLibre('');
  }

  function majChampSaisie(exercice, champ, valeur) {
    setChampsSaisie((c) => ({ ...c, [exercice]: { ...c[exercice], [champ]: valeur } }));
  }

  function ajouterSerie(exercice) {
    const saisie = champsSaisie[exercice] || {};
    const reps = parseInt(saisie.reps, 10);
    const poids = parseFloat((saisie.poids || '').replace(',', '.'));
    if (isNaN(reps) || reps <= 0 || isNaN(poids) || poids < 0) {
      setErreur('Entre des reps et un poids valides.');
      return;
    }
    setErreur(null);
    setSeriesLoggees((s) => {
      const existantes = s[exercice] || [];
      return {
        ...s,
        [exercice]: [...existantes, { numero_serie: existantes.length + 1, reps, poids }],
      };
    });
    // ON GARDE LA SAISIE au lieu de vider les champs (demande de Hafiz du
    // 02/09/2026) : les séries d'un même exercice se font presque toujours à
    // la même charge et au même nombre de reps. Il n'y a donc plus qu'à
    // toucher « + Série », et à corriger un champ seulement quand ça change.
    setChampsSaisie((c) => ({
      ...c, [exercice]: { reps: String(reps), poids: String(poids) },
    }));
  }

  // MODIFIER / SUPPRIMER UNE SÉRIE DÉJÀ SAISIE pendant la séance (demande de
  // Hafiz du 04/09/2026). Jusqu'ici on ne pouvait qu'AJOUTER : une faute de
  // frappe obligeait à sortir de la séance en perdant tout.
  // Ces séries vivent dans `seriesLoggees` (état local) jusqu'à « Terminer »,
  // donc rien à envoyer au serveur ici — la séance part d'un bloc à la fin.
  function modifierSerie(exercice, index, champ, valeur) {
    setSeriesLoggees((tout) => {
      const series = [...(tout[exercice] || [])];
      if (!series[index]) return tout;
      series[index] = { ...series[index], [champ]: valeur };
      return { ...tout, [exercice]: series };
    });
  }

  // On renumérote après coup : sans ça, supprimer la série 2 laisserait
  // « Série 1, Série 3 » à l'écran ET dans ce qui part au serveur.
  function supprimerSerie(exercice, index) {
    setSerieEnEdition(null);
    setSeriesLoggees((tout) => {
      const restantes = (tout[exercice] || [])
        .filter((_, i) => i !== index)
        .map((serie, i) => ({ ...serie, numero_serie: i + 1 }));
      const copie = { ...tout };
      if (restantes.length === 0) delete copie[exercice];
      else copie[exercice] = restantes;
      return copie;
    });
  }

  // À la fermeture de l'édition, on remet des NOMBRES valides : les champs de
  // saisie manipulent du texte, et un champ vidé donnerait NaN au serveur.
  function fermerEditionSerie(exercice, index) {
    setSeriesLoggees((tout) => {
      const series = [...(tout[exercice] || [])];
      const serie = series[index];
      if (!serie) return tout;
      const reps = Math.max(1, parseInt(serie.reps, 10) || 1);
      const poids = Math.max(0, parseFloat(String(serie.poids).replace(',', '.')) || 0);
      series[index] = { ...serie, reps, poids };
      return { ...tout, [exercice]: series };
    });
    setSerieEnEdition(null);
  }

  async function terminerSeance() {
    const toutesLesSeries = Object.entries(seriesLoggees).flatMap(([exercice, series]) =>
      series.map((s) => ({ exercice, ...s }))
    );
    if (toutesLesSeries.length === 0) {
      setErreur('Ajoute au moins une série avant de terminer.');
      return;
    }
    setEnregistrementEnCours(true);
    const jour = aujourdhui();
    const local = {
      id: `local-${Date.now()}`,
      programme_id: programmeActif?.id ?? null,
      date: jour,
      series: toutesLesSeries,
    };
    setEntrainements((e) => [local, ...e]);

    // Lie la séance loggée au compteur hebdo du Profil (estimation simple :
    // ~3 min par série, 20 min minimum).
    const dureeEstimee = Math.max(20, toutesLesSeries.length * 3);
    ajouterSeanceLocale?.(dureeEstimee);

    if (estConnecte) {
      try {
        const programmeId = programmeActif && !String(programmeActif.id).startsWith('local-')
          ? programmeActif.id : null;
        const cree = await api.creerEntrainement(moi.id, programmeId, jour, toutesLesSeries);
        setEntrainements((e) => e.map((ent) => (ent.id === local.id ? cree : ent)));
      } catch (err) {
        setErreur(err.message || "Séance gardée en local, l'envoi au serveur a échoué.");
      }
    }
    // Le volume de la semaine vient de changer : on remet à jour le message du
    // rappel de suivi (sinon il annoncerait des chiffres périmés).
    rafraichirRappelSuivi([local, ...entrainements]);
    setEnregistrementEnCours(false);
    setVue('accueil');
  }

  // ---- Volume de la SEMAINE EN COURS (lundi → dimanche) ----
  // Calculé AVANT les vues : le rappel de suivi en a besoin même quand on est
  // dans l'écran de séance (il se reprogramme après chaque enregistrement).
  const lundi = lundiDeLaSemaine();
  const dimanche = new Date(lundi);
  dimanche.setDate(dimanche.getDate() + 6);
  const debutSemaineISO = enISO(lundi);
  const finSemaineISO = enISO(dimanche);
  const seriesFaites = compterSeriesParGroupe(
    entrainements, correctionsGroupes, debutSemaineISO, finSemaineISO
  );

  // ----- Rendu -----

  if (chargement) {
    return (
      <View style={[styles.conteneur, styles.centre]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // ---- Vue : détail d'une séance passée ----
  if (vue === 'historiqueDetail' && entrainementSelectionne) {
    // Regroupe les séries par exercice, dans l'ordre où elles ont été loggées.
    const parExercice = [];
    entrainementSelectionne.series.forEach((s) => {
      let groupe = parExercice.find((g) => g.exercice === s.exercice);
      if (!groupe) { groupe = { exercice: s.exercice, series: [] }; parExercice.push(groupe); }
      groupe.series.push(s);
    });
    return (
      <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
        <Text style={styles.titre}>📅 Séance du {entrainementSelectionne.date}</Text>
        {parExercice.map((groupe) => (
          <View key={groupe.exercice} style={styles.carteExercice}>
            <Text style={styles.nomExercice}>{groupe.exercice}</Text>
            {groupe.series.map((s, i) => (
              <Text key={i} style={styles.serieFaite}>
                Série {s.numero_serie} : {s.poids} kg × {s.reps} reps
              </Text>
            ))}
          </View>
        ))}
        <TouchableOpacity onPress={() => { setVue('accueil'); setEntrainementSelectionne(null); }}>
          <Text style={styles.lienAnnuler}>← Retour à l'historique</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---- Vue : nouveau programme ----
  if (vue === 'nouveauProgramme') {
    return (
      <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
        <Text style={styles.titre}>➕ Nouveau programme</Text>
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
                    <Text style={styles.contenuCalendrier}>
                      {nbExos === 0
                        ? '⚠️ à remplir'
                        : `${brouillon.nom.trim() || 'Sans nom'} · ${nbExos} exo${nbExos > 1 ? 's' : ''}`}
                    </Text>
                    <Text style={styles.flecheCalendrier}>{ouvert ? '▲' : '▼'}</Text>
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
                      {brouillon.lignes.map((ligne, i) => (
                        <View key={i} style={[styles.ligneExoForm, { marginTop: espacement.s }]}>
                          <TextInput
                            style={[styles.champ, { flex: 2 }]}
                            value={ligne.exercice}
                            onChangeText={(v) => modifierLigneJour(jour, i, 'exercice', v)}
                            placeholder="Nom de l'exercice"
                            placeholderTextColor={colors.texteGris}
                          />
                          <TextInput
                            style={[styles.champ, styles.champCourt]}
                            value={ligne.seriesCibles}
                            onChangeText={(v) => modifierLigneJour(jour, i, 'seriesCibles', v)}
                            keyboardType="numeric"
                            placeholder="Séries"
                            placeholderTextColor={colors.texteGris}
                          />
                          <TextInput
                            style={[styles.champ, styles.champCourt]}
                            value={ligne.repsCibles}
                            onChangeText={(v) => modifierLigneJour(jour, i, 'repsCibles', v)}
                            keyboardType="numeric"
                            placeholder="Reps"
                            placeholderTextColor={colors.texteGris}
                          />
                          {brouillon.lignes.length > 1 && (
                            <TouchableOpacity
                              onPress={() => retirerLigneJour(jour, i)}
                              style={styles.boutonRetirer}
                            >
                              <Text style={styles.boutonRetirerTexte}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                      <TouchableOpacity
                        style={styles.boutonSecondaire}
                        onPress={() => ajouterLigneJour(jour)}
                      >
                        <Text style={styles.boutonSecondaireTexte}>+ Ajouter un exercice</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {erreur && <Text style={styles.messageErreur}>⚠️ {erreur}</Text>}

        <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerProgramme}>
          <Text style={styles.boutonPrincipalTexte}>Enregistrer le programme</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { reinitialiserFormulaireProgramme(); setVue('accueil'); }}>
          <Text style={styles.lienAnnuler}>Annuler</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---- Vue : logger une séance ----
  if (vue === 'seance') {
    const jour = aujourdhui();
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
        <Text style={styles.titre}>
          💪 {programmeActif ? programmeActif.nom : 'Séance libre'}
        </Text>
        <Text style={styles.sousTitre}>{jour}</Text>

        {exercicesSession.map((exercice) => {
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
          const suggestion = suggererProchaineSerie(entrainements, exercice, cibleExo?.reps_cibles);
          const record = recordPersonnel(entrainements, exercice);
          const nouveauRecord = bat_le_record(seriesFaites, record);
          const stagnation = detecterStagnation(entrainements, exercice, 3);
          return (
            <View key={exercice} style={styles.carteExercice}>
              <Text style={styles.nomExercice}>{exercice}</Text>
              <Text style={styles.indiceDerniere}>
                {dernieres
                  ? `Dernière fois (${dernieres.date}) : ${dernieres.series
                      .map((s) => `${s.poids}kg×${s.reps}`)
                      .join(', ')}`
                  : 'Première fois sur cet exercice'}
                {indicateur && (
                  <Text style={{ color: indicateur.couleur, fontWeight: '800' }}> {indicateur.symbole}</Text>
                )}
              </Text>

              {/* Quoi tenter aujourd'hui pour progresser */}
              {suggestion && (
                <Text style={styles.suggestion}>
                  🎯 Aujourd'hui : {suggestion.poids > 0 ? `${suggestion.poids} kg × ` : ''}
                  {suggestion.reps} reps
                  <Text style={styles.raisonSuggestion}> — {suggestion.raison}</Text>
                </Text>
              )}

              {/* Record personnel + badge quand il tombe en direct */}
              {record && (
                <Text style={nouveauRecord ? styles.recordBattu : styles.record}>
                  {nouveauRecord
                    ? `🏆 NOUVEAU RECORD ! (ancien : ${record.poids} kg × ${record.reps})`
                    : `🏆 Record : ${record.poids} kg × ${record.reps} (${record.date})`}
                </Text>
              )}
              {!record && nouveauRecord && (
                <Text style={styles.recordBattu}>🏆 Premier record sur cet exercice !</Text>
              )}

              {/* Alerte stagnation */}
              {stagnation && (
                <Text style={styles.stagnation}>
                  ⚠️ Bloqué à {stagnation.poids} kg depuis {stagnation.seances} séances — change
                  quelque chose (charge, reps, ou varie l'exercice).
                </Text>
              )}

              {/* Toucher une série l'ouvre en modification (04/09/2026). */}
              {seriesFaites.map((s, i) => {
                const cle = `${exercice}#${i}`;
                const enEdition = serieEnEdition === cle;
                if (!enEdition) {
                  return (
                    <TouchableOpacity key={i} onPress={() => setSerieEnEdition(cle)}>
                      <Text style={styles.serieFaite}>
                        Série {s.numero_serie} : {s.poids} kg × {s.reps} reps
                        <Text style={styles.indiceModifier}>  ✏️</Text>
                      </Text>
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
                      <Text style={styles.boutonRetirerTexte}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              <View style={styles.ligneAjoutSerie}>
                <TextInput
                  style={[styles.champ, styles.champCourt]}
                  value={saisie.reps || ''}
                  onChangeText={(v) => majChampSaisie(exercice, 'reps', v)}
                  keyboardType="numeric"
                  placeholder="Reps"
                  placeholderTextColor={colors.texteGris}
                />
                <TextInput
                  style={[styles.champ, styles.champCourt]}
                  value={saisie.poids || ''}
                  onChangeText={(v) => majChampSaisie(exercice, 'poids', v)}
                  keyboardType="numeric"
                  placeholder="Kg"
                  placeholderTextColor={colors.texteGris}
                />
                <TouchableOpacity style={styles.boutonAjouterSerie} onPress={() => ajouterSerie(exercice)}>
                  <Text style={styles.boutonAjouterSerieTexte}>+ Série</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {!programmeActif && (
          <View style={styles.ligneAjoutSerie}>
            <TextInput
              style={[styles.champ, { flex: 1 }]}
              value={nouvelExerciceLibre}
              onChangeText={setNouvelExerciceLibre}
              placeholder="Ajouter un exercice…"
              placeholderTextColor={colors.texteGris}
            />
            <TouchableOpacity style={styles.boutonAjouterSerie} onPress={ajouterExerciceLibre}>
              <Text style={styles.boutonAjouterSerieTexte}>+ Exo</Text>
            </TouchableOpacity>
          </View>
        )}

        {erreur && <Text style={styles.messageErreur}>⚠️ {erreur}</Text>}

        <TouchableOpacity style={styles.boutonPrincipal} onPress={terminerSeance} disabled={enregistrementEnCours}>
          {enregistrementEnCours ? <ActivityIndicator color={colors.texte} /> : (
            <Text style={styles.boutonPrincipalTexte}>✅ Terminer la séance</Text>
          )}
        </TouchableOpacity>
        {/* Sortir SANS enregistrer. C'était un lien gris discret (« Abandonner »)
            que Hafiz n'a pas trouvé — c'est maintenant un vrai bouton. */}
        <TouchableOpacity style={styles.boutonSortir} onPress={() => setVue('accueil')}>
          <Text style={styles.boutonSortirTexte}>🚪 Sortir du programme (sans enregistrer)</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---- Vue : accueil ----
  // Les séances appartenant à un cycle sont affichées DANS leur cycle ;
  // ici on ne liste que les séances isolées (créées depuis la semaine type).
  const idsSeancesDeCycles = cycles.flatMap((c) => c.seances.map((s) => s.id));
  const programmesSeuls = programmes.filter((p) => !idsSeancesDeCycles.includes(p.id));
  const exercicesSemaine = exercicesDeLaPeriode(
    entrainements, correctionsGroupes, debutSemaineISO, finSemaineISO
  );
  // Les groupes à afficher : ceux avec un objectif + ceux déjà travaillés.
  const nbNonClasses = exercicesSemaine.filter((e) => !e.groupe).length;
  const groupesSuivis = groupesMusculaires.filter(
    (g) => objectifsSeries[g] || seriesFaites[g]
  );
  // Le compteur de la semaine (28/08/2026, demande de Hafiz) : combien de
  // séries au total, sur combien de séances, comptées depuis les séances
  // RÉELLEMENT faites. Affiché sans rien déplier — c'est le chiffre qu'on
  // vient chercher en premier.
  const totalSeriesSemaine = groupesMusculaires.reduce(
    (total, g) => total + (seriesFaites[g] || 0), 0
  );
  const seancesDeLaSemaine = entrainements.filter(
    (e) => e.date >= debutSemaineISO && e.date <= finSemaineISO
  ).length;

  // Records personnels, tous exercices confondus (section « 🏆 Mes records »).
  const mesRecords = tousLesRecords(entrainements);

  // UN PROGRAMME EST-IL EN SERVICE ? (27/08/2026, demande de Hafiz : « si un
  // programme est enregistré et utilisé, la semaine type disparaît »)
  // « Enregistré ET utilisé » = il occupe vraiment des jours — soit un cycle
  // complet, soit une séance qui se répète chaque semaine, soit des dates
  // posées au calendrier. Tant que rien de tout ça n'existe, la semaine type
  // reste le moyen le plus simple d'écrire sa semaine ; dès qu'un programme
  // prend le relais, elle ferait doublon (et deux éditeurs de la même séance
  // qui se marchent dessus).
  // BUG CORRIGE (28/08/2026) : on testait `cycles.length > 0`, or « Sortir du
  // programme » ne SUPPRIME pas le cycle -- il lui retire seulement ses jours
  // et ses dates. La condition restait donc vraie pour toujours et la semaine
  // type ne revenait jamais. On demande maintenant qu'un cycle occupe
  // reellement la semaine (`cycleEnService`).
  const programmeEnService =
    cycles.some(cycleEnService)
    || planning.length > 0
    || programmes.some((p) => (p.jours || []).length > 0);

  // Ce programme occupe-t-il vraiment la semaine ? (sinon « Sortir » n'a rien
  // à libérer, on ne montre pas le bouton)
  function cycleEnService(cycle) {
    return cycle.seances.some(
      (seance) => (seance.jours || []).length > 0
        || planning.some((pl) => pl.programme_id === seance.id)
    );
  }

  // Un programme PARTAGÉ, ramené à la forme d'un modèle standard : c'est
  // exactement la même structure, donc il s'affiche et se copie avec le même
  // code, sans conversion (`appliquerModele`).
  function enModele(o) {
    return {
      id: `partage-${o.id}`,
      officielId: o.id,
      nom: o.nom,
      emoji: '⭐',
      description: o.description || 'Programme partagé.',
      seances: o.seances || [],
    };
  }

  // Ce qu'on peut poser dans le calendrier comme CYCLE : mes programmes
  // complets + les modèles standards, ramenés à la même forme.
  const cyclesPlacables = [
    ...cycles.map((c) => ({
      id: `mien-${c.id}`, nom: c.nom, emoji: '📋',
      seances: c.seances.map((s) => ({
        nom: s.nom, jours: s.jours || [], exercices: s.exercices,
      })),
    })),
    ...programmesStandards,
  ];

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ padding: espacement.m }}>
      <Text style={styles.titre}>💪 Entraînement</Text>
      <Text style={styles.sousTitre}>
        Tes programmes et ton journal de séance — indépendant des paliers Fitness Royale.
      </Text>
      {!estConnecte && (
        <Text style={styles.indiceHorsLigne}>
          📡 Mode hors-ligne : tes programmes et séances restent sur ce téléphone tant que tu n'es pas connecté.
        </Text>
      )}

      {/* ---- Volume : séries par groupe musculaire, semaine en cours ---- */}
      <TouchableOpacity onPress={() => setVolumeOuvert(!volumeOuvert)}>
        <Text style={styles.sectionTitre}>
          🎯 Séries par groupe musculaire {volumeOuvert ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.totalSeries}>
        {totalSeriesSemaine} série{totalSeriesSemaine > 1 ? 's' : ''} cette semaine
        {seancesDeLaSemaine > 0
          ? ` · ${seancesDeLaSemaine} séance${seancesDeLaSemaine > 1 ? 's' : ''}`
          : ' · aucune séance encore'}
      </Text>
      {/* Résumé visible SANS déplier : on doit voir où on en est d'un coup d'œil. */}
      {!volumeOuvert && nbNonClasses > 0 && (
        <Text style={styles.alerteNonClasses}>
          ❓ {nbNonClasses} exercice{nbNonClasses > 1 ? 's' : ''} n'{nbNonClasses > 1 ? 'ont' : 'a'} pas
          de groupe — leurs séries ne sont comptées nulle part. Déplie pour les classer.
        </Text>
      )}
      {!volumeOuvert && groupesSuivis.length > 0 && (
        <View style={styles.resumeVolume}>
          {groupesSuivis.map((groupe) => {
            const fait = seriesFaites[groupe] || 0;
            const cible = objectifsSeries[groupe] || 0;
            const atteint = cible > 0 && fait >= cible;
            return (
              <View
                key={groupe}
                style={[styles.pucheVolume, atteint && { borderColor: colors.vert }]}
              >
                <Text style={styles.pucheGroupe}>{groupe}</Text>
                <Text style={[styles.pucheCompte, atteint && { color: colors.vert }]}>
                  {fait}{cible > 0 ? `/${cible}` : ''}{atteint ? ' ✅' : ''}
                </Text>
              </View>
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
            return (
              <View key={groupe} style={styles.ligneVolume}>
                <Text style={styles.nomGroupe}>{groupe}</Text>
                <View style={styles.barreVolumeFond}>
                  <View
                    style={[
                      styles.barreVolumeRemplie,
                      { width: `${pourcent}%`, backgroundColor: atteint ? colors.vert : colors.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.compteurVolume, atteint && { color: colors.vert }]}>
                  {fait}{cible > 0 ? `/${cible}` : ''}{atteint ? ' ✅' : ''}
                </Text>
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
                <Text style={styles.boutonDemarrerTexte}>💾 Enregistrer mes objectifs</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditionObjectifs(false)}>
                <Text style={styles.lienAnnuler}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}

          {!editionObjectifs && (
            <TouchableOpacity style={styles.boutonSecondaire} onPress={ouvrirEditionObjectifs}>
              <Text style={styles.boutonSecondaireTexte}>🎯 Fixer mes objectifs</Text>
            </TouchableOpacity>
          )}

          {/* Rappel de SUIVI : le point hebdo sur le volume.
              Différent du rappel d'entraînement (qui, lui, dit d'aller
              s'entraîner). Caché sur web comme l'autre. */}
          {!editionObjectifs && Platform.OS !== 'web' && (
            <View style={styles.blocRappelSuivi}>
              <Text style={styles.libelleRappelSuivi}>🔔 Point hebdo sur mes séries</Text>
              <Text style={styles.indice}>
                Une notification chaque semaine avec ton avancement — pour ne pas
                découvrir le dimanche soir qu'il te manque 8 séries de dos.
              </Text>
              <View style={[styles.lignePuces, { marginTop: espacement.s }]}>
                {joursSemaine.map((jour) => (
                  <TouchableOpacity
                    key={jour}
                    style={[styles.puceJour, suiviJour === jour && styles.puceJourActive]}
                    onPress={() => setSuiviJour(jour)}
                  >
                    <Text style={[styles.puceJourTexte, suiviJour === jour && styles.puceJourTexteActif]}>
                      {abreviationsJours[jour]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.ligneAjoutSerie, { marginTop: espacement.s }]}>
                <TextInput
                  style={[styles.champ, { width: 90 }]}
                  value={suiviHeure}
                  onChangeText={setSuiviHeure}
                  placeholder="19:00"
                  placeholderTextColor={colors.texteGris}
                />
                <TouchableOpacity style={styles.boutonAjouterSerie} onPress={activerRappelSuivi}>
                  <Text style={styles.boutonAjouterSerieTexte}>
                    {suiviActif ? 'Mettre à jour' : 'Activer'}
                  </Text>
                </TouchableOpacity>
                {suiviActif && (
                  <TouchableOpacity style={styles.boutonRetirer} onPress={desactiverRappelSuivi}>
                    <Text style={styles.boutonRetirerTexte}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {suiviMessage && (
                <Text style={[styles.messageRappel, suiviMessage.erreur && { color: colors.rouge }]}>
                  {suiviMessage.texte}
                </Text>
              )}
            </View>
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
              <Text style={[styles.indice, { marginTop: espacement.s }]}>
                🏷 Où comptent mes exercices ? Touche-en un pour le changer de groupe.
              </Text>
              {exercicesSemaine.map(({ exercice, groupe, corrige }) => (
                <View key={exercice}>
                  <TouchableOpacity
                    style={styles.ligneChoixProgramme}
                    onPress={() => setExerciceAClasser(exerciceAClasser === exercice ? null : exercice)}
                  >
                    <Text style={styles.choixProgrammeTexte}>
                      {exerciceAClasser === exercice ? '▲' : '▼'} {exercice}
                    </Text>
                    <Text style={[styles.groupeExercice, !groupe && { color: colors.rouge }]}>
                      {groupe ? `${groupe}${corrige ? ' ✏️' : ''}` : '❓ compté nulle part'}
                    </Text>
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

      {/* ---- Semaine type : écrire directement la séance de chaque jour.
           N'apparaît que TANT QU'AUCUN PROGRAMME N'EST EN SERVICE — après,
           c'est le programme qui pilote la semaine (voir programmeEnService). ---- */}
      {!programmeEnService && (
      <>
      <Text style={styles.sectionTitre}>🗓 Semaine type</Text>
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
              <Text style={styles.flecheCalendrier}>{ouvert ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {ouvert && (
              <EditeurSeance
                key={`jour-${jour}-${seanceDuJour ? seanceDuJour.id : 'vide'}`}
                programme={seanceDuJour}
                placeholderNom={`Ex. : Pecs / Biceps du ${jour}`}
                nomParDefaut={`Séance du ${jour}`}
                libelleBouton={`💾 Enregistrer la séance du ${jour}`}
                onSauvegarder={(nom, exercices) =>
                  sauvegarderSeanceJour(jour, seanceDuJour, nom, exercices)}
                onVider={seanceDuJour ? () => viderJourSemaine(jour, seanceDuJour) : null}
                libelleVider="🗑 Vider ce jour (jour de repos)"
              />
            )}
          </View>
        );
      })}

      </>
      )}

      {/* ---- Calendrier mensuel interactif : touche une DATE pour voir son
           programme, en ajouter un, ou démarrer la séance du jour. ---- */}
      <Text style={styles.sectionTitre}>📆 Calendrier</Text>
      {/* Largeur limitée : sans ça, les cases (1/7 de l'écran chacune)
          deviennent énormes sur un grand écran (retour de Hafiz). */}
      <View style={styles.blocCalendrier}>
      <View style={styles.enTeteMois}>
        <TouchableOpacity onPress={() => changerMois(-1)} style={styles.boutonMois}>
          <Text style={styles.flecheMois}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.titreMois}>
          {nomsMois[moisAffiche.mois]} {moisAffiche.annee}
        </Text>
        <TouchableOpacity onPress={() => changerMois(1)} style={styles.boutonMois}>
          <Text style={styles.flecheMois}>▶</Text>
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
            const estAujourdhui = dateISO === aujourdhui();
            const selectionne = jourOuvert === dateISO;
            return (
              <TouchableOpacity
                key={k}
                style={[
                  styles.caseJour,
                  estAujourdhui && styles.caseAujourdhui,
                  selectionne && styles.caseSelectionnee,
                ]}
                onPress={() => {
                  setJourOuvert(selectionne ? null : dateISO);
                  setChoixProgrammeOuvert(false);
                }}
              >
                <Text style={[styles.numeroJour, estAujourdhui && { color: colors.or, fontWeight: '800' }]}>
                  {dateJs.getDate()}
                </Text>
                <Text style={styles.marqueurJour}>{fait ? '✅' : prevu ? '•' : ''}</Text>
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
        return (
          <View style={styles.carteModele}>
            <Text style={styles.nomProgrammeTexte}>
              📌 {jourDeLaDate(dateJs).charAt(0).toUpperCase() + jourDeLaDate(dateJs).slice(1)}{' '}
              {dateJs.getDate()} {nomsMois[dateJs.getMonth()]}
            </Text>
            {blocs.length === 0 && (
              <Text style={[styles.indice, { marginTop: 4 }]}>Rien de prévu ce jour-là.</Text>
            )}
            {/* Le calendrier ne fait plus QUE montrer et DÉMARRER (27/08/2026,
                demande de Hafiz). Modifier une séance se fait désormais dans
                « Mes programmes » — une seule place pour éditer, au lieu de
                deux éditeurs identiques qui se marchaient dessus. */}
            {blocs.map(({ cle, programme, planif, etiquette }) => (
              <View key={cle} style={styles.detailJour}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.nomProgrammeTexte, { flex: 1 }]}>
                    {programme.nom} <Text style={styles.indice}>({etiquette})</Text>
                  </Text>
                  {planif && (
                    <TouchableOpacity onPress={() => retirerDuPlanning(planif)} style={styles.boutonRetirer}>
                      <Text style={styles.boutonRetirerTexte}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {programme.exercices.map((exo, i) => (
                  <LigneExercicePrevu key={i} exo={exo} entrainements={entrainements} />
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
                  <Text style={styles.boutonDemarrerTexte}>
                    🏋️ Démarrer cette séance{cestAujourdhui ? '' : ' maintenant'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            {!choixProgrammeOuvert ? (
              <TouchableOpacity
                style={styles.boutonSecondaire}
                onPress={() => { setChoixProgrammeOuvert(true); setModeleAPlacer(null); }}
              >
                <Text style={styles.boutonSecondaireTexte}>➕ Placer un programme ce jour</Text>
              </TouchableOpacity>
            ) : modeleAPlacer ? (
              // Un cycle a été choisi : demander sur combien de semaines l'étaler.
              <View style={styles.detailJour}>
                <Text style={styles.nomProgrammeTexte}>{modeleAPlacer.emoji} {modeleAPlacer.nom}</Text>
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
                  <Text style={styles.boutonDemarrerTexte}>✅ Placer le cycle</Text>
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
                  📋 Programme complet (remplit tous ses jours automatiquement) :
                </Text>
                {cyclesPlacables.map((modele) => (
                  <TouchableOpacity
                    key={modele.id}
                    style={styles.ligneChoixProgramme}
                    onPress={() => setModeleAPlacer(modele)}
                  >
                    <Text style={styles.choixProgrammeTexte}>{modele.emoji} {modele.nom}</Text>
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

      {/* Proposition de propager un renommage d'exercice (04/09/2026). */}
      {renommages.length > 0 && (
        <View style={styles.carteRenommage}>
          <Text style={styles.titreRenommage}>✏️ Exercice renommé</Text>
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
              {renommageEnCours ? <ActivityIndicator color={colors.texte} size="small" /> : (
                <Text style={styles.boutonDemarrerTexte}>Renommer partout</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonModifier} onPress={() => setRenommages([])}>
              <Text style={styles.boutonModifierTexte}>Seulement ici</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitre}>Mes programmes</Text>
      {cycles.length === 0 && programmesSeuls.length === 0 && (
        <Text style={styles.indice}>Aucun programme pour l'instant.</Text>
      )}

      {/* « Mes programmes » est l'endroit où l'on MODIFIE (27/08/2026, demande
          de Hafiz) : le calendrier, lui, ne fait que montrer et démarrer.
          D'où « ✏️ Modifier » ici à la place de « Démarrer ». */}
      {(cycles.length > 0 || programmesSeuls.length > 0) && (
        <Text style={styles.indice}>
          C'est ici qu'on retouche une séance. Pour la démarrer, touche son jour
          dans le calendrier.
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
          <Text style={styles.nomProgrammeTexte}>📋 {cycle.nom}</Text>
          <View style={styles.ligneActionsProgramme}>
            <TouchableOpacity
              style={styles.boutonModifier}
              onPress={() => basculerDetailCycle(cycle.id)}
            >
              <Text style={styles.boutonModifierTexte}>
                {detailOuvert ? '▲ Masquer le détail' : '▼ Voir le détail'}
              </Text>
            </TouchableOpacity>
            {/* Publier : réservé à l'admin (le serveur renvoie 403 sinon).
                C'est ainsi qu'on alimente le catalogue — pas de formulaire
                séparé, l'admin construit un programme normalement puis le
                publie. */}
            {moi.admin && (
              <TouchableOpacity
                style={styles.boutonPublier}
                onPress={() => publierCycle(cycle)}
                disabled={publicationEnCours !== null}
              >
                {publicationEnCours === cycle.id ? (
                  <ActivityIndicator color={colors.rouge} size="small" />
                ) : (
                  <Text style={styles.boutonPublierTexte}>🔑 Partager par code</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => demanderSuppression('cycle-' + cycle.id)}
              style={styles.boutonRetirer}
            >
              <Text style={styles.boutonRetirerTexte}>✕</Text>
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
                    <Text style={styles.contenuCalendrier}>
                      {deroulee ? '▲' : '▼'} {seance.nom} · {seance.exercices.length} exo{seance.exercices.length > 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.boutonModifier}
                    onPress={() => setProgrammeEnEdition(enEdition ? null : seance.id)}
                  >
                    <Text style={styles.boutonModifierTexte}>{enEdition ? 'Fermer' : '✏️ Modifier'}</Text>
                  </TouchableOpacity>
                </View>
                {deroulee && !enEdition && (
                  <View style={styles.detailJour}>
                    {seance.exercices.length === 0 ? (
                      <Text style={styles.indice}>Aucun exercice dans cette séance.</Text>
                    ) : seance.exercices.map((exo, i) => (
                      <LigneExercicePrevu key={i} exo={exo} entrainements={entrainements} />
                    ))}
                  </View>
                )}
                {enEdition && (
                  <EditeurSeance
                    key={`edition-${seance.id}`}
                    programme={seance}
                    placeholderNom="Nom de la séance"
                    nomParDefaut={seance.nom}
                    libelleBouton="💾 Enregistrer les modifications"
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
          {cycleEnService(cycle) && (
            <>
              <TouchableOpacity
                style={styles.boutonSortir}
                onPress={() => demanderSuppression('sortie-cycle-' + cycle.id)}
              >
                <Text style={styles.boutonSortirTexte}>🚪 Sortir de ce programme</Text>
              </TouchableOpacity>
              <ConfirmationSuppression
                actif={suppressionAConfirmer === 'sortie-cycle-' + cycle.id}
                question={`Sortir de « ${cycle.nom} » ? Il libère la semaine et ses dates du calendrier, mais reste ici : tu pourras le reposer quand tu veux.`}
                libelleConfirmer="Oui, sortir"
                couleur={colors.accent}
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
            <TouchableOpacity onPress={() => setSeanceDeroulee(deroulee ? null : programme.id)}>
              <Text style={styles.nomProgrammeTexte}>
                {deroulee ? '▲' : '▼'} {programme.nom}
              </Text>
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
                <Text style={styles.boutonModifierTexte}>{enEdition ? 'Fermer' : '✏️ Modifier'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => demanderSuppression('prog-' + programme.id)}
                style={styles.boutonRetirer}
              >
                <Text style={styles.boutonRetirerTexte}>✕</Text>
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
                {programme.exercices.length === 0 ? (
                  <Text style={styles.indice}>Aucun exercice dans cette séance.</Text>
                ) : programme.exercices.map((exo, i) => (
                  <LigneExercicePrevu key={i} exo={exo} entrainements={entrainements} />
                ))}
              </View>
            )}
            {enEdition && (
              <EditeurSeance
                key={`edition-${programme.id}`}
                programme={programme}
                placeholderNom="Nom de la séance"
                nomParDefaut={programme.nom}
                libelleBouton="💾 Enregistrer les modifications"
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
                  <Text style={styles.boutonSortirTexte}>🚪 Sortir de ce programme</Text>
                </TouchableOpacity>
                <ConfirmationSuppression
                  actif={suppressionAConfirmer === 'sortie-prog-' + programme.id}
                  question={`Sortir de « ${programme.nom} » ? Il libère ses jours et ses dates, mais reste ici : tu pourras le reposer quand tu veux.`}
                  libelleConfirmer="Oui, sortir"
                  couleur={colors.accent}
                  onConfirmer={() => { setSuppressionAConfirmer(null); sortirDuProgramme([programme]); }}
                  onAnnuler={() => setSuppressionAConfirmer(null)}
                />
              </>
            )}
          </View>
        );
      })}
      <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('nouveauProgramme')}>
        <Text style={styles.boutonSecondaireTexte}>+ Nouveau programme</Text>
      </TouchableOpacity>

      {/* ---- Récupérer un programme AVEC UN CODE ----
           Les programmes partagés ne sont PAS publics (02/09/2026, demande de
           Hafiz) : sans le code, on ne peut même pas savoir qu'ils existent.
           Même geste que rejoindre un duel ou valider la perf d'un partenaire. */}
      <Text style={styles.sectionTitre}>🔑 Programme partagé</Text>
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
            {rechercheCode ? <ActivityIndicator color={colors.texte} size="small" /> : (
              <Text style={styles.boutonAjouterSerieTexte}>Voir</Text>
            )}
          </TouchableOpacity>
        </View>
        {erreurCode && <Text style={styles.messageErreur}>⚠️ {erreurCode}</Text>}

        {/* On montre le contenu AVANT de copier : personne ne récupère un
            programme sans savoir ce qu'il contient. */}
        {programmeTrouve && (
          <View style={[styles.detailJour, { borderColor: colors.or, borderWidth: 1 }]}>
            <Text style={styles.nomProgrammeTexte}>⭐ {programmeTrouve.nom}</Text>
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
              <Text style={styles.boutonDemarrerTexte}>📥 Copier ce programme</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ---- ADMIN : les programmes que J'AI partagés, avec leurs codes ---- */}
      {moi.admin && (
        <>
          <Text style={styles.sectionTitre}>🛠 Mes programmes partagés</Text>
          {messageOfficiel && (
            <Text style={[styles.indice, messageOfficiel.erreur && { color: colors.rouge }]}>
              {messageOfficiel.texte}
            </Text>
          )}
          {programmesOfficiels.length === 0 ? (
            <Text style={styles.indice}>
              Aucun pour l'instant. Utilise « 🔑 Partager par code » sur un de tes
              programmes ci-dessus.
            </Text>
          ) : programmesOfficiels.map((o) => (
            <View key={o.id} style={[styles.carteModele, styles.carteOfficielle]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.nomProgrammeTexte, { flex: 1 }]}>⭐ {o.nom}</Text>
                <TouchableOpacity onPress={() => retirerOfficiel(o)} style={styles.boutonRetirer}>
                  <Text style={styles.boutonRetirerTexte}>✕</Text>
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
      )}

      {/* ---- Modèles standards : Push Pull Legs, Full Body… ---- */}
      <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setModelesOuverts(!modelesOuverts)}>
        <Text style={styles.boutonSecondaireTexte}>
          📦 Programmes standards {modelesOuverts ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {modelesOuverts && programmesStandards.map((modele) => (
        <View key={modele.id} style={styles.carteModele}>
          <Text style={styles.nomProgrammeTexte}>{modele.emoji} {modele.nom}</Text>
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
              <ActivityIndicator color={colors.texte} size="small" />
            ) : (
              <Text style={styles.boutonDemarrerTexte}>Utiliser ce modèle</Text>
            )}
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.boutonPrincipal} onPress={() => demarrerSeance(null)}>
        <Text style={styles.boutonPrincipalTexte}>🏋️ Démarrer une séance libre</Text>
      </TouchableOpacity>

      {/* ---- Rappel d'entraînement (pas de notifications programmées sur web) ---- */}
      {Platform.OS !== 'web' && (
        <>
          <Text style={styles.sectionTitre}>🔔 Rappel d'entraînement</Text>
          <View style={styles.carteModele}>
            <Text style={styles.indice}>
              Choisis tes jours et ton heure : ton téléphone te préviendra, même
              app fermée (comme un réveil).
            </Text>
            <View style={[styles.lignePuces, { marginTop: espacement.s }]}>
              {joursSemaine.map((jour) => (
                <TouchableOpacity
                  key={jour}
                  style={[styles.puceJour, rappelJours.includes(jour) && styles.puceJourActive]}
                  onPress={() => basculerJourRappel(jour)}
                >
                  <Text style={[styles.puceJourTexte, rappelJours.includes(jour) && styles.puceJourTexteActif]}>
                    {abreviationsJours[jour]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.ligneAjoutSerie, { marginTop: espacement.s }]}>
              <TextInput
                style={[styles.champ, { width: 90 }]}
                value={rappelHeure}
                onChangeText={setRappelHeure}
                placeholder="18:00"
                placeholderTextColor={colors.texteGris}
              />
              <TouchableOpacity style={styles.boutonAjouterSerie} onPress={activerRappel}>
                <Text style={styles.boutonAjouterSerieTexte}>
                  {rappelActif ? 'Mettre à jour' : 'Activer'}
                </Text>
              </TouchableOpacity>
              {rappelActif && (
                <TouchableOpacity style={styles.boutonRetirer} onPress={desactiverRappel}>
                  <Text style={styles.boutonRetirerTexte}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {rappelMessage && (
              <Text style={[styles.messageRappel, rappelMessage.erreur && { color: colors.rouge }]}>
                {rappelMessage.texte}
              </Text>
            )}
          </View>
        </>
      )}

      {/* ---- Records personnels (calculés depuis l'historique) ---- */}
      {mesRecords.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setRecordsOuverts(!recordsOuverts)}>
            <Text style={styles.sectionTitre}>
              🏆 Mes records {recordsOuverts ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {recordsOuverts && (
            <View style={styles.carteModele}>
              <Text style={styles.indice}>
                Ta série la plus lourde sur chaque exercice, toutes séances confondues.
              </Text>
              <Text style={styles.indice}>
                Un nom mal tapé ? Touche l'exercice pour le renommer partout —
                dans tes programmes, ton historique et ton comptage de séries.
              </Text>
              {mesRecords.map((r) => {
                if (recordARenommer !== r.exercice) {
                  return (
                    <TouchableOpacity
                      key={r.exercice}
                      style={styles.ligneRecord}
                      onPress={() => { setRecordARenommer(r.exercice); setNomRecordSaisi(r.exercice); }}
                    >
                      <Text style={styles.nomRecord} numberOfLines={1}>{r.exercice}</Text>
                      <Text style={styles.valeurRecord}>
                        {r.poids > 0 ? `${r.poids} kg × ` : ''}{r.reps} reps
                      </Text>
                      <Text style={styles.dateRecord}>{r.date}</Text>
                    </TouchableOpacity>
                  );
                }
                return (
                  <View key={r.exercice} style={styles.ligneAjoutSerie}>
                    <TextInput
                      style={[styles.champ, { flex: 1 }]}
                      value={nomRecordSaisi}
                      onChangeText={setNomRecordSaisi}
                      placeholder="Nouveau nom"
                      placeholderTextColor={colors.texteGris}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.boutonAjouterSerie}
                      onPress={() => renommerDepuisRecord(r.exercice)}
                      disabled={renommageEnCours}
                    >
                      {renommageEnCours ? <ActivityIndicator color={colors.texte} size="small" /> : (
                        <Text style={styles.boutonAjouterSerieTexte}>Renommer</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.boutonRetirer} onPress={() => setRecordARenommer(null)}>
                      <Text style={styles.boutonRetirerTexte}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      <Text style={styles.sectionTitre}>Historique</Text>
      {entrainements.length === 0 && (
        <Text style={styles.indice}>Aucune séance loggée pour l'instant.</Text>
      )}
      {entrainements.slice(0, 10).map((e) => {
        const nbSeries = e.series.length;
        const exercicesUniques = [...new Set(e.series.map((s) => s.exercice))];
        return (
          <TouchableOpacity
            key={e.id}
            style={styles.carteHistorique}
            onPress={() => { setEntrainementSelectionne(e); setVue('historiqueDetail'); }}
          >
            <Text style={styles.dateHistorique}>{e.date}</Text>
            <Text style={styles.indice}>
              {exercicesUniques.length} exercice{exercicesUniques.length > 1 ? 's' : ''} · {nbSeries} série{nbSeries > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}

      {erreur && <Text style={styles.messageErreur}>⚠️ {erreur}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: colors.fond },
  centre: { alignItems: 'center', justifyContent: 'center' },
  titre: { color: colors.texte, fontSize: 24, fontWeight: '800' },
  sousTitre: { color: colors.texteGris, fontSize: 13, marginTop: 4, marginBottom: espacement.m },
  indiceHorsLigne: {
    color: colors.texteGris, fontSize: 12, backgroundColor: colors.carteClaire,
    padding: espacement.s, borderRadius: 10, marginBottom: espacement.m,
  },
  totalSeries: {
    color: colors.or, fontSize: 13, fontWeight: '800',
    marginTop: -4, marginBottom: espacement.s,
  },
  sectionTitre: {
    color: colors.texte, fontSize: 18, fontWeight: '700',
    marginTop: espacement.l, marginBottom: espacement.s,
  },
  indice: { color: colors.texteGris, fontSize: 12, marginTop: 2 },
  libelle: { color: colors.texte, fontWeight: '600', marginBottom: 6 },
  champ: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: 12,
    color: colors.texte, borderWidth: 1, borderColor: colors.bordure,
  },
  champCourt: { width: 70 },
  ligneExoForm: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: espacement.s },
  boutonRetirer: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.rouge,
  },
  boutonRetirerTexte: { color: colors.rouge, fontWeight: '800' },
  boutonSecondaire: {
    backgroundColor: colors.carteClaire, borderRadius: 12, padding: 12, alignItems: 'center',
    marginTop: espacement.s, marginBottom: espacement.m, borderWidth: 1, borderColor: colors.accent,
  },
  boutonSecondaireTexte: { color: colors.accent, fontWeight: '700' },
  boutonPrincipal: {
    backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center',
    marginTop: espacement.m,
  },
  boutonPrincipalTexte: { color: colors.texte, fontWeight: '700', fontSize: 16 },
  lienAnnuler: { color: colors.texteGris, textAlign: 'center', marginTop: espacement.m, fontSize: 13 },
  messageErreur: { color: colors.rouge, fontSize: 13, marginTop: espacement.s },
  carteProgramme: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.carte, borderRadius: 12,
    padding: espacement.m, marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure, gap: 8,
  },
  nomProgrammeTexte: { color: colors.texte, fontWeight: '700', fontSize: 15 },
  boutonDemarrer: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  boutonDemarrerTexte: { color: colors.texte, fontWeight: '700', fontSize: 12 },
  carteHistorique: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m,
    marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  dateHistorique: { color: colors.or, fontWeight: '700' },
  carteExercice: {
    backgroundColor: colors.carte, borderRadius: 14, padding: espacement.m,
    marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  nomExercice: { color: colors.texte, fontWeight: '700', fontSize: 15 },
  indiceDerniere: { color: colors.texteGris, fontSize: 12, marginTop: 4, marginBottom: espacement.s },
  serieFaite: { color: colors.vert, fontSize: 13, marginTop: 2 },
  ligneAjoutSerie: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: espacement.s },
  boutonAjouterSerie: {
    backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
  },
  boutonAjouterSerieTexte: { color: colors.texte, fontWeight: '700', fontSize: 12 },
  lignePuces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  puceJour: {
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
  },
  puceJourActive: { borderColor: colors.or, backgroundColor: colors.carte },
  puceJourTexte: { color: colors.texteGris, fontWeight: '600', fontSize: 12 },
  puceJourTexteActif: { color: colors.or },
  ligneCalendrier: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.carte, borderRadius: 10, padding: espacement.s,
    marginBottom: 4, borderWidth: 1, borderColor: colors.bordure,
  },
  ligneCalendrierAujourdhui: { borderColor: colors.or },
  jourCalendrier: { color: colors.texte, fontWeight: '700', fontSize: 12, width: 82 },
  contenuCalendrier: { color: colors.texteGris, fontSize: 12, flex: 1 },
  cocheCalendrier: { fontSize: 14 },
  ligneSeanceCycle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: espacement.s,
    paddingTop: espacement.s, borderTopWidth: 1, borderTopColor: colors.bordure,
  },
  jourSeanceCycle: { color: colors.or, fontWeight: '700', fontSize: 11, width: 62 },
  boutonModifier: {
    borderWidth: 1, borderColor: colors.accent, borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 9,
  },
  boutonModifierTexte: { color: colors.accent, fontWeight: '700', fontSize: 11 },
  zoneDeroule: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  boutonSortir: {
    borderWidth: 1, borderColor: colors.texteGris, borderRadius: 8,
    paddingVertical: 9, alignItems: 'center', marginTop: espacement.s,
  },
  boutonSortirTexte: { color: colors.texteGris, fontWeight: '700', fontSize: 12 },
  ligneVolume: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: espacement.s },
  ligneObjectif: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginTop: 6,
  },
  nomGroupe: { color: colors.texte, fontSize: 12, fontWeight: '600', width: 110 },
  barreVolumeFond: {
    flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.carteClaire, overflow: 'hidden',
  },
  barreVolumeRemplie: { height: 8, borderRadius: 4 },
  compteurVolume: { color: colors.texteGris, fontSize: 12, fontWeight: '700', width: 62, textAlign: 'right' },
  resumeVolume: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: espacement.s },
  pucheVolume: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
  },
  pucheGroupe: { color: colors.texteGris, fontSize: 11, fontWeight: '600' },
  pucheCompte: { color: colors.texte, fontSize: 11, fontWeight: '800' },
  blocRappelSuivi: {
    marginTop: espacement.m, paddingTop: espacement.m,
    borderTopWidth: 1, borderTopColor: colors.bordure,
  },
  libelleRappelSuivi: {
    color: colors.texte, fontWeight: '700', fontSize: 13, marginBottom: 4,
  },
  suggestion: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  raisonSuggestion: { color: colors.texteGris, fontSize: 11, fontWeight: '400' },
  record: { color: colors.texteGris, fontSize: 11, marginBottom: 3 },
  recordBattu: { color: colors.or, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  stagnation: { color: colors.rouge, fontSize: 11, marginBottom: 3, lineHeight: 15 },
  ligneRecord: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  nomRecord: { color: colors.texte, fontSize: 12, flex: 1 },
  valeurRecord: { color: colors.or, fontSize: 12, fontWeight: '700' },
  dateRecord: { color: colors.texteGris, fontSize: 10, width: 78, textAlign: 'right' },
  flecheCalendrier: { color: colors.texteGris, fontSize: 10 },
  ligneChoixProgramme: { paddingVertical: 8 },
  choixProgrammeTexte: { color: colors.texte, fontSize: 14 },
  blocCalendrier: { width: '100%', maxWidth: 380, alignSelf: 'flex-start' },
  enTeteMois: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: espacement.s,
  },
  boutonMois: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
  },
  flecheMois: { color: colors.or, fontWeight: '700' },
  titreMois: { color: colors.texte, fontWeight: '700', fontSize: 15, textTransform: 'capitalize' },
  ligneSemaine: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  enTeteCaseJour: {
    flex: 1, textAlign: 'center', color: colors.texteGris, fontSize: 10, fontWeight: '700',
  },
  caseJour: {
    flex: 1, aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carte, borderWidth: 1, borderColor: colors.bordure,
  },
  caseJourVide: { flex: 1, aspectRatio: 1 },
  caseAujourdhui: { borderColor: colors.or },
  caseSelectionnee: { backgroundColor: colors.carteClaire, borderColor: colors.accent },
  numeroJour: { color: colors.texte, fontSize: 12, fontWeight: '600' },
  // Un emoji a besoin de plus de place que sa taille de police : avec une
  // hauteur figée à 12 px, le ✅ était coupé (retour de Hafiz du 03/09/2026).
  // On réserve la place avec minHeight + lineHeight, sans jamais rogner.
  marqueurJour: {
    color: colors.accent, fontSize: 11, lineHeight: 15, minHeight: 15,
    textAlign: 'center',
  },
  detailJour: {
    backgroundColor: colors.carteClaire, borderRadius: 10, padding: espacement.s,
    marginBottom: 4, marginLeft: espacement.m, borderWidth: 1, borderColor: colors.bordure,
  },
  exerciceDetailJour: { color: colors.texteGris, fontSize: 12, marginTop: 3 },
  attenduDetailJour: { color: colors.or, fontSize: 11, marginTop: 1 },
  indiceModifier: { color: colors.texteGris, fontSize: 10 },
  carteRenommage: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m,
    borderWidth: 1, borderColor: colors.or, marginBottom: espacement.m,
  },
  titreRenommage: { color: colors.or, fontWeight: '800', marginBottom: 4 },
  ligneRenommage: { color: colors.texte, fontSize: 13, marginBottom: 2 },
  ligneEditionSerie: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
  },
  numeroSerieEdition: {
    color: colors.texteGris, fontSize: 12, fontWeight: '700', width: 24,
  },
  // Les actions d'un programme, sous son nom : elles passent à la ligne
  // plutôt que d'écraser le titre ou de déborder de la carte.
  ligneActionsProgramme: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    gap: 6, marginTop: espacement.s,
  },
  groupeExercice: { color: colors.texteGris, fontSize: 11, marginLeft: espacement.s },
  alerteNonClasses: {
    color: colors.rouge, fontSize: 12, lineHeight: 17, marginBottom: espacement.s,
  },
  carteOfficielle: { borderColor: colors.or },
  codePartage: {
    color: colors.or, fontSize: 26, fontWeight: '800', letterSpacing: 4,
    textAlign: 'center', marginVertical: espacement.s,
  },
  boutonPublier: {
    borderWidth: 1, borderColor: colors.rouge, borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 8, marginRight: 6,
  },
  boutonPublierTexte: { color: colors.rouge, fontWeight: '700', fontSize: 11 },
  carteModele: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m,
    marginBottom: espacement.s, borderWidth: 1, borderColor: colors.bordure,
  },
  boutonUtiliserModele: {
    backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8,
    alignItems: 'center', marginTop: espacement.s,
  },
  messageRappel: { color: colors.vert, fontSize: 12, marginTop: espacement.s },
});
