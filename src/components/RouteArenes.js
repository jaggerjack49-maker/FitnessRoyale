// LA ROUTE DES ARÈNES — la carte de progression verticale, du DÉBUT à LÉGENDE.
//
// C'est l'identité visuelle du projet : le joueur voit littéralement où il va.
// On affiche du SOMMET vers le BAS (LÉGENDE en haut) pour que le regard tombe
// d'abord sur l'objectif ultime, et que la position actuelle se lise comme une
// ascension restant à faire.
//
// RAPPEL : une arène = une ligue Fitness Royale, gagnée uniquement avec des perfs
// VÉRIFIÉES. L'XP n'intervient pas ici (voir docs/VISION_ARENA_PASS.md).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, espacement } from '../theme';
import { couleursLigues } from '../data/clubSP';
import { seuilMoyenne } from '../data/arenes';
import { Icone } from './Icones';

export default function RouteArenes({ arenes, indexActuel, nbExercices }) {
  // Du sommet vers la base.
  const duHautVersLeBas = [...arenes].reverse();

  return (
    <View style={styles.route}>
      {duHautVersLeBas.map((arene, position) => {
        const franchie = arene.index < indexActuel;
        const actuelle = arene.index === indexActuel;
        const couleur = couleursLigues[arene.ligue] || colors.texteGris;
        const atteinte = franchie || actuelle;
        const paliersRequis = Math.ceil(seuilMoyenne(arene.index) * nbExercices);
        const derniere = position === duHautVersLeBas.length - 1;

        return (
          <View key={arene.index}>
            <View
              style={[
                styles.etape,
                actuelle && { borderColor: couleur, backgroundColor: colors.carteClaire },
                franchie && { borderColor: couleur },
              ]}
            >
              {/* L'emblème dans une pastille colorée */}
              <View
                style={[
                  styles.pastille,
                  { borderColor: atteinte ? couleur : colors.bordure },
                  actuelle && { backgroundColor: couleur },
                ]}
              >
                {/* Sur la pastille PLEINE de l'arène actuelle, l'emblème passe
                    en sombre pour rester lisible ; ailleurs il prend la couleur
                    de la ligue (estompée si l'arène est verrouillée). */}
                <View style={!atteinte && styles.emblemeVerrouille}>
                  <Icone
                    nom={arene.icone}
                    taille={22}
                    couleur={actuelle ? colors.fond : atteinte ? couleur : colors.texteGris}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.nom, { color: atteinte ? couleur : colors.texteGris }]}>
                  {arene.nom}
                </Text>
                {/* Le TITRE porté par l'arène (« Recrue », « Gladiator »…) n'est
                    plus rappelé ici (demande de Hafiz du 25/08/2026) : il est
                    déjà affiché sur la carte de l'arène en haut de l'écran, et
                    il chargeait la route pour rien. On ne garde que l'objectif
                    concret, qui est la seule info actionnable de cette ligne. */}
                <Text style={styles.detail} numberOfLines={1}>
                  {arene.index === 0 ? 'Point de départ' : `${paliersRequis} paliers vérifiés`}
                </Text>
              </View>

              <View style={styles.etat}>
                <Icone
                  nom={franchie ? 'valide' : actuelle ? 'repere' : 'cadenas'}
                  taille={18}
                  couleur={franchie ? colors.vert : actuelle ? couleur : colors.texteGris}
                />
              </View>
            </View>

            {/* La flèche qui relie deux étapes de la route */}
            {!derniere && (
              <View style={styles.liaison}>
                {/* La flèche s'allume si l'étape du DESSOUS est déjà atteinte
                    (c'est le chemin que le joueur a parcouru ou va parcourir). */}
                <Icone
                  nom="chevron-haut"
                  taille={16}
                  couleur={duHautVersLeBas[position + 1].index <= indexActuel ? couleur : colors.bordure}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  route: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  etape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.carte,
    borderRadius: 14,
    padding: espacement.s,
    borderWidth: 1.5,
    borderColor: colors.bordure,
  },
  pastille: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, backgroundColor: colors.fond,
  },
  emblemeVerrouille: { opacity: 0.3 },
  nom: { fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  detail: { color: colors.texteGris, fontSize: 11, marginTop: 2 },
  etat: { width: 26, alignItems: 'center' },
  liaison: { alignItems: 'center', paddingVertical: 2 },
});
