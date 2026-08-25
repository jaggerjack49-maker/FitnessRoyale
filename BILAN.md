# Bilan — Fitness Royale

Les détails techniques et les décisions prises sont dans `CLAUDE.md` (section
par section) — ce fichier est un résumé simple, à lire en quelques minutes.

Dernière mise à jour : 09/08/2026.

---

## Validation sans vidéo — 09/08/2026 — ✅ Terminée

Deux nouvelles façons de faire vérifier une perf, sans avoir besoin de filmer
et d'envoyer une vidéo :

- **🔑 Code partenaire** : après ta perf, génère un code (comme pour un duel
  en ligne) et donne-le à un pote de salle présent avec toi. Il le saisit
  sur SON téléphone → ta perf passe directement en "Vérifié salle".
- **🤝 Vote de confiance** : ta perf déclarée apparaît automatiquement dans
  la liste des autres joueurs, qui peuvent la valider sans avoir besoin
  d'une preuve — comme le vote vidéo, mais sur simple confiance. Si une
  vidéo est déjà en attente sur cette perf, elle n'apparaît pas ici (pour
  privilégier la preuve vidéo quand elle existe).
- La vidéo reste disponible comme avant — ce sont juste deux options en
  plus, plus rapides si tu ne veux pas filmer.
- **13 nouveaux tests, 136 au total, tous passent.**

### Fichiers modifiés

- `backend/app/basededonnees.py` — 2 nouvelles tables (codes de validation, votes sans vidéo)
- `backend/app/main.py` — 4 nouveaux endpoints
- `backend/tests/test_api_validation.py` — 13 tests d'intégration HTTP
- `src/api.js` — fonctions correspondantes côté app
- `src/screens/PerformancesScreen.js` — boutons "Code partenaire", carte
  pour saisir un code reçu, section "Perfs à valider (sans preuve)"

---

## Classement par exercice — 09/08/2026 — ✅ Terminée

Comme demandé : un nouveau mode **"🏋️ Par exercice"** dans l'onglet
Compétition, à côté de Global / Par poids / Salles.

- Choisis un exercice dans la liste déroulante (ex. "Squat", "Développé
  couché"…) et vois qui est le plus fort SUR CET exercice précis, parmi
  ceux qui ont une perf vérifiée dessus.
- Chaque ligne affiche directement la valeur (kg ou reps) et le niveau
  atteint sur cet exercice — contrairement au classement global qui ne
  montre jamais de chiffre, ici c'est utile de le voir.
- En cas d'égalité de niveau sur l'exercice, le départage se fait aux
  points de compétition — jamais en comparant les kg entre un homme et
  une femme directement, ce qui serait injuste (les barèmes n'ont pas la
  même échelle).
- **123 tests au total, tous passent** (3 nouveaux dédiés à ce classement).

### Fichiers modifiés

- `src/logic/classement.js` — nouvelle fonction `classerParExercice`
- `backend/app/logique.py` — même fonction côté serveur (portage identique)
- `backend/tests/test_logique.py` — 3 nouveaux tests
- `src/screens/CompetitionScreen.js` — nouveau mode + sélecteur d'exercice

---

## Critère de classement : la polyvalence récompensée — 09/08/2026 — ✅ Terminée

Tu as demandé à revoir les critères de classement : ceux qui ont des perfs
vérifiées dans le PLUS D'EXERCICES possibles doivent être devant, et la
ligue finale doit représenter ta moyenne sur TOUS les exercices — pas
seulement ceux que tu as faits.

- **Avant** : ta moyenne (donc ton rang et ta ligue) ne comptait que tes
  exercices vérifiés. Un joueur ultra spécialisé sur UN SEUL exercice au
  max pouvait avoir la même moyenne qu'un joueur complet sur tous les
  exercices — rien ne récompensait la polyvalence.
- **Maintenant** : ta moyenne se calcule sur les **15 exercices du
  barème**, pas seulement ceux que tu as vérifiés — un exercice sans perf
  vérifiée compte pour 0. Résultat : plus tu as de perfs vérifiées, plus
  ta moyenne (et ton rang) grimpe, même à niveau égal par exercice.
- **Attention** : les ligues sont donc mécaniquement plus dures à
  atteindre qu'avant (il faut des perfs sur beaucoup d'exercices, pas
  juste 1 ou 2) — c'est voulu, pas un bug si un compte de test semble
  "redescendre" de ligue après ce changement.
