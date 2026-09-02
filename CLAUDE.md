# Fitness Royale

App de fitness compétitive, esprit « Clash Royale dans la vraie vie ». Marque : Fitness Royale — « FIGHT FOR IT ».
RENOMMAGE DU 26/08/2026 (demande de Hafiz) : la marque « Club SP » a disparu de TOUT l'affichage —
on dit désormais « barème Fitness Royale », et l'en-tête d'accueil comme l'écran de connexion ne
portent plus que FITNESS ROYALE + le slogan. Seuls restent des identifiants INTERNES : le fichier
`src/data/clubSP.js` (chemin d'import, renommer toucherait ~10 fichiers pour rien) et les sections
datées ci-dessous, qui gardent le vocabulaire de leur époque.
LIRE `docs/CONTEXTE.md` : c'est le document de référence (vision, barème complet, roadmap 6 mois).
Hafiz (le créateur) est débutant en programmation : expliquer simplement, commenter le code en français.

## État actuel (v0.7 — comptes, duels en ligne, vidéo, chat de clan, avatar évolutif, entraînement)

- ORDRE DES ONGLETS (revu le 26/08/2026) : Profil · Perfs · Paliers · Compétition · Entraînement ·
  Clan — défini par le tableau `ONGLETS` en tête d'App.js, réordonner ce tableau suffit.
- Écrans : Profil (rang global + rang catégorie, salle de gym éditable, perfs, séances), Performances (saisie + statuts), Entraînement (programmes + journal de séance, voir section dédiée), Paliers (barème complet par exercice, échelle dépliable, prochain objectif), Compétition (classements — global / par poids / par exercice / salles — + défis + duels)
- Le classement AFFICHE uniquement le RANG (1er, 2e…) — jamais les moyennes de paliers (calcul interne)
- Plus de « niveau » ni de « points » : le rang et la ligue suffisent
- Salle de gym : champ libre dans l'onglet CLAN (déplacé du Profil le 01/09/2026 — la salle EST
  le clan). Sert au chat de clan, au classement des membres et au classement par salle.
  Depuis le 01/09/2026 elle est VRAIMENT enregistrée côté serveur (`PUT /joueurs/{id}/salle`) :
  ce n'est plus un champ local.
- POINTS de compétition (duels + défis) : DÉPARTAGE des égalités uniquement, jamais le critère principal
- Défis récurrents : journalier (+20 pts) et hebdomadaire (+100 pts + titre) — CÔTÉ FRONT toujours
  simulés (bouton "Valider" = simulation locale, comme avant). CÔTÉ BACKEND, désormais réels :
  voir "Défis récurrents (backend)" ci-dessous. Le lien front↔backend pour les défis est une
  prochaine étape (voir "À faire").
- Titres (ex. « Guerrier de la semaine ») : gagnés via défis, affichés au Profil (encore simulés côté front)
- Classement Salles : palier moyen des membres de chaque salle, départage aux points cumulés
- DUELS (src/logic/duels.js) : charge fixe, le plus de reps gagne, premier à 2 victoires.
  R1 choisi par le challenger, R2 par l'adversaire, R3 (départage) par l'IA.
  DEUX façons de jouer maintenant : le duel EN DIRECT (pass-and-play, un seul téléphone,
  toujours simulé/local, voir ci-dessous) et le duel EN LIGNE (deux téléphones séparés, vrai
  compte requis, via un code à partager — voir "Duels en ligne à deux téléphones" plus bas).
- DUEL EN DIRECT (src/components/DuelDirect.js) : pass-and-play sur UN téléphone (les deux joueurs
  en salle), le téléphone arbitre. FAIT : le duel à DEUX téléphones existe (code à partager, voir
  "Duels en ligne à deux téléphones") — synchronisé par polling, pas encore par WebSocket (voir
  "À faire" si le besoin de vrai temps réel se fait sentir).
