// LES DEMANDES DE COACHING venues du site web (15/11/2026).
//
// Le site `site/` propose un coaching personnalisé ; son formulaire arrive
// dans la table `demandes_coaching`. Sans cet écran, ces demandes
// n'arriveraient nulle part de lisible et la fonctionnalité ne servirait à
// rien — on ne va pas lire une base de données à la main pour savoir que
// quelqu'un veut s'entraîner.
//
// ⚠️ RÉSERVÉ À L'ADMIN, et c'est le parent qui le décide (`u.admin ? … :
// null` dans ProfilScreen). L'API refuse de toute façon (403) : une demande
// porte le contact, l'âge et le poids d'une vraie personne.
//
// ⚠️ JAMAIS `{valeur && …}` AVEC UNE DONNÉE DE LA BASE : SQLite et Postgres
// renvoient des 0/1 et des nombres, et React affiche un `0` nu — ce qui,
// sur téléphone, remplace l'écran par l'écran d'erreur (bug du 01/10/2026).
// Partout ici : `condition ? … : null`.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, espacement } from '../theme';
import { da, monospace } from '../designSystem';
import {
  IconeChevronBas, IconeChevronHaut, IconeRecharger, IconeEnvoyer,
} from './Icones';
import * as api from '../api';

// Les libellés lisibles des listes fermées du formulaire. Une clé inconnue
// retombe sur la valeur brute : un libellé manquant ne doit jamais effacer
// l'information ni casser l'écran.
const LIBELLES = {
  prise_de_masse: 'Prise de masse',
  perte_de_gras: 'Perte de gras',
  force: 'Force',
  remise_en_forme: 'Remise en forme',
  competition: 'Compétition',
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  salle_complete: 'Salle complète',
  home_gym: 'Home gym',
  poids_du_corps: 'Poids du corps',
  autre: 'Autre matériel',
  programme: 'Programme sur mesure',
  suivi: 'Suivi mensuel',
  suivi_nutrition: 'Suivi + nutrition',
  je_ne_sais_pas: 'Ne sait pas encore',
};

// Les quatre états d'une demande, dans l'ordre où on les fait avancer.
// Mêmes clés que `STATUTS_DEMANDE` côté serveur.
const STATUTS = [
  { cle: 'nouvelle', libelle: 'Nouvelle', couleur: colors.or },
  { cle: 'en_cours', libelle: 'En cours', couleur: colors.accent },
  { cle: 'acceptee', libelle: 'Acceptée', couleur: colors.vert },
  { cle: 'refusee', libelle: 'Refusée', couleur: colors.rouge },
];

function lisible(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return LIBELLES[valeur] || String(valeur);
}

function statutDe(cle) {
  return STATUTS.find((s) => s.cle === cle) || STATUTS[0];
}

// « 2026-11-15T09:12:33.000 » → « 15/11 à 09:12 ». On ne passe pas par
// `new Date(...)` : l'horodatage est déjà celui qu'on veut montrer, et le
// moteur JS d'Android refuse certains formats (bug du 09/08/2026).
function quand(horodatage) {
  const texte = typeof horodatage === 'string' ? horodatage : '';
  const morceaux = texte.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!morceaux) return '';
  return `${morceaux[3]}/${morceaux[2]} à ${morceaux[4]}:${morceaux[5]}`;
}

function Ligne({ etiquette, valeur }) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return (
    <View style={styles.ligneDetail}>
      <Text style={styles.etiquette}>{etiquette}</Text>
      <Text style={styles.valeur}>{String(valeur)}</Text>
    </View>
  );
}