- Un nouveau test vérifie noir sur blanc qu'un joueur avec 4 exercices à
  Gold passe DEVANT un joueur avec 1 seul exercice au niveau max Royal.
  **120 tests au total, tous passent.**

### Fichiers modifiés

- `src/logic/classement.js` — nouvelle formule de moyenne
- `backend/app/logique.py` — même formule côté serveur (portage identique)
- `backend/tests/test_logique.py` — tests mis à jour + nouveau test dédié

---

## Chrono en direct pour les duels — 06/08/2026 — ✅ Terminée

Après avoir testé les duels en ligne, tu as remarqué qu'il n'y avait aucun
moyen de "voir" que l'adversaire jouait vraiment sa série en direct. On a
écarté l'idée d'un compteur "+1 rep" tapé à la main (impossible en plein
développé couché, mains occupées par la barre) pour partir sur un statut
en direct plus simple :

- Avant de commencer ta série, tu appuies sur **"🔴 Je commence ma
  série"** puis tu poses le téléphone.
- Ton adversaire voit alors, sur SON téléphone, un **chrono qui tourne**
  ("🏋️ est en train de faire sa série… 12s") — mis à jour automatiquement
  toutes les 3 secondes comme le reste du duel en ligne.
- Une fois ta série finie, tu appuies sur **"⏹ Terminé"** puis tu rentres
  ton nombre de reps, comme avant.
- Ce chrono est purement informatif : ça ne change RIEN au résultat du
  round (toujours le plus de reps qui gagne) — c'est juste un vrai
  "présent en direct" plutôt qu'un round joué dans le vide sans savoir si
  l'autre a déjà fini ou n'a même pas commencé.
- **5 nouveaux tests automatiques** — 119 tests au total, tous passent.

### Fichiers modifiés

- `backend/app/basededonnees.py` — 2 colonnes ajoutées (horodatage de
  début pour chaque joueur, par round)