- Barèmes Club SP dans `src/data/clubSP.js` — hommes Bronze→Royal (6), femmes Bronze→Titan (5)
  (« Royal » remplace l'ancien nom « Olympe »)
- Logique dans `src/logic/classement.js` : palier par exercice, ligue = palier moyen,
  classement global par RANG (1er, 2e…) basé sur le PALIER MOYEN (pas la somme) + relatif par CATÉGORIES DE POIDS (-60/-70/-80/-90/+90 kg), rang au palier moyen dans chaque catégorie
- Preuve de performance (`src/data/statuts.js`) : Déclaré (suivi perso, hors classement) /
  Vérifié communauté (vidéo) / Vérifié salle (partenaire). Seul le vérifié compte.
  VÉRIFIÉ COMMUNAUTÉ = maintenant une VRAIE vidéo + un vrai vote d'un autre joueur pour un compte
  connecté (voir "Upload vidéo + validation communauté" plus bas) ; reste une simulation en mode
  hors-ligne (pas de serveur à qui envoyer la vidéo).
- État partagé : `mesPerfs` vit dans App.js, passé en props. Données factices dans mockData.js
  (servent de repli hors-ligne — voir "Branchement backend" ci-dessous).
- Test : `npx expo start` (SANS --tunnel si tu veux tester avec le backend, voir plus bas) avec Expo Go.

- Calories : ESTIMÉES depuis le temps d'entraînement (~8 kcal/min), pas de vraie mesure
- Séances : saisies par l'utilisateur dans Profil (durée en minutes) ; état mesSeances dans App.js.
  Restent LOCALES pour l'instant (pas encore envoyées au serveur) — le backend a bien un endpoint
  pour enregistrer des séances (utilisé par les défis), mais l'app ne l'appelle pas encore
  automatiquement quand tu ajoutes une séance dans Profil. Prochaine étape si on veut que les
  défis "réels" du backend se déclenchent depuis l'usage normal de l'app.

## Branchement backend (front ↔ API) — fait le 20/07/2026

- `src/api.js` : le client HTTP vers le backend FastAPI. Toutes les fonctions (joueurs, perfs,
  vérifications, classements, + duels/séances/défis pour un usage futur) lèvent une erreur si le
  serveur ne répond pas sous 4 secondes (timeout) — App.js les attrape et repasse en mode hors-ligne.
- ADRESSE DU SERVEUR : détectée automatiquement via `Constants.expoConfig.hostUri` (l'IP de ton PC
  sur le réseau local, fournie par Expo). **Ça ne marche QU'EN MODE LAN** (`npx expo start` sans
  `--tunnel`) : le téléphone et le PC doivent être sur le même Wi-Fi. En mode `--tunnel`, le
  téléphone ne peut pas joindre directement ton PC sur le port 8000 → l'app bascule automatiquement
  en mode hors-ligne (c'est normal, pas un bug). Pour forcer une adresse précise, modifier
  `expo.extra.apiUrl` dans `app.json`.
- BUG CORRIGÉ (20/07/2026) : l'adresse du serveur était calculée UNE SEULE FOIS au chargement de
  `api.js` (`const BASE_URL = ...`). Si `Constants.expoConfig` n'était pas encore rempli à cet
  instant précis (ça peut arriver selon la façon dont l'app est ouverte, ex. lien `exp://` collé
  dans le navigateur du téléphone plutôt que scan QR), l'adresse retombait silencieusement sur
  `localhost` — qui, sur un téléphone, désigne le téléphone lui-même, jamais le PC. Résultat :
  "mode hors-ligne" en boucle, alors que le réseau/pare-feu étaient corrects. Corrigé en
  recalculant l'adresse à CHAQUE appel (`obtenirBaseUrl()`) au lieu d'une constante figée au
  démarrage, et en vérifiant plusieurs sources Expo possibles (`hostUri`, `expoGoConfig.debuggerHost`,
  `manifest.hostUri`, `manifest2...hostUri`) pour couvrir différentes versions/modes de connexion
  d'Expo Go. L'adresse actuellement utilisée est maintenant affichée dans la bannière hors-ligne
  de l'app (`api.adresseServeur()`) pour diagnostiquer plus vite si ça se reproduit.
- SI ÇA NE MARCHE TOUJOURS PAS malgré un bon réseau : vérifier le pare-feu Windows. Les règles
  auto-créées pour `python.exe` par une invite interactive sont parfois scopées à UN SEUL profil
  réseau (ex. seulement "Public") — si tu changes ton réseau de Public à Privé (recommandé pour
  un réseau domestique), l'ancienne règle ne s'applique plus. Solution robuste : créer une règle
  explicite pour le port, valable sur tous les profils :
  `New-NetFirewallRule -DisplayName "Fitness Royale Backend" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow`
  (nécessite PowerShell en administrateur). Pour tester si le blocage vient du réseau ou de l'app,
  ouvrir `http://<IP-DU-PC>:8000/sante` dans le NAVIGATEUR du téléphone — si ça affiche
  `{"statut":"ok"}`, le réseau est bon et le problème est côté app (comme ci-dessus) ; sinon
  c'est un vrai blocage réseau (pare-feu ou isolation Wi-Fi du routeur).
- BUG CORRIGÉ (23/07/2026) : « Objects are not valid as a React child » au lancement de l'app,
  dans la bannière "Mode hors-ligne" (`App.js`), sur l'affichage de `api.adresseServeur()`.
  Cause probable : sur le téléphone testé, une des sources lues par `obtenirBaseUrl()` (l'API
  historique `Constants.manifest`, gardée en repli pour compatibilité) ne renvoyait pas une vraie
  chaîne de caractères dans ce contexte précis (comportement qui semble varier selon la version
  d'Expo Go). Corrigé en rendant `obtenirBaseUrl()` totalement défensive : chaque source est
  validée avec `chaineValide()` (doit être une vraie chaîne non vide, sinon ignorée), toute la
  fonction est protégée par un `try/catch`, et `adresseServeur()` force `String(...)` en dernier
  rempart — impossible désormais qu'autre chose qu'une chaîne soit renvoyée.
  PROFITE-EN AUSSI : `messageErreurDepuis()` dans `api.js` transforme aussi TOUJOURS le `detail`
  d'une erreur serveur (chaîne, ou liste d'erreurs de validation Pydantic 422) en texte lisible
  avant de le lever comme erreur — même genre de garde-fou, pour une autre source possible du
  même type de plantage.
- OUTIL DE DIAGNOSTIC AJOUTÉ (23/07/2026) : `src/components/LimiteErreur.js`, un composant
  "Error Boundary" React qui enveloppe toute l'app (`App.js`). Si un écran plante au rendu,
  il affiche le message ET la vraie pile de COMPOSANTS (pas la pile technique de React) —
  ça a permis de localiser précisément le bug ci-dessus sans accès à un ordinateur de dev.
  Reste en place en permanence : utile pour tout futur bug de rendu.
- COMPTES (depuis le 20/07/2026) : l'auto-création anonyme de "Hafiz" n'existe plus — il faut un
  vrai compte (pseudo + mot de passe). Voir section "Comptes sécurisés" ci-dessous pour le détail.
- DÉCISION : les CLASSEMENTS (global/poids/salles) ne passent PAS par les endpoints
  `/classement/...` du serveur — l'app récupère juste la LISTE des joueurs (`GET /joueurs`) et
  recalcule le classement EN LOCAL avec `src/logic/classement.js` (déjà testé, déjà utilisé par
  tous les écrans, gère le `moi: true` pour la mise en avant). Ça évite de dupliquer l'affichage
  (couleurs de ligue, badges, mise en forme) pour deux formats de données différents.
- DÉCISION : les POINTS et TITRES restent 100% gérés en LOCAL (comme avant le branchement), parce
  que les duels et défis affichés dans l'app sont encore simulés côté front (voir plus haut). Le
  serveur a bien un compteur de points par joueur (pour les AUTRES joueurs de démo, ex. IronMax
  520 pts), mais celui de "Hafiz" n'est pas encore relié aux boutons de l'app.
- Écran de chargement (« ⏳ Connexion au serveur… ») pendant la tentative de connexion initiale ;
  bannière discrète (« 📡 Mode hors-ligne ») affichée en haut de l'app tant que le serveur n'est
  pas joignable. Si une requête échoue APRÈS la connexion initiale (perf ajoutée en cours de
  route…), l'app repasse silencieusement hors-ligne sans effacer ce que l'utilisateur vient de saisir.
- Dépendance ajoutée : `expo-constants` (détection de l'IP du serveur).

## Comptes sécurisés — fait le 20/07/2026

- Inscription (`POST /auth/inscription`) et connexion (`POST /auth/connexion`) : pseudo + mot de
  passe. Le mot de passe est haché avec PBKDF2-HMAC-SHA256 (200 000 itérations, sel aléatoire par
  compte) — voir `backend/app/auth.py`. DÉCISION : PBKDF2 via `hashlib` (bibliothèque standard de
  Python) plutôt que `bcrypt`, pour éviter d'installer une dépendance compilée (parfois pénible à
  installer sous Windows) — PBKDF2 avec autant d'itérations est tout aussi reconnu comme sûr.
- Connexion réussie → un TOKEN opaque (chaîne aléatoire) est renvoyé et doit être envoyé dans
  l'en-tête `Authorization: Bearer <token>` sur les appels suivants. Le token est stocké dans une
  table `sessions` (pas de JWT — plus simple à comprendre et à invalider : `POST /auth/deconnexion`
  supprime juste la ligne). DÉCISION : pas d'expiration automatique des tokens pour l'instant (projet
  perso, pas de vrais enjeux de sécurité en production) — seule la déconnexion explicite invalide un token.
- `GET /auth/moi` renvoie le profil du joueur connecté à partir du token — utilisé par l'app pour
  vérifier qu'une session sauvegardée est encore valide.
- BUG CORRIGÉ (26/07/2026) : `mesDuels`, `defisFaits` et `mesSeances` (tous des états 100% LOCAUX
  côté app, jamais envoyés au serveur) ne se réinitialisaient PAS en changeant de compte — un
  nouveau compte voyait les duels/défis simulés du compte précédent (ou de mockData.js au tout
  premier lancement). Cause : ces états vivent dans le composant racine `AppInterne`, qui ne
  redémarre pas à la connexion (seul l'écran affiché change entre ConnexionScreen et les onglets).
  Corrigé en les remettant à zéro explicitement dans `entrerEnLigne()` (App.js), appelée à
  CHAQUE connexion/inscription réussie.
- PROPRIÉTÉ : chaque joueur ne peut modifier QUE ses propres données. Protégé par
  `auth.verifier_proprietaire` sur : ajouter une perf, ajouter une séance, valider un défi.
  Une tentative de modifier les données d'un AUTRE joueur renvoie 403.
- DÉCISION IMPORTANTE : un joueur ne peut plus valider SA PROPRE performance en tant que
  "communauté" (403 si tenté) — la vérification communauté n'a de sens que si c'est quelqu'un
  d'autre qui valide. En revanche, la vérification "salle" (partenaire) reste auto-appliquée par
  le joueur affilié (`moi.affilieSalle` côté front) : il n'existe pas encore de vrai compte "salle
  partenaire" distinct pour porter cette action, donc on garde cette simplification jusqu'à ce que
  ce système existe. CONSÉQUENCE CÔTÉ FRONT : le bouton "Envoyer une vidéo" (auto-validation) a
  disparu de l'écran Perfs pour un compte connecté — remplacé par un texte "🕒 En attente" — car il
  échouerait systématiquement. Il ne reste actif qu'en mode hors-ligne (pure simulation locale,
  comme avant). La vraie validation par un AUTRE joueur arrivera avec la tâche "upload vidéo".
- ÉCRAN APP : `src/screens/ConnexionScreen.js` — bascule Se connecter / Créer un compte, avec les
  champs pseudo/mot de passe (+ sexe/poids/salle à l'inscription). Affiché par App.js UNIQUEMENT
  si le serveur répond mais qu'aucune session valide n'est trouvée (si le serveur est injoignable,
  l'app saute directement en mode hors-ligne — pas de compte à proposer si personne ne répond).
- PERSISTANCE : le token est sauvegardé dans `AsyncStorage` (`@react-native-async-storage/async-storage`,
  ajouté comme dépendance) sous la clé `fitnessRoyale.token`, pour ne pas avoir à se reconnecter à
  chaque lancement de l'app. Un bouton "🚪 Se déconnecter" (bas de l'écran Profil) l'efface.
- DONNÉES ABSENTES DES VRAIS COMPTES : `serieJours`, `stats` (victoires/défaites), `affilieSalle`
  ne sont pas encore suivis côté serveur pour un vrai compte (seulement dans mockData.js) — App.js
  leur donne des valeurs par défaut neutres (0, {0,0}, false) pour un compte fraîchement connecté,
  afin que les écrans ne plantent pas. Le taux de victoire affiche "—" plutôt qu'un NaN% si
  victoires+défaites = 0.
- CORRECTION DE BUG (découverte en testant les comptes) : `basededonnees.py` ouvrait une connexion
  SQLite par fonction mais ne la fermait JAMAIS (`with connexion() as conn:` ne fait que
  commit/rollback en Python, pas fermer la connexion) — ça bloquait la suppression du fichier de
  base sous Windows. Corrigé en transformant `connexion()` en vrai gestionnaire de contexte
  (`@contextmanager`) qui ferme la connexion en sortant du bloc `with`.
- MIGRATION DE DONNÉES : l'ancien "Hafiz" créé avant l'existence des comptes (sans mot de passe) a
  été supprimé de la base de dev — il ne pouvait plus jamais se connecter (mot de passe NULL) et
  aurait bloqué le pseudo "Hafiz" pour une vraie inscription. Si tu relances l'app, inscris-toi
  avec un nouveau mot de passe — tes anciennes perfs de test (bench 160kg, etc.) ne sont plus là,
  c'est normal.
- Tests : `backend/tests/test_auth.py` (hachage, sessions, pas de fuite du hash) et
  `backend/tests/test_api_auth.py` (tests d'intégration HTTP complets via `fastapi.testclient` —
  nouvelle dépendance `httpx` ajoutée à `requirements.txt` pour ça). Les deux utilisent une base de
  données TEMPORAIRE (jamais `fitness_royale.db`), en redirigeant `db.CHEMIN_DB` avant les tests.

## Duels en ligne à deux téléphones — fait le 20/07/2026

Le duel BO3 backend (créé plus tôt) est maintenant un VRAI duel en ligne, jouable à deux
téléphones séparés, avec écran dans l'app :

- Flux : le CHALLENGER crée un duel (`POST /duels/creer`, connexion requise) et reçoit un CODE à
  6 caractères (ex. "K7XPQR", sans 0/O/1/I/L pour éviter les confusions) à partager par n'importe
  quel moyen (verbalement, message…). L'ADVERSAIRE le rejoint avec ce code
  (`POST /duels/rejoindre`), ce qui passe le duel de "en_attente" à "en_cours".
- DÉCISION IMPORTANTE — synchronisation SANS WebSocket : chaque joueur soumet SES PROPRES
  répétitions indépendamment depuis SON téléphone (`POST /duels/{id}/rounds/{n}/mes-reps`), le
  round ne se résout que quand les DEUX ont soumis. Pas de temps réel (pas de WebSocket) : l'app
  re-consulte `GET /duels/{id}` toutes les 3 secondes (polling) pour voir les coups de l'autre.
  Le vrai temps réel (push serveur) reste une amélioration future si besoin.
- Règles IDENTIQUES à `src/logic/duels.js` : charge fixe, le plus de reps gagne, BO3, R1 choisi
  par le challenger, R2 par l'adversaire (`POST /duels/{id}/rounds/{1|2}/choisir-exercice`,
  refusé si ce n'est pas ton tour), R3 tiré par l'IA (`POST /duels/{id}/rounds/3/tirer-ia`, charge
  Bronze accessible aux deux). Égalité de reps → personne ne marque, le round reste rejouable
  (re-choisir l'exercice réinitialise les reps du round). Dès 2 victoires, le duel se termine et
  la récompense est ajoutée aux points du vainqueur automatiquement.
- Tables SQLite `duels` (+ colonne `code` UNIQUE, `adversaire_id` NULLABLE tant que personne n'a
  rejoint, statuts 'en_attente'/'en_cours'/'termine') et `duel_rounds` (inchangée). Voir
  `backend/app/basededonnees.py`.
- MIGRATION DE DONNÉES : l'ancien schéma des duels (créés directement avec les 2 joueurs connus,
  sans code) a été recréé — les 2 duels de test de la toute première vérification manuelle du
  backend ont été perdus. Base de dev, sans conséquence (voir `_migrer_schema_duels` dans
  `basededonnees.py`).
- ÉCRAN APP : `src/components/DuelEnLigne.js` — créer/rejoindre par code, jouer son tour (choisir
  l'exercice quand c'est ton tour, entrer tes reps), avec polling automatique. Accessible depuis
  l'onglet Compétition → Défis → "🌐 Duel en ligne", uniquement si connecté (compte réel requis,
  contrairement au duel en direct pass-and-play qui reste local/simulé sur un seul téléphone).
- Après un duel en ligne gagné, `rafraichirMonProfil()` (App.js) recharge les points depuis le
  serveur — contrairement aux duels/défis simulés, les points des VRAIS duels sont gérés par le
  serveur, donc l'app doit les resynchroniser après coup.
- Tests : `backend/tests/test_duels.py` (logique pure : code, verrouillage de round) et
  `backend/tests/test_api_duels.py` (intégration HTTP complète : création, jonction, tours,
  victoire directe, départage, garde-fous — spectateur, mauvais tour, double-jonction…).
- BUG DE TEST DÉCOUVERT ET CORRIGÉ : `db.CHEMIN_DB` est une variable globale du module —
  la rediriger au niveau du FICHIER de test (au lieu de `setUpClass`) faisait que le dernier
  fichier de test importé écrasait le chemin pour tous les autres tests tournant dans le même
  process, mélangeant les comptes entre fichiers de test. Corrigé dans `test_api_auth.py` et
  `test_api_duels.py` (redirection dans `setUpClass`/`tearDownClass`, comme le faisait déjà
  `test_auth.TestSessions`).

## Statut en direct des duels (chrono de série) — fait le 06/08/2026

Demande de Hafiz après avoir testé les duels en ligne : « pas de moyen de vérifier la
performance ». Deux idées écartées avant de choisir celle-ci :
- Vidéo obligatoire par round : trop lourd (upload + attente d'un vote comme pour les perfs).
- Compteur "+1 rep" tapé en direct : IMPOSSIBLE en pratique (ex. développé couché — les mains
  sont occupées par la barre, pas par le téléphone), objection de Hafiz.
- RETENU : un simple statut/chrono en direct, sans preuve formelle mais interactif et jouable
  les mains libres pendant l'effort.
- Flux : une fois l'exercice/charge du round choisis, chaque joueur appuie sur
  "🔴 Je commence ma série" (`POST /duels/{id}/rounds/{n}/commencer`, connexion requise) juste
  avant de poser le téléphone. Le serveur horodate ce côté (`challenger_debut` ou
  `adversaire_debut` dans `duel_rounds`, colonnes ISO ajoutées par migration additive dans
  `basededonnees.py`). L'ADVERSAIRE voit alors, via le polling existant (3s), un chrono qui
  tourne ("🏋️ est en train de faire sa série… Ns") calculé CÔTÉ CLIENT à partir de cet
  horodatage (pas de flux vidéo/audio, juste une présence). Une fois la série finie, le joueur
  appuie sur "⏹ Terminé" (affiche alors le champ de reps, comme avant) puis valide son total —
  la logique de victoire du round n'a PAS changé (le plus de reps gagne), le chrono est purement
  informatif/interactif, jamais utilisé pour trancher.
- Les horodatages sont remis à NULL à chaque nouveau choix d'exercice pour ce round
  (`choisir_exercice_round`) — donc aussi à chaque replay d'un round à égalité, comme les reps.
- ÉCRAN APP : `src/components/DuelEnLigne.js` — nouvel état local `montrerSaisieReps` (passe à
  `true` seulement après "Terminé") et une horloge locale (`setInterval` 1s) qui recalcule les
  secondes écoulées à l'affichage ; le statut de l'ADVERSAIRE (pas commencé / en cours avec son
  propre chrono / déjà fini) est affiché en permanence pendant que je joue mon round, pas
  seulement après avoir soumis mes reps.
- Tests : 5 nouveaux tests dans `backend/tests/test_api_duels.py` (horodatage enregistré côté
  serveur, refus si l'exercice n'est pas encore choisi, refus pour un spectateur, le chrono ne
  change JAMAIS le résultat d'un round à lui seul, remise à zéro au replay). Suite complète :
  119 tests, tous OK.
- BUG CORRIGÉ (09/08/2026) : le chrono affichait "NaNs" sur ANDROID uniquement (fonctionnait
  sur iOS). Cause : `datetime.now().isoformat()` côté serveur produit une précision en
  MICROSECONDES (6 chiffres, ex. `"...T20:15:48.123456"`) — hors de la grammaire stricte du
  format date-heure ISO définie par la norme JS (exactement 3 chiffres de milliseconde). Le
  moteur JS d'Android (Hermes) rejette cette chaîne (`new Date(...)` → `Invalid Date`,
  `.getTime()` → `NaN`), alors que le moteur iOS est plus tolérant et l'acceptait quand même.
  Corrigé à la racine en forçant partout `datetime.now().isoformat(timespec="milliseconds")`
  (`backend/app/main.py`, 5 endroits : chrono de duel, vidéo, chat de clan, programmes,
  entraînements) pour ne générer QUE des horodatages au format standard. Garde-fou ajouté en
  plus côté app (`secondesDepuis()` dans `DuelEnLigne.js`) : si jamais une date était quand même
  illisible, affiche 0 au lieu de "NaN" — pour qu'un futur cas similaire ne casse plus l'affichage.

## Rafraîchissement automatique (classement, profil, vidéos) — fait le 09/08/2026

BUG SIGNALÉ par Hafiz : après avoir voté "valider" sur des vidéos d'autres joueurs, les vidéos
restaient affichées dans "Vidéos à valider" et le classement (Compétition) ne reflétait pas le
changement de statut. Vérifié empiriquement en tapant directement sur l'API (script one-shot,
sans passer par l'app) : le SERVEUR fonctionnait parfaitement (le vote change bien le statut de
la perf en "communaute" et `GET /joueurs` le reflète immédiatement). Le bug était donc 100% côté
app :
- `joueursServeur` (base du classement affiché dans Compétition/Profil) et mon propre profil
  (`mesPerfs`/`mesPoints`/`mesTitres`) n'étaient chargés QU'UNE SEULE FOIS, au démarrage de l'app
  ou à la connexion — jamais réactualisés ensuite. Résultat : même quand le serveur était à jour
  (mon statut de perf changé par le vote d'un autre joueur, un adversaire qui gagne des points…),
  rien ne bougeait à l'écran tant qu'on ne redémarrait pas complètement l'app.
- Corrigé dans `App.js` : nouveau `useEffect` qui re-consulte le serveur toutes les 10 secondes
  (même approche "polling, pas de WebSocket" que les duels en ligne et le chat de clan) tant que
  l'app est en ligne — recharge `listerJoueurs()` (classement) et, si connecté, `monProfil()`
  (mes perfs/points/titres). IMPORTANT : ne touche PAS `maSalle` dans ce rafraîchissement — ce
  champ est volontairement LOCAL (voir plus haut) et un re-fetch périodique aurait sans arrêt
  écrasé une modification de salle faite dans l'app par la valeur (obsolète) du serveur.
- Idem pour la liste "Vidéos à valider" (`PerformancesScreen.js`) : re-consultée toutes les
  10 secondes en tâche de fond (silencieusement, sans spinner, pour ne pas faire clignoter la
  liste), plutôt que seulement au premier chargement de l'écran.
- Le vote lui-même restait déjà instantané pour le VOTANT (la vidéo disparaît immédiatement de
  sa propre liste, mise à jour locale optimiste) — ce correctif concerne les autres écrans/comptes
  qui devaient jusqu'ici attendre un redémarrage de l'app pour voir le changement.

## Défis récurrents (backend) — fait le 20/07/2026

- `backend/app/defis.py` : défi du jour (séance ≥30 min AUJOURD'HUI) et défi de la semaine
  (≥4 séances dans la semaine ISO en cours), basés sur les VRAIES séances enregistrées
  (table `seances`, endpoint `POST/GET /joueurs/{id}/seances`) et la vraie date du jour —
  fini la simulation, le serveur vérifie pour de vrai. Testé dans `backend/tests/test_defis.py`.
  Un défi ne peut être validé qu'une fois par période (jour ou semaine ISO) : table
  `defis_valides`, contrainte UNIQUE (joueur, type, période).
- Endpoints : `GET /joueurs/{id}/defis` (état des 2 défis : réussi ? déjà validé ?),
  `POST /joueurs/{id}/defis/{jour|semaine}/valider` (renvoie 400 si pas réussi, 409 si déjà
  validé ; sinon ajoute les points + le titre pour le défi de la semaine).
- PAS ENCORE branché au front (les boutons "Valider" de l'app restent une simulation locale).

## Upload vidéo + validation communauté — fait le 20/07/2026

Avant, "vérifier une perf par la communauté" était juste un bouton qui flippait le statut sans
aucune preuve. Maintenant, il faut une VRAIE vidéo et un vote d'un AUTRE joueur :

- Flux : le joueur ajoute une perf (statut 'declare'), puis joint une vraie vidéo prise dans sa
  pellicule (`expo-image-picker`) → upload réel du FICHIER (pas juste une URL) vers le serveur
  (`POST /joueurs/{id}/performances/{exercice}/video`, multipart). La perf reste 'declare' tant
  que personne n'a voté — CONFORME à la philosophie du projet (docs/CONTEXTE.md : le classement
  ne doit compter que du vérifié).
- DÉCISION IMPORTANTE — règle de vote "premier arrivé, premier servi" : le PREMIER autre joueur
  qui vote décide, pas de quorum. "Valider" fait vraiment passer la perf en statut 'communaute'
  (compte au classement) ; "refuser" clôt cette tentative (le joueur peut réessayer avec une
  nouvelle vidéo). Choisi pour rester simple — un vrai système à quorum (ex. 3 votes) est une
  amélioration possible si le besoin se fait sentir, notée dans "À faire".
- Stockage : les fichiers vidéo sont sauvegardés sur le DISQUE du serveur (`backend/videos/`,
  créé automatiquement au démarrage), avec un nom de fichier généré aléatoirement (jamais le nom
  fourni par le client — sécurité contre les chemins malveillants). Extensions autorisées : .mp4,
  .mov, .m4v, .avi, .webm. Taille max : 50 Mo. Dépendance ajoutée : `python-multipart` (nécessaire
  à FastAPI pour lire les fichiers envoyés en formulaire).
- Endpoints : `POST /joueurs/{id}/performances/{exercice}/video` (upload, connexion + propriété
  requises), `GET /videos/en-attente` (les vidéos des AUTRES à voter — jamais les tiennes),
  `GET /videos/{id}/fichier` (sert le fichier, pour le lire dans l'app), `POST /videos/{id}/voter`
  (connexion requise, interdit de voter sur sa propre vidéo, interdit de revoter après résolution).
- ÉCRAN APP : dans `src/screens/PerformancesScreen.js` — bouton "📹 Joindre une vidéo" sur une
  perf non vérifiée (ouvre le sélecteur de vidéos du téléphone), et une section "🎥 Vidéos à
  valider" listant les vidéos des autres joueurs avec un lecteur vidéo intégré
  (`expo-av`) et des boutons Valider/Refuser. Dépendances ajoutées : `expo-image-picker`,
  `expo-av`.
- Tests : `backend/tests/test_videos.py` (validation d'extension, génération de nom de fichier)
  et `backend/tests/test_api_videos.py` (intégration HTTP complète AVEC upload multipart réel :
  upload, garde-fous de propriété, liste filtrée, vote qui fait vraiment passer la perf en
  "communaute", interdiction de voter sur soi-même/de revoter). Base de données ET dossier vidéo
  redirigés vers des emplacements temporaires pendant les tests (jamais `backend/videos/` ni
  `fitness_royale.db`).

### AUCUN stockage permanent des vidéos — fait le 20/08/2026

Demande de Hafiz : « je ne veux même pas que les vidéos soient stockées ». Clarifié ensemble :
la vidéo reste un moyen de preuve valide, mais le FICHIER ne doit jamais rester sur le serveur
au-delà du temps nécessaire à un vote.

- `regles_videos.supprimer_fichier(nom_fichier)` (`backend/app/videos.py`) efface le fichier du
  DISQUE — appelée dans `POST /videos/{id}/voter` (main.py) juste après avoir résolu le vote,
  que la perf soit validée OU refusée. Idempotente (`unlink(missing_ok=True)`).
- CE QUI RESTE EN BASE, CE QUI DISPARAÎT DU DISQUE : la ligne `preuves_video` (statut, qui a
  voté, quand) n'est PAS supprimée — c'est une trace légère, pas un fichier. Seul le contenu
  binaire disparaît. `GET /videos/{id}/fichier` renvoie donc 404 après résolution (le code
  gérait déjà ce cas : `chemin.exists()` avant de servir le fichier — aucun changement là).
- AUCUN changement côté app : `PerformancesScreen.js` retire déjà la vidéo de la liste locale
  dès que le vote est envoyé (mise à jour optimiste), donc il ne redemande jamais un fichier
  déjà résolu.
- LIMITE CONNUE (assumée, pas dans le périmètre demandé) : une vidéo qui reste indéfiniment
  "en_attente" (personne ne vote) reste stockée tant que ça dure — pas de nettoyage automatique
  par ancienneté pour l'instant. À revoir si le besoin se présente.
- Tests : 3 nouveaux dans `test_api_videos.py` — le fichier disparaît du disque après validation
  ET après refus (`chemin.exists()` avant/après + `GET /fichier` → 404), et la TRACE en base
  (statut de la perf) survit bien à la suppression du fichier. Suite complète : 194 tests, OK.

## Validation sans vidéo — fait le 09/08/2026

Demande de Hafiz : « crée un moyen de valider les perfs sans passer par la vidéo ». Deux
mécanismes ajoutés en parallèle de la vidéo (qui reste disponible) :

**1. Code partenaire (comme les duels en ligne)** — pour un partenaire de salle PRÉSENT au
moment de la perf :
- Flux : le joueur génère un code à usage unique pour SA perf déclarée
  (`POST /joueurs/{id}/performances/{exercice}/code-validation`, connexion + propriété requises,
  refusé si la perf est déjà vérifiée) — même génération de code que les duels
  (`regles_duels.generer_code()`, réutilisée telle quelle). Il le partage verbalement à son
  partenaire, qui le saisit sur SON téléphone (`POST /validations/rejoindre`, connexion requise,
  refusé si c'est sa propre perf ou si le code a déjà servi) → la perf passe directement en
  "salle". Table `codes_validation` (voir `basededonnees.py`).
- DÉCISION : contrairement au vote vidéo/communauté, ce chemin donne le statut "salle" (pas
  "communaute") — cohérent avec le sens du statut existant (un partenaire physiquement présent),
  et c'est un premier vrai pas vers le "vrai système de salle partenaire" noté dans "À faire"
  (reste néanmoins n'importe quel autre joueur, pas encore un compte "salle" certifié).

**2. Vote communauté sans preuve jointe** — sur simple confiance, comme le vote vidéo mais sans
vidéo à regarder :
- Flux : dès qu'une perf est 'declare', elle apparaît automatiquement dans la liste
  `GET /performances/a-valider-sans-video` de TOUS LES AUTRES joueurs (pas besoin d'une action
  de l'auteur pour la "soumettre" — elle y est déjà). Même règle "premier vote décide" que la
  vidéo : `POST /joueurs/{id}/performances/{exercice}/voter-sans-video` fait passer la perf en
  "communaute" si validé, ne change rien si refusé (la perf reste 'declare', quelqu'un d'autre
  peut revoter plus tard). Table `votes_perf_declaree` (contrainte UNIQUE par (perf, votant) —
  empêche un même votant de voter deux fois tant que la perf reste en attente).
- DÉCISION IMPORTANTE : une perf qui a déjà une VIDÉO en attente n'apparaît PAS dans cette liste
  (filtre `NOT EXISTS` sur `preuves_video` dans `perfs_declarees_en_attente()`) — on préfère que
  le vote se base sur la vidéo (plus rigoureuse) si elle existe, pour éviter qu'un joueur valide
  "à l'aveugle" une perf qui a justement une preuve disponible juste à côté.
- Ce mécanisme est le PLUS FACILE À ABUSER des trois (aucune preuve, juste la confiance) — accepté
  comme compromis volontaire pour un projet perso, noté explicitement dans le code.
- ÉCRAN APP : `src/screens/PerformancesScreen.js` — sur chaque perf non vérifiée, deux boutons
  "📹 Vidéo" / "🔑 Code partenaire" (le code généré s'affiche en grand dans la carte, avec un
  lien "Fermer" une fois partagé) ; une carte "🔑 Valider la perf d'un partenaire" (champ de
  saisie de code, même style que rejoindre un duel) ; une section "🤝 Perfs à valider (sans
  preuve)" listant les perfs déclarées des autres avec Valider/Refuser (même style que "Vidéos à
  valider", sans lecteur vidéo). Rafraîchie automatiquement toutes les 10s comme le reste (voir
  "Rafraîchissement automatique").
- Tests : `backend/tests/test_api_validation.py` — 13 tests d'intégration HTTP (flux complet des
  deux mécanismes, garde-fous de propriété/auto-vote/double-vote/code déjà utilisé, exclusion
  d'une perf avec vidéo en attente). Suite complète : 136 tests, tous OK.

## Chat de clan — fait le 20/07/2026

Chaque salle de gym = un clan avec son propre chat, réservé à ses membres :

- DÉCISION : le chat est scopé par SALLE (texte libre du profil), pas par un vrai objet "clan" en
  base — plus simple, cohérent avec le reste de l'app (classement Salles fonctionne pareil).
  Réservé aux MEMBRES : le serveur vérifie que `courant.salle == salle` du chat demandé (403
  sinon) — un joueur sans salle, ou d'une autre salle, ne peut ni lire ni écrire.
- Endpoints : `GET /clans/{salle}/messages` (les 200 derniers messages, chronologiques),
  `POST /clans/{salle}/messages` (connexion + appartenance à la salle requises).
- ÉCRAN APP : nouvel onglet "💬 Clan" (le dernier) — `src/screens/ClanScreen.js`.
  Bulles de discussion façon messagerie, rafraîchissement automatique toutes les 4 secondes
  (polling, même approche que les duels en ligne — pas de WebSocket). Si pas connecté ou pas de
  salle renseignée, affiche une explication au lieu du chat.
- Tests : `backend/tests/test_api_clan.py` (intégration HTTP complète : membre peut lire/écrire,
  non-membre refusé en lecture ET en écriture, joueur sans salle n'a accès à aucun clan, ordre
  chronologique, message vide refusé).

## Avatar évolutif — fait le 20/07/2026

L'apparence de l'avatar change selon la ligue (palier moyen), du gris terne (Aucune) à l'aura
violette du Royal :

- `src/components/AvatarJoueur.js` : cercle avec l'initiale du pseudo, entouré d'un anneau dont
  la couleur ET l'épaisseur augmentent avec la ligue (`couleursLigues` de `clubSP.js`, déjà
  utilisées ailleurs dans l'app), une lueur (ombre colorée) à partir de Gold, et un petit emblème
  (🥉🥈🥇⭐⚡👑) qui apparaît en incrustation à partir de Bronze.
- DÉCISION : pas de vraies illustrations (personnage, équipement) — ça demanderait de vrais
  visuels dessinés sur mesure, hors de portée de ce qui peut être généré ici. L'évolution se joue
  sur la couleur/l'anneau/l'emblème, qui est déjà un signal visuel clair et cohérent avec le reste
  de l'identité visuelle de l'app (mêmes couleurs de ligue que le classement). Noté dans "À faire"
  si de vraies illustrations sont voulues plus tard.
- Utilisé dans l'écran Profil (grand format, 72px) et dans chaque ligne du classement (petit
  format, 36px) — l'avatar de tout le monde évolue, pas seulement le tien.

## Entraînement (programmes + journal de séance) — fait le 26/07/2026

Nouvel onglet "💪 Entraînement" — un outil de suivi perso, complètement
SÉPARÉ du système de paliers Club SP :

- DÉCISION IMPORTANTE — INDÉPENDANCE TOTALE du barème Club SP : rien dans cette section ne touche
  à la table `performances` ni au classement. Les exercices sont en texte libre (pas besoin de
  coller aux noms exacts du barème). L'utilisateur met à jour ses perfs OFFICIELLES à la main dans
  l'onglet Perfs, séparément. Vérifié par test (`test_api_entrainement.py`) : logger une séance ne
  change jamais `performances`.
- **Programmes** : créés de zéro par l'utilisateur (pas de modèles pré-faits) — un nom + une liste
  d'exercices, chacun avec un objectif séries × reps. `POST /joueurs/{id}/programmes`,
  `GET /joueurs/{id}/programmes`, `GET /programmes/{id}`, `DELETE /programmes/{id}`.
- **Journal de séance (workout log)** : pendant une séance, on logue chaque série réellement faite
  (exercice, numéro de série, reps, poids) — soit depuis un programme (liste pré-remplie), soit en
  "séance libre" (exercices ajoutés à la volée). Une séance loggée est datée.
  `POST /joueurs/{id}/entrainements` (toutes les séries d'un coup), `GET /joueurs/{id}/entrainements`.
- **Surcharge progressive v2** (`src/logic/surchargeProgressive.js`, demande de Hafiz du
  12/08/2026) — trois aides affichées sous CHAQUE exercice pendant une séance, toutes calculées
  CÔTÉ APP depuis `entrainements` (aucun endpoint, marche hors-ligne) :
  1. **Suggestion de charge** (`suggererProchaineSerie`) — double progression : tant que
     l'objectif de reps du programme n'est pas atteint on propose +1 rep à charge égale ; une
     fois atteint on monte la charge (+2,5 kg, ou +1 kg sous 20 kg) et on revient à l'objectif
     de reps. Exercice au poids du corps (poids 0) : on ne propose que des reps en plus.
     Affiché « 🎯 Aujourd'hui : 102.5 kg × 8 reps — objectif de 8 reps atteint à 100 kg ».
  2. **Record personnel** (`recordPersonnel`) — la série la plus lourde jamais faite (à poids
     égal, celle avec le plus de reps). `bat_le_record()` compare les séries saisies dans la
     séance EN COURS au record : le badge « 🏆 NOUVEAU RECORD ! » apparaît en direct, avant même
     d'avoir terminé la séance. Section récapitulative « 🏆 Mes records » dans l'accueil
     (`tousLesRecords`, triée du plus lourd au plus léger).
  3. **Détection de stagnation** (`detecterStagnation`) — si sur les 3 dernières séances de cet
     exercice la charge max n'a jamais dépassé celle de la plus ancienne des trois, alerte
     « ⚠️ Bloqué à 100 kg depuis 3 séances ». Disparaît dès que la charge repart.
  - DÉCISION : ces trois fonctions reçoivent TOUT l'historique, SANS filtrer sur la date du jour.
    La séance en cours n'est pas encore dans `entrainements` (elle vit dans `seriesLoggees`
    jusqu'à « Terminer »), donc aucun risque de se comparer à soi-même — et si une séance a déjà
    été loggée le même jour, elle est bien prise en compte (un premier essai filtrait
    `date < aujourd'hui` et affichait un record périmé après une 2e séance dans la journée).
    `trouverDernieresSeries` (le « Dernière fois : … » historique) garde lui son filtre par date.
  - Vérifié : historique squat bloqué à 100 kg × 3 séances → les 3 aides s'affichent ensemble ;
    saisir 102,5 kg déclenche « 🏆 NOUVEAU RECORD ! » en direct ; après enregistrement, la
    suggestion passe à 105 kg et l'alerte de stagnation disparaît.
- **Surcharge progressive (v1, endpoint historique)** : `GET /joueurs/{id}/exercices/{exercice}/dernier?avant=AAAA-MM-JJ`
  renvoie les séries du dernier entraînement contenant cet exercice, AVANT la date donnée (jamais
  la séance en cours). Le FRONT calcule en fait ça localement à partir de la liste déjà chargée
  (`trouverDernieresSeries` dans `EntrainementScreen.js`) — marche aussi hors-ligne, évite un
  aller-retour réseau supplémentaire à chaque exercice. L'indicateur ↑/=/↓ compare le poids maxi
  loggé aujourd'hui à celui de la dernière fois.
- DÉCISION — lien avec le compteur hebdo du Profil : une séance loggée depuis cet onglet appelle
  `ajouterSeanceLocale(minutes)` dans `App.js`, qui alimente le même `mesSeances` que le bouton
  "➕ Séance" du Profil. Comme il n'y a pas de champ durée dans le journal de séance, la durée est
  ESTIMÉE (≈3 min par série, 20 min minimum) — simplification pour ne pas demander deux fois la
  même info à l'utilisateur. Reste LOCAL comme le reste de `mesSeances` (pas encore envoyé au
  serveur, voir "À faire").
- Mode hors-ligne : programmes et séances vivent d'abord en état local (React), avec synchro au
  serveur en tâche de fond si connecté (même schéma que `ajouterPerf` : mise à jour optimiste,
  l'échec réseau ne bloque rien). Hors-ligne, tout fonctionne mais rien n'est sauvegardé au
  redémarrage de l'app (pas de persistance locale via AsyncStorage pour l'instant).
- Tests : `backend/tests/test_api_entrainement.py` — 14 tests d'intégration HTTP (créer/lister/
  supprimer un programme, garde-fous de propriété, logger une séance libre ou depuis un programme,
  historique dans le bon ordre, calcul correct des dernières séries avant une date donnée).

## Critère de classement : la polyvalence récompensée — fait le 09/08/2026

Demande de Hafiz : « les plus haut dans le classement sont ceux qui ont des performances dans
le plus d'exercices possible, et la ligue finale représente ta moyenne dans tous les exercices ».
- AVANT : le palier moyen (= score de classement = ligue affichée) se calculait UNIQUEMENT sur
  les exercices que le joueur avait VÉRIFIÉS. Conséquence : un joueur avec UN SEUL exercice au
  palier max (ex. Royal) avait la même moyenne (donc le même rang potentiel) qu'un joueur maxé
  sur TOUS les exercices — rien ne récompensait la polyvalence.
- MAINTENANT : `moyennePaliers()` (`src/logic/classement.js`, portage identique dans
  `backend/app/logique.py`) divise la somme des paliers vérifiés par le NOMBRE TOTAL d'exercices
  du barème (15, homme comme femme) — PAS par le nombre d'exercices vérifiés. Un exercice non
  vérifié compte donc pour 0 dans la moyenne. UNE SEULE formule suffit à obtenir les deux
  effets demandés : (1) plus un joueur a de perfs vérifiées, plus sa moyenne (et son rang)
  monte — à niveau égal par exercice, la polyvalence gagne ; (2) la ligue affichée EST déjà
  cette moyenne sur la totalité du barème, donc "atteindre Royal" veut maintenant dire "être au
  palier Royal en moyenne sur les 15 exercices", pas sur un seul.
- CONSÉQUENCE IMPORTANTE : les ligues sont mécaniquement beaucoup plus dures à atteindre
  qu'avant (il faut des perfs vérifiées sur BEAUCOUP d'exercices, pas juste 1 ou 2) — c'est le
  comportement voulu, mais bon à savoir si un joueur de test semble "redescendre" de ligue après
  ce changement : c'est normal, pas un bug.
- Le classement par salle (`classerSalles`) utilise déjà `moyennePaliers()` en interne, donc
  hérite automatiquement de la même règle sans changement de code séparé.
- Tests : `test_logique.py` mis à jour (moyenne de Hafiz recalculée : 11 paliers vérifiés / 15
  exercices = 0.73, ligue "Bronze" au lieu de "Gold") + nouveau test dédié
  `test_la_polyvalence_prime_sur_un_seul_exercice_pousse_a_fond` qui vérifie noir sur blanc
  qu'un joueur avec 4 exercices à Gold passe DEVANT un joueur avec 1 seul exercice à Royal.
  Suite complète : 120 tests, tous OK.

## Classement par exercice — fait le 09/08/2026

Demande de Hafiz : « comme pour le classement au poids du corps on devrait ajouter un classement
par exercices » — un 4e mode dans Compétition, à côté de Global / Par poids / Salles.

- `classerParExercice(joueurs, exercice)` (`src/logic/classement.js`, portage identique
  `classer_par_exercice()` dans `backend/app/logique.py`) : classe les joueurs ayant une perf
  VÉRIFIÉE sur CET exercice précis, par PALIER atteint sur cet exercice (pas la moyenne globale).
  `listeExercicesClassement` exporte la liste des 15 exercices (identique aux deux sexes).
- DÉCISION IMPORTANTE — départage aux POINTS, jamais à la valeur brute (kg/reps) : à palier
  égal sur un exercice, comparer les kg directement entre un homme et une femme serait injuste
  (échelles de barème différentes, ex. Gold homme = 100kg au développé couché contre 45kg chez
  la femme) — le palier normalise déjà cette différence, comme partout ailleurs dans l'app. Une
  première version départageait à la valeur brute ; corrigée avant même d'arriver en test manuel
  (repérée en écrivant le test croisé homme/femme, voir `test_classement_par_exercice`).
  Les joueurs sans perf vérifiée sur l'exercice choisi sont simplement absents de cette liste
  (pas de "0" affiché).
- ÉCRAN APP : `CompetitionScreen.js` — nouveau mode "🏋️ Par exercice" avec un sélecteur déroulant
  (même composant visuel que le choix d'exercice ailleurs dans l'app) pour choisir LEQUEL des
  15 exercices afficher ; défaut = premier exercice de la liste. Chaque ligne montre la valeur
  brute (kg ou reps) ET le palier atteint sur CET exercice (ex. "125 kg • Legend"), contrairement
  au classement global qui n'affiche jamais de valeur — ici c'est la perf de l'exercice affiché,
  pas le score interne de classement, donc pas de souci à la montrer.
- Tests : `test_logique.py` — classement correct par palier, perfs non vérifiées exclues,
  départage aux points vérifié explicitement entre un homme et une femme à palier égal.
  Suite complète : 123 tests, tous OK.

## Hébergement du backend (Fly.io) — fait le 09/08/2026

Objectif de Hafiz : pouvoir utiliser Fitness Royale (mobile ET une future version web) « n'importe
où », pas seulement sur le Wifi du PC. Ça demande d'héberger le backend sur un vrai serveur
internet à une adresse FIXE (au lieu du PC local détecté automatiquement par IP LAN).

- DÉCISION — Fly.io plutôt que Render/Railway : le backend utilise SQLite (un simple FICHIER)
  ET stocke les vidéos uploadées directement sur le DISQUE du serveur. La plupart des offres
  gratuites (Render en particulier) ont un disque ÉPHÉMÈRE — tout est effacé à chaque
  redéploiement/redémarrage, ce qui perdrait tous les comptes et vidéos. Fly.io propose des
  VOLUMES PERSISTANTS à faible coût (quelques dollars/mois grand max pour un usage perso, carte
  bancaire requise même pour rester dans les limites gratuites). Alternative notée pour plus tard :
  migrer vers une base Postgres + un stockage objet managés (Supabase/Neon/R2) permettrait un
  hébergement 100% gratuit sur Render, mais demande une réécriture de `basededonnees.py` et
  `videos.py` — pas fait pour l'instant, gardé en tête si le besoin de scaler se présente.
- CHANGEMENT DE CODE (minimal, pour garder le comportement local identique) : `basededonnees.py`
  et `videos.py` lisent maintenant la variable d'environnement `FITNESS_ROYALE_DATA_DIR` pour
  savoir où vivent la base SQLite et le dossier des vidéos. Si elle n'est PAS définie (cas normal
  en local), rien ne change : même chemin qu'avant (`backend/`). En hébergement, le `Dockerfile`
  la fixe à `/data`, qui correspondra au volume persistant Fly.io monté à cet endroit.
- CORS ajouté (`CORSMiddleware`, ouvert à tous les domaines) dans `main.py` — nécessaire pour
  qu'un futur frontend WEB hébergé sur un domaine différent du backend puisse l'appeler (le
  navigateur bloque sinon les requêtes entre domaines différents). Ne concerne PAS l'app mobile
  (Expo Go / APK) : seuls les navigateurs appliquent cette règle.
- Nouveaux fichiers : `backend/Dockerfile` (image de prod, sans `--reload`) et
  `backend/.dockerignore` (exclut tests/, la base et les vidéos LOCALES de l'image).
- ÉTAPES MANUELLES (Hafiz doit les faire lui-même — création de compte + carte bancaire,
  impossible à faire à sa place) :
  1. Installer flyctl : `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"`
     (puis rouvrir le terminal pour que la commande `fly` soit reconnue).
  2. `fly auth signup` (ou `fly auth login` si déjà un compte) — ouvre le navigateur.
  3. Depuis le dossier `backend/` : `fly launch` — détecte le Dockerfile, demande un nom
     d'appli (unique sur Fly, ex. `fitness-royale-api`) et une région (ex. `cdg` = Paris) ;
     répondre NON à la création d'une base Postgres/Redis proposée (pas besoin, on garde
     SQLite) et NON à "déployer maintenant" (il manque encore le volume).
  4. Créer le volume persistant : `fly volumes create fitness_royale_data --region <région
     choisie à l'étape 3> --size 1` (1 Go, largement suffisant pour commencer).
  5. Ouvrir le `fly.toml` généré et ajouter (mêmes noms que l'étape 4 et le Dockerfile) :
     ```toml
     [mounts]
       source = "fitness_royale_data"
       destination = "/data"
     ```
  6. Déployer : `fly deploy` (pas besoin de Docker installé en local — Fly construit l'image
     à distance si aucun Docker local n'est détecté).
  7. Vérifier : ouvrir `https://<nom-de-l-appli>.fly.dev/sante` dans un navigateur → doit
     afficher `{"statut":"ok"}`. C'est la nouvelle ADRESSE FIXE du backend.
- À FAIRE ENSUITE (pas fait dans cette tâche, prochaine étape séparée) : brancher l'app sur cette
  adresse fixe au lieu de l'IP LAN auto-détectée — soit en définissant `expo.extra.apiUrl` dans
  `app.json` pour un futur build APK (voir `src/api.js`, cette source est déjà prioritaire sur
  la détection automatique), soit comme base de l'URL utilisée par la future version web.

## Hébergement gratuit : Render + Neon (double moteur SQLite/Postgres) — fait le 24/08/2026

Suite de « Hébergement du backend (Fly.io) » ci-dessus : Fly.io demande une carte bancaire même
pour rester dans les limites gratuites. Demande de Hafiz : un hébergement **gratuit**, à
condition que la base de comptes/perfs **survive** aux redémarrages (pas d'option éphémère).

- DÉCISION — Render (serveur web gratuit) + Neon (Postgres gratuit), pas Fly.io : Render offre
  750h/mois gratuites SANS carte bancaire, mais SANS disque persistant — or le backend stockait
  jusqu'ici tout (comptes, perfs, vidéos) dans un simple fichier SQLite sur ce disque, qui serait
  donc effacé à chaque redémarrage. Solution : sortir la base de données du serveur web et la
  confier à Neon, un Postgres géré gratuit qui ne pause ni n'expire jamais (contrairement à
  Supabase gratuit — pause après 7 jours d'inactivité — et à l'offre Postgres gratuite de Render
  elle-même — expire après 30 jours). Recherché et comparé le 24/08/2026.
- COMPROMIS ACCEPTÉ PAR HAFIZ — le réveil du serveur : Render gratuit MET EN VEILLE le service
  après 15 min sans requête, et met jusqu'à ~1 minute à répondre à la requête qui le réveille.
  Alternative (Fly.io toujours actif, payant) proposée et REFUSÉE par Hafiz au profit du gratuit :
  « Oui, je gère l'attente dans l'app » — d'où le nouvel écran « 🔄 Réveil du serveur… » côté app
  (voir plus bas) plutôt qu'un vrai serveur toujours réveillé.
- ⚠️ RISQUE IDENTIFIÉ, PAS ENCORE TRAITÉ — vidéos en attente de vote : le disque de Render étant
  éphémère, une vidéo tout juste uploadée (voir « Upload vidéo… — AUCUN stockage permanent ») peut
  disparaître si le serveur se met en veille (ou redémarre) AVANT qu'un autre joueur ait voté
  dessus — pas de perte pour les vidéos déjà tranchées (elles sont de toute façon supprimées après
  coup), mais une vidéo en attente perdue forcerait à la re-uploader. Pas bloquant pour un usage
  perso à faible fréquence, mais à garder en tête si le besoin de fiabiliser se présente (ex.
  stocker les vidéos en attente sur un stockage externe comme Neon/S3 plutôt que le disque local).

### Double moteur de base de données (`backend/app/basededonnees.py`)

- DÉCISION DE CONCEPTION : plutôt que de réécrire le fichier pour Postgres (cassant SQLite), les
  77 fonctions d'accès aux données restent quasi INCHANGÉES — toute la différence entre les deux
  moteurs est concentrée dans une poignée d'outils en tête de fichier :
  - `_moteur_actuel()` : lit la variable d'environnement `DATABASE_URL` — absente = SQLite
    (comportement inchangé, y compris pour TOUTE la suite de tests, aucune dépendance réseau) ;
    présente = Postgres, via `psycopg`.
  - `connexion()` ouvre le bon moteur mais renvoie toujours un objet `.execute(sql, params)` qui
    se comporte PAREIL des deux côtés (mêmes `?` en paramètres — `_traduire()` les convertit en
    `%s` uniquement côté Postgres —, même accès `ligne["colonne"]`, même `.lastrowid`).
  - `ErreurIntegrite` remplace `sqlite3.IntegrityError` partout où le code appelant (main.py)
    doit réagir à une violation de contrainte UNIQUE — il n'a donc plus jamais besoin de savoir
    quel moteur est actif. `main.py` n'importe même plus `sqlite3`.
  - `_TABLES_BASE` + `_executer_tables_base()` remplacent l'ancien bloc `executescript()` (SQLite
    uniquement) par une liste de `CREATE TABLE` exécutés un par un ; sur Postgres,
    `INTEGER PRIMARY KEY AUTOINCREMENT` devient `SERIAL PRIMARY KEY` par simple substitution de
    texte (seule vraie différence de dialecte entre les deux moteurs sur ce bloc).
    ⚠️ RÈGLE À RETENIR : toute création de table DOIT passer par
    `_executer_creation_table()` (ou vivre dans `_TABLES_BASE`), JAMAIS par un `conn.execute()`
    direct — sinon elle contourne cette traduction et plante sur Postgres (voir le bug du
    25/08/2026 ci-dessous).
  - Les `INSERT OR IGNORE` (syntaxe SQLite) sont devenus `ON CONFLICT (...) DO NOTHING`
    (portable, supporté par SQLite 3.24+ ET Postgres).
  - Chaque INSERT dont le code appelant a besoin de l'id généré porte maintenant `RETURNING id`
    (portable aussi, SQLite 3.35+ le supporte) au lieu de dépendre de `cursor.lastrowid`
    (spécifique à SQLite, inexistant sur Postgres).
- BUG DÉCOUVERT ET CORRIGÉ EN TESTANT (24/08/2026) : ajouter `RETURNING id` partout a cassé la
  suite de tests SQLite (`sqlite3.OperationalError: cannot commit transaction - SQL statements
  in progress`, 14 échecs). Cause : sur SQLite, un `INSERT ... RETURNING` laisse le curseur dans
  un état « requête en cours » tant que sa ligne de résultat n'est pas lue — `commit()` échoue
  si une requête est encore « en cours » sur la connexion. Corrigé en lisant IMMÉDIATEMENT cette
  ligne dans `_ConnexionAdaptee.execute()` (dès l'exécution, pour les deux moteurs, pas seulement
  à la lecture de `.lastrowid`) — `_CurseurAdapte` expose ensuite la valeur déjà lue. Repéré la
  fonction fautive `planifier_lot()` teste maintenant `curseur.lastrowid is not None` plutôt que
  `curseur.rowcount == 1` (peu fiable pour un INSERT ignoré par `ON CONFLICT DO NOTHING RETURNING`).
  Suite complète re-testée après coup : 194 tests, tous OK — comportement SQLite strictement
  inchangé.
- BUG DÉCOUVERT ET CORRIGÉ AU PREMIER VRAI DÉPLOIEMENT (25/08/2026) :
  `psycopg.errors.SyntaxError: syntax error at or near "AUTOINCREMENT"` au démarrage sur
  Render+Neon. Cause : 5 tables ajoutées à `initialiser()` APRÈS la migration (`cycles`,
  `cycle_programmes`, `objectifs_series`, `groupes_exercices`, `planning`) appelaient
  `conn.execute()` directement avec leur `CREATE TABLE` brut — elles contournaient donc la
  traduction `AUTOINCREMENT` → `SERIAL` qui ne vivait que dans `_executer_tables_base()`, la
  boucle du schéma de base. Le piège venait de la FORME du code : la traduction était enfouie
  dans une fonction dédiée au seul `_TABLES_BASE`, rien n'empêchait d'ajouter une table à côté.
  Corrigé en extrayant la traduction dans `_executer_creation_table(conn, sql)`, utilisée par
  TOUTES les créations de tables (schéma de base ET ajouts ultérieurs) — un seul chemin possible.
- Dépendance ajoutée : `psycopg[binary]` (`backend/requirements.txt`).
- ✅ VALIDÉ EN CONDITIONS RÉELLES (25/08/2026) contre le vrai Neon, après le correctif ci-dessus :
  `GET /sante` → `{"statut":"ok"}` et `GET /joueurs` renvoie les 5 joueurs de démo avec leurs
  performances — donc les tables ont bien été CRÉÉES sur Postgres *et* remplies (une vraie
  écriture, pas juste un démarrage). Le chemin SQLite reste couvert par toute la suite de tests.

### Réveil du serveur, côté app (`src/api.js`, `App.js`)

- `verifierConnexion(onReveil)` (`src/api.js`) tente d'abord un appel rapide (`DELAI_MAX_MS`,
  4s — le cas normal, serveur déjà éveillé ou en LAN local sans mise en veille). S'il échoue,
  appelle `onReveil()` puis retente avec un délai bien plus patient (`DELAI_REVEIL_MS`, 55s) —
  assez pour couvrir le réveil Render le plus lent observé en pratique (~1 min).
  Le helper interne `appel()`/`get()` accepte désormais un délai en paramètre (au lieu d'une
  constante figée) uniquement pour permettre ce cas précis ; tous les autres appels de l'app
  gardent le délai court habituel (une vraie coupure ne doit pas faire attendre l'utilisateur
  une minute sur une action normale, seulement sur la toute première connexion).
- `App.js` : nouvel état `reveil`, passé comme callback à `verifierConnexion()` au démarrage.
  L'écran de chargement affiche « 🔄 Réveil du serveur… (jusqu'à 1 min) » au lieu de
  « ⏳ Connexion au serveur… » pendant ce second essai — pour ne pas laisser croire à une panne.

### Déploiement effectif — fait le 25/08/2026

Les comptes externes ont été créés par Hafiz (impossible à faire à sa place), le reste enchaîné
dans la foulée. Tout est en place :

- **GitHub** : https://github.com/jaggerjack49-maker/FitnessRoyale (`origin`, branche `master`).
  Le dépôt local n'avait AUCUN commit avant le 25/08/2026 — Git n'avait jamais servi sur ce
  projet ; le premier commit couvre donc tout l'état v0.7 d'un coup. Render se branche sur ce
  dépôt et REDÉPLOIE AUTOMATIQUEMENT à chaque `git push` sur `master` (utile à savoir : pousser
  du code backend cassé met le serveur en ligne hors service).
- **Neon** : projet Postgres gratuit, `DATABASE_URL` posée UNIQUEMENT dans les variables
  d'environnement du service Render (jamais dans le code ni dans le dépôt — elle contient le mot
  de passe de la base).
