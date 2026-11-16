/* =========================================================
   Fitness Royale — Coaching : l'envoi du formulaire.
   Pas de bibliothèque, pas d'étape de construction : ce fichier est servi
   tel quel. Le site est statique, seul ce formulaire parle à l'API.

   L'adresse de l'API, le délai d'attente et la lecture des erreurs vivent
   dans `commun.js`, partagé avec la page de lecture des demandes.
   ========================================================= */

(function () {
  'use strict';

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

  /* ⚠️ `textContent`, JAMAIS `innerHTML` : une partie de ce qu'on affiche ici
     vient du serveur (le `detail` d'une erreur), et un de ses messages
     recopie la valeur envoyée (« Objectif inconnu : … »). Posé en HTML, ce
     texte pourrait porter une balise. Même règle que dans `admin.js`, et
     `backend/tests/test_site_admin.py` la vérifie sur les deux fichiers. */
  function afficher(texte, genre) {
    message.className = 'message-envoi' + (genre ? ' ' + genre : '');
    message.textContent = texte;
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

  function reussite() {
    // Le formulaire disparaît : le renvoyer serait refusé (une demande par
    // contact et par 24 h), et on ne laisse pas un bouton qui ne marche plus.
    formulaire.querySelectorAll('fieldset').forEach(function (bloc) {
      bloc.remove();
    });
    bouton.remove();

    afficher('', 'ok');
    var titre = document.createElement('b');
    titre.textContent = 'C\'est envoyé, merci.';
    message.appendChild(titre);
    message.appendChild(document.createTextNode(
      'Je lis ta demande et je te recontacte très vite pour en parler. ' +
      'En attendant, tu peux déjà installer l\'application Fitness Royale et ' +
      'créer ton compte : c\'est là que ton programme arrivera.'
    ));
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
    }, window.FR.DELAI_EXPLICATION_MS);

    window.FR.appel('/coaching/demandes', {
      methode: 'POST',
      corps: construireDemande()
    }).then(function (resultat) {
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
      afficher('Demande non envoyée : ' +
               window.FR.raisonLisible(resultat.corps, resultat.code) +
               ' Tu peux réessayer.', 'erreur');
    }).catch(function (err) {
      clearTimeout(explication);
      bouton.disabled = false;
      afficher('Demande non envoyée : ' + window.FR.raisonReseau(err) + '. ' +
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
