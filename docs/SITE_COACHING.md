# Le site web « Fitness Royale Coaching » — mode d'emploi

Le dossier `site/` est un site VITRINE indépendant de l'application : du HTML,
du CSS et un fichier JavaScript, servis tels quels. Son seul échange avec le
reste du projet est le formulaire de demande de coaching, qui écrit dans le
backend existant.

Les décisions et les pièges sont racontés dans `CLAUDE.md`
(« Site web de coaching », 15/11/2026). Ce fichier-ci ne dit que comment
TRAVAILLER dessus.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `site/index.html` | la page publique, formulaire compris |
| `site/script.js` | l'envoi du formulaire, et rien d'autre |
| `site/admin.html` | la page privée : lire les demandes reçues |
| `site/admin.js` | la connexion, la liste, les changements d'état |
| `site/commun.js` | ce que les deux pages partagent — **l'adresse de l'API** |
| `site/styles.css` | la direction artistique, reprise de `src/designSystem.js` |
| `site/admin.css` | ce que la page privée ajoute (la liste des demandes) |
| `site/logo.png` | copie de `assets/logo-connexion.png` (33 ko) |
| `site/favicon.png` | copie de `assets/favicon.png` |

⚠️ **L'adresse de l'API n'est écrite que dans `commun.js`.** Recopiée ailleurs,
elle finirait par diverger — et quand elle se trompe, elle pointe sur
`localhost`, c'est-à-dire sur l'appareil du visiteur. Un test le vérifie.

Aucune dépendance, aucune étape de construction : ce qui est dans le dossier
est exactement ce qui est servi.

## Le regarder en local

```bash
python -m http.server 8090 --directory site
```

puis `http://127.0.0.1:8090/`. **Ouvre-le par cette adresse, pas en
double-cliquant le fichier** : en `file://`, le navigateur refuse l'envoi du
formulaire.

Pour essayer le formulaire pour de vrai, lance le backend à côté :

```bash
cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`script.js` vise automatiquement `http://localhost:8000` quand la page est
servie depuis `localhost` ou `127.0.0.1`, et l'adresse en ligne partout
ailleurs. Il n'y a donc rien à changer entre les deux situations.

## Changer les TARIFS

Ils ne sont écrits NULLE PART pour l'instant : les trois formules affichent
« Tarif à convenir ensemble ». Pour les poser, remplacer le texte des trois
balises `<p class="prix">` dans `site/index.html` (un commentaire les signale
juste au-dessus de la section).

## Changer les choix du formulaire

⚠️ Les listes déroulantes (objectif, niveau, matériel, formule) sont
RECOPIÉES des constantes de `backend/app/main.py`
(`OBJECTIFS_COACHING`, `NIVEAUX_COACHING`, `MATERIELS_COACHING`,
`FORMULES_COACHING`). Le serveur REFUSE une valeur absente de sa liste :
modifier l'une sans l'autre donnerait au visiteur un refus incompréhensible
sur un choix que le site lui a lui-même proposé.

`backend/tests/test_listes_site_coaching.py` compare les deux et échoue dès
qu'elles divergent. **Changer les deux, puis lancer les tests.**

## Lire les demandes reçues

Sur le site lui-même, page **`/admin.html`** (en local :
`http://127.0.0.1:8090/admin.html`). On s'y connecte avec son compte
**administrateur** Fitness Royale — le même pseudo et le même mot de passe que
dans l'application. On déplie chaque demande et on la fait avancer :
Nouvelle → En cours → Acceptée ou Refusée. Le contact devient un lien :
un clic ouvre le mail ou l'appel.

Trois choses à savoir :

- **La page n'est liée nulle part** et porte un `noindex` : on y va par son
  adresse. Ce n'est pas ce qui protège les demandes — c'est le serveur, qui
  refuse (403) tout compte non administrateur, et (401) toute visite sans
  connexion. C'est juste une porte qu'on ne montre pas.
- **La connexion est gardée** d'une visite à l'autre, comme dans l'app.
  « Se déconnecter » détruit vraiment la session côté serveur : à faire sur un
  ordinateur qui n'est pas le tien.
- **Un compte ordinaire est refusé tout de suite**, avec un message clair.

⚠️ Cette lecture n'existe plus dans l'application (elle y était jusqu'au
16/11/2026, carte « DEMANDES DE COACHING » du Profil). Un seul endroit : deux
écrans pour la même chose finissent toujours par diverger, et celui de l'app
demandait en plus un nouvel APK à chaque retouche.

## Le mettre en ligne (à faire par Hafiz — accès au compte Render)

Un SECOND Static Site, à côté de celui qui sert l'application :

Render → **New +** → **Static Site** → dépôt `jaggerjack49-maker/FitnessRoyale`
- Branch `master`
- Root Directory : **vide**
- Build Command : **vide** (il n'y a rien à construire)
- Publish Directory : **`site`**
- Plan Free → Create Static Site

Une fois en ligne, la page de lecture des demandes est à
`https://<ton-site>/admin.html`. ⚠️ **Ne pas ajouter de règle « Rewrite `/*`
→ `/index.html` »** dans Redirects/Rewrites : le site a deux pages bien
réelles, et une règle attrape-tout servirait la page publique à la place de
la page de lecture.

Deux choses à savoir :
- un Static Site ne dort jamais et ne consomme pas d'heures de service web
  (contrairement au backend gratuit) ;
- il se reconstruit à chaque `git push` sur `master`, comme les deux autres.

⚠️ **Pousser le backend AVANT d'annoncer le site** : le formulaire appelle
`POST /coaching/demandes`, qui n'existe que depuis ce lot. Sans déploiement
du backend d'abord, chaque demande échouerait en silence.

## Ce qui n'y est volontairement PAS

- **Aucun témoignage ni avis client.** Je n'en invente pas : un faux
  témoignage présenté comme vrai n'est pas une option. À ajouter quand de
  vrais clients en auront écrit.
- **Aucun paiement en ligne.** Le tarif se convient après la demande.
- **Aucune photo.** Les tiennes iraient très bien — dépose-les dans `site/`
  et on les intègre.
