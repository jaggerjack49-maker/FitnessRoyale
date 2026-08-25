# Fitness Royale — Backend (Python + FastAPI)

Le « cerveau » du jeu : comptes joueurs, performances avec vérification,
paliers Club SP et classements. Base de données : SQLite (un simple fichier).

## Lancer le serveur

Depuis ce dossier `backend/` :

```
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Puis ouvre **http://localhost:8000/docs** : FastAPI génère une page interactive
où tu peux tester chaque endpoint à la main (créer un joueur, ajouter une perf…).

## Les endpoints

| Méthode | URL | Rôle |
|---|---|---|
| GET | `/bareme/homme` ou `/bareme/femme` | Le barème Club SP complet |
| POST | `/joueurs` | Créer un joueur (pseudo, sexe, poids, salle) |
| GET | `/joueurs` / `/joueurs/{id}` | Liste / détail (avec ligue calculée) |
| POST | `/joueurs/{id}/performances` | Déclarer une perf (statut « declare ») |
| POST | `/joueurs/{id}/performances/{exercice}/verifier` | Vérification communauté ou salle |
| GET | `/classement/global` | Classement par rang |
| GET | `/classement/poids` | Par catégories (-60/-70/-80/-90/+90 kg) |
| GET | `/classement/salles` | Le classement des clans |

## Les règles (mêmes que l'app)

- Une perf « declare » ne compte PAS au classement — il faut la faire vérifier.
- Classement au palier moyen (interne), affichage par RANG uniquement.
- Égalité → départage aux points de compétition.

## Tests

```
python3 -m unittest discover tests
```

## Prochaines étapes

- Connexion de l'app React Native (remplacer mockData.js par des appels à cette API)
- Duels en ligne (WebSockets), upload vidéo, comptes sécurisés (mots de passe)
