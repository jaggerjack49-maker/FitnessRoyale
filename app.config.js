// Configuration DYNAMIQUE de l'app — complète app.json (Expo lit les deux :
// app.json d'abord, puis ce fichier qui peut modifier le résultat).
//
// POURQUOI CE FICHIER : l'adresse du serveur (extra.apiUrl) ne doit PAS être
// figée dans app.json — en développement (Expo Go), elle doit rester null pour
// que l'app détecte automatiquement l'IP du PC ; mais dans un APK installé,
// il n'y a plus d'Expo pour la détecter, il faut la fournir à la construction.
// Solution : la variable d'environnement API_URL, définie UNIQUEMENT dans les
// profils de build d'eas.json. En dev, elle n'existe pas → rien ne change.
//
// ⚠️ LE SITE WEB EXPORTÉ NE LIT PAS `extra` (découvert le 21/09/2026). Sur le
// web, expo-constants prend le manifeste dans `process.env.APP_MANIFEST`
// (`ExponentConstants.web.js`) — ce qui fonctionne avec `expo start --web`,
// mais PAS dans un site statique produit par `expo export` : là,
// `Constants.expoConfig` ne donne rien et l'app retombait sur son repli
// `localhost:8000`. On recopie donc l'adresse dans une variable
// `EXPO_PUBLIC_…`, que Metro inline dans le bundle sur TOUTES les plateformes.
// app.json reste la SEULE source à modifier (voir src/api.js).
export default ({ config }) => {
  const adresse = process.env.API_URL || config.extra?.apiUrl || null;
  if (adresse) process.env.EXPO_PUBLIC_API_URL = adresse;
  return {
    ...config,
    extra: { ...config.extra, apiUrl: adresse },
  };
};
