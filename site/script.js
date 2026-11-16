/* =========================================================
   Fitness Royale — Coaching : l'envoi du formulaire.
   Pas de bibliothèque, pas d'étape de construction : ce fichier est servi
   tel quel. Le site est statique, seul ce formulaire parle à l'API.
   ========================================================= */

(function () {
  'use strict';

  // L'ADRESSE DE L'API. En local (vérification dans le navigateur avec le
  // backend lancé à côté), on tape le backend local ; partout ailleurs,
  // l'adresse fixe en ligne. C'est le même principe que `obtenirBaseUrl()`
  // dans src/api.js, en beaucoup plus simple : un site web n'a qu'un hôte.
  var enLocal = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
  var API = enLocal ? 'http://localhost:8000' : 'https://fitnessroyale.onrender.com';

  // ⚠️ LE DÉLAI EST LONG, ET C'EST VOULU. L'hébergement gratuit met la
  // machine en veille après un moment d'inactivité : la toute première
  // demande de la journée peut mettre près d'une minute à aboutir. Couper au
  // bout de quelques secondes ferait croire à une panne et perdrait la
  // demande d'une vraie personne. (Voir « Réveil du serveur » dans CLAUDE.md.)
  var DELAI_MAX_MS = 70000;
  // Au bout de ce temps, on explique l'attente au lieu de laisser tourner.
  var DELAI_EXPLICATION_MS = 4000;

  var formulaire = document.getElementById('formulaire');
  var bouton = document.getElementById('envoyer');
  var message = document.getElementById('message-envoi');

  if (!formulaire || !bouton || !message) { return; }

  // Les champs obligatoires, avec ce qu'on dit quand ils manquent.
  var OBLIGATOIRES = [
    ['prenom', 'ton prénom'],
    ['contact', 'ton e-mail ou ton téléphone'],
    ['objectif', 'ton objectif'],
    ['niveau', 'ton niveau'],
    ['jours_par_semaine', 'le nombre de jours par semaine'],
    ['materiel', 'ton matériel']
  ];
  // Les champs chiffrés et facultatifs : envoyés seulement s'ils sont remplis.
  var NOMBRES = ['age', 'poids', 'taille'];

  function valeur(nom) {
    var champ = document.getElementById(nom);
    return champ ? champ.value.trim() : '';
  }

  function marquer(nom, fautif) {
    var champ = document.getElementById(nom);
    if (champ) { champ.classList.toggle('faux', fautif); }
  }

  function afficher(texte, genre) {
    message.className = 'message-envoi' + (genre ? ' ' + genre : '');
    message.innerHTML = texte;
  }

  /* Transforme la réponse d'erreur de l'API en une phrase lisible.
     Le `detail` est soit une chaîne (nos propres messages), soit la liste
     des erreurs de validation — qu'on ne montre jamais telle quelle. */
  function raisonLisible(corps, code) {
    if (corps && typeof corps.detail === 'string') { return corps.detail; }
    if (corps && Array.isArray(corps.detail)) {
      return 'Un des champs ne convient pas. Vérifie ton âge, ton poids et ta taille.';
    }
    return 'Quelque chose a mal tourné (code ' + code + ').';
  }

  function construireDemande() {
    var demande = {
      prenom: valeur('prenom'),
      contact: valeur('contact'),
      objectif: valeur('objectif'),
      niveau: valeur('niveau'),
      jours_par_semaine: parseInt(valeur('jours_par_semaine'), 10),
      materiel: valeur('materiel'),
      piege: valeur('piege')
    };
    if (valeur('formule')) { demande.formule = valeur('formule'); }
    NOMBRES.forEach(function (nom) {
      var brut = valeur(nom).replace(',', '.');
      if (brut !== '') {
        var nombre = parseFloat(brut);
        if (!isNaN(nombre)) { demande[nom] = nombre; }
      }
    });
    if (valeur('limitations')) { demande.limitations = valeur('limitations'); }
    if (valeur('message')) { demande.message = valeur('message'); }
    return demande;
  }

  function premierManquant() {
    for (var i = 0; i < OBLIGATOIRES.length; i++) {
      var nom = OBLIGATOIRES[i][0];
      var rempli = valeur(nom) !== '';
      marquer(nom, !rempli);
      if (!rempli) { return OBLIGATOIRES[i]; }
    }
    return null;
  }

  function envoyer(demande) {
    // AbortController fixe nous-mêmes la limite : sans ça, le navigateur
    // peut abandonner bien plus tôt ou bien plus tard selon la plateforme.
    var arret = new AbortController();
    var minuteur = setTimeout(function () { arret.abort(); }, DELAI_MAX_MS);

    return fetch(API + '/coaching/demandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demande),
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

  function reussite() {
    // Le formulaire disparaît : le renvoyer serait refusé (une demande par
    // contact et par 24 h), et on ne laisse pas un bouton qui ne marche plus.
    formulaire.querySelectorAll('fieldset').forEach(function (bloc) {
      bloc.remove();
    });
    bouton.remove();
    afficher(
      '<b>C\'est envoyé, merci.</b>' +
      'Je lis ta demande et je te recontacte très vite pour en parler. ' +
      'En attendant, tu peux déjà installer l\'application Fitness Royale et ' +
      'créer ton compte : c\'est là que ton programme arrivera.',
      'ok'
    );
    message.scrollIntoView({ block: 'center' });
  }

  formulaire.addEventListener('submit', function (evenement) {
    evenement.preventDefault();

    var manquant = premierManquant();
    if (manquant) {
      afficher('Il manque ' + manquant[1] + '.', 'erreur');
      var champ = document.getElementById(manquant[0]);
      if (champ) { champ.focus(); }
      return;
    }

    bouton.disabled = true;
    afficher('Envoi en cours…', 'attente');
    var explication = setTimeout(function () {
      afficher(
        'Envoi en cours… La première demande de la journée peut prendre ' +
        'jusqu\'à une minute, c\'est normal. Ne ferme pas la page.',
        'attente'
      );
    }, DELAI_EXPLICATION_MS);

    envoyer(construireDemande()).then(function (resultat) {
      clearTimeout(explication);
      if (resultat.ok) {
        reussite();
        return;
      }
      bouton.disabled = false;
      if (resultat.code === 409) {
        // Ce n'est pas une erreur de sa part : sa demande est déjà arrivée.
        afficher('Tu as déjà envoyé une demande il y a moins de 24 h — ' +
                 'elle est bien arrivée, je te réponds très vite.', 'ok');
        return;
      }
      afficher('Demande non envoyée : ' + raisonLisible(resultat.corps, resultat.code) +
               ' Tu peux réessayer.', 'erreur');
    }).catch(function (err) {
      clearTimeout(explication);
      bouton.disabled = false;
      var raison = (err && err.name === 'AbortError')
        ? 'la connexion est trop lente'
        : 'pas de connexion internet';
      afficher('Demande non envoyée : ' + raison + '. ' +
               'Vérifie ta connexion et réessaie — rien n\'est perdu, ' +
               'ce que tu as écrit est toujours là.', 'erreur');
    });
  });

  // Un champ corrigé perd sa bordure rouge tout de suite.
  OBLIGATOIRES.forEach(function (paire) {
    var champ = document.getElementById(paire[0]);
    if (champ) {
      champ.addEventListener('input', function () { marquer(paire[0], false); });
      champ.addEventListener('change', function () { marquer(paire[0], false); });
    }
  });
})();