function CarteDemande({ demande, onStatut, enCours }) {
  const [deplie, setDeplie] = useState(false);
  const statut = statutDe(demande.statut);
  const mensurations = [
    demande.age ? `${demande.age} ans` : null,
    demande.poids ? `${demande.poids} kg` : null,
    demande.taille ? `${demande.taille} cm` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[styles.demande, { borderLeftColor: statut.couleur }]}>
      <TouchableOpacity
        style={styles.enteteDemande}
        onPress={() => setDeplie(!deplie)}
        accessibilityRole="button"
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.prenom}>{demande.prenom}</Text>
          <Text style={styles.resume}>
            {[lisible(demande.objectif), lisible(demande.niveau),
              `${demande.jours_par_semaine} j/sem`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.coinDroit}>
          <Text style={[styles.badge, { color: statut.couleur, borderColor: statut.couleur }]}>
            {statut.libelle}
          </Text>
          <Text style={styles.date}>{quand(demande.cree_le)}</Text>
        </View>
        {deplie
          ? <IconeChevronHaut taille={16} couleur={da.texteGris} />
          : <IconeChevronBas taille={16} couleur={da.texteGris} />}
      </TouchableOpacity>

      {deplie ? (
        <View style={styles.detail}>
          <Ligne etiquette="CONTACT" valeur={demande.contact} />
          <Ligne etiquette="MATÉRIEL" valeur={lisible(demande.materiel)} />
          <Ligne etiquette="FORMULE" valeur={lisible(demande.formule)} />
          <Ligne etiquette="PROFIL" valeur={mensurations} />
          <Ligne etiquette="LIMITATIONS" valeur={demande.limitations} />
          <Ligne etiquette="MESSAGE" valeur={demande.message} />

          <Text style={styles.libelleStatut}>FAIRE AVANCER</Text>
          <View style={styles.rangeeStatuts}>
            {STATUTS.map((s) => {
              const actif = s.cle === demande.statut;
              return (
                <TouchableOpacity
                  key={s.cle}
                  style={[styles.boutonStatut,
                    actif ? { borderColor: s.couleur, backgroundColor: da.orVoile } : null]}
                  disabled={enCours || actif}
                  onPress={() => onStatut(demande.id, s.cle)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.boutonStatutTexte,
                    actif ? { color: s.couleur } : null]}>
                    {s.libelle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function DemandesCoaching() {
  const [ouvert, setOuvert] = useState(false);
  const [demandes, setDemandes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur('');
    try {
      const recues = await api.demandesCoaching();
      setDemandes(Array.isArray(recues) ? recues : []);
    } catch (err) {
      setErreur(err?.message || 'Les demandes n\'ont pas pu être chargées.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function changerStatut(identifiant, statut) {
    setEnCours(true);
    setErreur('');
    // Mise à jour optimiste : la liste réagit tout de suite. En cas d'échec
    // on recharge la vérité plutôt que de laisser l'écran mentir (règle
    // posée le 04/09/2026 pour les suppressions).
    setDemandes((avant) => avant.map(
      (d) => (d.id === identifiant ? { ...d, statut } : d)));
    try {
      await api.changerStatutDemande(identifiant, statut);
    } catch (err) {
      setErreur(err?.message || 'Changement NON enregistré.');
      charger();
    } finally {
      setEnCours(false);
    }
  }

  const nouvelles = demandes.filter((d) => d.statut === 'nouvelle').length;

  return (
    <View style={styles.carte}>
      <TouchableOpacity
        style={styles.entete}
        onPress={() => setOuvert(!ouvert)}
        accessibilityRole="button"
      >
        <IconeEnvoyer taille={18} couleur={colors.or} />
        <Text style={styles.titre}>DEMANDES DE COACHING</Text>
        {ouvert
          ? <IconeChevronHaut taille={16} couleur={da.texteGris} />
          : <IconeChevronBas taille={16} couleur={da.texteGris} />}
      </TouchableOpacity>

      <Text style={styles.resumeChiffre}>
        {chargement && demandes.length === 0
          ? 'Chargement…'
          : `${demandes.length} demande${demandes.length > 1 ? 's' : ''} reçue${demandes.length > 1 ? 's' : ''}`
            + (nouvelles > 0 ? ` · ${nouvelles} à traiter` : '')}
      </Text>

      {ouvert ? (
        <>
          <TouchableOpacity
            style={styles.boutonRecharger}
            onPress={charger}
            disabled={chargement}
            accessibilityRole="button"
          >
            <IconeRecharger taille={15} couleur={colors.or} />
            <Text style={styles.boutonRechargerTexte}>Actualiser</Text>
          </TouchableOpacity>

          {chargement ? <ActivityIndicator color={colors.or} style={{ marginTop: espacement.s }} /> : null}

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

          {!chargement && demandes.length === 0 && !erreur ? (
            <Text style={styles.vide}>
              Aucune demande pour l'instant. Elles arriveront ici dès que
              quelqu'un remplira le formulaire du site.
            </Text>
          ) : null}

          {demandes.map((demande) => (
            <CarteDemande
              key={demande.id}
              demande={demande}
              onStatut={changerStatut}
              enCours={enCours}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: da.carteBasse,
    borderWidth: 1,
    borderColor: da.bordureOrDouce,
    borderRadius: 16,
    padding: espacement.m,
    marginTop: espacement.m,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  titre: { flex: 1, color: colors.or, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
  resumeChiffre: { color: da.texteGris, fontSize: 12, marginTop: 2 },

  boutonRecharger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderColor: da.bordureOrDouce, backgroundColor: da.orVoile,
    borderRadius: 10, minHeight: 44, marginTop: espacement.m,
  },
  boutonRechargerTexte: { color: colors.or, fontWeight: '800', fontSize: 13 },

  erreur: { color: colors.rouge, fontSize: 12, marginTop: espacement.s, lineHeight: 17 },
  vide: { color: da.texteMuet, fontSize: 12, lineHeight: 17, marginTop: espacement.m },

  demande: {
    backgroundColor: colors.carte,
    borderWidth: 1, borderColor: colors.bordure,
    borderLeftWidth: 3,
    borderRadius: 12,
    marginTop: espacement.s,
  },
  enteteDemande: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, minHeight: 56,
  },
  prenom: { color: colors.texte, fontWeight: '800', fontSize: 15 },
  resume: { color: da.texteGris, fontSize: 12, marginTop: 2 },
  coinDroit: { alignItems: 'flex-end' },
  badge: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  date: { color: da.texteMuet, fontSize: 10, fontFamily: monospace, marginTop: 3 },

  detail: {
    borderTopWidth: 1, borderTopColor: colors.bordure,
    paddingHorizontal: 12, paddingBottom: 12,
  },
  ligneDetail: { marginTop: 10 },
  etiquette: { color: da.texteMuet, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  valeur: { color: colors.texte, fontSize: 13, lineHeight: 19, marginTop: 2 },

  libelleStatut: {
    color: da.texteMuet, fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    marginTop: espacement.m,
  },
  rangeeStatuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  boutonStatut: {
    borderWidth: 1, borderColor: colors.bordure, backgroundColor: colors.carteClaire,
    borderRadius: 10, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center',
  },
  boutonStatutTexte: { color: da.texteDoux, fontWeight: '700', fontSize: 12 },
});
