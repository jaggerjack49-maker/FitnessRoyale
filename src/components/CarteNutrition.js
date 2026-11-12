// CarteNutrition — le journal alimentaire du jour, dans l'onglet Entraînement
// (18/09/2026, demande de Hafiz : « intégrer une IA qui pourra estimer les
// calories des aliments avec la caméra »).
//
// PARCOURS : 📷 photo (ou galerie) → la photo est RÉDUITE à 1024 px sur le
// téléphone (quelques centaines de Ko au lieu de plusieurs Mo) → envoyée au
// serveur, qui la fait analyser par Claude Opus 5 → un BROUILLON s'affiche :
// le joueur relit, corrige les grammes (calories et macros suivent), retire
// ce qui est faux, puis l'ajoute à son journal. Rien n'est enregistré sans
// cette relecture : c'est une ESTIMATION, et l'écran le dit.
//
// La photo n'est gardée nulle part (ni sur le serveur, ni ici).
// L'analyse a besoin du serveur (elle passe par lui pour joindre Claude).
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { colors, espacement } from '../theme';
import { Icone, TexteIcone, LibelleIcone } from './Icones';
import * as api from '../api';
import { enISO } from '../logic/rattrapage';
import {
  ajusterPortion, alimentsAEnvoyer, brouillonDepuisAnalyse, libelleReste, progression,
  totauxAliments, decalerJour, moyennesNutrition, etatDuJour,
} from '../logic/nutrition';
import { jourDeLaDate } from '../data/programmesStandards';

// Assez pour que l'IA distingue les aliments, assez petit pour un envoi rapide.
const LARGEUR_PHOTO = 1024;
const LIBELLES_CONFIANCE = { faible: 'faible', moyenne: 'moyenne', elevee: 'élevée' };

