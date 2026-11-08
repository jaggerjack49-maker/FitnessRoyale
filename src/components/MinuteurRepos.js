// LE MINUTEUR DE REPOS (08/11/2026, demande de Hafiz : « lorsqu'on termine une
// série le temps de repos s'active »).
//
// Il apparaît tout seul après chaque « + Série », en bas de l'écran de séance,
// PAR-DESSUS la page : on le voit quel que soit l'endroit où l'on a fait
// défiler. Il annonce la prochaine étape DANS L'ORDRE DU PROGRAMME (« Prochain :
// développé couché — série 3 », calcul dans src/logic/repos.js).
//
// Comme le chrono de séance, il ne décompte pas seconde par seconde : il
// compare maintenant à l'instant de fin (`repos.fin`), donc il reste juste
// après une mise en veille. Un composant À PART avec sa propre horloge, pour
// ne pas redessiner tout l'écran de séance plusieurs fois par seconde.
//
// Téléphone posé écran éteint : l'app ne peut ni vibrer ni s'afficher. Quand
// elle passe en arrière-plan, on programme une notification à l'instant où le
// repos finit ; on l'annule dès qu'on revient (voir notifications.js).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, AppState } from 'react-native';
import { colors, espacement } from '../theme';
import { da, monospace } from '../designSystem';
import { Icone } from './Icones';
import { secondesRestantes, dureeLisible } from '../logic/repos';
import * as notifications from '../notifications';

// La permission des notifications n'est demandée qu'une fois par lancement,
// au premier repos — pas au milieu de chaque série.
let permissionDemandee = false;

export default function MinuteurRepos({ repos, etape, actif, onAjuster, onPasser }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  const finVibree = useRef(null);
  const fin = repos?.fin || null;
  const restant = secondesRestantes(fin, maintenant);

  // L'horloge : deux fois par seconde (sinon l'arrondi fait sauter un chiffre).
  useEffect(() => {
    if (!actif || !fin) return undefined;
    setMaintenant(Date.now());
    const minuteur = setInterval(() => setMaintenant(Date.now()), 500);
    return () => clearInterval(minuteur);
  }, [actif, fin]);

  // Une seule vibration par repos, au moment où il se termine.
  useEffect(() => {
    if (fin && restant === 0 && finVibree.current !== fin) {
      finVibree.current = fin;
      Vibration.vibrate([0, 400, 200, 400]);
    }
  }, [fin, restant]);

  useEffect(() => {
    if (!fin || permissionDemandee) return;
    permissionDemandee = true;
    notifications.demanderPermission().catch(() => {});
  }, [fin]);

  // App en arrière-plan → notification de fin de repos ; retour → annulée.
  useEffect(() => {
    if (!fin) return undefined;
    const abonnement = AppState.addEventListener('change', (etat) => {
      const reste = secondesRestantes(fin, Date.now());
      if (etat !== 'active' && reste > 0) {
        notifications.programmerFinRepos(reste, etape || undefined);
      } else if (etat === 'active') {
        notifications.annulerFinRepos();
        setMaintenant(Date.now());
      }
    });
    return () => {
      abonnement.remove();
      notifications.annulerFinRepos();
    };
  }, [fin, etape]);

  if (!fin) return null;
  const termine = restant === 0;
  const duree = Math.max(1, repos.duree || 1);
  const part = termine ? 1 : Math.min(1, Math.max(0, 1 - restant / duree));

  return (
    <View style={[styles.carte, termine && styles.carteTerminee]}>
      <View style={styles.piste}>
        <View style={[styles.remplissage, { width: `${part * 100}%` }, termine && styles.remplissageTermine]} />
      </View>
      <View style={styles.rangee}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.libelle, termine && { color: colors.vert }]}>
            {termine ? 'REPOS TERMINÉ' : 'REPOS'}
          </Text>
          {termine ? (
            <Text style={styles.temps}>Go !</Text>
          ) : (
            <Text style={styles.temps}>{dureeLisible(restant)}</Text>
          )}
          {etape ? <Text style={styles.etape} numberOfLines={2}>{etape}</Text> : null}
        </View>
        {!termine && (
          <>
            <TouchableOpacity style={styles.bouton} onPress={() => onAjuster(-15)}
              accessibilityLabel="Retirer 15 secondes">
              <Text style={styles.boutonTexte}>−15</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bouton} onPress={() => onAjuster(15)}
              accessibilityLabel="Ajouter 15 secondes">
              <Text style={styles.boutonTexte}>+15</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={[styles.bouton, styles.boutonPasser]} onPress={onPasser}
          accessibilityLabel={termine ? 'Fermer' : 'Passer le repos'}>
          {termine
            ? <Icone nom="valide" taille={16} couleur={da.orSombre} />
            : <Text style={[styles.boutonTexte, { color: da.orSombre }]}>Passer</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    position: 'absolute', left: espacement.m, right: espacement.m, bottom: espacement.m,
    backgroundColor: colors.carte, borderRadius: 16, borderWidth: 1,
    borderColor: da.bordureOrDouce, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  carteTerminee: { borderColor: colors.vert },
  piste: { height: 4, backgroundColor: colors.carteClaire },
  remplissage: { height: 4, backgroundColor: colors.or },
  remplissageTermine: { backgroundColor: colors.vert },
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  libelle: { color: colors.texteGris, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  temps: { color: colors.or, fontFamily: monospace, fontWeight: '900', fontSize: 30 },
  etape: { color: colors.texteDoux, fontSize: 12, marginTop: 2 },
  bouton: {
    minWidth: 48, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.carteClaire, borderWidth: 1, borderColor: colors.bordure,
    paddingHorizontal: 8,
  },
  boutonPasser: { backgroundColor: colors.or, borderColor: colors.or },
  boutonTexte: { color: colors.texte, fontWeight: '800', fontSize: 13 },
});
