# Vision « Arena Pass » — Fitness Royale

> « Ta salle devient ton arène. »

Vision produit décrite par Hafiz le 12/08/2026. Ce document CAPTURE la cible ;
il ne décrit pas ce qui est construit (voir CLAUDE.md pour l'état réel).

---

## 1. L'écran principal visé

L'utilisateur ouvre l'app et voit, dans cet ordre :

```
TON ARÈNE
🏟️ TITAN III
1 842 Rating
████████░░ 78 %
Encore 220 Rating → TITAN II

⚔️ PROCHAIN ADVERSAIRE
KARIM — Titan III — 1 851 Rating
[ AFFRONTER ]

🏆 SAISON 04
Position : #17

🎯 TES DÉFIS
+2,5 kg au Bench      ███████░░░ 70 %
3 séances cette sem.  ██████████ 100 % ✓
Gagner 2 Battles      █░░ 1/2
```

## 2. La route des arènes — 6 arènes, seuils en XP

Une grande route VERTICALE, façon carte de progression — l'identité visuelle
de l'app. Le joueur voit littéralement où il va.

| # | Arène | XP | Titres | Identité visuelle | Ressenti visé |
|---|---|---|---|---|---|
| 1 | 🌱 INITIATION | 0 – 499 | Novice → Recrue | Salle basique, petit équipement, ambiance débutant | « Je commence mon aventure » |
| 2 | 🔥 FORGE | 500 – 1 499 | Recrue → Fighter | Machines, haltères, environnement plus impressionnant | Je m'entraîne vraiment |
| 3 | ⚔️ COLOSSE | 1 500 – 3 499 | Warrior → Gladiator | Grande salle, plateformes de force, équipements lourds | On me reconnaît comme sérieux |
| 4 | 🏆 TITAN | 3 500 – 6 999 | TITAN | Architecture monumentale, énorme rack, ambiance compétition | Le rang qu'on veut afficher |
| 5 | 💎 OLYMPE | 7 000 – 11 999 | OLYMPIEN | Temple / montagne, statues d'athlètes, prestige extrême | Très haut niveau |
| 6 | 👑 ROYALE | 12 000 + | ROYAL | Arène gigantesque, trophée central, effets légendaires | La catégorie ultime |

Le sommet s'appelle **ROYALE** (et non « LÉGENDE ») : le rang ultime porte le
nom de la marque — correction de Hafiz du 12/08/2026.

**Au-dessus de ROYALE, il n'y a rien.** Pour continuer à progresser, le joueur
doit grimper dans le CLASSEMENT MONDIAL. Excellente idée : le plafond de
progression individuelle devient une porte vers la compétition pure, et évite
l'inflation sans fin des paliers.

NOTE : ces noms remplacent les arènes actuellement codées (Le Vestiaire →
Le Trône Royal) et ne correspondent plus aux ligues Club SP (Bronze → Royal).
Deux vocabulaires vont donc coexister — voir « Décisions en suspens ».

## 3. Arena Pass

### Gratuit
Progression sur la route : **XP → récompenses → badges → titres**.

### Premium
- skins de profil
- animations
- cadres
- titres exclusifs
- récompenses partenaires
- challenges premium

### RÈGLE ABSOLUE
**Jamais de bonus qui améliore les performances ou le classement.**
Tout le premium est COSMÉTIQUE ou donne accès à des récompenses externes.
Sinon le système devient pay-to-win et perd toute crédibilité sportive.

## 4. Récompenses physiques (modèle économique)

Les marques et salles partenaires financent une partie des récompenses :

| Palier atteint | Récompense |
|---|---|
| Titan | −10 % chez une salle partenaire |
| Olympien | T-shirt partenaire |
| Légende | Abonnement salle 1 mois |
| Champion régional | Gros lot sponsorisé |

Implique côté technique : un catalogue de récompenses, des codes/bons à usage
unique, un suivi des attributions, et probablement une interface partenaire.

## 5. Pari d'argent — HORS MVP (décision assumée)

Volontairement EXCLU du produit initial. Raisons : contraintes juridiques par
pays, règles des stores (Google Play / App Store), et surtout le besoin de
vérifier d'abord que les gens aiment la compétition.

En attendant : `Battle → Rating → XP → récompenses`
Et surtout PAS : `Battle → argent`

L'architecture doit toutefois être conçue pour qu'un enjeu puisse être ajouté
plus tard sans tout réécrire (un duel porte déjà une `recompense` en points —
c'est le bon point d'accroche).

---

## Décisions en suspens (à trancher avant de coder)

## ⚙️ RÈGLE FONDATRICE (tranchée par Hafiz le 12/08/2026)

> « Arène et palier/ligue c'est pareil. L'XP augmente juste en fonction des
> séances que tu fais, de tes compétitions et des défis que tu gagnes. »

**Une arène EST une ligue Club SP** — les noms INITIATION → LÉGENDE remplacent
Bronze → Royal. L'arène reste donc déterminée par le PALIER MOYEN sur les perfs
VÉRIFIÉES : on ne monte d'arène qu'en devenant réellement plus fort. L'ADN du
projet est préservé.

**L'XP est une jauge SÉPARÉE**, qui mesure l'ENGAGEMENT et non la force. Elle
ne change jamais l'arène, le rang ni la ligue. Elle sert à alimenter l'Arena
Pass : récompenses, badges, titres, cosmétiques.

Ce partage est le bon design :
- le **mérite sportif** (perfs vérifiées) fixe ton rang et ton arène ;
- l'**assiduité** (XP) débloque des récompenses.

Un joueur assidu mais faible accumulera donc beaucoup d'XP et de récompenses
cosmétiques, sans jamais grimper au classement. C'est exactement ce qu'on veut.

### Correspondance arènes ↔ ligues

| Arène | Ligue Club SP |
|---|---|
| (départ, aucune perf) | Aucune |
| 🌱 INITIATION | Bronze |
| 🔥 FORGE | Silver |
| ⚔️ COLOSSE | Gold |
| 🏆 TITAN | Legend |
| 💎 OLYMPE | Titan |
| 👑 ROYALE | Royal |

Les femmes s'arrêtent à 💎 OLYMPE (barème à 5 paliers), les hommes vont
jusqu'à 👑 LÉGENDE (6 paliers).

### Barème d'XP (activité uniquement)

| Source | XP |
|---|---|
| Séance loggée | +20 |
| Défi du jour réussi | +20 |
| Défi de la semaine réussi | +100 |
| Duel (battle) gagné | +50 |

Les perfs vérifiées ne donnent PAS d'XP : elles font monter d'arène, ce qui est
déjà leur récompense.

---

## Décisions restant à trancher

### A. À quoi servent les seuils d'XP (0–499, 500–1 499, … 12 000+) ?

Ils ne peuvent plus définir les arènes (celles-ci suivent les ligues). Ils
deviennent naturellement les **niveaux de l'Arena Pass** : chaque palier d'XP
franchi débloque une récompense sur la route du Pass. À confirmer.

### B. L'XP peut-elle BAISSER ?

Avec une XP purement cumulative d'activité, non : on ne perd jamais ce qu'on a
fait. C'est plus motivant et bien plus simple. (Le classement, lui, peut
descendre — c'est là que se joue la compétition.)

### C. Les sous-paliers (TITAN III → TITAN II → TITAN I)

Mentionnés dans la maquette d'écran principal. À dériver soit de l'XP, soit de
la position dans la tranche de palier moyen de l'arène en cours.

---

## Découpage proposé (du plus autonome au plus lourd)

1. **Route des arènes verticale** + nouveaux noms — purement visuel, aucun
   impact sur les calculs. Peut se faire immédiatement.
2. **Défis sur l'écran d'accueil** avec barres de progression — s'appuie sur des
   données déjà présentes (séances loggées, perfs, duels).
3. **Rating + saisons + prochain adversaire** — nouveau moteur de compétition,
   nécessite de trancher la décision A.
4. **Arena Pass gratuit** : XP, route de récompenses, badges, titres.
5. **Arena Pass premium** : cosmétiques (skins, cadres, animations, titres).
   Implique un système de paiement (et les commissions des stores).
6. **Récompenses physiques partenaires** : catalogue, codes, suivi, interface
   partenaire. C'est un chantier à part entière, avec des vrais enjeux
   (fraude, validité des bons, relation commerciale).
