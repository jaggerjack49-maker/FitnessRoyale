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
// L'analyse a besoin du serveur ; hors-ligne, la carte l'explique.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { colors, espacement } from '../theme';
import * as api from '../api';
import { enISO } from '../logic/rattrapage';
import {
  ajusterPortion, alimentsAEnvoyer, brouillonDepuisAnalyse, libelleReste, progression,
  totauxAliments,
} from '../logic/nutrition';

// Assez pour que l'IA distingue les aliments, assez petit pour un envoi rapide.
const LARGEUR_PHOTO = 1024;
const LIBELLES_CONFIANCE = { faible: 'faible', moyenne: 'moyenne', elevee: 'élevée' };

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

export default function CarteNutrition({ moi, estConnecte, actif = true }) {
  const [journal, setJournal] = useState(null); // { repas, totaux, objectifs }
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [brouillon, setBrouillon] = useState(null);
  const [message, setMessage] = useState(null); // { texte, erreur }
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null);
  const [editionObjectifs, setEditionObjectifs] = useState(false);
  const [champKcal, setChampKcal] = useState('');
  const [champProteines, setChampProteines] = useState('');
  const [saisieManuelle, setSaisieManuelle] = useState(null); // { nom, kcal, proteines }

  // Le « jour » est celui du TÉLÉPHONE (date locale), comme le calendrier.
  const jour = enISO(new Date());

  async function charger() {
    if (!estConnecte) return;
    try {
      setJournal(await api.journalNutrition(moi.id, jour));
    } catch (erreur) {
      setMessage({ texte: `Journal non chargé : ${erreur.message}`, erreur: true });
    }
  }

  // Rechargé à chaque retour sur l'onglet — même leçon que le bug du 16/09
  // (un premier chargement raté ne doit jamais rester raté).
  useEffect(() => {
    if (estConnecte && actif) charger();
  }, [estConnecte, actif, moi.id, jour]);

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
      setMessage({ texte: '✅ Repas ajouté à ton journal.', erreur: false });
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
    setEditionObjectifs(true);
  }

  async function enregistrerObjectifs() {
    try {
      const kcal = nombreSaisi(champKcal);
      const proteines = nombreSaisi(champProteines);
      await api.changerObjectifsNutrition(moi.id, {
        kcal: kcal === null ? null : Math.round(kcal),
        proteines: proteines === null ? null : Math.round(proteines),
      });
      setEditionObjectifs(false);
      await charger();
    } catch (erreur) {
      setMessage({ texte: `Objectif non enregistré : ${erreur.message}`, erreur: true });
    }
  }

  if (!estConnecte) {
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>🍽 Nutrition</Text>
        <Text style={styles.indice}>Connecte-toi pour tenir ton journal alimentaire et analyser tes repas en photo.</Text>
      </View>
    );
  }

  const totaux = journal?.totaux || { kcal: 0, proteines_g: 0, glucides_g: 0, lipides_g: 0 };
  const objectifs = journal?.objectifs || {};
  const reste = libelleReste(totaux.kcal, objectifs.kcal, 'kcal');
  const totauxBrouillon = brouillon ? totauxAliments(brouillon.aliments) : null;

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>🍽 Nutrition — aujourd'hui</Text>

      {/* ---- Bilan du jour ---- */}
      <Text style={styles.ligneBilan}>
        <Text style={styles.chiffre}>{totaux.kcal}</Text>
        {objectifs.kcal ? ` / ${objectifs.kcal}` : ''} kcal
        {'   ·   '}
        <Text style={styles.chiffre}>{Math.round(totaux.proteines_g)}</Text>
        {objectifs.proteines ? ` / ${objectifs.proteines}` : ''} g protéines
      </Text>
      {objectifs.kcal ? <Barre valeur={totaux.kcal} objectif={objectifs.kcal} couleur={colors.or} /> : null}
      {objectifs.proteines ? (
        <Barre valeur={totaux.proteines_g} objectif={objectifs.proteines} couleur={colors.accent} />
      ) : null}
      <Text style={styles.indice}>
        {reste || 'Pas encore d\'objectif du jour.'}
        {'  ·  '}Glucides {Math.round(totaux.glucides_g)} g · Lipides {Math.round(totaux.lipides_g)} g
      </Text>

      {!editionObjectifs ? (
        <TouchableOpacity onPress={ouvrirObjectifs}>
          <Text style={styles.lien}>🎯 {objectifs.kcal ? 'Modifier mon objectif du jour' : 'Fixer mon objectif du jour'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.bloc}>
          <View style={styles.ligne}>
            <TextInput style={[styles.champ, styles.champMoyen]} value={champKcal} onChangeText={setChampKcal}
              keyboardType="numeric" placeholder="kcal (ex. 2400)" placeholderTextColor={colors.texteGris} />
            <TextInput style={[styles.champ, styles.champMoyen]} value={champProteines} onChangeText={setChampProteines}
              keyboardType="numeric" placeholder="protéines g (ex. 160)" placeholderTextColor={colors.texteGris} />
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
      {!brouillon && !analyseEnCours && !saisieManuelle && (
        <View style={styles.ligne}>
          <TouchableOpacity style={[styles.boutonOr, styles.boutonLarge]} onPress={() => analyser(false)}>
            <Text style={styles.boutonOrTexte}>📷 Photographier mon repas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonBord} onPress={() => analyser(true)}>
            <Text style={styles.boutonBordTexte}>🖼</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonBord} onPress={() => setSaisieManuelle({ nom: '', kcal: '', proteines: '' })}>
            <Text style={styles.boutonBordTexte}>✍️</Text>
          </TouchableOpacity>
        </View>
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
          <TextInput style={styles.champ} value={saisieManuelle.nom} placeholder="Nom (ex. Barre protéinée)"
            placeholderTextColor={colors.texteGris}
            onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, nom: t }))} />
          <View style={styles.ligne}>
            <TextInput style={[styles.champ, styles.champMoyen]} value={saisieManuelle.kcal} keyboardType="numeric"
              placeholder="kcal" placeholderTextColor={colors.texteGris}
              onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, kcal: t }))} />
            <TextInput style={[styles.champ, styles.champMoyen]} value={saisieManuelle.proteines} keyboardType="numeric"
              placeholder="protéines g" placeholderTextColor={colors.texteGris}
              onChangeText={(t) => setSaisieManuelle((s) => ({ ...s, proteines: t }))} />
          </View>
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
                  <Text style={styles.croix}>✕</Text>
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
          </Text>
          <Text style={styles.indice}>
            Confiance de l'IA : {LIBELLES_CONFIANCE[brouillon.confiance] || 'faible'}
            {brouillon.remarque ? ` — ${brouillon.remarque}` : ''}
          </Text>
          <Text style={styles.avertissement}>
            ⚠️ C'est une estimation : l'huile, les sauces et le poids exact ne se voient pas toujours
            sur une photo. Corrige les grammes si besoin.
          </Text>
          <View style={styles.ligne}>
            <TouchableOpacity style={[styles.boutonOr, styles.boutonLarge]} onPress={enregistrerBrouillon} disabled={envoiEnCours}>
              <Text style={styles.boutonOrTexte}>{envoiEnCours ? '…' : '✅ Ajouter au journal'}</Text>
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
            <Text style={styles.texte}>{r.source === 'photo' ? '📷' : '✍️'} {r.nom}</Text>
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
              <Text style={styles.croix}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {journal && journal.repas.length === 0 && !brouillon && (
        <Text style={styles.indice}>Aucun repas noté aujourd'hui.</Text>
      )}
    </View>
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
  indice: { color: colors.texteGris, fontSize: 12, marginTop: 4 },
  texte: { color: colors.texte, fontSize: 14 },
  lien: { color: colors.or, fontWeight: '700', marginTop: espacement.s },
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
  boutonOr: { backgroundColor: colors.or, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  boutonLarge: { flex: 1 },
  boutonOrTexte: { color: colors.fond, fontWeight: '800' },
  boutonBord: { borderWidth: 1, borderColor: colors.or, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  boutonBordTexte: { fontSize: 16 },
  message: { color: colors.vert, marginTop: espacement.s },
  avertissement: { color: colors.texteGris, fontSize: 11, marginTop: espacement.s, fontStyle: 'italic' },
  repas: {
    flexDirection: 'row', alignItems: 'center', marginTop: espacement.s, paddingTop: espacement.s,
    borderTopWidth: 1, borderTopColor: colors.bordure,
  },
});