- **Render** : service `fitnessroyale`, adresse fixe **https://fitnessroyale.onrender.com**.
  Root Directory `backend`, Build `pip install -r requirements.txt`, Start
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, plan Free.
  PIÈGE RENCONTRÉ : le champ « Root Directory » n'avait pas été pris en compte à la création du
  service → `Could not open requirements file`. Il se corrige dans Settings → Build & Deploy,
  puis « Manual Deploy » (changer un réglage ne redéploie pas tout seul).

### L'app parle au serveur en ligne — fait le 25/08/2026

- `expo.extra.apiUrl` (app.json) et `API_URL` (eas.json, profils preview ET production) pointent
  désormais sur `https://fitnessroyale.onrender.com` au lieu de l'IP du PC. Comme cette source
  est la PREMIÈRE lue par `obtenirBaseUrl()` (`src/api.js`), l'app utilise le serveur en ligne
  PARTOUT — Expo Go, version web et APK — sans dépendre du Wi-Fi de la maison ni du PC allumé.
  Ça rend caduque l'alerte « si l'IP du PC change, refaire un build » de la section « APK Android
  installable » : l'adresse est maintenant fixe.
- `usesCleartextTraffic` (plugin `expo-build-properties`, app.json) a été RETIRÉ : il n'existait
  que pour autoriser le `http://` non chiffré vers le PC, or Render est en `https://`. La
  dépendance `expo-build-properties` reste installée (inutilisée) au cas où.
