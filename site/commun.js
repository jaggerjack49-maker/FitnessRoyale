/* =========================================================
   Fitness Royale — Coaching : ce que les DEUX pages partagent.
   (la page publique `index.html` et la page de lecture `admin.html`)

   ⚠️ L'ADRESSE DE L'API N'EST ÉCRITE QU'ICI, et c'est tout l'intérêt de ce
   fichier. Une adresse recopiée à deux endroits finit toujours par diverger —
   et celle-là, quand elle se trompe, pointe sur `localhost`, c'est-à-dire sur
   l'appareil du visiteur : la page semble marcher chez soi et ne marche chez
   personne (le bug du 21/09/2026, déjà payé une fois).
   ========================================================= */

window.FR = (function () {
  'use strict';

  // En local (vérification avec le backend lancé à côté) on tape le backend
  // local ; partout ailleurs, l'adresse fixe en ligne.
  var enLocal = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
  var API = enLocal ? 'http://localhost:8000' : 'https://fitnessroyale.onrender.com';

  // ⚠️ LE DÉLAI EST LONG, ET C'EST VOULU. L'hébergement gratuit met la
  // machine en veille : la toute première demande de la journée peut mettre
  // près d'une minute. Couper au bout de quelques secondes ferait croire à
  // une panne. (Voir « Réveil du serveur » dans CLAUDE.md.)
  var DELAI_MAX_MS = 70000;
  // Au bout de ce temps, on explique l'attente au lieu de laisser tourner.
  var DELAI_EXPLICATION_MS = 4000;

  /* Un appel à l'API. Renvoie TOUJOURS { ok, code, corps } quand le serveur a
     répondu — même pour une erreur, parce que c'est le corps qui porte la
     raison. Ne lève que si on n'a pas pu lui parler du tout (réseau coupé,
     délai dépassé). */
  function appel(chemin, options) {
    var reglages = options || {};
    // AbortController fixe nous-mêmes la limite : sans ça, le navigateur peut
    // abandonner bien plus tôt ou bien plus tard selon la plateforme.
    var arret = new AbortController();
    var minuteur = setTimeout(function () { arret.abort(); }, DELAI_MAX_MS);

    var entetes = { 'Content-Type': 'application/json' };
    if (reglages.jeton) { entetes.Authorization = 'Bearer ' + reglages.jeton; }

    return fetch(API + chemin, {
      method: reglages.methode || 'GET',
      headers: entetes,
      body: reglages.corps ? JSON.stringify(reglages.corps) : undefined,
      signal: arret.signal
    }).then(function (reponse) {
      clearTimeout(minuteur);
      return reponse.json().catch(function () { return {}; }).then(function (corps) {
        return { ok: reponse.ok, code: reponse.status, corps: corps };
      });
    }, function (err) {
      clearTimeout(minuteur);
      throw err;
    });
  }

  /* Transforme une réponse d'erreur en une phrase lisible. Le `detail` est
     soit une chaîne (nos propres messages), soit la liste des erreurs de
     validation — qu'on ne montre jamais telle quelle. */
  function raisonLisible(corps, code) {
    if (corps && typeof corps.detail === 'string') { return corps.detail; }
    if (corps && Array.isArray(corps.detail)) {
      return 'Un des champs ne convient pas. Vérifie ton âge, ton poids et ta taille.';
    }
    return 'Quelque chose a mal tourné (code ' + code + ').';
  }

  /* Pourquoi on n'a pas pu parler au serveur du tout. */
  function raisonReseau(err) {
    return (err && err.name === 'AbortError')
      ? 'la connexion est trop lente'
      : 'pas de connexion internet';
  }

  return {
    API: API,
    DELAI_MAX_MS: DELAI_MAX_MS,
    DELAI_EXPLICATION_MS: DELAI_EXPLICATION_MS,
    appel: appel,
    raisonLisible: raisonLisible,
    raisonReseau: raisonReseau
  };
})();
