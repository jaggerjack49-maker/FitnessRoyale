/* =========================================================
   Fitness Royale — Coaching : LIRE les demandes reçues.

   Cette page est le pendant privé du formulaire public : lui écrit, elle lit.
   Elle n'a aucun pouvoir propre — c'est le SERVEUR qui exige un compte
   administrateur (`GET /admin/coaching/demandes` répond 403 à tout autre
   compte, et 401 sans jeton). Copiée telle quelle sur un autre site, elle ne
   montrerait toujours rien à personne.

   ⚠️ RÈGLE ABSOLUE DE CE FICHIER : JAMAIS D'HTML CONSTRUIT À PARTIR D'UNE
   DONNÉE REÇUE. Tout passe par `createElement` + `textContent`. Une demande
   est écrite par n'importe quel visiteur du site : si on la collait dans la
   page avec `innerHTML`, il suffirait d'envoyer une demande contenant une
   balise de script pour qu'elle s'exécute ICI, dans la page où vit le jeton
   d'administration — et le voler. `backend/tests/test_site_admin.py` vérifie
   qu'aucune de ces fonctions n'apparaît dans ce fichier.
   ========================================================= */

(function () {
  'use strict';

  // Le jeton est gardé d'une visite à l'autre, comme dans l'application.
  // « Se déconnecter » appelle /auth/deconnexion, qui le DÉTRUIT côté
  // serveur : c'est la seule chose qui le rend vraiment inutilisable.
  var CLE_JETON = 'fitnessRoyale.coaching.jeton';
  var CLE_PSEUDO = 'fitnessRoyale.coaching.pseudo';

  // Les libellés lisibles des listes fermées du formulaire. Une clé inconnue
  // retombe sur la valeur brute : un libellé manquant ne doit jamais effacer
  // l'information. (Mêmes clés que OBJECTIFS_COACHING & co. dans main.py.)
  var LIBELLES = {
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
    je_ne_sais_pas: 'Ne sait pas encore'
  };

  // Les quatre états, dans l'ordre où on les fait avancer.
  // Mêmes clés que STATUTS_DEMANDE côté serveur.
  var STATUTS = [
    { cle: 'nouvelle', libelle: 'Nouvelle' },
    { cle: 'en_cours', libelle: 'En cours' },
    { cle: 'acceptee', libelle: 'Acceptée' },
    { cle: 'refusee', libelle: 'Refusée' }
  ];

  var vueConnexion = document.getElementById('vue-connexion');
  var vueListe = document.getElementById('vue-liste');
  var formulaireConnexion = document.getElementById('formulaire-connexion');
  var boutonConnecter = document.getElementById('connecter');
  var messageConnexion = document.getElementById('message-connexion');
  var messageListe = document.getElementById('message-liste');
  var zoneDemandes = document.getElementById('demandes');
  var zoneFiltres = document.getElementById('filtres');
  var resume = document.getElementById('resume');
  var boutonActualiser = document.getElementById('actualiser');
  var boutonDeconnexion = document.getElementById('deconnexion');
  var qui = document.getElementById('qui');

  var demandes = [];
  var filtre = 'toutes';
  var occupe = false;

  /* ---------- Petits outils ---------- */

  // Le SEUL constructeur d'élément de ce fichier : un texte est un texte,
  // jamais du balisage (voir l'avertissement en tête).
  function el(balise, classe, texte) {
    var noeud = document.createElement(balise);
    if (classe) { noeud.className = classe; }
    if (texte !== undefined && texte !== null && texte !== '') {
      noeud.textContent = String(texte);
    }
    return noeud;
  }

  function vider(noeud) {
    while (noeud.firstChild) { noeud.removeChild(noeud.firstChild); }
  }

  function afficher(zone, texte, genre) {
    zone.className = 'message-envoi' + (genre ? ' ' + genre : '');
    zone.textContent = texte || '';
  }

  // localStorage peut lever (navigation privée, site bloqué) : on ne laisse
  // jamais ça casser la page, on redemande simplement le mot de passe.
  var memoire = {
    lire: function (cle) {
      try { return window.localStorage.getItem(cle) || ''; } catch (e) { return ''; }
    },
    ecrire: function (cle, valeur) {
      try { window.localStorage.setItem(cle, valeur); } catch (e) { /* tant pis */ }
    },
    effacer: function (cle) {
      try { window.localStorage.removeItem(cle); } catch (e) { /* tant pis */ }
    }
  };

  function jeton() { return memoire.lire(CLE_JETON); }

  function lisible(valeur) {
    if (valeur === null || valeur === undefined || valeur === '') { return ''; }
    return LIBELLES[valeur] || String(valeur);
  }

  function libelleStatut(cle) {
    for (var i = 0; i < STATUTS.length; i++) {
      if (STATUTS[i].cle === cle) { return STATUTS[i].libelle; }
    }
    return String(cle || 'Nouvelle');
  }

  // « 2026-11-15T09:12:33.000 » → « 15/11/2026 à 09:12 ». On ne passe pas par
  // `new Date(...)` : l'horodatage est déjà celui qu'on veut montrer, à
  // l'heure du serveur, et on n'a rien à convertir.
  function quand(horodatage) {
    var texte = typeof horodatage === 'string' ? horodatage : '';
    var m = texte.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) { return ''; }
    return m[3] + '/' + m[2] + '/' + m[1] + ' à ' + m[4] + ':' + m[5];
  }

  /* Le contact devient cliquable quand on reconnaît SANS AMBIGUÏTÉ un e-mail
     ou un téléphone — sinon c'est du texte. Le schéma (`mailto:`, `tel:`)
     vient de nous, jamais de la saisie : impossible d'y glisser autre chose. */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var TELEPHONE = /^\+?[\d\s().-]{6,20}$/;

  function lienContact(contact) {
    var valeur = String(contact === null || contact === undefined ? '' : contact).trim();
    var lien;
    if (EMAIL.test(valeur)) {
      lien = el('a', null, valeur);
      lien.href = 'mailto:' + valeur;
      return lien;
    }
    if (TELEPHONE.test(valeur)) {
      lien = el('a', null, valeur);
      lien.href = 'tel:' + valeur.replace(/[\s().-]/g, '');
      return lien;
    }
    return el('span', null, valeur);
  }

  /* ---------- Les vues ---------- */

  function montrer(vue) {
    vueConnexion.hidden = (vue !== 'connexion');
    vueListe.hidden = (vue !== 'liste');
    boutonDeconnexion.hidden = (vue !== 'liste');
    qui.textContent = (vue === 'liste') ? memoire.lire(CLE_PSEUDO) : '';
  }

  function ligneDetail(etiquette, contenu) {
    if (!contenu || (typeof contenu === 'string' && contenu.trim() === '')) { return null; }
    var bloc = el('div', 'ligne-detail');
    bloc.appendChild(el('p', 'etiquette-detail', etiquette));
    if (typeof contenu === 'string') {
      bloc.appendChild(el('p', 'valeur-detail', contenu));
    } else {
      var enveloppe = el('p', 'valeur-detail');
      enveloppe.appendChild(contenu);
      bloc.appendChild(enveloppe);
    }
    return bloc;
  }

  function mensurations(demande) {
    var morceaux = [];
    if (demande.age) { morceaux.push(demande.age + ' ans'); }
    if (demande.poids) { morceaux.push(demande.poids + ' kg'); }
    if (demande.taille) { morceaux.push(demande.taille + ' cm'); }
    return morceaux.join(' · ');
  }

  function carte(demande) {
    var statut = demande.statut || 'nouvelle';
    var bloc = el('article', 'demande ' + statut);

    // --- L'en-tête, qui déplie le reste.
    var entete = el('button', 'entete-demande');
    entete.type = 'button';
    entete.setAttribute('aria-expanded', 'false');

    var gauche = el('span', 'entete-gauche');
    gauche.appendChild(el('span', 'prenom', demande.prenom));
    gauche.appendChild(el('span', 'resume-demande', [
      lisible(demande.objectif),
      lisible(demande.niveau),
      demande.jours_par_semaine ? demande.jours_par_semaine + ' j/sem' : ''
    ].filter(Boolean).join(' · ')));
    entete.appendChild(gauche);

    var droite = el('span', 'entete-droite');
    droite.appendChild(el('span', 'badge ' + statut, libelleStatut(statut)));
    droite.appendChild(el('span', 'date-demande', quand(demande.cree_le)));
    entete.appendChild(droite);
    entete.appendChild(el('span', 'chevron', '▾'));
    bloc.appendChild(entete);

    // --- Le détail, replié au départ.
    var detail = el('div', 'detail-demande');
    detail.hidden = true;

    [
      ligneDetail('CONTACT', lienContact(demande.contact)),
      ligneDetail('MATÉRIEL', lisible(demande.materiel)),
      ligneDetail('FORMULE', lisible(demande.formule)),
      ligneDetail('PROFIL', mensurations(demande)),
      ligneDetail('BLESSURES, LIMITATIONS', demande.limitations),
      ligneDetail('SON MESSAGE', demande.message),
      // La date complète, parce que l'en-tête la masque sur petit écran.
      ligneDetail('REÇUE LE', quand(demande.cree_le))
    ].forEach(function (ligne) {
      if (ligne) { detail.appendChild(ligne); }
    });

    detail.appendChild(el('p', 'etiquette-detail etiquette-statuts', 'FAIRE AVANCER'));
    var rangee = el('div', 'rangee-statuts');
    STATUTS.forEach(function (s) {
      var bouton = el('button', 'puce-statut' + (s.cle === statut ? ' actif ' + s.cle : ''), s.libelle);
      bouton.type = 'button';
      bouton.disabled = (s.cle === statut);
      bouton.addEventListener('click', function () { changerStatut(demande.id, s.cle); });
      rangee.appendChild(bouton);
    });
    detail.appendChild(rangee);
    bloc.appendChild(detail);

    entete.addEventListener('click', function () {
      detail.hidden = !detail.hidden;
      entete.setAttribute('aria-expanded', detail.hidden ? 'false' : 'true');
      bloc.classList.toggle('deplie', !detail.hidden);
    });

    return bloc;
  }

  function compter(cle) {
    return demandes.filter(function (d) { return d.statut === cle; }).length;
  }

  function dessinerFiltres() {
    vider(zoneFiltres);
    var choix = [{ cle: 'toutes', libelle: 'Toutes', nombre: demandes.length }];
    STATUTS.forEach(function (s) {
      choix.push({ cle: s.cle, libelle: s.libelle, nombre: compter(s.cle) });
    });
    choix.forEach(function (c) {
      var puce = el('button', 'puce-filtre' + (c.cle === filtre ? ' actif' : ''),
                    c.libelle + ' (' + c.nombre + ')');
      puce.type = 'button';
      puce.addEventListener('click', function () {
        filtre = c.cle;
        dessiner();
      });
      zoneFiltres.appendChild(puce);
    });
  }

  function dessiner() {
    dessinerFiltres();

    var nouvelles = compter('nouvelle');
    resume.textContent = demandes.length === 0
      ? 'Aucune demande pour l\'instant.'
      : demandes.length + ' demande' + (demandes.length > 1 ? 's' : '') +
        ' reçue' + (demandes.length > 1 ? 's' : '') +
        (nouvelles > 0 ? ' · ' + nouvelles + ' à traiter' : ' · tout est traité');

    vider(zoneDemandes);
    var montrees = (filtre === 'toutes')
      ? demandes
      : demandes.filter(function (d) { return d.statut === filtre; });

    if (montrees.length === 0) {
      zoneDemandes.appendChild(el('p', 'vide', demandes.length === 0
        ? 'Elles arriveront ici dès que quelqu\'un remplira le formulaire du site.'
        : 'Aucune demande dans cet état.'));
      return;
    }
    montrees.forEach(function (demande) {
      zoneDemandes.appendChild(carte(demande));
    });
  }

  /* ---------- Parler au serveur ---------- */

  // Le jeton ne vaut plus rien : on l'oublie et on redemande le mot de passe.
  function sessionPerdue(raison) {
    memoire.effacer(CLE_JETON);
    memoire.effacer(CLE_PSEUDO);
    montrer('connexion');
    afficher(messageConnexion, raison, 'erreur');
  }

  function charger() {
    if (!jeton()) { montrer('connexion'); return; }
    afficher(messageListe, 'Chargement…', 'attente');
    var explication = setTimeout(function () {
      afficher(messageListe, 'Chargement… La première ouverture de la journée ' +
               'peut prendre jusqu\'à une minute, c\'est normal.', 'attente');
    }, window.FR.DELAI_EXPLICATION_MS);

    window.FR.appel('/admin/coaching/demandes', { jeton: jeton() })
      .then(function (reponse) {
        clearTimeout(explication);
        if (reponse.ok) {
          demandes = Array.isArray(reponse.corps) ? reponse.corps : [];
          montrer('liste');
          afficher(messageListe, '');
          dessiner();
          return;
        }
        if (reponse.code === 401) {
          sessionPerdue('Ta session a expiré. Reconnecte-toi.');
          return;
        }
        if (reponse.code === 403) {
          montrer('liste');
          demandes = [];
          dessiner();
          afficher(messageListe, 'Ce compte n\'est pas administrateur : ' +
                   'les demandes ne lui sont pas accessibles.', 'erreur');
          return;
        }
        montrer('liste');
        afficher(messageListe, 'Les demandes n\'ont pas pu être chargées : ' +
                 window.FR.raisonLisible(reponse.corps, reponse.code), 'erreur');
      })
      .catch(function (err) {
        clearTimeout(explication);
        montrer(jeton() ? 'liste' : 'connexion');
        afficher(messageListe, 'Les demandes n\'ont pas pu être chargées : ' +
                 window.FR.raisonReseau(err) + '. Réessaie.', 'erreur');
      });
  }

  function changerStatut(identifiant, statut) {
    if (occupe) { return; }
    occupe = true;
    afficher(messageListe, '');

    // Mise à jour optimiste : la liste réagit tout de suite. En cas d'échec on
    // RECHARGE la vérité plutôt que de laisser l'écran mentir (règle posée le
    // 04/09/2026 pour les suppressions).
    var avant = demandes.map(function (d) { return d; });
    demandes = demandes.map(function (d) {
      return (d.id === identifiant) ? Object.assign({}, d, { statut: statut }) : d;
    });
    dessiner();

    window.FR.appel('/admin/coaching/demandes/' + identifiant + '/statut', {
      methode: 'PUT',
      jeton: jeton(),
      corps: { statut: statut }
    }).then(function (reponse) {
      occupe = false;
      if (reponse.ok) { return; }
      demandes = avant;
      dessiner();
      if (reponse.code === 401) {
        sessionPerdue('Ta session a expiré. Reconnecte-toi.');
        return;
      }
      afficher(messageListe, 'Changement NON enregistré : ' +
               window.FR.raisonLisible(reponse.corps, reponse.code), 'erreur');
    }).catch(function (err) {
      occupe = false;
      demandes = avant;
      dessiner();
      afficher(messageListe, 'Changement NON enregistré : ' +
               window.FR.raisonReseau(err) + '.', 'erreur');
    });
  }

  function seConnecter(pseudo, motDePasse) {
    boutonConnecter.disabled = true;
    afficher(messageConnexion, 'Connexion…', 'attente');
    var explication = setTimeout(function () {
      afficher(messageConnexion, 'Connexion… La première de la journée peut ' +
               'prendre jusqu\'à une minute, c\'est normal.', 'attente');
    }, window.FR.DELAI_EXPLICATION_MS);

    window.FR.appel('/auth/connexion', {
      methode: 'POST',
      corps: { pseudo: pseudo, mot_de_passe: motDePasse }
    }).then(function (reponse) {
      clearTimeout(explication);
      boutonConnecter.disabled = false;
      if (!reponse.ok) {
        afficher(messageConnexion, reponse.code === 401
          ? 'Pseudo ou mot de passe incorrect.'
          : window.FR.raisonLisible(reponse.corps, reponse.code), 'erreur');
        return;
      }
      var joueur = reponse.corps.joueur || {};
      // ⚠️ `admin` arrive de la base : c'est un 0 ou un 1, pas un booléen.
      if (!joueur.admin) {
        // Un compte ordinaire n'a rien à faire ici : on rend tout de suite le
        // jeton qu'on vient d'obtenir au lieu de le garder pour rien.
        window.FR.appel('/auth/deconnexion', {
          methode: 'POST', jeton: reponse.corps.token
        }).catch(function () { /* sans importance */ });
        afficher(messageConnexion, 'Ce compte n\'est pas administrateur : ' +
                 'les demandes de coaching ne lui sont pas accessibles.', 'erreur');
        return;
      }
      memoire.ecrire(CLE_JETON, reponse.corps.token);
      memoire.ecrire(CLE_PSEUDO, joueur.pseudo || pseudo);
      afficher(messageConnexion, '');
      document.getElementById('mot_de_passe').value = '';
      charger();
    }).catch(function (err) {
      clearTimeout(explication);
      boutonConnecter.disabled = false;
      afficher(messageConnexion, 'Connexion impossible : ' +
               window.FR.raisonReseau(err) + '. Réessaie.', 'erreur');
    });
  }

  function seDeconnecter() {
    var ancien = jeton();
    memoire.effacer(CLE_JETON);
    memoire.effacer(CLE_PSEUDO);
    demandes = [];
    montrer('connexion');
    afficher(messageConnexion, 'À tout de suite.', 'ok');
    // Le jeton est DÉTRUIT côté serveur : l'oublier ici ne suffirait pas.
    if (ancien) {
      window.FR.appel('/auth/deconnexion', { methode: 'POST', jeton: ancien })
        .catch(function () { /* sans importance : il est déjà oublié ici */ });
    }
  }

  /* ---------- Branchements ---------- */

  formulaireConnexion.addEventListener('submit', function (evenement) {
    evenement.preventDefault();
    var pseudo = document.getElementById('pseudo').value.trim();
    var motDePasse = document.getElementById('mot_de_passe').value;
    if (!pseudo || !motDePasse) {
      afficher(messageConnexion, 'Il manque ton pseudo ou ton mot de passe.', 'erreur');
      return;
    }
    seConnecter(pseudo, motDePasse);
  });

  boutonActualiser.addEventListener('click', charger);
  boutonDeconnexion.addEventListener('click', seDeconnecter);

  montrer(jeton() ? 'liste' : 'connexion');
  if (jeton()) { charger(); }
})();