- POUR REDÉVELOPPER CONTRE LE BACKEND LOCAL : mettre `expo.extra.apiUrl` à `null` dans app.json —
  la détection automatique de l'IP du PC reprend la main (mode LAN uniquement). C'est écrit en
  commentaire en tête de `src/api.js`.
- ⚠️ PIÈGE QUI A COÛTÉ DU TEMPS — le CACHE DE TRANSFORMATION DE METRO : après avoir changé
  `extra.apiUrl` dans app.json, la version web continuait d'aller sur `localhost:8000`. La
  config était pourtant juste (`npx expo config --type public` affichait la bonne adresse) et
  le bundle « simple » (`AppEntry.bundle?platform=web&dev=true`) la contenait bien — mais le
  bundle RÉELLEMENT chargé par le navigateur (avec ses paramètres complets, dont
  `transform.engine=hermes`) portait encore `"extra":{"apiUrl":{}}`, une valeur périmée servie
  depuis le cache. Redémarrer le serveur, vider `.expo/` ou le cache du navigateur NE SUFFIT
  PAS : le manifeste est inliné à la TRANSFORMATION, dont le cache vit ailleurs. Il faut
  supprimer `node_modules/.cache` ET `%TEMP%/metro-cache` (+ `%TEMP%/metro-file-map-*`), ou
  lancer `npx expo start --clear`. À refaire à chaque modification de `extra` dans app.json.
  LEÇON DE MÉTHODE : le symptôme (« l'app ignore extra.apiUrl ») ressemblait à un bug de code,
  et une première « correction » de `obtenirBaseUrl()` a été écrite puis ANNULÉE — c'est en
  comparant le bundle servi à la config résolue, puis en lisant `Constants.expoConfig.extra`
  DANS le navigateur (`{"apiUrl":{}}`), que la vraie cause est apparue. Vérifier ce que le
  runtime reçoit vraiment avant de corriger le code qui le lit.
- ⚠️ LA BASE NEON EST VIERGE : les comptes de test créés jusqu'ici (Hafiz, The Jaggerjack…)
  vivaient dans le fichier SQLite LOCAL (`backend/fitness_royale.db`, ignoré par Git) — ils ne
  sont PAS sur Neon, qui ne contient que les 5 joueurs de démo insérés automatiquement au
  premier démarrage. Il faut donc SE RÉINSCRIRE sur le serveur en ligne, et re-passer le compte
  en admin à la main (voir « Mode test ») — mais côté Postgres cette fois, pas avec la commande
  `sqlite3` de cette section.
- APK REFAIT le 25/08/2026 (`npx eas-cli build --platform android --profile preview`) : il pointe
  sur Render, réutilise la clé de signature existante (s'installe par-dessus l'ancien). PIÈGE DE
  MÉTHODE rencontré en surveillant le build : `eas build:view` n'accepte PAS `--non-interactive`
  (contrairement à `eas build`) — la boucle de surveillance échouait en silence et laissait croire
  que le build était bloqué alors qu'il avait réussi. Vérifier le statut avec
  `npx eas-cli build:view <id> --json`.

### ⚠️ LENTEUR POSTGRES : une connexion par appel, ça ne pardonne pas à distance (25/08/2026)

Premier vrai test depuis l'APK : impossible de se connecter NI de créer un compte — l'app
affichait « aborted », puis « ce compte existe déjà » au deuxième essai. Symptôme trompeur :
l'inscription RÉUSSISSAIT côté serveur, mais l'app abandonnait avant de recevoir la réponse.

- MESURÉ (curl, serveur déjà chaud) : `GET /sante` ~1 s, mais `GET /joueurs` **15 s**, de façon
  constante — donc pas un réveil de serveur, une vraie lenteur de fond.
- CAUSE RACINE : `connexion()` ouvre une connexion NEUVE à chaque appel. Sur SQLite (fichier
  local) c'est quasi gratuit, ce qui a rendu le problème invisible pendant toute la migration ;
  vers Neon, chaque ouverture coûte ~2,5 s (réseau + TLS + authentification). Et
  `lire_tous_les_joueurs()` appelait `lire_joueur()` en boucle → **une connexion PAR JOUEUR**.
  5 joueurs = 6 connexions = 15 s, et le coût AUGMENTAIT à chaque inscription (20 joueurs
  auraient donné ~50 s).
- CORRIGÉ EN TROIS TEMPS :
  1. **Réserve de connexions** (`psycopg_pool.ConnectionPool`, `_obtenir_reserve()`) : les
     connexions Postgres sont empruntées puis rendues, plus jamais rouvertes. `max_size=4` —
     l'offre gratuite de Neon limite les connexions simultanées. Créée au PREMIER besoin, pas à
     l'import, sinon les tests (SQLite) tenteraient de joindre un Postgres inexistant.
     Le chemin SQLite garde l'ouverture/fermeture à chaque appel (sinon le fichier reste
     verrouillé sous Windows). Dépendance : `psycopg[binary,pool]`.
  2. `lire_tous_les_joueurs()` : **3 requêtes fixes** (joueurs, perfs, titres, recollées en
     mémoire) au lieu de 2 par joueur — le coût ne dépend plus du nombre de joueurs.
  3. Délai d'attente de l'app (`DELAI_MAX_MS`, `src/api.js`) porté de 4 s à **12 s** : même avec
     un serveur rapide, Neon gratuit met la base en VEILLE après quelques minutes d'inactivité et
     le premier accès qui la réveille peut dépasser 4 s sans que rien ne soit en panne.
- LEÇON GÉNÉRALE : un motif d'accès aux données parfaitement sain sur SQLite peut être ruineux
  sur une base DISTANTE. Ce qui était gratuit (ouvrir une connexion, faire N+1 requêtes) se paie
  désormais en latence réseau. À surveiller pour toute nouvelle fonction qui boucle sur des
  joueurs en appelant une autre fonction de `basededonnees.py`.

## Version web — fait le 10/08/2026

Objectif de Hafiz : « créer l'application » → une version utilisable dans un NAVIGATEUR
(ordinateur ou téléphone), en plus de l'app mobile Expo Go. Grâce à Expo, c'est la MÊME app
(mêmes écrans, même code) rendue en site web par `react-native-web` — aucun écran n'a été réécrit.

- Dépendances ajoutées : `react-dom`, `react-native-web`, `@expo/metro-runtime`
  (installées via `npx expo install`, versions alignées sur le SDK Expo 54).
- `app.json` : ajout de `"web": { "bundler": "metro" }`.
- LANCER LA VERSION WEB : `npx expo start --web` (le backend doit tourner à côté, comme pour
  le mobile : `uvicorn app.main:app --app-dir backend --host 0.0.0.0`). Le site s'ouvre sur
  `http://localhost:8081`. Sur le web, l'app parle au serveur via le repli `localhost:8000`
  de `obtenirBaseUrl()` (`src/api.js`) — normal, le navigateur tourne sur le même PC que le
  serveur. Le CORS ouvert ajouté pour Fly.io (voir "Hébergement") couvre déjà le cas web.
- SEUL CHANGEMENT DE CODE : `joindreVideo()` dans `src/api.js` — le format d'upload
  `{uri, name, type}` est propre à React Native et ne marche pas dans un navigateur. Sur le
  web (`Platform.OS === 'web'`), on lit maintenant le fichier choisi (`fetch(uri).blob()`)
  et on l'envoie comme un vrai fichier, avec l'extension déduite du type MIME (l'URI web est
  un identifiant aléatoire sans extension). Le chemin mobile est inchangé.
- Vérifié dans le navigateur : inscription, profil, classements OK ; pas d'erreur console.
  Aucun `Alert.alert` dans le code (il serait muet sur web) — les erreurs passent par des
  états React affichés à l'écran, ce qui marche partout.