- `backend/app/main.py` — nouvel endpoint "commencer un round"
- `backend/tests/test_api_duels.py` — 5 nouveaux tests
- `src/api.js` — fonction correspondante côté app
- `src/components/DuelEnLigne.js` — bouton "Je commence ma série", chrono
  en direct (le mien + celui de l'adversaire), écran "Terminé" avant de
  rentrer les reps

---

## Mission « Entraînement » (programmes + journal de séance) — 26/07/2026 — ✅ Terminée

Nouvel onglet **"💪 Entraînement"** dans l'app, complètement séparé des paliers
Club SP — un vrai outil de suivi de musculation perso :

- **Programmes** : tu crées tes propres programmes de zéro (ex. "Push /
  Pull / Legs"), avec la liste des exercices et un objectif séries × reps
  pour chacun. Pas de modèles imposés, pas besoin de coller au barème
  officiel — les noms d'exercices sont libres.
- **Journal de séance** : pendant que tu t'entraînes, tu enregistres chaque
  série réellement faite (reps + poids), soit en suivant un programme, soit
  en "séance libre". Chaque séance est datée et gardée dans l'historique.
- **Surcharge progressive** : à côté de chaque exercice, l'app affiche
  automatiquement "Dernière fois : Xkg × Y reps" (ta séance précédente sur
  cet exercice), avec un petit **↑ / = / ↓** qui te dit d'un coup d'œil si tu
  progresses.
- **Important** : cette section ne touche JAMAIS tes performances
  officielles (celles du barème Club SP, dans l'onglet Perfs) — c'est un
  outil de suivi perso séparé. Tu continues à mettre à jour tes perfs
  officielles toi-même, à la main.
- **Lien avec ton profil** : logger une séance compte aussi dans "Cette
  semaine" sur ton Profil (nombre de séances, calories estimées) — la durée
  est estimée automatiquement (~3 minutes par série) puisque le journal ne
  demande pas explicitement une durée.
- **14 nouveaux tests automatiques** — 114 tests au total, tous passent. Un
  test vérifie spécifiquement que logger une séance ne modifie jamais tes
  perfs officielles.
- Fonctionne aussi **hors-ligne** (programmes et séances restent sur le
  téléphone tant que tu n'es pas connecté), mais attention : sans connexion,
  rien n'est encore sauvegardé si tu fermes complètement l'app avant de te
  reconnecter — c'est noté comme amélioration future dans CLAUDE.md.

### Fichiers créés ou modifiés

**Nouveaux :**
- `src/screens/EntrainementScreen.js` — l'écran complet (programmes, log de séance, historique)
- `backend/tests/test_api_entrainement.py` — 14 tests d'intégration HTTP

**Modifiés :**
- `backend/app/basededonnees.py` — 4 nouvelles tables (programmes, programme_exercices, entrainements, series_journal)
- `backend/app/main.py` — endpoints programmes/entraînements/surcharge progressive
- `src/api.js` — fonctions correspondantes côté app
- `App.js` — nouvel onglet "💪 Entraînement", lien avec le compteur hebdo du Profil

---

## Mission « Comptes, duels en ligne, vidéo, chat, avatar » — 20/07/2026 — ✅ Terminée

Les 5 tâches de cette mission sont terminées, traitées dans l'ordre, chacune
avec ses tests avant de passer à la suivante.

## ✅ Fait

### 1. Comptes sécurisés

Avant, l'app se connectait toute seule à un profil "Hafiz" sans mot de
passe. Maintenant, il faut un vrai compte :

- **Inscription** : pseudo + mot de passe. Le mot de passe est transformé en
  une empreinte illisible avant d'être stocké (jamais en clair) — même moi,
  en regardant la base de données, je ne peux pas voir ton mot de passe.
- **Connexion** : le serveur vérifie le mot de passe et te donne un "jeton"
  (token) à présenter pour prouver que c'est bien toi sur les prochaines
  actions. Ce jeton est gardé sur ton téléphone pour ne pas avoir à se
  reconnecter à chaque fois.
- **Chacun protège ses propres données** : impossible de modifier les
  performances, séances ou défis de quelqu'un d'autre — le serveur vérifie
  systématiquement que c'est bien TOI qui agis sur TON profil.
- **Nouvel écran** dans l'app : bascule "Se connecter" / "Créer un compte",
  avec un bouton "Se déconnecter" dans l'onglet Profil.
- **54 tests automatiques** passent (dont 33 nouveaux pour les comptes) —
  hachage de mot de passe, sessions, et de vraies requêtes HTTP simulées
  (inscription, connexion, tentative de modifier les données d'un autre
  joueur → bien refusée, etc.)

**Point important à savoir** : comme les comptes n'existaient pas avant,
l'ancien "Hafiz" de test (créé sans mot de passe) a dû être supprimé — il
ne pouvait plus jamais se connecter. Si tu relances l'app, il faudra créer
un nouveau compte avec un mot de passe. Tes anciennes perfs de test ne sont
plus là, c'est normal (voir CLAUDE.md pour le détail).

**Un effet de bord utile** : en testant les comptes, j'ai trouvé un vrai
bug dans le code existant — les connexions à la base de données n'étaient
jamais fermées, ce qui bloquait certaines opérations sous Windows. Corrigé
au passage (voir CLAUDE.md, section "Comptes sécurisés").

### 2. Duels en ligne à deux téléphones

Avant, les duels de l'app étaient soit entièrement fictifs (données figées),
soit joués à deux sur UN SEUL téléphone qui arbitre (le "duel en direct").
Maintenant, deux joueurs peuvent s'affronter chacun depuis SON téléphone :

- **Créer un duel** : tu appuies sur "Créer", le serveur te donne un CODE à
  6 caractères (ex. "K7XPQR") à partager à ton adversaire (par SMS, à
  l'oral…).
- **Rejoindre** : ton adversaire tape ce code dans son app, et vous voilà
  connectés au même duel.
- **Jouer** : mêmes règles qu'avant — charge fixe, le plus de reps gagne,
  premier à 2 victoires sur 3 rounds (round 1 : exercice choisi par celui
  qui a créé le duel ; round 2 : par celui qui a rejoint ; round 3, en cas
  d'égalité 1-1 : l'IA choisit). Chacun entre SES PROPRES répétitions
  depuis son téléphone — le serveur attend que les DEUX aient joué avant de
  décider qui gagne le round.
- **Comment ça se synchronise sans "vrai" temps réel** : l'app revérifie
  automatiquement l'état du duel toutes les 3 secondes (comme rafraîchir une
  page web). Ce n'est pas instantané à la milliseconde près, mais largement
  suffisant pour un duel où chacun tape ses reps après sa série.
- Le vainqueur touche automatiquement les points de récompense, visibles
  dans l'app juste après la victoire.
- **21 nouveaux tests automatiques** (dont 18 tests d'intégration qui
  simulent le VRAI flux HTTP : créer, rejoindre, jouer chaque round,
  gagner directement ou après départage, et tous les refus attendus —
  rejoindre son propre duel, jouer hors tour, spectateur qui essaie de
  jouer, etc.) — 75 tests au total, tous passent.

**Un deuxième bug trouvé en testant** : mes tests utilisaient chacun leur
propre "fausse base de données" pour ne pas polluer tes vraies données,
mais la façon dont je redirigeais cette fausse base avait un défaut — le
dernier fichier de test lancé écrasait le réglage des autres, et leurs
comptes de test se mélangeaient. Corrigé (voir CLAUDE.md pour le détail
technique) : c'est un bug de mes tests, pas de l'app elle-même, mais je
préfère te le signaler par transparence.

### 3. Upload vidéo + validation communauté

Avant, "faire vérifier sa perf par la communauté" était un simple bouton
qui changeait le statut sans preuve. Maintenant, il faut une vraie vidéo :

- **Joindre une vidéo** : dans l'onglet Perfs, à côté d'une perf non
  vérifiée, un bouton "📹 Joindre une vidéo" ouvre la pellicule de ton
  téléphone. La vidéo choisie est vraiment envoyée et stockée sur le
  serveur (pas juste un lien ou une simulation).
- **Vote de la communauté** : les AUTRES joueurs voient une section "🎥
  Vidéos à valider" avec un lecteur vidéo intégré et deux boutons — Valider
  ou Refuser. Le premier avis compte : si quelqu'un valide, ta perf passe
  vraiment en "vérifié communauté" (elle compte au classement) ; si
  quelqu'un refuse, tu peux réessayer avec une nouvelle vidéo.
- Impossible de voter sur sa propre vidéo, impossible de revoter une fois
  la décision prise (le serveur vérifie ces deux règles).
- **17 nouveaux tests automatiques** (dont un test qui fait un VRAI envoi
  de fichier, comme le ferait l'app) — 92 tests au total, tous passent.

**Point important à savoir** : la règle de vote est volontairement simple
(un seul avis suffit, pas de "3 votes sur 5"). C'est un choix pour rester
simple à ce stade — si tu veux un système plus strict plus tard (par
exemple 3 votes concordants), c'est noté dans CLAUDE.md comme amélioration
possible.

### 4. Chat de clan (salle)

Chaque salle de gym a maintenant son propre chat, réservé à ses membres :

- **Nouvel onglet "💬 Clan"** dans l'app (5e onglet, après Compétition).
- Tu ne peux discuter que dans le clan de TA salle (celle renseignée à
  l'inscription) — impossible de lire ou d'écrire dans le clan d'une autre
  salle, ou si tu n'as pas de salle renseignée.
- Les messages s'affichent façon messagerie (bulles), avec rafraîchissement
  automatique toutes les 4 secondes.
- **8 nouveaux tests automatiques** (dont : un membre peut lire/écrire, un
  non-membre est bien refusé en lecture ET en écriture, un joueur sans
  salle n'a accès à aucun clan) — 100 tests au total, tous passent.

### 5. Avatar évolutif

L'apparence de ton avatar (le rond avec ton initiale) change maintenant
selon ta ligue :

- Un anneau coloré autour de l'avatar, de plus en plus épais à mesure que
  tu progresses (gris terne sans ligue → violet éclatant pour Royal).
- Une petite lueur autour de l'avatar à partir de la ligue Gold.
- Un petit emblème incrusté (🥉🥈🥇⭐⚡👑) qui indique ta ligue d'un coup d'œil.
- Visible en grand sur ton Profil, et en petit à côté de CHAQUE joueur dans
  les classements — tout le monde voit l'avatar de tout le monde évoluer.

**Point important à savoir** : je n'ai pas pu dessiner de vraies
illustrations (un personnage qui change d'équipement, par exemple) — ça
demanderait de vrais visuels créés sur mesure, ce que je ne peux pas
produire ici. L'évolution se joue donc sur la couleur, l'anneau et
l'emblème plutôt que sur un vrai dessin qui change. C'est noté dans
CLAUDE.md comme amélioration possible si tu veux aller plus loin un jour
(par exemple avec un illustrateur, ou des images générées séparément).

---

## Ce qui reste pour plus tard

Rien de bloquant, mais quelques pistes notées dans `CLAUDE.md` (section
"À faire") pour la suite, si tu veux continuer à améliorer l'app :

- Un vrai temps réel (au lieu de revérifier toutes les quelques secondes)
  pour les duels en ligne et le chat de clan
- Un vote à plusieurs personnes pour les vidéos (au lieu du premier avis)
- Brancher les séances et les défis de l'app directement au serveur
  (aujourd'hui, seuls les perfs, les duels en ligne et les vidéos le sont)
- De vraies illustrations pour l'avatar évolutif
- Mode Royale (plusieurs joueurs, un seul en tête)

---

## Fichiers créés ou modifiés

### Tâche 1 — Comptes sécurisés

**Nouveaux :**
- `backend/app/auth.py` — hachage de mot de passe, tokens, vérification de propriété
- `backend/tests/test_auth.py` — tests du hachage et des sessions
- `backend/tests/test_api_auth.py` — tests d'intégration HTTP complets
- `src/screens/ConnexionScreen.js` — écran connexion/inscription

**Modifiés :**
- `backend/app/basededonnees.py` — table `sessions`, colonne mot de passe, correction de la fuite de connexions
- `backend/app/main.py` — endpoints `/auth/*`, protection des endpoints existants
- `backend/requirements.txt` — ajout de `httpx` (pour les tests)
- `src/api.js` — gestion du token, fonctions inscription/connexion/déconnexion, distinction erreur réseau vs erreur métier
- `App.js` — flux de connexion complet, persistance du token (AsyncStorage)
- `src/screens/PerformancesScreen.js` — bouton d'auto-validation masqué pour un compte connecté
- `src/screens/ProfilScreen.js` — bouton de déconnexion, correction d'un bug d'affichage (NaN%)
- `package.json` — ajout de `@react-native-async-storage/async-storage`

### Tâche 2 — Duels en ligne

**Nouveaux :**
- `src/components/DuelEnLigne.js` — écran créer/rejoindre/jouer un duel en ligne
- `backend/tests/test_api_duels.py` — tests d'intégration HTTP complets des duels en ligne

**Modifiés :**
- `backend/app/duels.py` — génération de code, détection de round verrouillé (remplace la simulation de départage)
- `backend/app/basededonnees.py` — nouveau schéma des duels (code, adversaire optionnel), soumission indépendante des reps
- `backend/app/main.py` — nouveaux endpoints `/duels/creer`, `/duels/rejoindre`, `choisir-exercice`, `tirer-ia`, `mes-reps`
- `backend/tests/test_duels.py` — tests mis à jour pour la nouvelle logique (code, verrouillage)
- `backend/tests/test_api_auth.py` — correction de l'isolation des bases de test
- `src/api.js` — nouvelles fonctions pour les duels en ligne
- `src/screens/CompetitionScreen.js` — bouton "Duel en ligne" (visible si connecté)
- `App.js` — fonction `rafraichirMonProfil` pour resynchroniser les points après un duel

### Tâche 3 — Upload vidéo + validation communauté

**Nouveaux :**
- `backend/app/videos.py` — validation d'extension, génération de nom de fichier, dossier de stockage
- `backend/tests/test_videos.py` — tests de la logique de validation
- `backend/tests/test_api_videos.py` — tests d'intégration HTTP avec upload multipart réel

**Modifiés :**
- `backend/app/basededonnees.py` — tables `preuves_video` et `votes_video`
- `backend/app/main.py` — endpoints upload/liste/fichier/vote, dossier vidéo créé au démarrage
- `backend/requirements.txt` — ajout de `python-multipart`
- `src/api.js` — fonctions upload (multipart), liste des vidéos en attente, vote
- `src/screens/PerformancesScreen.js` — bouton d'upload réel + section de vote avec lecteur vidéo
- `app.json` — permission d'accès à la pellicule (plugin expo-image-picker)
- `package.json` — ajout de `expo-image-picker` et `expo-av`

### Tâche 4 — Chat de clan

**Nouveaux :**
- `src/screens/ClanScreen.js` — écran de chat (nouvel onglet "💬 Clan")
- `backend/tests/test_api_clan.py` — tests d'intégration HTTP complets

**Modifiés :**
- `backend/app/basededonnees.py` — table `messages_clan`
- `backend/app/main.py` — endpoints `/clans/{salle}/messages` (lecture + écriture)
- `src/api.js` — fonctions `messagesClan`, `envoyerMessageClan`
- `App.js` — 5e onglet "Clan" ajouté à la barre de navigation

### Tâche 5 — Avatar évolutif

**Nouveaux :**
- `src/components/AvatarJoueur.js` — avatar avec anneau/lueur/emblème selon la ligue

**Modifiés :**
- `src/screens/ProfilScreen.js` — utilise le nouvel avatar (grand format)
- `src/screens/CompetitionScreen.js` — utilise le nouvel avatar dans le classement (petit format)

`CLAUDE.md` mis à jour au fur et à mesure des cinq tâches.

---

## Vérifications faites pour toute la mission

- ✅ **100 tests automatiques** passent (`cd backend && python -m unittest
  discover tests`) — logique pure ET intégration HTTP complète (avec de
  vraies requêtes, y compris un vrai envoi de fichier vidéo).
- ✅ Le serveur a été redémarré et testé en conditions réelles après CHAQUE
  tâche (pas seulement avec les tests automatiques) : inscription/connexion,
  duel en ligne complet (créer, rejoindre, jouer, gagner), upload vidéo +
  vote, chat de clan — tout vérifié à la main avec de vraies requêtes HTTP
  avant de passer à la tâche suivante.
- ✅ Le code de l'app (React Native) a été recompilé avec `npx expo export`
  après chaque tâche pour vérifier l'absence d'erreur de syntaxe ou d'import
  — toujours réussi (615 fichiers à la fin).
- ✅ Toutes les données de test créées pendant les vérifications manuelles
  ont été nettoyées de la base — seuls les 5 joueurs de démo (IronMax,
  SarahFit, KenzoLift, NoraRun, Djibril93) restent, prêts pour ton test.
- ⚠️ Comme avant, je n'ai pas pu tester l'app "en vrai" dans Expo Go sur un
  téléphone physique (pas d'accès à un téléphone ni à ton réseau Wi-Fi
  depuis ici). À toi de lancer `npx expo start` (sans `--tunnel`) et de
  créer un compte pour essayer les 5 nouvelles fonctionnalités.
