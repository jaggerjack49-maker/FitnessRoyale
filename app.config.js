// Configuration DYNAMIQUE de l'app — complète app.json (Expo lit les deux :
// app.json d'abord, puis ce fichier qui peut modifier le résultat).
//
// POURQUOI CE FICHIER : l'adresse du serveur (extra.apiUrl) ne doit PAS être
// figée dans app.json — en développement (Expo Go), elle doit rester null pour
// que l'app détecte automatiquement l'IP du PC ; mais dans un APK installé,
// il n'y a plus d'Expo pour la détecter, il faut la fournir à la construction.
// Solution : la variable d'environnement API_URL, définie UNIQUEMENT dans les
// profils de build d'eas.json. En dev, elle n'existe pas → rien ne change.
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl: process.env.API_URL || config.extra?.apiUrl || null,
  },
});
