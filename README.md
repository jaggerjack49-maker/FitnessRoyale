# Fitness Royale 🏆

Première version mobile (React Native + Expo, SDK 54) avec deux modules :
- **Profil & tableau de bord** : niveau, ligue, série de jours, stats de la semaine, bilan compétition.
- **Performances** : ajoute tes perfs ; vérification en 3 paliers (non vérifié / communauté / salle), seules les perfs vérifiées comptent.
- **Compétition** : classements Club SP (global + relatif au poids du corps) et défis.

Les données sont pour l'instant factices (`src/data/mockData.js`) — elles seront remplacées par un vrai serveur plus tard.

## Tester sur ton téléphone (le plus simple)

1. Installe **Node.js** sur ton ordinateur : https://nodejs.org (version LTS).
2. Installe l'app **Expo Go** sur ton téléphone (App Store / Play Store).
3. Dans un terminal, place-toi dans ce dossier puis :
   ```
   npm install
   npx expo start
   ```
4. Scanne le QR code affiché avec Expo Go (Android) ou l'appareil photo (iPhone).

## Structure du projet

```
FitnessRoyale/
├── App.js                    ← point d'entrée + barre d'onglets
├── src/
│   ├── theme.js              ← couleurs et espacements
│   ├── data/mockData.js      ← données factices
│   ├── components/           ← briques réutilisables
│   │   ├── BarreProgression.js
│   │   ├── CarteStat.js
│   │   └── CarteDefi.js
│   └── screens/
│       ├── ProfilScreen.js
│       └── CompetitionScreen.js
```

## Prochaines étapes possibles

- Module Entraînement (séances, exercices)
- Module Nutrition (repas, calories)
- Vrai backend (comptes utilisateurs, données réelles)