- À FAIRE ENSUITE (séparé) : héberger cette version web sur internet (ex. `npx expo export
  --platform web` produit un dossier `dist/` statique, à servir n'importe où) et la brancher
  sur l'adresse Fly.io via `expo.extra.apiUrl` — pour l'instant elle n'est utilisable qu'en
  local, PC + navigateur sur la même machine (ou même Wi-Fi via l'IP du PC).

## APK Android installable (EAS Build) — configuré le 10/08/2026

⚠️ SECTION EN PARTIE PÉRIMÉE depuis le 25/08/2026 : tout ce qui parle de l'IP DU PC
(192.168.100.45), du pare-feu et de `usesCleartextTraffic` ne s'applique PLUS — le serveur est
maintenant hébergé en ligne à une adresse fixe et l'app pointe dessus. Voir « L'app parle au
serveur en ligne » plus haut. Le reste (comment lancer un build EAS) reste valable.

Objectif de Hafiz : une vraie app installable sur téléphone, sans Expo Go. Construite dans le
cloud par EAS Build (service Expo, gratuit avec file d'attente — compte Expo requis, pas de
carte bancaire). DÉCISION HISTORIQUE (remplacée) : l'APK pointait sur l'IP DU PC
(192.168.100.45:8000) — il ne marchait donc que sur le Wi-Fi de la maison, avec le PC allumé et
le backend lancé.

- `eas.json` : profil "preview" → un APK installable directement (`buildType: "apk"`), avec la
  variable d'environnement `API_URL` (l'adresse du serveur intégrée à la construction).
  Le profil "production" (AAB pour le Play Store, plus tard) a la même variable.
- `app.config.js` (NOUVEAU) : config dynamique qui complète app.json — injecte `API_URL` dans
  `extra.apiUrl` À LA CONSTRUCTION seulement. En dev (Expo Go / web), la variable n'existe pas
  → `apiUrl` reste null → détection automatique de l'IP comme avant, rien ne change.
- `expo-build-properties` (dépendance ajoutée) : plugin configuré dans app.json avec
  `usesCleartextTraffic: true` — SANS ça, un APK Android refuse silencieusement toute connexion
  `http://` (non chiffrée) ; nécessaire tant que le serveur est local (Fly.io sera en https,
  on pourra alors retirer cette option).
- Pare-feu : la règle "Fitness Royale Backend" (port 8000, tous profils) existe déjà — vérifiée.
- ATTENTION : si l'IP du PC change (192.168.100.45 aujourd'hui), l'APK ne trouve plus le serveur
  → mettre à jour `eas.json` et refaire un build, ou réserver l'IP dans la box.
- ÉTAPES MANUELLES (Hafiz — compte requis, impossible à faire à sa place) :
  1. Créer un compte gratuit sur https://expo.dev/signup
  2. `npx eas-cli login` (pseudo + mot de passe du compte Expo)
  3. `npx eas-cli build --platform android --profile preview` — répondre OUI à "create a new
     project" (1re fois) et OUI à "generate a new Android Keystore" (EAS garde la clé de
     signature pour tous les builds suivants). ~10-20 min d'attente dans le cloud.
  4. À la fin, un lien + QR code : l'ouvrir sur le téléphone pour télécharger et installer
     l'APK (autoriser "sources inconnues" si Android le demande).
- REFAIRE UN BUILD après ajout de fonctionnalités : re-lancer la commande de l'étape 3,
  réinstaller le nouvel APK par-dessus l'ancien (les données restent côté serveur, rien n'est
  perdu). Les changements PUREMENT côté backend ne demandent PAS de nouveau build.

## Mots de passe : changement + « mot de passe oublié » (code de secours) — fait le 12/08/2026

Demande de Hafiz après avoir oublié les mots de passe de tous ses comptes de test (réinitialisés
à la main ce jour-là : les 4 comptes → `royale123`).