// Le JOURNAL couvre les 30 derniers jours (le serveur en accepte jusqu'à 90).
const JOURS_JOURNAL = 30;
const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// « Aujourd'hui », « Hier », sinon « Lundi 9 novembre ».
function libelleJour(jourISO, aujourdhui) {
  if (jourISO === aujourdhui) return "Aujourd'hui";
  if (jourISO === decalerJour(aujourdhui, -1)) return 'Hier';
  const date = new Date(`${jourISO}T12:00:00`);
  if (Number.isNaN(date.getTime())) return jourISO;
  const nom = jourDeLaDate(date);
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${date.getDate()} ${NOMS_MOIS[date.getMonth()]}`;
}

// Le petit badge d'une journée du journal, selon son objectif de calories.
const ETATS_JOUR = {
  objectif: { texte: 'Objectif tenu', couleur: colors.vert },
  sous: { texte: "Sous l'objectif", couleur: colors.accent },
  dessus: { texte: 'Au-dessus', couleur: colors.rouge },
};

function nombreSaisi(texte) {
  const n = parseFloat(String(texte).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function Barre({ valeur, objectif, couleur }) {
  return (
    <View style={styles.piste}>
      <View style={[styles.remplissage, { width: `${progression(valeur, objectif) * 100}%`, backgroundColor: couleur }]} />
    </View>
  );
}

// LES QUATRE MACROS DU JOUR (11/11/2026, demande de Hafiz : « ajoute aussi les
// glucides et les lipides »). Une ligne chacune, même forme pour les quatre :
// la pastille de couleur, le nom, « mangé / objectif », et la barre dès qu'un
// objectif est fixé. Sans objectif, la ligne montre quand même ce qui a été
// mangé — c'était le cas des glucides et lipides jusqu'ici, en petit texte gris.
const MACROS = [
  { cle: 'kcal', total: 'kcal', libelle: 'Calories', unite: 'kcal', couleur: colors.or },
  { cle: 'proteines', total: 'proteines_g', libelle: 'Protéines', unite: 'g', couleur: colors.accent },
  { cle: 'glucides', total: 'glucides_g', libelle: 'Glucides', unite: 'g', couleur: colors.macroGlucides },
  { cle: 'lipides', total: 'lipides_g', libelle: 'Lipides', unite: 'g', couleur: colors.macroLipides },
];

function LigneMacro({ macro, valeur, objectif }) {
  return (
    <View style={styles.macro}>
      <View style={styles.enteteMacro}>
        <View style={[styles.pastilleMacro, { backgroundColor: macro.couleur }]} />
        <Text style={styles.libelleMacro}>{macro.libelle}</Text>
        <Text style={styles.valeurMacro}>
          <Text style={styles.chiffreMacro}>{Math.round(Number(valeur) || 0)}</Text>
          {objectif ? ` / ${objectif}` : ''} {macro.unite}
        </Text>
      </View>
      {objectif ? <Barre valeur={valeur} objectif={objectif} couleur={macro.couleur} /> : null}
    </View>
  );
}

// `onRemonter` : fait défiler l'écran tout en haut — toucher un jour du
// journal (en bas) affiche ce jour dans la carte du haut, qu'il faut donc voir.
export default function CarteNutrition({ moi, actif = true, onRemonter }) {
  const [journal, setJournal] = useState(null); // { repas, totaux, objectifs }
  // Le jour AFFICHÉ (12/11/2026) : aujourd'hui par défaut, mais on peut
  // revenir sur un jour passé pour le relire, ajouter un repas oublié ou en
  // retirer un. Jamais dans le futur.
  const aujourdhui = enISO(new Date());
  const [jour, setJour] = useState(aujourdhui);
  const [historique, setHistorique] = useState(null); // réponse de /nutrition/historique
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [brouillon, setBrouillon] = useState(null);
  const [message, setMessage] = useState(null); // { texte, erreur }
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null);
  const [editionObjectifs, setEditionObjectifs] = useState(false);
  const [champKcal, setChampKcal] = useState('');
  const [champProteines, setChampProteines] = useState('');
  const [champGlucides, setChampGlucides] = useState('');
  const [champLipides, setChampLipides] = useState('');
  // { nom, kcal, proteines, glucides, lipides }
  const [saisieManuelle, setSaisieManuelle] = useState(null);

  // Le « jour » est celui du TÉLÉPHONE (date locale), comme le calendrier.
  // Le jour affiché ET le journal des 30 derniers jours, chargés ensemble :
  // ajouter ou retirer un repas change les deux. `allSettled` : si l'un des
  // deux échoue, l'autre s'affiche quand même (leçon du 16/09/2026).
  async function charger(jourVoulu = jour) {
    const [duJour, journalDesJours] = await Promise.allSettled([
      api.journalNutrition(moi.id, jourVoulu),
      api.historiqueNutrition(moi.id, aujourdhui, JOURS_JOURNAL),
    ]);
    if (duJour.status === 'fulfilled') setJournal(duJour.value);
    if (journalDesJours.status === 'fulfilled') setHistorique(journalDesJours.value);
    const echec = [duJour, journalDesJours].find((r) => r.status === 'rejected');
    if (echec) setMessage({ texte: `Journal non chargé : ${echec.reason?.message}`, erreur: true });
  }

  // Rechargé à chaque retour sur l'onglet — même leçon que le bug du 16/09
  // (un premier chargement raté ne doit jamais rester raté).
  useEffect(() => {
    if (actif) charger(jour);
  }, [actif, moi.id, jour]);

  // Changer de jour : on oublie ce qui était en cours sur l'ancien (brouillon,
  // saisie, suppression armée), sinon un repas commencé pour lundi partirait
  // sur mardi.
  function allerAuJour(nouveau) {
    if (!nouveau || nouveau > aujourdhui) return;
    setJournal(null);
    setBrouillon(null);
    setSaisieManuelle(null);
    setASupprimer(null);
    setMessage(null);
    setJour(nouveau);
  }

  async function analyser(depuisGalerie) {
    setMessage(null);
    try {
      let resultat;
      if (depuisGalerie) {
        resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setMessage({ texte: 'Autorise la caméra pour photographier ton repas.', erreur: true });
          return;
        }
        resultat = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      }
      if (resultat.canceled || !resultat.assets?.[0]) return;
      setAnalyseEnCours(true);
      const reduite = await manipulateAsync(
        resultat.assets[0].uri,
        [{ resize: { width: LARGEUR_PHOTO } }],
        { compress: 0.7, format: SaveFormat.JPEG, base64: true },
      );
      const analyse = await api.analyserRepas(moi.id, reduite.base64, 'image/jpeg');
      setBrouillon(brouillonDepuisAnalyse(analyse));
      if (Number.isFinite(analyse.analyses_restantes) && analyse.analyses_restantes <= 3) {
        setMessage({ texte: `Encore ${analyse.analyses_restantes} analyse(s) photo possible(s) aujourd'hui.`, erreur: false });
      }
    } catch (erreur) {
      setMessage({ texte: erreur.message || "L'analyse n'a pas pu aboutir.", erreur: true });
    } finally {
      setAnalyseEnCours(false);
    }
  }

  function changerAliment(index, modification) {
    setBrouillon((b) => ({
      ...b,
      aliments: b.aliments.map((a, i) => (i === index ? modification(a) : a)),
    }));
  }

  async function ajouterAuJournal(nom, source, aliments) {
    if (aliments.length === 0) {
      setMessage({ texte: 'Il faut au moins un aliment.', erreur: true });
      return false;
    }
    setEnvoiEnCours(true);
    try {
      await api.ajouterRepas(moi.id, { nom: nom.trim() || 'Repas', date: jour, source, aliments });
      await charger();
      setMessage({ texte: 'Repas ajouté à ton journal.', erreur: false });
      return true;
    } catch (erreur) {
      setMessage({ texte: `Pas enregistré : ${erreur.message}`, erreur: true });
      return false;
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function enregistrerBrouillon() {
    if (await ajouterAuJournal(brouillon.nom, 'photo', alimentsAEnvoyer(brouillon))) setBrouillon(null);
  }

  async function enregistrerManuel() {
    const kcal = nombreSaisi(saisieManuelle.kcal);
    if (!saisieManuelle.nom.trim() || kcal === null) {
      setMessage({ texte: 'Indique au moins un nom et des calories.', erreur: true });
      return;
    }
    const aliment = {
      nom: saisieManuelle.nom.trim(), kcal,
      proteines_g: nombreSaisi(saisieManuelle.proteines) ?? 0,
      glucides_g: nombreSaisi(saisieManuelle.glucides) ?? 0,
      lipides_g: nombreSaisi(saisieManuelle.lipides) ?? 0,
    };
    if (await ajouterAuJournal(saisieManuelle.nom, 'manuel', alimentsAEnvoyer({ aliments: [aliment] }))) {
      setSaisieManuelle(null);
    }
  }

  async function supprimer(repasId) {
    setASupprimer(null);
    setMessage(null); // sinon « Repas ajouté » restait affiché après la suppression
    try {
      await api.supprimerRepas(repasId);
      await charger();
    } catch (erreur) {
      setMessage({ texte: `Pas supprimé : ${erreur.message}`, erreur: true });
    }
  }

  function ouvrirObjectifs() {
    setChampKcal(journal?.objectifs?.kcal ? String(journal.objectifs.kcal) : '');
    setChampProteines(journal?.objectifs?.proteines ? String(journal.objectifs.proteines) : '');
    setChampGlucides(journal?.objectifs?.glucides ? String(journal.objectifs.glucides) : '');
    setChampLipides(journal?.objectifs?.lipides ? String(journal.objectifs.lipides) : '');
    setEditionObjectifs(true);
  }

  async function enregistrerObjectifs() {
    try {
      const entier = (texte) => {
        const n = nombreSaisi(texte);
        return n === null ? null : Math.round(n);
      };
      await api.changerObjectifsNutrition(moi.id, {
        kcal: entier(champKcal),
        proteines: entier(champProteines),
        glucides: entier(champGlucides),
        lipides: entier(champLipides),
      });
      setEditionObjectifs(false);
      await charger();
    } catch (erreur) {
      setMessage({ texte: `Objectif non enregistré : ${erreur.message}`, erreur: true });
    }
  }

  const totaux = journal?.totaux || { kcal: 0, proteines_g: 0, glucides_g: 0, lipides_g: 0 };
  const objectifs = journal?.objectifs || {};
  const reste = libelleReste(totaux.kcal, objectifs.kcal, 'kcal');
  const totauxBrouillon = brouillon ? totauxAliments(brouillon.aliments) : null;
  const moyennes = moyennesNutrition(historique?.jours);

  return (
    <>
    <View style={styles.carte}>
      {/* Plus de titre « Nutrition » ici : l'en-tête de l'écran le porte déjà
          juste au-dessus. C'est le JOUR qui titre la carte. */}
      {/* ---- Le jour affiché : < jour > (12/11/2026). On ne va jamais dans
          le futur : la flèche de droite s'éteint sur aujourd'hui. ---- */}
      <View style={styles.navJour}>
        <TouchableOpacity style={styles.flecheJour} onPress={() => allerAuJour(decalerJour(jour, -1))}
          accessibilityLabel="Jour précédent">
          <Icone nom="chevron-gauche" taille={18} couleur={colors.or} />
        </TouchableOpacity>
        <View style={styles.centreJour}>
          <Text style={styles.libelleJour}>{libelleJour(jour, aujourdhui)}</Text>
          {jour !== aujourdhui ? (
            <TouchableOpacity onPress={() => allerAuJour(aujourdhui)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.retourAujourdhui}>Revenir à aujourd'hui</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity style={[styles.flecheJour, jour >= aujourdhui && styles.flecheEteinte]}
          disabled={jour >= aujourdhui} onPress={() => allerAuJour(decalerJour(jour, 1))}
          accessibilityLabel="Jour suivant">
          <Icone nom="chevron-droit" taille={18} couleur={jour >= aujourdhui ? colors.texteGris : colors.or} />
        </TouchableOpacity>
      </View>

      {/* ---- Bilan du jour : les quatre macros ---- */}
      {MACROS.map((m) => (
        <LigneMacro key={m.cle} macro={m} valeur={totaux[m.total]} objectif={objectifs[m.cle]} />
      ))}
      <Text style={styles.indice}>
        {reste || 'Pas encore d\'objectif du jour.'}
      </Text>

      {!editionObjectifs ? (
        <TouchableOpacity onPress={ouvrirObjectifs}>
          <TexteIcone nom="cible" taille={13} ecart={6} style={styles.lien}>{MACROS.some((m) => objectifs[m.cle]) ? 'Modifier mes objectifs' : 'Fixer mes objectifs (calories, protéines, glucides, lipides)'}</TexteIcone>
        </TouchableOpacity>
      ) : (
        <View style={styles.bloc}>
          {/* Chaque champ porte son LIBELLÉ : un placeholder disparaît dès
              qu'on tape (leçon de l'écran de séance, 01/10/2026). Tous
              facultatifs : un champ vide = pas d'objectif pour cette macro. */}
          <View style={styles.ligne}>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>CALORIES (KCAL)</Text>
              <TextInput style={styles.champ} value={champKcal} onChangeText={setChampKcal}
                keyboardType="numeric" placeholder="ex. 2400" placeholderTextColor={colors.texteGris} />
            </View>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>PROTÉINES (G)</Text>
              <TextInput style={styles.champ} value={champProteines} onChangeText={setChampProteines}
                keyboardType="numeric" placeholder="ex. 160" placeholderTextColor={colors.texteGris} />
            </View>
          </View>
          <View style={styles.ligne}>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>GLUCIDES (G)</Text>
              <TextInput style={styles.champ} value={champGlucides} onChangeText={setChampGlucides}
                keyboardType="numeric" placeholder="ex. 280" placeholderTextColor={colors.texteGris} />
            </View>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>LIPIDES (G)</Text>
              <TextInput style={styles.champ} value={champLipides} onChangeText={setChampLipides}
                keyboardType="numeric" placeholder="ex. 75" placeholderTextColor={colors.texteGris} />
            </View>
          </View>
          <View style={styles.ligne}>
            <TouchableOpacity style={styles.boutonOr} onPress={enregistrerObjectifs}>
              <Text style={styles.boutonOrTexte}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditionObjectifs(false)}>
              <Text style={styles.lienGris}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---- Ajouter un repas ---- */}
      {/* UN BOUTON DIT CE QU'IL FAIT : « 🖼 » et « ✍️ » étaient deux emojis
          nus, posés à côté d'un bouton qui, lui, portait son texte — on ne
          pouvait que deviner. Ils sont maintenant sur leur propre ligne, avec
          leur libellé, et l'action principale garde toute la largeur. */}
      {!brouillon && !analyseEnCours && !saisieManuelle && (
        <>
          <TouchableOpacity style={[styles.boutonOr, styles.boutonLarge]} onPress={() => analyser(false)}>
            <LibelleIcone nom="appareil-photo" taille={15} style={styles.boutonOrTexte}>Photographier mon repas</LibelleIcone>
          </TouchableOpacity>
          <View style={styles.ligne}>
            <TouchableOpacity style={[styles.boutonBord, styles.boutonLarge]} onPress={() => analyser(true)}>
              {/* « Depuis mes photos » passait a la ligne une fois l'icone
                  posee devant (61 px de haut contre 43 pour son voisin,
                  mesure a l'ecran). L'icone DIT deja « une photo que tu as
                  deja » : les deux premiers mots etaient redondants. */}
              <LibelleIcone nom="image" taille={14} ecart={6} style={styles.boutonBordTexte}>Mes photos</LibelleIcone>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.boutonBord, styles.boutonLarge]}
              onPress={() => setSaisieManuelle({ nom: '', kcal: '', proteines: '', glucides: '', lipides: '' })}
            >
              <LibelleIcone nom="crayon" taille={14} ecart={6} style={styles.boutonBordTexte}>À la main</LibelleIcone>
            </TouchableOpacity>
          </View>
        </>
      )}

      {analyseEnCours && (
        <View style={[styles.bloc, styles.ligne]}>
          <ActivityIndicator color={colors.or} />
          <Text style={styles.texte}>  Analyse de ton repas… (10 à 30 secondes)</Text>
        </View>
      )}

      {message && (
        <Text style={[styles.message, message.erreur && { color: colors.rouge }]}>{message.texte}</Text>
      )}

      {/* ---- Saisie à la main (quand on connaît déjà les calories) ---- */}
      {saisieManuelle && (
        <View style={styles.bloc}>
          {/* Chaque champ porte son LIBELLÉ, comme les objectifs : un
              placeholder disparaît dès qu'on tape (12/11/2026). */}
          <Text style={styles.titreSaisie}>
            {jour === aujourdhui ? 'Ajouter un repas' : `Ajouter un repas — ${libelleJour(jour, aujourdhui).toLowerCase()}`}
          </Text>
          <Text style={[styles.libelleChamp, styles.libelleHaut]}>NOM</Text>
          <TextInput style={[styles.champ, styles.champSousLibelle]} value={saisieManuelle.nom} placeholder="ex. Barre protéinée"
            placeholderTextColor={colors.texteGris}
            onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, nom: t }))} />
          <View style={styles.ligne}>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>CALORIES (KCAL)</Text>
              <TextInput style={[styles.champ, styles.champSousLibelle]} value={saisieManuelle.kcal} keyboardType="numeric"
                placeholder="ex. 220" placeholderTextColor={colors.texteGris}
                onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, kcal: t }))} />
            </View>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>PROTÉINES (G)</Text>
              <TextInput style={[styles.champ, styles.champSousLibelle]} value={saisieManuelle.proteines} keyboardType="numeric"
                placeholder="ex. 20" placeholderTextColor={colors.texteGris}
                onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, proteines: t }))} />
            </View>
          </View>
          <View style={styles.ligne}>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>GLUCIDES (G)</Text>
              <TextInput style={[styles.champ, styles.champSousLibelle]} value={saisieManuelle.glucides} keyboardType="numeric"
                placeholder="ex. 25" placeholderTextColor={colors.texteGris}
                onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, glucides: t }))} />
            </View>
            <View style={styles.champAvecLibelle}>
              <Text style={styles.libelleChamp}>LIPIDES (G)</Text>
              <TextInput style={[styles.champ, styles.champSousLibelle]} value={saisieManuelle.lipides} keyboardType="numeric"
                placeholder="ex. 7" placeholderTextColor={colors.texteGris}
                onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, lipides: t }))} />
            </View>
          </View>
          <Text style={styles.indice}>Seuls le nom et les calories sont obligatoires.</Text>
          <View style={styles.ligne}>
            <TouchableOpacity style={styles.boutonOr} onPress={enregistrerManuel} disabled={envoiEnCours}>
              <Text style={styles.boutonOrTexte}>Ajouter</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSaisieManuelle(null)}>
              <Text style={styles.lienGris}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---- Brouillon de l'analyse : à relire AVANT d'enregistrer ---- */}
      {brouillon && (
        <View style={styles.bloc}>
          <TextInput style={[styles.champ, styles.nomRepas]} value={brouillon.nom}
            onChangeText={(t) => setBrouillon((b) => ({ ...b, nom: t }))} />
          {brouillon.aliments.map((a, i) => (
            <View key={i} style={styles.aliment}>
              <View style={styles.ligne}>
                <Text style={[styles.texte, { flex: 1 }]} numberOfLines={2}>{a.nom}</Text>
                <TouchableOpacity onPress={() => setBrouillon((b) => ({ ...b, aliments: b.aliments.filter((_, j) => j !== i) }))}>
                  <Icone nom="croix" taille={14} couleur={colors.texteGris} />
                </TouchableOpacity>
              </View>
              <View style={styles.ligne}>
                <TextInput style={[styles.champ, styles.champCourt]} keyboardType="numeric"
                  value={String(a.grammes ?? '')}
                  onChangeText={(t) => changerAliment(i, (al) => ajusterPortion(al, nombreSaisi(t) ?? 0))} />
                <Text style={styles.indice}> g{a.portion ? ` (${a.portion})` : ''}</Text>
              </View>
              <Text style={styles.indice}>
                {a.kcal} kcal · P {a.proteines_g} g · G {a.glucides_g} g · L {a.lipides_g} g
              </Text>
            </View>
          ))}
          <Text style={styles.ligneBilan}>
            Total : <Text style={styles.chiffre}>{totauxBrouillon.kcal}</Text> kcal · P {totauxBrouillon.proteines_g} g
            {' '}· G {totauxBrouillon.glucides_g} g · L {totauxBrouillon.lipides_g} g
          </Text>
          <Text style={styles.indice}>
            Confiance de l'IA : {LIBELLES_CONFIANCE[brouillon.confiance] || 'faible'}
            {brouillon.remarque ? ` — ${brouillon.remarque}` : ''}
          </Text>
          <TexteIcone nom="alerte" taille={13} hautAligne style={styles.avertissement}>
            C'est une estimation : l'huile, les sauces et le poids exact ne se voient pas toujours
            sur une photo. Corrige les grammes si besoin.
          </TexteIcone>
          <View style={styles.ligne}>
            <TouchableOpacity style={[styles.boutonOr, styles.boutonLarge]} onPress={enregistrerBrouillon} disabled={envoiEnCours}>
              {envoiEnCours ? (
                <Text style={styles.boutonOrTexte}>…</Text>
              ) : (
                <LibelleIcone nom="valide" taille={15} style={styles.boutonOrTexte}>
                  Ajouter au journal
                </LibelleIcone>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBrouillon(null)}>
              <Text style={styles.lienGris}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---- Le journal du jour ---- */}
      {(journal?.repas || []).map((r) => (
        <View key={r.id} style={styles.repas}>
          <View style={{ flex: 1 }}>
            <TexteIcone nom={r.source === 'photo' ? 'appareil-photo' : 'crayon'} taille={13} ecart={6} couleur={colors.texteGris} style={styles.texte}>{r.nom}</TexteIcone>
            <Text style={styles.indice}>
              {r.kcal} kcal · P {Math.round(r.proteines)} g · G {Math.round(r.glucides)} g · L {Math.round(r.lipides)} g
            </Text>
          </View>
          {aSupprimer === r.id ? (
            <TouchableOpacity onPress={() => supprimer(r.id)}>
              <Text style={[styles.lien, { color: colors.rouge }]}>Supprimer ?</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setASupprimer(r.id)}>
              <Icone nom="croix" taille={14} couleur={colors.texteGris} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {journal && journal.repas.length === 0 && !brouillon && (
        <Text style={styles.indice}>
          {jour === aujourdhui ? "Aucun repas noté aujourd'hui." : 'Aucun repas noté ce jour-là.'}
        </Text>
      )}
    </View>

    {/* ---- LE JOURNAL (12/11/2026, demande de Hafiz : « il faut un log pour
        la nutrition ») : les 30 derniers jours notés, du plus récent au plus
        ancien, avec la moyenne. Toucher un jour l'affiche dans la carte du
        haut, où l'on peut ajouter ou retirer des repas. ---- */}
    <View style={styles.carte}>
      <TexteIcone nom="historique" taille={15} couleur={colors.or} style={styles.titre}>Journal</TexteIcone>
      <Text style={styles.indiceSansMarge}>Les {JOURS_JOURNAL} derniers jours où tu as noté tes repas. Touche un jour pour le revoir.</Text>
      {moyennes ? (
        <View style={styles.moyenne}>
          <Text style={styles.libelleChamp}>
            MOYENNE SUR {moyennes.nbJours} JOUR{moyennes.nbJours > 1 ? 'S' : ''} NOTÉ{moyennes.nbJours > 1 ? 'S' : ''}
          </Text>
          <Text style={styles.valeurMacro}>
            <Text style={styles.chiffreMacro}>{moyennes.kcal}</Text> kcal
            {' '}· P {moyennes.proteines_g} g · G {moyennes.glucides_g} g · L {moyennes.lipides_g} g
          </Text>
        </View>
      ) : null}
      {(historique?.jours || []).map((j) => {
        const etat = ETATS_JOUR[etatDuJour(j.kcal, objectifs.kcal)];
        const choisi = j.date === jour;
        return (
          <TouchableOpacity key={j.date} style={[styles.jourJournal, choisi && styles.jourChoisi]}
            onPress={() => { allerAuJour(j.date); if (onRemonter) onRemonter(); }}>
            <View style={styles.enteteMacro}>
              <Text style={styles.dateJournal}>{libelleJour(j.date, aujourdhui)}</Text>
              <Text style={styles.indiceSansMarge}>{j.nb_repas} repas</Text>
            </View>
            <View style={[styles.enteteMacro, { marginTop: 4 }]}>
              <Text style={[styles.valeurMacro, { flex: 1 }]}>
                <Text style={styles.chiffreMacro}>{j.kcal}</Text>
                {objectifs.kcal ? ` / ${objectifs.kcal}` : ''} kcal
              </Text>
              {etat ? (
                <View style={[styles.badgeEtat, { borderColor: etat.couleur }]}>
                  <Text style={[styles.texteEtat, { color: etat.couleur }]}>{etat.texte}</Text>
                </View>
              ) : null}
            </View>
            {objectifs.kcal ? <Barre valeur={j.kcal} objectif={objectifs.kcal} couleur={colors.or} /> : null}
            <Text style={styles.indice}>
              P {Math.round(j.proteines_g)} g · G {Math.round(j.glucides_g)} g · L {Math.round(j.lipides_g)} g
            </Text>
          </TouchableOpacity>
        );
      })}
      {historique && historique.jours.length === 0 ? (
        <Text style={styles.indice}>Aucun repas noté sur les {JOURS_JOURNAL} derniers jours.</Text>
      ) : null}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.carte, borderRadius: 12, padding: espacement.m, marginBottom: espacement.m,
  },
  titre: { color: colors.texte, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  ligneBilan: { color: colors.texteGris, fontSize: 14, marginTop: 4 },
  chiffre: { color: colors.or, fontWeight: '800', fontSize: 16 },
  piste: { height: 8, backgroundColor: colors.carteClaire, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  remplissage: { height: 8, borderRadius: 4 },
  // Les quatre macros du bilan (11/11/2026).
  macro: { marginTop: 8 },
  enteteMacro: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastilleMacro: { width: 8, height: 8, borderRadius: 4 },
  libelleMacro: { flex: 1, color: colors.texteDoux, fontSize: 13, fontWeight: '700' },
  valeurMacro: { color: colors.texteGris, fontSize: 13 },
  chiffreMacro: { color: colors.texte, fontWeight: '800', fontSize: 15 },
  champAvecLibelle: { flex: 1 },
  libelleHaut: { marginTop: 10 },
  champSousLibelle: { marginTop: 0 },
  titreSaisie: { color: colors.texte, fontWeight: '800', fontSize: 14 },
  // Le jour affiché (12/11/2026) : flèches de 44 px, comme le calendrier.
  navJour: {
    flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4,
    backgroundColor: colors.carteClaire, borderRadius: 12, padding: 4,
  },
  flecheJour: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flecheEteinte: { opacity: 0.35 },
  centreJour: { flex: 1, alignItems: 'center' },
  libelleJour: { color: colors.texte, fontSize: 15, fontWeight: '800' },
  retourAujourdhui: { color: colors.or, fontSize: 12, fontWeight: '700', marginTop: 2 },
  // Le journal des jours passés.
  moyenne: {
    marginTop: espacement.s, padding: espacement.s, borderRadius: 10,
    backgroundColor: colors.carteClaire,
  },
  jourJournal: {
    marginTop: espacement.s, padding: espacement.s, borderRadius: 10,
    borderWidth: 1, borderColor: colors.bordure, minHeight: 44,
  },
  jourChoisi: { borderColor: colors.or },
  dateJournal: { flex: 1, color: colors.texte, fontWeight: '800', fontSize: 14 },
  indiceSansMarge: { color: colors.texteGris, fontSize: 12 },
  badgeEtat: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  texteEtat: { fontSize: 11, fontWeight: '800' },
  libelleChamp: {
    color: colors.texteGris, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4,
  },
  indice: { color: colors.texteGris, fontSize: 12, marginTop: 4 },
  texte: { color: colors.texte, fontSize: 14 },
  // `paddingVertical` ET PAS seulement `marginTop` : la marge n'agrandit pas
  // la zone touchée, le rembourrage si (26 px mesurés avant, ~44 après).
  // Mesurées à l'écran le 27/10/2026 : ce lien et les deux boutons bordés
  // s'arrêtaient à 42-43 px, juste sous le minimum de 44.
  lien: { color: colors.or, fontWeight: '700', marginTop: 4, paddingVertical: 11, minHeight: 44 },
  lienGris: { color: colors.texteGris, marginLeft: espacement.m, textDecorationLine: 'underline' },
  bloc: { marginTop: espacement.s, padding: espacement.s, backgroundColor: colors.carteClaire, borderRadius: 10 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  champ: {
    backgroundColor: colors.fond, color: colors.texte, borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: colors.bordure, marginTop: 6,
  },
  champMoyen: { flex: 1 },
  champCourt: { width: 70, marginTop: 0 },
  nomRepas: { fontWeight: '700' },
  aliment: { marginTop: espacement.s, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.bordure },
  croix: { color: colors.texteGris, fontSize: 16, paddingHorizontal: 8 },
  boutonOr: { backgroundColor: colors.or, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center' },
  boutonLarge: { flex: 1 },
  boutonOrTexte: { color: colors.fond, fontWeight: '800' },
  boutonBord: {
    borderWidth: 1, borderColor: colors.or, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center',
    minHeight: 44, justifyContent: 'center',
  },
  boutonBordTexte: { color: colors.or, fontWeight: '700', fontSize: 13 },
  message: { color: colors.vert, marginTop: espacement.s },
  avertissement: { color: colors.texteGris, fontSize: 11, marginTop: espacement.s, fontStyle: 'italic' },
  repas: {
    flexDirection: 'row', alignItems: 'center', marginTop: espacement.s, paddingTop: espacement.s,
    borderTopWidth: 1, borderTopColor: colors.bordure,
  },
});
