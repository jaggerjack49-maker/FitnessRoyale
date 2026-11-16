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
| `site/index.html` | toute la page (une seule), formulaire compris |
| `site/styles.css` | la direction artistique, reprise de `src/designSystem.js` |
| `site/script.js` | l'envoi du formulaire, et rien d'autre |
| `site/logo.png` | copie de `assets/logo-connexion.png` (33 ko) |
| `site/favicon.png` | copie de `assets/favicon.png` |

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

Dans l'application, onglet Profil, carte « DEMANDES DE COACHING » — visible
uniquement sur un compte administrateur. On y déplie chaque demande et on la
fait avancer : Nouvelle → En cours → Acceptée ou Refusée.

## Le mettre en ligne (à faire par Hafiz — accès au compte Render)

Un SECOND Static Site, à côté de celui qui sert l'application :

Render → **New +** → **Static Site** → dépôt `jaggerjack49-maker/FitnessRoyale`
- Branch `master`
- Root Directory : **vide**
- Build Command : **vide** (il n'y a rien à construire)
- Publish Directory : **`site`**
- Plan Free → Create Static Site

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