- **Changer son mot de passe** (connecté) : `POST /auth/changer-mot-de-passe` (ancien + nouveau —
  l'ancien est exigé même avec un token valide, pour qu'un téléphone déverrouillé ne suffise pas
  à s'approprier le compte). ÉCRAN : Profil → carte « 🔒 Sécurité du compte » (repliée par défaut).
- **Mot de passe oublié** : PAS d'e-mail dans l'app → mécanisme du CODE DE SECOURS. Un code
  (8 caractères, même générateur que les codes de duel) est créé à l'INSCRIPTION et affiché UNE
  SEULE FOIS (écran « Compte créé ! » avec bouton « C'est noté »). Côté serveur, seul son HASH
  est stocké (PBKDF2, comme un mot de passe) — impossible de le réafficher, seulement d'en
  regénérer un (bouton dans « Sécurité du compte »). `POST /auth/mot-de-passe-oublie` (pseudo +
  code + nouveau mdp, sans connexion) : code à USAGE UNIQUE, toutes les sessions existantes sont
  supprimées (déconnexion partout si le compte était compromis), et la réponse reconnecte
  directement (même forme que /auth/connexion). Lien « Mot de passe oublié ? » sur l'écran de
  connexion → formulaire dédié.
- ATTENTION : les comptes créés AVANT cette fonctionnalité n'ont PAS de code de secours — il faut
  se connecter puis en générer un dans « Sécurité du compte » pour être couvert.
- Colonne `code_recuperation_hash` sur `joueurs` (migration additive), jamais exposée par l'API.
- Tests : 7 nouveaux dans `test_api_auth.py` (usage unique, sessions tuées, regénération…).

## Entraînement v2 : jours, modèles standards, calendrier multi-semaines, rappel — fait le 12/08/2026

Demandes de Hafiz (4 en une) : jours de la semaine sur les programmes, modèles standards type
Push Pull Legs avec composition hebdomadaire proposée, calendrier pour planifier un programme
sur plusieurs semaines, et rappel d'entraînement à heure fixe avec notification.

- **Jours de la semaine** : colonne `jours` (JSON, ex. `["lundi","jeudi"]`) sur `programmes` +
  puces Lun-Dim dans le formulaire « Nouveau programme ». Le serveur valide les noms de jours
  (400 sinon — liste `JOURS_SEMAINE` dans main.py, dupliquée dans
  `src/data/programmesStandards.js`, à garder synchronisées).
- **UN PROGRAMME = UN CYCLE COMPLET SUR LA SEMAINE** (refonte du 12/08/2026, demande de Hafiz :
  « dans ce programme on va devoir obligatoirement choisir les exercices et les jours… quand on
  va vouloir l'insérer dans le calendrier, les jours seront impactés automatiquement »).
  L'écran « ➕ Nouveau programme » se fait en 3 temps : (1) un nom, (2) les JOURS d'entraînement
  — OBLIGATOIRES, (3) pour CHAQUE jour coché, sa séance (nom + exercices avec séries × reps).
  Un jour sans exercice bloque l'enregistrement.
- MODÈLE DE DONNÉES — tables `cycles` + `cycle_programmes` : un cycle GROUPE des programmes
  existants, chacun étant une séance portant ses jours (`jours = ["lundi"]`). DÉCISION : pas de
  nouvelle table d'exercices — une séance reste un `programme` ordinaire, donc elle apparaît
  aussi dans la semaine type et reste posable seule au calendrier. Endpoints
  `POST/GET /joueurs/{id}/cycles` et `DELETE /cycles/{id}` (supprime le cycle ET ses séances,
  elles n'existent que pour lui). Une séance accepte PLUSIEURS jours (`jours: [...]`) pour les
  cycles type PPL 6j où « Push » revient le lundi ET le jeudi.
- **Modèles standards** (`src/data/programmesStandards.js`) : PPL 6j, PPL 3j, Full Body 3j,
  Upper/Lower 4j. « Utiliser ce modèle » crée maintenant un CYCLE complet à moi (même objet
  qu'un programme créé à la main, juste pré-rempli) — modifiable jour par jour ensuite.
  DÉCISION : les modèles vivent CÔTÉ FRONT (pas de table serveur) — ce ne sont que des
  pré-remplissages.
- **Poser un programme dans le calendrier remplit tous ses jours** : « ➕ Placer un programme ce
  jour » propose UNE séance (un seul jour) ou un PROGRAMME COMPLET — mes cycles + les modèles
  standards, ramenés à la même forme par `cyclesPlacables`. La date cliquée devient le « jour 1 » ;
  `placerModeleAuPlanning()` génère toutes les dates sur N semaines et les envoie d'un coup
  (`POST /joueurs/{id}/planning/lot`). Vérifié : « Mon PPL maison » (Lun/Mer/Ven) posé le lundi
  07/09 sur 3 semaines → 9 dates créées, chaque séance sur son bon jour.
- Dans « Mes programmes », les cycles s'affichent en cartes 📋 (une ligne par séance avec ses
  jours et un bouton Démarrer) ; les séances isolées (créées depuis la semaine type, hors cycle)
  restent listées en dessous — `programmesSeuls` les distingue via les ids des séances de cycles.
- **Calendrier multi-semaines** : colonnes `duree_semaines` + `date_debut` sur `programmes`
  (optionnelles ; une durée sans date de début = début aujourd'hui). Badge « semaine 2/4 » sur
  les cartes programmes ; un programme planifié disparaît du calendrier après sa dernière
  semaine. Le calcul (`planificationProgramme`) est 100% local dans EntrainementScreen.
  HISTORIQUE : une 1re version (liste des 7 prochains jours) a été REJETÉE par Hafiz en test
  (« je ne vois pas le calendrier », « quand on clique sur lundi on devrait pouvoir mettre un
  programme », « je veux un vrai calendrier interactif ») — remplacée le 12/08/2026 par la
  SEMAINE TYPE + le CALENDRIER MENSUEL ci-dessous.
- **Semaine type = ÉDITEUR DIRECT de la séance du jour** (composant `EditeurJour`) : 7 lignes
  Lundi-Dimanche ; toucher un jour ouvre un formulaire où l'utilisateur ÉCRIT LUI-MÊME la séance
  — un nom libre, puis autant d'exercices qu'il veut (nom + séries + reps, avec « + Ajouter un
  exercice » et ✕ pour retirer une ligne), plus « 🗑 Vider ce jour » qui le repasse en repos.
  HISTORIQUE : une 1re version proposait de COCHER un programme existant (PPL/Push…) dans une
  liste — rejetée par Hafiz (« supprime l'option de mettre le programme PPL ou push… on pourra
  juste cliquer sur le jour et mettre le nom et le programme qu'on peut faire ce jour nous-mêmes,
  le nombre d'exercices, les répétitions et les séries »). Le choix parmi les programmes existants
  reste disponible, mais UNIQUEMENT dans le calendrier.
- **Chaque jour de la semaine type est INDÉPENDANT** : enregistrer la séance d'un jour dont le
  programme est partagé avec d'autres jours (cas hérité, ex. un « Push » sur lundi ET jeudi)
  DÉTACHE ce jour et lui crée sa propre séance — éditer lundi ne modifie jamais jeudi à son insu.
  En interne, une séance de jour reste un `programme` avec `jours = [ce jour]` (aucune nouvelle
  table) : elle apparaît donc aussi dans « Mes programmes » et est réutilisable dans le calendrier.
- Endpoints d'édition : `PUT /programmes/{id}/nom` (renommer), `PUT /programmes/{id}/exercices`
  (remplace toute la liste), `PUT /programmes/{id}/jours` — propriété vérifiée sur les trois (403).
- **Calendrier mensuel interactif** : vraie grille du mois (◀ ▶ pour naviguer), point « • » sur
  les jours ayant un programme (récurrent OU posé à cette date), ✅ si séance loggée, contour or
  = aujourd'hui. Largeur bornée à 380px (`blocCalendrier`) : sans ça les cases (1/7 de l'écran)
  devenaient énormes sur grand écran (retour de Hafiz « le calendrier est trop gros »). Toucher
  une DATE ouvre son détail : programmes du jour avec EXERCICES COMPLETS et leurs séries × reps
  (étiquette « chaque mercredi » / « ce jour uniquement »), bouton « Démarrer cette séance » si
  c'est aujourd'hui, ✕ pour retirer une planification ponctuelle.
- **Modifier une séance DEPUIS le calendrier** (demande de Hafiz du 12/08/2026) : bouton
  « ✏️ Modifier » sur chaque séance du jour → même éditeur que la semaine type (nom, exercices,
  séries × reps, ajouter/retirer une ligne). DÉCISION — un seul composant `EditeurSeance`
  partagé par la semaine type ET le calendrier (au lieu de dupliquer le formulaire) ; il reçoit
  `programme`, les libellés, et un `onSauvegarder(nom, exercices)`.
- ATTENTION — la modification s'applique PARTOUT : une séance est le même objet quelle que soit
  la date où elle est prévue, donc la retoucher change tous les jours récurrents et toutes les
  dates posées qui l'utilisent. L'éditeur AFFICHE UN AVERTISSEMENT en jaune quand c'est le cas
  (« utilisée plusieurs jours de la semaine et à N autres dates »), calculé depuis `planning` et
  `programme.jours`. Vérifié : renommer « Push » en « Push lourd » et passer le développé couché
  à 6×3 depuis le 07/09 se reflète bien sur lundi ET jeudi de la semaine type.
- **Placer un CYCLE complet depuis le calendrier** (demande de Hafiz : « si le PPL dure six jours,
  quand tu cliques sur le premier jour, tous les autres jours concernés seront déjà impactés ») :
  « ➕ Placer un programme ce jour » propose soit UN programme (un seul jour), soit un CYCLE
  standard (PPL 6j, Full Body…) + un nombre de semaines. La date cliquée devient le « jour 1 » du
  cycle : `placerModeleAuPlanning()` crée les programmes manquants (réutilisés PAR NOM s'ils
  existent déjà, sans jours récurrents) puis pose toutes les dates d'un coup via
  `POST /joueurs/{id}/planning/lot` (doublons ignorés, max 200 dates). Vérifié : PPL 6j sur
  2 semaines à partir du lundi 17/08 → 12 dates créées (Push Lun/Jeu, Pull Mar/Ven, Legs Mer/Sam).
- Table `planning` (joueur_id, date, programme_id, UNIQUE les trois) + endpoints
  `GET/POST /joueurs/{id}/planning`, `POST /joueurs/{id}/planning/lot`, `DELETE /planning/{id}` —
  garde-fous : date valide, programme À SOI uniquement (403), doublon même jour (409 en unitaire,
  ignoré en lot). Les planifications par date et les jours récurrents se CUMULENT à l'affichage.
- **Volume : objectif de SÉRIES par groupe musculaire** (demande de Hafiz du 12/08/2026, « fixer
  un nombre de sets par body part » + comptabilisation). Section « 🎯 Séries par groupe
  musculaire » (repliée par défaut) en haut de l'onglet Entraînement :
  - **L'objectif** (ex. Pectoraux 12/semaine) est stocké côté serveur — table `objectifs_series`
    (UNIQUE joueur+groupe), endpoints `GET/PUT /joueurs/{id}/objectifs-series` (le PUT REMPLACE
    toute la liste ; un champ laissé vide = groupe non suivi). 12 groupes fixes
    (`GROUPES_MUSCULAIRES` dans main.py = `groupesMusculaires` dans
    `src/data/groupesMusculaires.js`, à garder synchronisés — 400 si groupe inconnu).
  - **Le COMPTAGE est calculé CÔTÉ APP** (`compterSeriesParGroupe`) à partir des séances déjà
    chargées, sur la semaine en cours (lundi→dimanche via `lundiDeLaSemaine`). DÉCISION : pas
    d'endpoint de comptage — l'app a déjà tout l'historique, ça évite un aller-retour et ça
    marche hors-ligne. Affichage : barre de progression par groupe, verte + ✅ une fois
    l'objectif atteint.
  - **Rattacher un exercice à un groupe** : les exercices étant en TEXTE LIBRE, `deviner_groupe()`
    devine par MOTS-CLÉS. ORDRE DES RÈGLES CRITIQUE : les expressions spécifiques passent avant
    les générales, sinon « leg curl » (ischios) serait pris par « curl » (biceps) et « soulevé de
    terre jambes tendues » (ischios) par « soulevé de terre » (dos).
  - Un exercice non reconnu n'est compté NULLE PART, mais l'app le liste sous « ❓ Exercices non
    classés » avec les 12 groupes à choisir ; le choix est enregistré (table `groupes_exercices`,
    `PUT /joueurs/{id}/groupes-exercices/{exercice}`) et PRIME toujours sur la détection auto.
  - Vérifié : séance de 3 séries de développé couché + 2 tractions + 1 exo inconnu → Pectoraux
    3/12, Dos 2/16 ; l'exo inconnu classé en Biceps fait passer Biceps de 0/8 à 1/8.
  - **RÉSUMÉ VISIBLE SANS DÉPLIER** (12/08/2026) : des puces « Pectoraux 0/12 · Dos 0/16 »
    s'affichent sous le titre même quand la section est repliée (verte + ✅ si l'objectif est
    atteint) — on doit voir où on en est d'un coup d'œil, sans action.
  - **RAPPEL DE SUIVI hebdomadaire** (demande de Hafiz : « un rappel pour le suivi ») : une
    notification une fois par semaine (jour + heure au choix, dimanche 19:00 par défaut) dont le
    MESSAGE PORTE L'ÉTAT RÉEL (« Pectoraux 8/12 · Dos 14/16 »). À distinguer du rappel
    d'ENTRAÎNEMENT existant, qui dit d'aller s'entraîner ; celui-ci dit où on en est.
  - PIÈGE TECHNIQUE RÉSOLU : le contenu d'une notification locale est FIGÉ au moment où on la
    programme. Le rappel est donc REPROGRAMMÉ après chaque séance enregistrée
    (`rafraichirRappelSuivi`), sinon il annoncerait des chiffres périmés.
  - AUTRE PIÈGE : `cancelAllScheduledNotificationsAsync()` annulerait les DEUX familles de
    rappels. `notifications.js` mémorise donc les identifiants par famille
    (`fitnessRoyale.idsNotifications` dans AsyncStorage) et n'annule que la famille visée —
    désactiver le point hebdo ne casse plus le rappel de séance.
  - Le calcul du volume de la semaine a été REMONTÉ avant les vues dans `EntrainementScreen` :
    la reprogrammation se fait depuis l'écran de séance, où les variables de la vue accueil
    n'existaient pas (ça aurait planté).
  - NON TESTÉ EN RÉEL (comme le rappel d'entraînement) : les notifications sont des no-op sur
    web et la carte y est cachée — à vérifier sur téléphone avec un nouvel APK.
- **Rappel d'entraînement** (`src/notifications.js`, dépendance `expo-notifications`) :
  notifications LOCALES hebdomadaires (comme un réveil — aucun serveur, marche app fermée).
  Carte « 🔔 Rappel d'entraînement » : puces de jours + heure (18:00), permission demandée à
  l'activation, config persistée dans AsyncStorage (`fitnessRoyale.rappel`). CACHÉE SUR WEB
  (expo-notifications ne programme pas de notification dans un navigateur ; toutes les fonctions
  de notifications.js sont des no-op sur web). NON TESTÉ EN RÉEL sur téléphone au moment de
  l'écriture — à vérifier avec l'APK (les notifications locales ne marchent pas toujours dans
  Expo Go selon la version d'Android).
- Vérifié dans le navigateur (version web) : sécurité du compte (changement + code affiché),
  parcours « mot de passe oublié » complet, modèle PPL → 3 programmes créés, calendrier correct
  (Legs le mercredi…), programme « 4 semaines » avec badge sem. 1/4. Suite backend : 147 tests OK.

## Entraînement v3 : chacun son rôle (calendrier / Mes programmes) — fait le 27/08/2026

Trois demandes de Hafiz en une, toutes dans `EntrainementScreen.js`. Le fil conducteur : la
même séance était éditable à DEUX endroits et démarrable à DEUX endroits, ce qui brouillait tout.

**1. La croix ne supprime plus sur-le-champ** (« lorsqu'on enregistre un programme, la croix ne
doit pas la supprimer immédiatement »). Un programme d'une semaine entière pouvait disparaître
sur une fausse manœuvre. La croix ARME maintenant une question posée dans la carte
(`ConfirmationSuppression`, nouveau petit composant), un second geste confirme.
DÉCISION : pas d'`Alert.alert` — il est MUET sur le web, où Hafiz teste (convention déjà posée
dans le projet : tous les messages passent par des états React affichés à l'écran).
Ouvrir la question ferme l'éditeur en cours (`setProgrammeEnEdition(null)`), pour ne pas poser
une question de suppression sous un formulaire ouvert.

**2. La SEMAINE TYPE disparaît dès qu'un programme est en service** (« si un programme est
enregistré et utilisé, la semaine type disparaît »). `programmeEnService` traduit « enregistré
ET utilisé » par : il existe un cycle, OU une séance qui se répète chaque semaine
(`jours` non vide), OU au moins une date posée au calendrier. Tant que rien de tout ça n'existe,
la semaine type reste le moyen le plus simple d'écrire sa semaine ; dès qu'un programme prend le
relais, elle ferait doublon.
⚠️ CONSÉQUENCE À CONNAÎTRE : la semaine type était le SEUL endroit où créer une séance de jour
à la volée. Une fois masquée, on passe par « + Nouveau programme » ou par « ✏️ Modifier » dans
« Mes programmes ». Elle réapparaît si on supprime tout.

**3. Un seul rôle par écran** (« le calendrier ne propose que de démarrer la session donc
l'onglet Mes programmes montre le programme et ne propose que de le modifier ») :
- CALENDRIER = montrer et DÉMARRER. Le bouton « ✏️ Modifier » et son `EditeurSeance` en sont
  retirés. Il garde la croix qui retire une planification PONCTUELLE — ce n'est pas une
  suppression de programme, juste un retrait de date, donc pas de confirmation dessus.
- MES PROGRAMMES = montrer et MODIFIER. Les boutons « Démarrer » y sont remplacés par
  « ✏️ Modifier », qui ouvre l'éditeur SOUS la ligne concernée (cycles comme séances isolées).
  Une ligne d'explication apparaît en tête de section (seulement s'il y a au moins un programme)
  pour dire où démarrer.
- `noteReutilisation(programme)` remplace le calcul qui vivait dans le calendrier : c'est
  l'avertissement « ⚠️ cette séance est utilisée sur N jours et N dates, tes modifications s'y
  appliqueront partout ». Une séance reste LE MÊME OBJET partout où elle est prévue.

DÉMARRER UNE SÉANCE, désormais : depuis le calendrier en touchant la date du JOUR, ou par
« 🏋️ Démarrer une séance libre ». (Le bouton du calendrier n'apparaît que pour aujourd'hui —
comportement inchangé, mais il devient le chemin principal, à surveiller au test.)

**4. Dérouler un programme, et en sortir** (même jour, après test de Hafiz : « il faut une
option pour dérouler le programme d'entraînement et une option pour sortir du programme »).
- DÉROULER : dans « Mes programmes », toucher une séance affiche ses exercices avec leurs
  séries × reps, en lecture seule (`seanceDeroulee`). Il fallait jusque-là ouvrir l'éditeur pour
  simplement REGARDER ce qu'on avait prévu — conséquence directe du point 3, qui avait retiré
  l'affichage détaillé du calendrier sans le remettre ailleurs.
- SORTIR : `sortirDuProgramme(seances)` retire les jours récurrents ET les dates posées d'un
  programme, SANS le supprimer. `programmeEnService` retombe donc à faux et la semaine type
  revient ; le programme reste dans « Mes programmes », prêt à être reposé au calendrier.
  C'était le manque créé par le point 2 : on ne pouvait plus quitter un programme qu'en le
  SUPPRIMANT. Le bouton n'apparaît que si le programme occupe vraiment la semaine
  (`cycleEnService`), sinon il n'aurait rien à libérer.
  Confirmation en deux temps comme la suppression, mais en OR et non en rouge : ça ne détruit
  rien (`ConfirmationSuppression` accepte `libelleConfirmer` et `couleur`).
- SORTIR D'UNE SÉANCE EN COURS : le lien gris « Abandonner », en bas de l'écran de séance,
  existait déjà mais Hafiz ne l'avait pas trouvé. Devenu un vrai bouton bordé,
  « 🚪 Sortir du programme (sans enregistrer) ».

VÉRIFIÉ : le bundle Metro compile et l'app démarre sans erreur console. Le parcours à l'écran
n'a PAS été rejoué (il demande un compte connecté) — à confirmer sur l'APK.

## Entraînement v4 : deux bugs de fond + le compteur de séries — fait le 28/08/2026

Retour de Hafiz après avoir testé l'APK de la v3. Deux des cinq points étaient de VRAIS BUGS,
tous les deux introduits par la v3 elle-même — et tous les deux SILENCIEUX, ce qui les rendait
difficiles à décrire autrement que par « ça ne marche pas ».

**1. BUG — « lorsqu'on quitte un programme, la semaine type doit revenir » (elle ne revenait
jamais).** `programmeEnService` testait `cycles.length > 0`. Or « Sortir du programme » ne
SUPPRIME pas le cycle : il lui retire seulement ses jours et ses dates. La condition restait
donc vraie pour toujours. Corrigé en demandant qu'un cycle occupe RÉELLEMENT la semaine
(`cycles.some(cycleEnService)`, la fonction existait déjà pour décider d'afficher le bouton
« Sortir »). LEÇON : `cycleEnService` disait déjà la bonne chose au bon endroit — le bug venait
d'avoir écrit une SECONDE définition, plus grossière, de la même idée quelques lignes plus loin.

**2. BUG — « quand on place un programme dans le calendrier, ça ne marche pas ».**
`placerModeleAuPlanning` génère les dates par `for (const jour of seance.jours)`. Si les séances
n'ont PLUS de jours, la boucle ne tourne pas une seule fois : zéro date posée, et rien à l'écran
ne le signalait. Or c'est exactement l'état d'un cycle dont on vient de « sortir » (bug n°1 =
la cause, celui-ci = la conséquence), et aussi celui des cycles que cette fonction crée
elle-même (elle les crée avec `jours: []`, la répétition venant des dates posées). Corrigé :
ces séances sont réparties sur des jours CONSÉCUTIFS à partir de la date choisie, dans leur
ordre — poser un programme fait toujours quelque chose. Et si la liste de dates finit quand
même vide, un message le dit au lieu de ne rien faire.

**3. Démarrer depuis n'importe quel jour du calendrier.** Le bouton « 🏋️ Démarrer cette séance »
était conditionné à `cestAujourdhui` : toucher une autre date n'offrait rien du tout — ce que la
v3 avait rendu très visible en faisant du calendrier LE chemin pour démarrer. Il s'affiche
maintenant sur toute date qui a une séance (libellé « Démarrer cette séance maintenant » quand
ce n'est pas aujourd'hui : la séance est enregistrée au jour où on la fait, pas à la date
touchée).

**4. Afficher le détail du PROGRAMME ENTIER.** La v3 permettait de dérouler une séance à la
fois ; voir sa semaine complète demandait autant de gestes qu'il y a de jours. Un interrupteur
« ▼ Voir le détail / ▲ Masquer le détail » sur la carte du programme déroule toutes ses séances
d'un coup (`cyclesDeroules`). Le déroulé séance par séance reste disponible — une séance est
ouverte si SON détail est ouvert OU celui du programme.

**5. Le compteur de séries de la semaine.** La section « 🎯 Séries par groupe musculaire »
comptait déjà juste (`compterSeriesParGroupe`), mais il fallait la déplier pour voir quoi que ce
soit, et le résumé replié était plafonné à 6 groupes. Désormais : un TOTAL toujours visible sous
le titre (« 28 séries cette semaine · 3 séances »), et plus aucun groupe travaillé n'est masqué.
Le calcul, lui, n'a pas changé — il reste fait CÔTÉ APP depuis les séances réellement loggées
de la semaine en cours (lundi→dimanche), sans aller-retour serveur.

## Arènes façon Clash Royale (écran Paliers) — fait le 12/08/2026

Demande de Hafiz : « pour la partie paliers j'aimerais qu'on construise un système d'arène comme
dans Clash Royale ». L'onglet Paliers s'ouvre maintenant sur la PROGRESSION, avant le barème.

- DÉCISION FONDAMENTALE — AUCUN nouveau score : une arène = une LIGUE Club SP déjà existante,
  simplement habillée d'un nom, d'un emblème et d'un seuil affichable. L'arène est déterminée par
  `ligueJoueur()` (palier moyen sur TOUS les exercices du barème), donc tout reste cohérent avec
  le classement, le profil et l'avatar. `src/data/arenes.js` ne contient que de la présentation
  + 3 petits calculs d'affichage.
- **RENOMMAGE (12/08/2026, vision Arena Pass de Hafiz)** : les arènes portent désormais ses noms,
  mappés 1-pour-1 sur les ligues — 🚪 DÉBUT (Aucune), 🌱 INITIATION (Bronze), 🔥 FORGE (Silver),
  ⚔️ COLOSSE (Gold), 🏆 TITAN (Legend), 💎 OLYMPE (Titan), 👑 ROYALE (Royal). Chaque arène porte
  un `titre` affichable au profil (Recrue, Fighter, Gladiator, Titan, Olympien, Royal) et un
  `decor` (description de l'ambiance visée). ATTENTION au piège de vocabulaire : l'arène 🏆 TITAN
  correspond à la ligue **Legend**, et 💎 OLYMPE à la ligue **Titan** — les deux échelles sont
  décalées d'un cran, ne pas les confondre en lisant le code.
- Le SOMMET s'appelle 👑 ROYALE, pas « LÉGENDE » (correction de Hafiz du 12/08/2026) : le rang
  ultime porte le nom de la marque, comme l'app elle-même. Cohérent avec la décision plus
  ancienne d'avoir renommé la ligue « Olympe » en « Royal ».
- LA ROUTE DES ARÈNES (`src/components/RouteArenes.js`) : la carte de progression VERTICALE
  demandée par Hafiz (« le joueur voit littéralement où il va »), affichée du SOMMET vers le BAS
  avec des flèches ⬆️ entre les étapes, une pastille colorée par emblème (estompée si verrouillée)
  et ✅ / 📍 / 🔒. Utilisée par l'écran Paliers ; conçue pour être réutilisable ailleurs.
- ADAPTATION AUTOMATIQUE AU SEXE : `arenesDuBareme()` coupe la liste au NOMBRE DE PALIERS du
  barème (femmes 5 → s'arrêtent à La Forge des Titans, hommes 6 → jusqu'au Trône Royal), plutôt
  que de tester le sexe en dur : si un barème change un jour, les arènes suivent toutes seules.
  Vérifié par un petit script sur les deux barèmes.
- SEUILS : `ligueJoueur()` fait `Math.round(moyenne)`, donc on entre dans l'arène N dès que la
  moyenne atteint N − 0,5 (`seuilMoyenne`). Converti en nombre de paliers affichable pour un
  barème de 15 exercices : Bronze 8, Silver 23, Gold 38, Legend 53, Titan 68, Royal 83.
- ÉCRAN (`PaliersScreen.js`) : (1) grande carte de l'arène actuelle — emblème, nom, devise, barre
  de progression à la couleur de la ligue, et surtout « il te manque N paliers à faire vérifier »
  (`paliersManquants`), volontairement ACTIONNABLE plutôt qu'un pourcentage abstrait ;
  (2) « Le parcours » — toutes les arènes du sommet vers la base, ✅ franchie / 📍 actuelle /
  🔒 verrouillée (emblème estompé) ; (3) le barème par exercice, INCHANGÉ, sous « Mes paliers
  par exercice ».
- Vérifié : compte sans perf → 🚪 Le Vestiaire, « il te manque 8 paliers » ; après 12 perfs
  vérifiées au palier Silver (score 24/15 = 1,6) → 🥈 La Salle d'Argent, Bronze et Vestiaire ✅,
  « il te manque 14 paliers » pour Gold (38 − 24), barre à 10 % en argent.

### Visuel de l'arène + arène sur le Profil — fait le 12/08/2026

Demande de Hafiz : « l'arène devrait être présentée dès qu'on entre dans l'app donc au centre de
profil. et je veux une représentation graphique de l'arène ».

- **L'arène est maintenant en haut du Profil** (premier écran de l'app), juste sous l'en-tête —
  avant la salle de gym. `CarteArene` prend une prop `compacte` (utilisée par le Profil : masque
  la devise) ; l'écran Paliers affiche la même carte en version complète.
- DÉCISION — UN SEUL composant partagé (`src/components/CarteArene.js`) entre Profil et Paliers,
  + `areneDuJoueur(joueur)` qui fait tout le calcul en un appel (via `etatArene()` dans
  `arenes.js`). Impossible que les deux écrans divergent. NOTE : `arenes.js` reste un fichier de
  DONNÉES — il ne connaît pas `logic/classement.js` ; c'est `CarteArene` qui lui fournit
  moyenne/scoreSP/ligue en paramètres.
- **Le visuel** (`src/components/AreneVisuel.js`) est DESSINÉ EN SVG (`react-native-svg`,
  nouvelle dépendance), pas une image. Raison : 7 arènes × plusieurs résolutions d'images à
  dessiner à la main, ça alourdit l'app et il faudrait un graphiste ; en SVG tout est généré à
  partir de la seule couleur de ligue (`teinter()` fabrique les dégradés), c'est net sur tous
  les écrans et une nouvelle arène coûte quelques lignes. Ça lève partiellement la limite notée
  dans « Avatar évolutif » (pas d'illustrations) : on ne dessine pas un personnage, mais un DÉCOR.
- **Le décor s'enrichit avec la ligue** (comme les arènes de Clash Royale) : niveau 0 une porte
  (vestiaire, tout en gris) ; 1+ gradins avec rangées de spectateurs ; 2+ projecteurs et
  faisceaux ; 3+ bannières suspendues ; 4+ colonnes et fronton de temple ; 5+ braseros allumés ;
  6 couronne et rayons. Vérifié en montant le compte de test : Silver → 6 paths / 1 rect ;
  Gold → 8 paths / 3 rects (les 2 bannières apparaissent).
- Le cadre utilise `aspectRatio: 320/180` (le ratio du viewBox) + `maxWidth: 380` : le dessin
  remplit toujours son cadre sans bande vide, du téléphone au grand écran (une 1re version à
  hauteur fixe laissait des bandes latérales sur desktop).
- ATTENTION APK : `react-native-svg` est un module NATIF — l'APK déjà installé ne l'a pas, il
  FAUT refaire un build EAS pour voir l'arène sur téléphone (la version web et Expo Go, elles,
  fonctionnent immédiatement).

### De vraies illustrations à la place du SVG — fait le 26/08/2026, refait le 27/08/2026

Demande de Hafiz (« voici le style que je veux pour les arènes ») : une maquette façon Clash
Royale, 6 arènes isométriques peintes.

- DÉCISION — abandon du dessin SVG pour `AreneVisuel` : le SVG ne sait produire que des formes
  géométriques ; la pierre texturée, les ombres peintes et les matières de la maquette ne sont
  pas atteignables par le code. Une première tentative de SVG isométrique (plateau, tours,
  bannières dessinés à la main) a été écrite puis REMPLACÉE par les vraies images.
- LE DÉCOUPAGE EST UN SCRIPT : `scripts/decouper_arenes.py` (Pillow + numpy), à relancer depuis
  la racine du projet si la maquette change. Il prend automatiquement la maquette la PLUS
  RÉCENTE de `maquette-arène/` (dossier VERSIONNÉ exprès), retire le fond, isole les 6 arènes et
  écrit les 7 PNG de `assets/arenes/`. Plus rien à refaire à la main.
- L'arène 0 (DÉBUT) n'existe pas dans la maquette : c'est INITIATION désaturée et assombrie.
- LE FOND TRANSPARENT EST ESSENTIEL : la carte pose l'image sur SA propre couleur, donc aucun
  raccord n'est visible.
- CE QUI EST PERDU par rapport au SVG : le décor ne s'enrichit plus PROGRESSIVEMENT par le code
  (l'ancien SVG ajoutait gradins/projecteurs/braseros selon le niveau) — chaque arène est
  maintenant une image figée. En pratique c'est mieux : la maquette fait déjà cette montée en
  décor à la main. Reste une lueur à la couleur de la ligue derrière l'image, pour garder le lien
  avec le code couleur du reste de l'app.
- `react-native-svg` sert à cette lueur (dégradé radial), et à rien d'autre dans ce composant.

#### La 2e maquette (propre) a tout simplifié — 27/08/2026

Retour de Hafiz après avoir testé l'APK : « seule l'arène OLYMPE rend vraiment bien », et
« je remarque comme un cercle au centre de l'image ». Trois causes, trois correctifs.

**1. Le cercle** — la lueur derrière l'image était une `View` ronde à 16 % d'opacité : un APLAT,
donc un contour net, bien visible par-dessus le fond transparent de l'illustration. Remplacée par
un vrai DÉGRADÉ RADIAL (`RadialGradient` de `react-native-svg`) qui s'éteint progressivement.

**2. Les arènes ne s'affichaient pas à la même taille** — leurs rapports largeur/hauteur allaient
de 1,17 (OLYMPE) à 1,40 (INITIATION) alors que le cadre est fixe. Avec `resizeMode="contain"`,
seule celle dont le format collait au cadre le remplissait ; les autres paraissaient rapetissées.
Corrigé en posant toutes les arènes sur une TOILE IDENTIQUE (512 × 470), calées en bas (le socle
est l'ancre visuelle). Le cadre de `AreneVisuel` porte exactement ce format.

**3. La 1re maquette était inexploitable proprement, Hafiz en a régénéré une SANS TEXTE.**
C'était la vraie cause de fond. Sur la maquette du 26/08, un bandeau de titre (« ARÈNE 3 /
COLOSSE »), une ligne de trophées et une devise étaient peints PAR-DESSUS chaque illustration.
Il fallait donc les effacer, et TOUTES les méthodes essayées abîmaient quelque chose :
- effacer un rectangle → arrachait le décor (nuages, cristaux, mur) ;
- reboucher par diffusion → bavures grises ;
- ne garder que le plus gros bloc d'un seul tenant → supprimait drapeaux, arbres, cristaux ;
- reconstruire par symétrie en recopiant le côté droit → drapeaux et statues DUPLIQUÉS, pire que
  tout. **Ne pas réessayer cette piste.**
Seule OLYMPE s'en sortait bien, parce que son bandeau ne couvrait que des nuages — faciles à
reconstituer. D'où le constat de Hafiz.
La maquette du 27/08 (`ChatGPT Image Aug 27, 2026, 06_08_26 AM.png`) n'a AUCUN texte ni cadre :
tout ce travail de retouche a disparu, et avec lui ses dégâts. Les 7 arènes sont désormais
COMPLÈTES et intactes. LEÇON : quand une image source est polluée, il vaut mieux la régénérer
proprement que s'acharner à la réparer par code.

**Ce que fait le script maintenant** (bien plus simple qu'avant) :
- Il ne découpe PLUS en cases de 512×512 : sur cette maquette les arènes débordent de leur case.
  Il enlève le fond sur l'image ENTIÈRE, puis isole les 6 blocs d'un seul tenant — chaque bloc
  EST une arène, quelle que soit sa position. Il vérifie qu'il en trouve exactement 6 et les
  remet dans l'ordre de lecture d'après leur centre.
- Le fond est retiré par propagation depuis les bords, BORNÉE à la famille « bleu sombre » :
  sans ce garde-fou la propagation part dans la pierre des murs, tout aussi sombre, et troue les
  arènes. Ça emporte au passage le halo lumineux autour de chaque arène.
- Palette réduite à 200 couleurs. Poids total : 1,5 Mo pour les 7 images (contre 0,36 Mo avant,
  mais pour une toile plus grande et un décor entièrement conservé).
### Deux corrections d'affichage — faites le 25/08/2026

- `RouteArenes` : le titre porté par l'arène (« Recrue », « Gladiator »…) n'est plus rappelé sur
  chaque étape — il est déjà sur la carte en haut de l'écran et chargeait la route pour rien.
- `ProfilScreen` : le lien « Classements › » devient « Voir tout › » — le mot était répété juste
  à côté du titre du bloc « CLASSEMENT — TOP 3 ».

### Profil : « Mes performances » est repliable — fait le 27/08/2026

Retour de Hafiz : « mes performances prend trop de place ». La liste fait jusqu'à 15 lignes et
repoussait tout le bas du profil (stats de la semaine, bilan compétition, sécurité, mode test)
très loin. Elle est désormais REPLIÉE PAR DÉFAUT derrière un en-tête cliquable (▼/▲), comme
« 🔒 Sécurité du compte » juste en dessous et comme les objectifs de séries de l'onglet
Entraînement. Un RÉSUMÉ CHIFFRÉ reste visible sans rien déplier (« 4 vérifiées sur 11 saisies ») —
même principe que les puces de volume : on doit voir où on en est d'un coup d'œil.
L'état `perfsOuvertes` est local à `ProfilScreen` (il n'a pas à survivre à un changement d'onglet).

## XP : la jauge d'activité (socle de l'Arena Pass) — fait le 12/08/2026

Première brique de la vision « Arena Pass » (voir `docs/VISION_ARENA_PASS.md`, qui contient la
roadmap complète : Pass gratuit/premium, récompenses partenaires, saisons, matchmaking).

- **RÈGLE FONDATRICE tranchée par Hafiz** : « arène et palier/ligue c'est pareil ; l'XP augmente
  juste en fonction des séances que tu fais, de tes compétitions et des défis que tu gagnes ».
  Donc : l'ARÈNE = la LIGUE = les perfs VÉRIFIÉES (inchangé). L'XP est une jauge SÉPARÉE qui ne
  touche NI l'arène, NI la ligue, NI le classement. Le mérite sportif fixe le rang, l'assiduité
  débloquera les récompenses. C'est ce qui protège l'ADN « seul le vérifié compte » tout en
  autorisant une boucle de progression quotidienne.
- Barème (`backend/app/xp.py`) : séance +20, défi du jour +20, défi de la semaine +100, duel
  gagné +50. Les perfs vérifiées ne donnent PAS d'XP — elles font monter d'arène, c'est déjà
  leur récompense.
- DÉCISION D'ARCHITECTURE : l'XP est **recalculée à la volée** depuis les données déjà en base
  (`nb_jours_actifs`, `defis_valides_par_type`, `nb_duels_gagnes`) — PAS de compteur incrémenté,
  PAS de table d'événements. Conséquences : impossible de double-compter, impossible de
  désynchroniser, et changer le barème met tout le monde à jour instantanément. Coût : un petit
  calcul par lecture, négligeable à cette échelle.
- `nb_jours_actifs` compte les DATES DISTINCTES en réunissant `seances` et `entrainements` :
  une même journée tracée deux fois (séance déclarée + séance loggée) ne compte qu'une fois.
  Important pour plus tard, quand les séances du Profil seront enfin envoyées au serveur.
- Endpoints : `GET /joueurs/{id}/xp` (total + détail par source), et `xp` ajouté à `/auth/moi`.
  Affichée discrètement sur la carte d'arène (« ⚡ 80 XP d'activité ») pour que personne ne croie
  qu'elle fait monter d'arène.
- Tests : `backend/tests/test_api_xp.py` — 7 tests, dont
  `test_l_xp_ne_change_ni_la_ligue_ni_le_classement` qui VERROUILLE la règle fondatrice (un
  joueur à 200 XP d'activité reste en ligue « Aucune », un joueur à 0 XP avec des perfs vérifiées
  est en Bronze). Suite complète : 178 tests, tous OK.
- PIÈGE RENCONTRÉ en écrivant ces tests : une seule perf vérifiée ne donne PAS de ligue
  (1 palier / 15 exercices = 0,07 → arrondi à 0) — conséquence normale de « la polyvalence
  récompensée ». Il faut ~8 perfs vérifiées pour sortir de « Aucune ».

## Écran d'accueil : direction artistique du designer — fait le 12/08/2026

Design importé depuis un projet claude.ai/design (`Fitness Royale.dc.html`) via le MCP
`claude_design`. Les deux autres fichiers du projet (`ios-frame.jsx`, `support.js`) sont
l'infrastructure du designer (cadre iPhone de prévisualisation, moteur de rendu) — rien à porter.

- PÉRIMÈTRE : d'abord l'accueil seul, puis **TOUTE L'APP** (« mets la DA partout », 12/08/2026).
- `src/designSystem.js` : la palette de la maquette (fond #0c0b0f, cartes #17161d, or #e8b23a,
  texte #f2f0ea) — la SOURCE UNIQUE de la DA.
- DÉCISION CLÉ pour propager sans tout réécrire : `src/theme.js` ne définit PLUS ses couleurs,
  il RÉEXPORTE celles de `designSystem.js` en gardant EXACTEMENT les mêmes clés (`colors.fond`,
  `colors.or`, `colors.carte`…). Les ~8 écrans qui importent `colors` reçoivent donc la DA sans
  qu'une seule ligne d'écran ne change. Changer la DA reteinte toute l'app depuis un fichier.
- Les COULEURS DE LIGUE (`clubSP.js`) passent aussi à celles de la maquette : Bronze #cd8a4b,
  Silver #c0c4cc, Gold #e8b23a, Legend #b06ef5, Titan #55c8f0, Royal #ff5470 (Legend devient
  violet et Royal rose — inversé par rapport à l'ancienne palette). Elles pilotent l'avatar
  évolutif, les losanges, le décor SVG de l'arène et les lignes de classement d'un seul coup.
- BARRE D'ONGLETS : les emojis ont laissé place à un LOSANGE qui s'allume en or sur l'onglet
  actif, avec des libellés plus petits et plus gras (style de la maquette).
- Vérifié écran par écran dans le navigateur après la bascule (Profil, Perfs, Entraînement,
  Paliers, Compétition, Clan) : fond global bien à #0c0b0f, couleurs de ligue correctes
  (GOLD = rgb(232,178,58)), 6 losanges dans la barre, aucune erreur.
- `src/components/Losange.js` : le carré tourné à 45°, motif de marque de la maquette, décliné
  à toutes les tailles (nom d'arène, lignes de classement…).
- `src/components/CarteArenAccueil.js` : la mise en scène du palier — aura qui PULSE derrière
  l'avatar (`Animated.loop`, `useNativeDriver` pour rester fluide), nom d'arène encadré de deux
  losanges, barre de progression et « Encore N paliers à faire vérifier ».
- Structure de l'accueil : en-tête CLUB SP / FITNESS ROYALE + badge série, carte d'arène,
  3 tuiles (perfs vérifiées / exos suivis / rang global), bouton « ARÈNE — LANCER UN DUEL »
  (→ onglet Compétition via la nouvelle prop `allerA`, passée par App.js), TOP 3 du classement.
  Tout le reste de l'ancien écran est CONSERVÉ dessous (salle, séances, bilan, sécurité,
  déconnexion).
- L'ancienne carte « Progression vers la ligue » a été SUPPRIMÉE : la carte d'arène dit la même
  chose en mieux. Seule l'info de catégorie de poids a été gardée, sous forme de bandeau.
- POLICES : la maquette utilise Archivo + JetBrains Mono. Installation REFUSÉE par Hafiz — on
  approche le rendu avec les poids système (900), un `letterSpacing` serré et une monospace
  système pour les chiffres (`monospace` dans designSystem.js).
- NON REPRIS de la maquette, volontairement : son écran Arène repose sur un bouton
  « +1 RÉPÉTITION » tapé pendant l'effort — mécanisme déjà ÉCARTÉ par Hafiz (« les mains sont
  occupées par la barre », voir « Statut en direct des duels »). Le chrono de série reste la
  solution retenue. Ses onglets de classement (Amis / France / Monde) n'existent pas non plus
  côté serveur (on a global / poids / exercice / salles).

## Icône de l'app — faite le 27/08/2026

Constat de Hafiz en installant l'APK : « l'apk n'a pas d'icône ». Cause : `app.json` ne portait
AUCUN champ `icon` ni `android.adaptiveIcon` — Expo retombait donc sur son image par défaut.
Ça n'avait rien cassé jusque-là parce que rien ne le signale : un build réussit sans icône.

- LE LOGO EST UNE IMAGE FOURNIE PAR HAFIZ (`icones/ChatGPT Image Aug 27, 2026, 06_36_18 PM.png`,
  dossier versionné exprès) : couronne + haltère, « FITNESS » en argent, « ROYALE » en or, buste
  en bas, sur une tuile noire à coins arrondis. HISTORIQUE : un premier jet dessiné au code (le
  losange or de la barre d'onglets avec « FR » évidé) a été fait puis REMPLACÉ le même jour quand
  Hafiz a envoyé ce logo. Avant ça, le badge doré de l'écran Perfs avait aussi été proposé et
  refusé. Le script sait retrouver seul l'image la plus récente du dossier : si le logo change,
  on dépose et on relance.
- `scripts/generer_icone.py` fabrique les TROIS fichiers depuis cette image — recadrage de la
  tuile compris, rien à préparer à la main.
  ⚠️ ILS NE SONT PAS INTERCHANGEABLES, c'est le piège de cette tâche :
  - `assets/icon.png` : l'icône classique, **opaque** (iOS retire la transparence et afficherait
    du noir à la place). C'est la tuile entière ; le système lui arrondit les coins par-dessus,
    invisible puisqu'ils sont déjà noirs.
  - `assets/adaptive-icon.png` : le PREMIER PLAN de l'icône adaptative Android, sur fond
    **transparent** (la couleur de fond est donnée à part dans `app.json`). Android la masque en
    cercle, carré arrondi ou goutte selon le téléphone, et ne garde qu'un cercle central de
    ~66 % — le logo est donc réduit pour tenir dedans. Le calcul mesure le RAYON RÉEL du dessin,
    pas sa boîte : les coins du logo étant vides, se baser sur la boîte l'aurait rapetissé pour
    rien. C'est normal qu'il paraisse petit quand on ouvre le fichier seul.
  - Les bords de la tuile sont ESTOMPÉS et `adaptiveIcon.backgroundColor` vaut exactement la
    couleur de la tuile (**#060708**, mesurée par le script, pas le #0c0b0f de la DA) : sans ça
    on verrait un carré sombre se détacher du fond.
  - `assets/favicon.png` : la pastille d'onglet de la version web.
- Vérifié avec `npx expo config --type public` : les trois chemins sont bien résolus.
- NON FAIT, à voir si le besoin se présente : l'écran de démarrage n'a toujours qu'une couleur
  (`splash.backgroundColor`), pas d'image. À noter aussi que cette couleur (#0F1218) date d'avant
  la DA du designer et ne correspond PAS au fond de l'app (#0c0b0f) — écart visible une fraction
  de seconde au lancement.

## Mode test (compte administrateur) — fait le 20/08/2026

Demande de Hafiz : « un compte spécial où je pourrai pratiquement tout faire pour mieux tester
l'app, notamment le système de ranking ». Tester le classement demande plusieurs joueurs à des
niveaux variés — remplir 15 exercices à la main pour chacun était impraticable.

- COMMENT DEVENIR ADMIN : colonne `admin` sur `joueurs` (migration additive), qui ne s'active
  **QUE À LA MAIN EN BASE** — jamais depuis l'app, jamais à l'inscription (test dédié :
  `test_l_inscription_ne_rend_jamais_admin`). Commande utilisée le 20/08/2026 :
  ```
  python -c "import sqlite3; c=sqlite3.connect('backend/fitness_royale.db'); c.execute(\"UPDATE joueurs SET admin=1 WHERE pseudo IN ('Hafiz','The Jaggerjack')\"); c.commit()"
  ```
  (la colonne n'existe qu'APRÈS un premier `db.initialiser()` — lancer le serveur une fois avant).
  Comptes admin actuels EN LOCAL (SQLite) : **Hafiz** et **The Jaggerjack**.
  ⚠️ SUR LE SERVEUR EN LIGNE (Neon/Postgres depuis le 25/08/2026), la commande ci-dessus ne
  s'applique PAS : la base n'est plus un fichier SQLite, et elle est VIERGE (aucun de ces deux
  comptes n'y existe — voir « L'app parle au serveur en ligne »). Il faut d'abord s'inscrire
  depuis l'app, puis passer le compte en admin côté Postgres, au choix :
  - depuis l'éditeur SQL de la console Neon (le plus simple, rien à installer) :
    `UPDATE joueurs SET admin = 1 WHERE pseudo = 'TonPseudo';`
  - ou en local, avec la même `DATABASE_URL` :
    `python -c "import os,psycopg; c=psycopg.connect(os.environ['DATABASE_URL']); c.execute(\"UPDATE joueurs SET admin=1 WHERE pseudo='TonPseudo'\"); c.commit()"`
- `backend/app/modetest.py` + endpoints `/admin/*`, tous protégés par `auth.utilisateur_admin`
  (403 sinon) :
  - `POST /admin/mes-perfs` {palier 0-6, nb_exercices} — me place à un palier, perfs déjà
    VÉRIFIÉES. **Efface d'abord les perfs existantes** : sinon un ancien exercice à un palier
    plus haut fausserait la moyenne qu'on cherche justement à contrôler. palier 0 = tout effacer.
  - `POST /admin/mes-points` {points} — FIXE les points (≠ `ajouter_points` qui incrémente),
    pour tester le départage à palier moyen égal.
  - `POST /admin/joueurs-test` {nombre, palier_min, palier_max, sexe} — crée des joueurs
    factices préfixés `TEST-`. Ils font varier LE NOMBRE D'EXERCICES vérifiés (60-100 % du
    barème) en plus du palier : sans ça tous les joueurs d'un même palier auraient la même
    moyenne et le classement serait un paquet d'ex æquo, ce qui ne testerait rien.
  - `DELETE /admin/joueurs-test` — supprime tous les joueurs marqués `est_test = 1`, jamais les
    vrais comptes.
- **AUTO-VALIDATION D'UNE PERF (20/08/2026)** : un admin peut valider SA PROPRE perf en
  « communauté ». C'est une EXCEPTION explicite à la règle de fond (« on ne valide pas sa propre
  perf, ça n'a de sens que si quelqu'un d'autre valide ») — sans elle, tester le classement
  obligerait à jongler entre deux comptes pour chaque perf saisie à la main. L'exception vit
  dans `verifier_performance` (`… and not courant.get("admin")`) et NE CHANGE RIEN pour un
  joueur ordinaire, ce que verrouille `test_un_compte_normal_ne_peut_toujours_pas_s_auto_valider`.
  Côté app : bouton « 🛠 Valider (admin) » à BORDURE ROUGE sur chaque perf non vérifiée de
  l'écran Perfs (affiché seulement si `moi.admin`), à côté des chemins normaux « 📹 Vidéo » et
  « 🔑 Code partenaire » — la couleur évite de le confondre avec une vraie validation.
  Vérifié : admin → 200 et la perf passe en « 👥 Vérifié communauté » en un clic ;
  compte normal → 403.
- À noter : le mode test remplit déjà toutes les perfs d'un coup (`/admin/mes-perfs`) ; ce bouton
  sert au cas complémentaire — valider UNE perf précise saisie à la main.
- Les joueurs factices n'ont PAS de mot de passe : impossible de s'y connecter (test dédié).
- ÉCRAN : `src/components/PanneauModeTest.js`, affiché en bas du Profil **uniquement si
  `moi.admin`** (bordure rouge pour qu'on ne le confonde pas avec le reste). `App.js` expose
  `rechargerDepuisServeur()` (extraite du rafraîchissement périodique des 10 s) pour que l'effet
  d'une action soit visible tout de suite au lieu d'attendre le prochain tick.
- Vérifié dans le navigateur : « Titan » → 15 perfs · ligue Titan instantanément ; « Générer »
  → 8 joueurs TEST- répartis (TITAN, LEGEND…) qui apparaissent au classement ; « Tout supprimer »
  → 21 joueurs redescendus à 13, aucun TEST- restant, Hafiz et TestWeb intacts. Et depuis un
  compte NON admin, les 4 endpoints répondent bien 403.
- Tests : `backend/tests/test_api_modetest.py` — 11 tests, dont le refus complet pour un compte
  normal et `test_palier_sur_une_partie_des_exercices_seulement` (5 exercices à Royal sur 15 →
  ligue Silver, pas Royal : verrouille « la polyvalence récompensée »). Suite : 191 tests, OK.

### UN SEUL VOCABULAIRE À L'ÉCRAN : arènes, jamais ligues (20/08/2026)

Bug d'ergonomie signalé par Hafiz en testant : « je me suis mis à Olympe pourtant ça affiche
ligue Titan titre Olympien ». Le calcul était juste (l'arène 💎 OLYMPE **est** la ligue Titan,
les deux échelles sont décalées d'un cran) — le problème est que le mot « Titan » désigne DEUX
choses : l'arène de rang 4 et la ligue de rang 5. Afficher les deux côte à côte ressemblait donc
à une incohérence.

RÈGLE POSÉE : les noms de LIGUES (Bronze, Silver, Gold, Legend, Titan, Royal) sont désormais du
vocabulaire **INTERNE** — ils restent la clé de calcul et de couleur, mais ne s'affichent plus
jamais à l'utilisateur au niveau global. Partout on montre le nom d'ARÈNE, via
`areneDeLaLigue(ligue).nom`. Corrigé à quatre endroits :
- `PanneauModeTest` : les boutons portaient les noms de ligues (cliquer « Titan » envoyait dans
  l'arène OLYMPE) → ils portent maintenant les noms et emblèmes d'arènes ;
- `CarteArene` : « Ligue Titan · titre Olympien » → « Titre « Olympien » » ;
- `CompetitionScreen` : les lignes de classement affichaient `joueur.ligue` ;
- `ProfilScreen` : le TOP 3 de l'accueil aussi.
EXCEPTION ASSUMÉE : le barème PAR EXERCICE (écran Paliers) garde les noms de ligues, car c'est
une autre échelle — le palier d'UN mouvement, pas l'arène globale.
Vérifié : bouton 💎 OLYMPE → accueil « OLYMPE », Paliers « 💎 OLYMPE · Titre Olympien »,
classement « OLYMPE • 88 kg ». Plus aucune mention de « Titan » nulle part.

## Lot du 01/09/2026 : onze demandes de Hafiz en une

Toutes issues d'un même retour après test de l'APK. Regroupées ici parce
qu'elles se répondent : plusieurs déplacent une fonction d'un écran à un autre.

### Le fil conducteur : chaque écran son rôle

- **La salle de gym déménage au Clan.** Le champ vivait au Profil ; la salle EST
  le clan, il est donc dans l'onglet Clan (« ma salle doit être réservé à la
  partie clan »). ⚠️ CONSÉQUENCE QU'IL A FALLU TRAITER : la salle n'existait
  que CÔTÉ APP (limite connue, notée de longue date dans « À faire »). Tant
  qu'elle était au Profil ça ne se voyait pas ; posée à côté du chat — qui,
  lui, vérifie l'appartenance CÔTÉ SERVEUR — la changer aurait fait répondre
  403 au chat. D'où le nouvel endpoint `PUT /joueurs/{id}/salle`
  (+ `db.changer_salle`, `api.changerSalle`). La ligne correspondante de
  « À faire » est donc levée.
- **Le Clan devient un vrai écran de clan** : la carte « ma salle », un
  classement des MEMBRES de la salle (`classer` filtré sur la salle — mêmes
  règles que le classement global, aucun calcul nouveau), et le chat, sous un
  sélecteur Membres / Chat.
- **La touche VS du Profil ouvre directement les duels.** Elle amenait sur
  l'onglet Compétition, donc sur le CLASSEMENT. `allerA(cle, { duel: true })`
  incrémente un compteur `demandeDuel` que `CompetitionScreen` surveille pour
  basculer sur l'onglet Défis. DÉCISION : un compteur plutôt qu'un booléen —
  un booléen resterait vrai et rouvrirait les duels à chaque rendu.

### Deux écrans allégés

- **Profil → « 🏅 Mes titres »** (repliable) : voir la section dédiée plus bas.
- **Perfs → « Enregistrées » est repliable**, avec le résumé « 4 vérifiées sur
  11 saisies » visible sans déplier — même motif qu'au Profil.
- **Perfs → la validation SANS PREUVE est supprimée.** C'était le chemin le
  plus facile à abuser des trois (un vote de confiance sans aucune preuve,
  compromis assumé à l'époque). Restent la VIDÉO et le CODE PARTENAIRE, qui
  demandent tous deux une preuve. ⚠️ Les endpoints backend
  (`/performances/a-valider-sans-video`, `/voter-sans-video`) SONT GARDÉS :
  plus rien ne les appelle, mais les retirer casserait
  `test_api_validation.py` sans rien gagner.

### Trois corrections dans Compétition

- **Classement par poids : du plus lourd au plus léger.** Une seule ligne,
  `ordreCategories` dans `classement.js` — `classerParCategories` en découle.
- **« Semaine 29 »**, figée en dur dans le sous-titre depuis les tout débuts,
  est retirée.
- **« Développé couché affiché deux fois ».** Il n'y a PAS de doublon dans le
  barème (vérifié : 15 clés distinctes). Le sélecteur d'exercice affichait le
  choix courant dans son en-tête ET dans la liste ouverte juste en dessous.
  Corrigé : l'en-tête dit « Choisis un exercice… » quand la liste est ouverte,
  et le choix courant est marqué d'un point plein. (À savoir si le retour
  revient : deux exercices commencent par les mêmes mots — « Développé couché »
  et « Développé couché prise serrée » — ce sont bien deux exercices
  différents du barème, pas un bug.)

### Performances attendues pour la prochaine séance

`LigneExercicePrevu` (EntrainementScreen) affiche sous chaque exercice prévu la
charge à viser — la MÊME `suggererProchaineSerie` qu'on voyait déjà pendant la
séance, mais montrée AVANT d'y aller : on sait quoi charger en arrivant à la
salle. Aucun calcul ni endpoint nouveau, tout se déduit de l'historique déjà
chargé (marche hors-ligne). Utilisée aux TROIS endroits qui listent des
exercices (détail du calendrier, séance déroulée, cycle déroulé) — un seul
composant, pas trois copies. Rien ne s'affiche pour un exercice jamais loggé :
mieux vaut rien qu'un chiffre inventé.

### Les titres (`src/logic/titres.js`, section repliable au Profil)

- DÉCISION FONDATRICE, la même que pour l'XP : **aucun nouveau score, aucune
  table.** Un titre n'est que la LECTURE du classement par exercice
  (`classerParExercice`, déjà utilisé par Compétition). Il se recalcule donc
  tout seul dès qu'une perf est vérifiée, et il ne PEUT PAS se désynchroniser
  du classement affiché ailleurs.
- Trois marches par exercice (🥇🥈🥉) → jusqu'à 45 titres possibles. Un
  exercice sur lequel personne n'a de perf vérifiée n'en décerne aucun : pas
  de « N°1 » d'un classement vide.
- **Libellés SANS GENRE** (« N°1 · Développé couché », pas Roi/Reine) : le
  titre décrit un rang, pas la personne qui le porte.
- `titresAPortee()` liste en plus les exercices où le podium est le plus
  proche, avec le palier à viser — actionnable, contrairement à un « pas
  encore obtenu ».

### Programmes partagés : l'admin partage, on récupère AVEC UN CODE

Demande : « je pourrai créer des programmes et les autres utilisateurs pourront
juste les coller ».

⚠️ CORRIGÉ DÈS LE LENDEMAIN (02/09/2026) : la première version en faisait un
CATALOGUE PUBLIC, visible de tous dans « Programmes standards ». Hafiz : « je
ne veux pas que tout le monde voie le programme. Il faut une option, un code
par exemple ». Le partage passe donc par un CODE, comme les duels en ligne et
la validation d'une perf par un partenaire — même générateur
(`regles_duels.generer_code`), déjà éprouvé deux fois dans l'app.
- **Il n'existe AUCUN endpoint qui liste les programmes partagés.** Sans le
  code, un joueur ne peut même pas savoir qu'un programme existe. C'est une
  NON-fonctionnalité, donc facile à réintroduire par accident : un test dédié
  (`test_aucun_moyen_de_lister_les_programmes_des_autres`) la verrouille.
  Seul l'admin peut lister — et uniquement SES propres partages, avec leurs
  codes, pour pouvoir les redonner.
- **DIFFÉRENCE avec les deux autres codes de l'app : celui-ci n'est PAS à usage
  unique.** Il est fait pour être donné à plusieurs personnes et sert tant que
  l'admin ne le retire pas. Retirer le partage invalide le code, mais ne touche
  pas aux copies déjà faites.
- Côté app : une carte « 🔑 Programme partagé » (pour tout le monde) où l'on
  entre le code ; le programme s'affiche AVANT d'être copié — on ne récupère
  pas un programme sans savoir ce qu'il contient. Côté admin, le bouton devient
  « 🔑 Partager par code » et une section « 🛠 Mes programmes partagés » affiche
  les codes en grand.
- Migration : la colonne `code` est ajoutée à `programmes_officiels` (table née
  la veille). Elle doit être placée APRÈS la création de la table dans
  `initialiser()`, sinon on tenterait d'ALTER une table inexistante sur une
  base neuve. Un programme publié avant cette migration n'a pas de code et
  n'est donc plus accessible à personne — comportement voulu.

- Table `programmes_officiels`. **DÉCISION : le contenu est stocké en JSON dans
  UNE colonne**, au lieu de deux tables liées comme les cycles d'un joueur. Un
  programme officiel n'est pas un objet vivant — personne ne le modifie séance
  par séance, on le publie et on le copie. Et c'est exactement la forme des
  modèles standards côté app (`src/data/programmesStandards.js`), donc l'app
  les affiche et les copie AVEC LE MÊME CODE, sans conversion : « copier » est
  simplement `appliquerModele`, qui existait déjà.
- Endpoints : `GET /programmes-officiels` (ouvert à tous — c'est du catalogue,
  rien de personnel), `POST` et `DELETE /admin/programmes-officiels`
  (`auth.utilisateur_admin`, 403 sinon).
- **PAS DE FORMULAIRE SÉPARÉ pour l'admin** : il construit un programme
  normalement, puis le publie d'un bouton « 🛠 Publier pour tous » (bordure
  rouge, comme le reste du mode test) sur la carte du cycle. Un programme est
  ordinaire jusqu'à ce qu'il soit publié.
- Retirer un programme du catalogue **ne touche pas aux copies déjà faites** :
  ce sont les programmes des joueurs depuis le jour où ils les ont copiés.
  Verrouillé par un test dédié.
- Tests : `backend/tests/test_api_programmes_officiels.py` — 15 tests.
  Suite complète : **209 tests, tous OK.**

## Trois retours d'APK — faits le 02/09/2026

Captures à l'appui (`docs/Screenshot_2026-09-01-*.jpg`), donc trois constats
nets plutôt que des impressions.

**1. « On voit toujours le détail du programme ».** L'interrupteur « ▼ Voir le
détail » de la v4 ne repliait que les EXERCICES : la carte d'un cycle listait
quand même ses cinq séances, avec leurs boutons « ✏️ Modifier ». Replié veut
maintenant dire replié : le nom du programme et un résumé (« 5 séances ·
Lun Mar Mer »), rien d'autre. LEÇON : « voir le détail » avait été compris
comme « voir les exercices » alors que pour Hafiz le détail commençait à la
liste des séances.

**2. Le clavier cachait les champs de saisie pendant la séance.** On tapait ses
reps sans voir ce qu'on écrivait. La vue de séance est désormais enveloppée
dans un `KeyboardAvoidingView` ET porte une grande marge basse
(`paddingBottom: 340`) : sur iOS le contenu remonte, sur Android — où la
fenêtre est simplement redimensionnée — la marge donne de quoi FAIRE DÉFILER
le champ au-dessus du clavier. `keyboardShouldPersistTaps="handled"` en plus,
pour que « + Série » réponde du premier coup au lieu de servir à fermer le
clavier.

**3. La saisie d'une série est conservée pour la suivante.** `ajouterSerie`
vidait les champs après chaque série. Or les séries d'un même exercice se font
presque toujours à la même charge et au même nombre de reps (la capture montre
quatre fois « 15 kg × 16 reps » d'affilée) : il fallait tout retaper à chaque
fois. Les valeurs restent, on ne corrige un champ que quand ça change vraiment.

## Backend (backend/) — Python + FastAPI + SQLite

- `logique.py` = portage exact de classement.js (tests dans test_logique.py). `duels.py` et
  `defis.py` = portages de la logique équivalente côté front (voir sections ci-dessus).
- Au démarrage (`@app.on_event("startup")`), si la table `joueurs` est VIDE, `main.py` insère
  automatiquement les 5 joueurs de démo de mockData.js (IronMax, SarahFit, KenzoLift, NoraRun,
  Djibril93) avec leurs perfs et points, pour que les classements ne soient jamais vides.
- Lancer : `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --host 0.0.0.0`
  (`--host 0.0.0.0` nécessaire pour que le téléphone puisse joindre le serveur en mode LAN).
  Note : en dev, `--reload` a semblé se bloquer après plusieurs modifications de fichiers d'affilée
  (le process ne redémarrait plus) — si `/docs` ne reflète pas tes derniers changements, redémarre
  le serveur manuellement (Ctrl+C puis relance) plutôt que de compter sur le rechargement auto.
- Tests : `cd backend && python -m unittest discover tests` (194 tests, tous OK).
- À FAIRE : brancher défis/séances au front (voir "À faire" plus bas).

## À faire (voir roadmap dans docs/CONTEXTE.md)

- Variantes « reps avec lest » des tractions/dips
- Vrai quorum de votes pour les vidéos (actuellement : le premier vote décide, pas de quorum —
  voir "Upload vidéo + validation communauté")
- Historique des DÉCISIONS de vote (qui a validé/refusé, quand) affiché quelque part dans
  l'app — la trace existe déjà en base (`preuves_video`), juste pas montrée. ATTENTION : ceci
  ne pourra JAMAIS inclure le contenu vidéo lui-même, qui est supprimé du disque dès la
  résolution du vote (voir "Aucun stockage permanent des vidéos", 20/08/2026) — seul un
  historique de STATUTS est possible, pas un historique de VIDÉOS.
- Mode Royale (multijoueur, un seul en tête)
- Vrai temps réel pour les duels ET le chat de clan (push serveur / WebSocket) — actuellement polling
  toutes les 3 secondes, ça marche mais c'est moins réactif qu'un vrai push
- Brancher les SÉANCES au serveur (`POST /joueurs/{id}/seances`) quand on en ajoute une dans Profil,
  puis brancher les DÉFIS (`GET/POST /joueurs/{id}/defis`) pour remplacer la simulation locale
- Suivre `serieJours` et `stats` (victoires/défaites) pour de vrais comptes côté serveur
  (actuellement seulement dans mockData.js, valeurs par défaut à 0 pour un vrai compte — noter
  que les VRAIES victoires/défaites de duels en ligne ne sont pas encore comptées dans ces stats)
- Vrai système de "salle partenaire" CERTIFIÉE pour la vérification "salle" — depuis le
  09/08/2026, n'IMPORTE QUEL autre joueur peut valider via le code partenaire (voir "Validation
  sans vidéo"), ce n'est pas encore un vrai compte "salle" affilié/vérifié par le Club SP. Reste
  aussi l'auto-application pour le joueur `affilieSalle` lui-même (voir "Comptes sécurisés")
- Historique des duels en ligne dans l'app (actuellement, `DuelEnLigne` ne montre que le duel
  en cours — le serveur garde tout via `GET /joueurs/{id}/duels`, non affiché pour l'instant)
- Vraies illustrations d'avatar (physique/équipement qui évolue) — actuellement juste
  couleur/anneau/emblème, voir "Avatar évolutif"
- Persistance hors-ligne de l'Entraînement (AsyncStorage) — actuellement, programmes/séances loggés
  hors-ligne sont perdus si l'app redémarre avant reconnexion (voir "Entraînement")
- Champ durée explicite pour une séance loggée (Entraînement) — actuellement estimée automatiquement
  (~3 min/série) pour alimenter le compteur hebdo du Profil, voir "Entraînement"
- Éditer/supprimer une série déjà loggée dans le journal de séance (actuellement : ajout seulement)
- Un programme « vidé » d'un jour (🗑 dans la semaine type) reste dans « Mes programmes » sans
  aucun jour — à supprimer à la main avec ✕ s'il n'est plus voulu (pas de ménage automatique)
- Volume par groupe musculaire : seule la SEMAINE EN COURS est affichée (pas d'historique des
  semaines passées, pas de graphique d'évolution) — voir "Entraînement v2"
- Écran de progression PAR EXERCICE (toutes les séances d'un mouvement + courbe) — proposé à
  Hafiz le 12/08/2026, non retenu pour l'instant (il a choisi suggestion + records + stagnation)
- Modifier un CYCLE existant (ajouter/retirer un jour, renommer le cycle) — actuellement il faut
  le supprimer et le recréer ; ses séances restent éditables une par une dans la semaine type
- IDÉE DE HAFIZ (12/08/2026) : transformer la SEMAINE TYPE en un programme à part entière
  (un objet « ma semaine » sauvegardable/partageable, plutôt qu'un simple assemblage de
  programmes par jour) — à creuser quand le reste sera stabilisé
- Vérifier le rappel d'entraînement (notifications locales) sur un vrai téléphone via l'APK —
  voir "Entraînement v2" (non testé en réel, caché sur web)
- Générer un code de secours pour les comptes créés avant le 12/08/2026 (aucun code tant que le
  joueur n'en génère pas un dans « Sécurité du compte »)

## Conventions

- Code et commentaires en français ; peu de dépendances
