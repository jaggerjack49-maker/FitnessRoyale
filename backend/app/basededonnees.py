"""Base de données — la « mémoire » du backend.

DEUX MOTEURS SUPPORTÉS, choisis automatiquement :
- Par défaut (aucune variable d'environnement) : SQLite, un simple fichier
  (fitness_royale.db) — comportement inchangé pour le développement local
  et pour TOUS les tests automatisés (rapides, zéro dépendance réseau).
- Si `DATABASE_URL` est définie (hébergement — voir "Hébergement du
  backend" dans CLAUDE.md) : PostgreSQL, via psycopg. Pensé pour un Postgres
  gratuit externe (ex. Neon) couplé à un serveur web sans disque persistant
  (ex. Render gratuit) — décision du 20/08/2026 (Hafiz : hébergement
  gratuit, mais les comptes/perfs doivent survivre aux redémarrages).

DÉCISION DE CONCEPTION — pour que les 70+ fonctions de ce fichier n'aient
PAS à connaître le moteur utilisé, toute la différence est concentrée ici,
dans une poignée d'outils :
- `connexion()` ouvre le bon moteur et renvoie un objet `.execute(sql, params)`
  qui se comporte PAREIL des deux côtés (mêmes paramètres `?`, même accès
  `dict(ligne)` / `ligne["colonne"]`, même `.lastrowid`, même `.rowcount`).
- `ErreurIntegrite` remplace `sqlite3.IntegrityError` — le code appelant
  (main.py) n'a plus besoin de savoir quel moteur a levé l'erreur.
- Chaque requête continue de s'écrire avec `?` (comme avant) ; `_traduire()`
  la convertit en `%s` UNIQUEMENT si le moteur est Postgres.

⚠️ NON TESTÉ EN CONDITIONS RÉELLES CONTRE POSTGRES au moment de l'écriture
(pas de Docker/psql installé localement pour valider — même situation que
pour Fly.io en son temps). À valider une fois qu'un vrai `DATABASE_URL` Neon
est disponible. Le mode SQLite, lui, reste couvert par toute la suite de tests.
"""

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

# DOSSIER DE DONNÉES (mode SQLite uniquement) : en local, le fichier vit dans
# backend/ comme avant. En hébergement SANS Postgres (ex. Fly.io avec un
# volume persistant), FITNESS_ROYALE_DATA_DIR pointe vers ce disque.
_DOSSIER_DONNEES = Path(os.environ.get("FITNESS_ROYALE_DATA_DIR") or (Path(__file__).parent.parent))
CHEMIN_DB = _DOSSIER_DONNEES / "fitness_royale.db"

# Le choix du moteur est relu À CHAQUE appel de connexion() (comme CHEMIN_DB),
# pour rester modifiable depuis les tests via une variable d'environnement.


def _moteur_actuel() -> str:
    return "postgres" if os.environ.get("DATABASE_URL") else "sqlite"


class ErreurIntegrite(Exception):
    """Une contrainte UNIQUE (ou autre contrainte d'intégrité) a été violée —
    même exception quel que soit le moteur, pour que main.py n'ait jamais à
    importer sqlite3 ni psycopg."""


def _traduire(sql: str) -> str:
    """SQLite utilise `?` comme paramètre, Postgres `%s` — une seule écriture
    de requête (toujours avec `?`) sert donc les deux moteurs."""
    return sql.replace("?", "%s") if _moteur_actuel() == "postgres" else sql


class _CurseurAdapte:
    """Enveloppe un vrai curseur (sqlite3 ou psycopg) pour que `.lastrowid`
    fonctionne PAREIL des deux côtés, à partir du `RETURNING id` ajouté aux
    requêtes (voir les fonctions creer_* plus bas). Tout le reste
    (`.fetchone()`, `.fetchall()`, `.rowcount`, l'itération...) est délégué
    tel quel : les deux moteurs suivent la même spec Python (DB-API 2.0).

    PIÈGE RÉSOLU : la ligne RETURNING doit être lue IMMÉDIATEMENT après
    l'exécution (voir _ConnexionAdaptee.execute ci-dessous), pas seulement
    quand `.lastrowid` est lu. Sur SQLite, un INSERT ... RETURNING laisse le
    curseur dans un état « statement en cours » tant que sa ligne n'est pas
    consommée — un commit() pendant ce temps échoue avec
    `OperationalError: cannot commit transaction - SQL statements in progress`."""

    def __init__(self, curseur, moteur, lastrowid_precalcule=None, a_returning=False):
        self._curseur = curseur
        self._moteur = moteur
        self._lastrowid_cache = lastrowid_precalcule
        self._a_returning = a_returning

    def __getattr__(self, nom):
        return getattr(self._curseur, nom)

    def __iter__(self):
        return iter(self._curseur)

    @property
    def lastrowid(self):
        if self._a_returning:
            return self._lastrowid_cache
        return self._curseur.lastrowid


class _ConnexionAdaptee:
    """Enveloppe sqlite3.Connection OU psycopg.Connection derrière la même
    interface `.execute(sql, params)` — la SEULE différence que le reste de
    ce fichier a besoin de connaître."""

    def __init__(self, conn, moteur):
        self._conn = conn
        self._moteur = moteur

    def execute(self, sql, params=()):
        sql_traduit = _traduire(sql)
        if self._moteur == "sqlite":
            try:
                curseur = self._conn.execute(sql_traduit, params)
            except sqlite3.IntegrityError as e:
                raise ErreurIntegrite(str(e)) from e
        else:
            curseur = self._conn.cursor()
            try:
                curseur.execute(sql_traduit, params)
            except psycopg.errors.UniqueViolation as e:
                raise ErreurIntegrite(str(e)) from e
        a_returning = "returning" in sql_traduit.lower()
        lastrowid_precalcule = None
        if a_returning:
            ligne = curseur.fetchone()
            lastrowid_precalcule = ligne["id"] if ligne else None
        return _CurseurAdapte(curseur, self._moteur, lastrowid_precalcule, a_returning)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


# RÉSERVE DE CONNEXIONS POSTGRES (« pool ») — ajoutée le 25/08/2026.
#
# POURQUOI : ce fichier ouvre une connexion par appel de fonction
# (`with connexion() as conn:`). Sur SQLite c'est quasi gratuit (un fichier
# local), mais vers un Postgres DISTANT (Neon) chaque ouverture coûte une
# négociation réseau + TLS + authentification — mesuré à ~2,5 s en pratique.
# `lire_tous_les_joueurs()` ouvrant une connexion PAR JOUEUR, `GET /joueurs`
# mettait 15 s avec seulement 5 joueurs (et aurait empiré à chaque nouveau
# joueur) — bien au-delà du délai d'attente de l'app, d'où les « aborted »
# et les inscriptions qui aboutissaient côté serveur mais paraissaient
# échouer côté téléphone.
#
# La réserve garde quelques connexions OUVERTES et les prête à tour de rôle :
# on ne paie l'ouverture qu'une fois, pas à chaque requête.
# `max_size` reste petit — l'offre gratuite de Neon limite le nombre de
# connexions simultanées, et un seul petit serveur web les consomme.
_reserve_postgres = None
_verrou_reserve = threading.Lock()


def _obtenir_reserve():
    """Crée la réserve au PREMIER besoin (pas à l'import) — sinon les tests,
    qui tournent en SQLite, tenteraient de joindre un Postgres inexistant."""
    global _reserve_postgres
    if _reserve_postgres is None:
        with _verrou_reserve:
            if _reserve_postgres is None:  # re-test : un autre thread a pu la créer
                from psycopg_pool import ConnectionPool

                reserve = ConnectionPool(
                    os.environ["DATABASE_URL"],
                    min_size=1,
                    max_size=4,
                    kwargs={"row_factory": dict_row},
                    open=False,
                )
                reserve.open()
                _reserve_postgres = reserve
    return _reserve_postgres


@contextmanager
def connexion():
    """Ouvre une connexion à la base (les lignes se comportent comme des
    dictionnaires, quel que soit le moteur).

    Utiliser avec `with connexion() as conn:` — valide (commit) ou annule
    (rollback) automatiquement en sortant du bloc.

    SQLite : la connexion est ouverte puis FERMÉE à chaque fois (sinon le
    fichier reste verrouillé, surtout gênant sous Windows) — inchangé.
    Postgres : la connexion est EMPRUNTÉE à la réserve ci-dessus puis rendue,
    jamais fermée (voir le commentaire de `_obtenir_reserve`)."""
    moteur = _moteur_actuel()
    if moteur == "sqlite":
        conn_brute = sqlite3.connect(CHEMIN_DB)
        conn_brute.row_factory = sqlite3.Row
        conn_brute.execute("PRAGMA foreign_keys = ON")
        conn = _ConnexionAdaptee(conn_brute, moteur)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        # `.connection()` valide (commit) ou annule (rollback) tout seul en
        # sortant du bloc, puis rend la connexion à la réserve.
        with _obtenir_reserve().connection() as conn_brute:
            yield _ConnexionAdaptee(conn_brute, moteur)


def _colonne_existe(conn, table: str, colonne: str) -> bool:
    if _moteur_actuel() == "sqlite":
        return any(ligne["name"] == colonne for ligne in conn.execute(f"PRAGMA table_info({table})"))
    lignes = conn.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
        (table, colonne),
    ).fetchall()
    return len(lignes) > 0


def _table_existe(conn, table: str) -> bool:
    if _moteur_actuel() == "sqlite":
        return conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?", (table,)
        ).fetchone() is not None
    return conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_name = ?", (table,)
    ).fetchone() is not None


def _migrer_schema_duels(conn):
    """Recrée duels/duel_rounds si l'ANCIEN schéma est détecté (sans colonne
    'code' — duels créés directement avec les 2 joueurs, sans code à partager).

    Base de dev, pas de vraies données à préserver : les duels de test
    existants sont perdus (voir décision dans CLAUDE.md)."""
    if _table_existe(conn, "duels") and not _colonne_existe(conn, "duels", "code"):
        conn.execute("DROP TABLE IF EXISTS duel_rounds")
        conn.execute("DROP TABLE IF EXISTS duels")


_TABLES_BASE = [
        """            CREATE TABLE IF NOT EXISTS joueurs (
                id     INTEGER PRIMARY KEY AUTOINCREMENT,
                pseudo TEXT NOT NULL UNIQUE,
                sexe   TEXT NOT NULL CHECK (sexe IN ('homme', 'femme')),
                poids  REAL NOT NULL,
                salle  TEXT,
                points INTEGER NOT NULL DEFAULT 0
            )""",
        """            CREATE TABLE IF NOT EXISTS performances (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                exercice  TEXT NOT NULL,
                valeur    REAL NOT NULL,
                statut    TEXT NOT NULL DEFAULT 'declare'
                          CHECK (statut IN ('declare', 'communaute', 'salle')),
                UNIQUE (joueur_id, exercice)  -- une seule perf (la meilleure) par exercice
            )""",
        """            -- Un duel BO3 en ligne : premier à 2 rounds gagnés (règles dans duels.py).
            -- Créé par le challenger seul (adversaire_id NULL, statut 'en_attente')
            -- avec un code à partager ; l'adversaire rejoint avec ce code
            -- (POST /duels/rejoindre), ce qui passe le duel en 'en_cours'.
            CREATE TABLE IF NOT EXISTS duels (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                code          TEXT UNIQUE,
                challenger_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                adversaire_id INTEGER REFERENCES joueurs(id) ON DELETE CASCADE,
                recompense    INTEGER NOT NULL DEFAULT 100,
                statut        TEXT NOT NULL DEFAULT 'en_attente'
                              CHECK (statut IN ('en_attente', 'en_cours', 'termine')),
                gagnant_id    INTEGER REFERENCES joueurs(id)
            )""",
        """            -- Les 3 rounds d'un duel (créés vides, remplis quand on les joue).
            -- {cote}_debut = horodatage où CE joueur a appuyé sur "je commence
            -- ma série" — sert à afficher un chrono en direct à l'adversaire
            -- (voir "Statut en direct des duels" dans CLAUDE.md). NULL tant
            -- qu'il n'a pas commencé son tour sur ce round.
            CREATE TABLE IF NOT EXISTS duel_rounds (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                duel_id           INTEGER NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
                numero            INTEGER NOT NULL CHECK (numero IN (1, 2, 3)),
                choisi_par        TEXT NOT NULL
                                  CHECK (choisi_par IN ('challenger', 'adversaire', 'ia')),
                exercice          TEXT,
                charge            REAL,
                reps_challenger   INTEGER,
                reps_adversaire   INTEGER,
                challenger_debut  TEXT,
                adversaire_debut  TEXT,
                UNIQUE (duel_id, numero)
            )""",
        """            -- Une séance d'entraînement (sert à valider les défis avec de VRAIES dates).
            CREATE TABLE IF NOT EXISTS seances (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                date      TEXT NOT NULL,   -- format 'AAAA-MM-JJ'
                minutes   INTEGER NOT NULL CHECK (minutes > 0)
            )""",
        """            -- Défis validés : un défi ne peut être validé qu'UNE fois par période.
            -- periode = '2026-07-19' (jour) ou '2026-S29' (semaine).
            CREATE TABLE IF NOT EXISTS defis_valides (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                type      TEXT NOT NULL CHECK (type IN ('jour', 'semaine')),
                periode   TEXT NOT NULL,
                points    INTEGER NOT NULL,
                titre     TEXT,
                UNIQUE (joueur_id, type, periode)
            )""",
        """            -- Une session = un token de connexion actif pour un joueur.
            -- Pas d'expiration pour l'instant (projet perso) ; se déconnecter
            -- supprime la ligne (voir supprimer_session).
            CREATE TABLE IF NOT EXISTS sessions (
                token     TEXT PRIMARY KEY,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                cree_le   TEXT NOT NULL
            )""",
        """            -- Une preuve vidéo pour une perf : en attente d'un vote de la
            -- communauté (voir videos.py pour la règle de décision).
            CREATE TABLE IF NOT EXISTS preuves_video (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                exercice  TEXT NOT NULL,
                fichier   TEXT NOT NULL,
                statut    TEXT NOT NULL DEFAULT 'en_attente'
                          CHECK (statut IN ('en_attente', 'validee', 'refusee')),
                cree_le   TEXT NOT NULL
            )""",
        """            -- Le vote d'un autre joueur sur une preuve vidéo.
            CREATE TABLE IF NOT EXISTS votes_video (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id  INTEGER NOT NULL REFERENCES preuves_video(id) ON DELETE CASCADE,
                votant_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                valide    INTEGER NOT NULL,
                UNIQUE (video_id, votant_id)
            )""",
        """            -- Chat de clan : un message posté dans le clan d'une SALLE.
            -- Réservé aux membres (joueur.salle == salle du message).
            CREATE TABLE IF NOT EXISTS messages_clan (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                salle     TEXT NOT NULL,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                texte     TEXT NOT NULL,
                cree_le   TEXT NOT NULL
            )""",
        """            -- Section "Entraînement" — INDÉPENDANTE du barème Fitness Royale (aucun lien
            -- avec la table performances). Un programme = une liste d'exercices
            -- en texte libre, avec un objectif séries x reps pour chacun.
            CREATE TABLE IF NOT EXISTS programmes (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                nom       TEXT NOT NULL,
                cree_le   TEXT NOT NULL
            )""",
        """            CREATE TABLE IF NOT EXISTS programme_exercices (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                programme_id  INTEGER NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
                exercice      TEXT NOT NULL,
                ordre         INTEGER NOT NULL,
                series_cibles INTEGER NOT NULL,
                reps_cibles   INTEGER NOT NULL
            )""",
        """            -- Une séance loggée (le "workout log") — éventuellement liée à un
            -- programme, mais programme_id peut être NULL (séance libre).
            CREATE TABLE IF NOT EXISTS entrainements (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id    INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                programme_id INTEGER REFERENCES programmes(id) ON DELETE SET NULL,
                date         TEXT NOT NULL,
                cree_le      TEXT NOT NULL
            )""",
        """            -- Chaque série réellement effectuée pendant un entraînement loggé.
            CREATE TABLE IF NOT EXISTS series_journal (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                entrainement_id INTEGER NOT NULL REFERENCES entrainements(id) ON DELETE CASCADE,
                exercice        TEXT NOT NULL,
                numero_serie    INTEGER NOT NULL,
                reps            INTEGER NOT NULL,
                poids           REAL NOT NULL
            )""",
        """            -- Validation SANS VIDÉO n°1 : code à partager avec un partenaire de
            -- salle PRÉSENT au moment de la perf (comme le code des duels en
            -- ligne). Le partenaire saisit le code sur SON téléphone -> la perf
            -- passe en "salle". Un code = une seule perf, usage unique.
            CREATE TABLE IF NOT EXISTS codes_validation (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                exercice  TEXT NOT NULL,
                code      TEXT NOT NULL UNIQUE,
                statut    TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'validee')),
                cree_le   TEXT NOT NULL
            )""",
        """            -- Validation SANS VIDÉO n°2 : vote communauté sur une perf DÉCLARÉE
            -- (sans preuve jointe) -- même règle "premier vote décide" que pour
            -- les vidéos, mais sur la seule confiance. UNIQUE empêche un même
            -- votant de voter deux fois sur la même perf tant qu'elle est en attente.
            CREATE TABLE IF NOT EXISTS votes_perf_declaree (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                exercice  TEXT NOT NULL,
                votant_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                valide    INTEGER NOT NULL,
                UNIQUE (joueur_id, exercice, votant_id)
            )""",
    ]


def _executer_creation_table(conn, sql):
    """Exécute un CREATE TABLE en traduisant `INTEGER PRIMARY KEY
    AUTOINCREMENT` (syntaxe SQLite) en `SERIAL PRIMARY KEY` (Postgres) si
    besoin -- seule différence de dialecte entre les deux moteurs sur ces
    définitions de table, donc une simple substitution de texte suffit.
    BUG CORRIGÉ (25/08/2026, trouvé en déployant sur Render+Neon) : les
    tables ajoutées à `initialiser()` APRÈS coup (cycles, planning...)
    exécutaient leur CREATE TABLE brut, sans passer par cette traduction
    -- ça plantait sur Postgres avec `syntax error at or near
    "AUTOINCREMENT"`. Toute nouvelle table doit passer par cette fonction
    (ou vivre dans `_TABLES_BASE`), jamais par un `conn.execute()` direct."""
    if _moteur_actuel() == "postgres":
        sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    conn.execute(sql)


def _executer_tables_base(conn):
    """Crée les 16 tables du schéma initial, une par une (portable SQLite/
    Postgres — `executescript()` n'existe que sur SQLite)."""
    for statement in _TABLES_BASE:
        _executer_creation_table(conn, statement)


def initialiser():
    """Crée les tables si elles n'existent pas. Appelé au démarrage du serveur."""
    with connexion() as conn:
        _migrer_schema_duels(conn)
        _executer_tables_base(conn)
        # Migration : ajoute la colonne mot de passe si la base existait déjà avant
        # (impossible d'ajouter une colonne via CREATE TABLE IF NOT EXISTS).
        if not _colonne_existe(conn, "joueurs", "mot_de_passe_hash"):
            conn.execute("ALTER TABLE joueurs ADD COLUMN mot_de_passe_hash TEXT")
        # Migration : ajoute les colonnes de chrono en direct si la base existait déjà.
        if not _colonne_existe(conn, "duel_rounds", "challenger_debut"):
            conn.execute("ALTER TABLE duel_rounds ADD COLUMN challenger_debut TEXT")
        if not _colonne_existe(conn, "duel_rounds", "adversaire_debut"):
            conn.execute("ALTER TABLE duel_rounds ADD COLUMN adversaire_debut TEXT")
        # Migration : le CODE DE SECOURS pour "mot de passe oublié" — haché
        # comme un mot de passe (jamais stocké en clair), usage unique.
        if not _colonne_existe(conn, "joueurs", "code_recuperation_hash"):
            conn.execute("ALTER TABLE joueurs ADD COLUMN code_recuperation_hash TEXT")
        # Migration : compte ADMINISTRATEUR (mode test). 0 = joueur normal.
        # Ne s'active JAMAIS depuis l'app — uniquement à la main en base
        # (voir "Mode test" dans CLAUDE.md), pour qu'un joueur ne puisse pas
        # se l'accorder tout seul.
        if not _colonne_existe(conn, "joueurs", "admin"):
            conn.execute("ALTER TABLE joueurs ADD COLUMN admin INTEGER NOT NULL DEFAULT 0")
        # Migration : marque les joueurs CRÉÉS PAR LE MODE TEST, pour pouvoir
        # tous les supprimer d'un coup sans toucher aux vrais comptes.
        if not _colonne_existe(conn, "joueurs", "est_test"):
            conn.execute("ALTER TABLE joueurs ADD COLUMN est_test INTEGER NOT NULL DEFAULT 0")
        # Migration : les JOURS de la semaine d'un programme d'entraînement
        # (texte JSON, ex. '["lundi", "jeudi"]' — NULL si aucun jour choisi).
        if not _colonne_existe(conn, "programmes", "jours"):
            conn.execute("ALTER TABLE programmes ADD COLUMN jours TEXT")
        # Migration : programme planifié sur PLUSIEURS SEMAINES (calendrier).
        # duree_semaines = NULL -> programme permanent, sans fin prévue.
        # date_debut ('AAAA-MM-JJ') = NULL -> pas encore planifié dans le temps.
        if not _colonne_existe(conn, "programmes", "duree_semaines"):
            conn.execute("ALTER TABLE programmes ADD COLUMN duree_semaines INTEGER")
        if not _colonne_existe(conn, "programmes", "date_debut"):
            conn.execute("ALTER TABLE programmes ADD COLUMN date_debut TEXT")
        # CYCLE = un programme COMPLET sur la semaine (ex. « Mon PPL ») : il
        # groupe plusieurs SÉANCES, une par jour travaillé, chacune avec ses
        # propres exercices. Une séance est un `programme` classique portant le
        # jour concerné (jours = ["mardi"]) — le cycle ne fait que les
        # rassembler sous un même nom, pour pouvoir le poser d'un coup dans le
        # calendrier (tous ses jours se remplissent automatiquement).
        _executer_creation_table(conn, """
            CREATE TABLE IF NOT EXISTS cycles (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                nom       TEXT NOT NULL,
                cree_le   TEXT NOT NULL
            )
        """)
        _executer_creation_table(conn, """
            CREATE TABLE IF NOT EXISTS cycle_programmes (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle_id     INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
                programme_id INTEGER NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
                UNIQUE (cycle_id, programme_id)
            )
        """)
        # VOLUME par GROUPE MUSCULAIRE : combien de SÉRIES par semaine je veux
        # faire sur chaque « body part » (ex. Pectoraux : 12). Le comptage des
        # séries réellement faites se calcule côté app à partir des séances
        # loggées — seul l'OBJECTIF est stocké ici.
        _executer_creation_table(conn, """
            CREATE TABLE IF NOT EXISTS objectifs_series (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id     INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                groupe        TEXT NOT NULL,
                series_cibles INTEGER NOT NULL CHECK (series_cibles > 0),
                UNIQUE (joueur_id, groupe)
            )
        """)
        # Les exercices étant en TEXTE LIBRE, l'app devine leur groupe
        # musculaire par mots-clés. Cette table garde les CORRECTIONS de
        # l'utilisateur (ex. « Mon exo bizarre » -> Dos), qui priment.
        _executer_creation_table(conn, """
            CREATE TABLE IF NOT EXISTS groupes_exercices (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                exercice  TEXT NOT NULL,
                groupe    TEXT NOT NULL,
                UNIQUE (joueur_id, exercice)
            )
        """)
        # PLANNING par DATE PRÉCISE (calendrier interactif) : « le 2026-08-21,
        # je fais le programme X ». Complète les jours RÉCURRENTS d'un programme
        # (colonne jours ci-dessus) — les deux se cumulent à l'affichage.
        # Les PROGRAMMES PARTAGÉS : ceux que l'admin met à disposition.
        # Ils ne sont PAS publics (correction du 02/09/2026, demande de
        # Hafiz : « je ne veux pas que tout le monde voie le programme »).
        # On ne les découvre qu'avec un CODE à partager — même principe que
        # les codes de duel et de validation de perf, et le code est même
        # produit par la même fonction (`regles_duels.generer_code`).
        # DIFFÉRENCE IMPORTANTE avec ces deux-là : ce code n'est PAS à usage
        # unique. Il est fait pour être donné à plusieurs personnes, et sert
        # tant que l'admin ne le retire pas.
        # Un joueur ne peut que LIRE le programme puis s'en faire une copie
        # personnelle — jamais modifier l'original.
        #
        # DÉCISION : le contenu (les séances, leurs jours, leurs exercices)
        # est stocké en JSON dans UNE colonne, au lieu de deux tables liées
        # comme les cycles d'un joueur. Un programme officiel n'est pas un
        # objet vivant : personne ne le modifie séance par séance, on le
        # publie et on le copie. C'est exactement la même forme que les
        # modèles standards côté app (src/data/programmesStandards.js), donc
        # l'app les affiche avec le même code, sans conversion.
        _executer_creation_table(conn, """
            CREATE TABLE IF NOT EXISTS programmes_officiels (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                code        TEXT UNIQUE,
                nom         TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                contenu     TEXT NOT NULL,   -- JSON [{nom, jours, exercices}]
                auteur_id   INTEGER REFERENCES joueurs(id) ON DELETE SET NULL,
                cree_le     TEXT NOT NULL
            )
        """)
        # Migration : le CODE de partage, pour les bases où la table
        # programmes_officiels existait déjà sans lui (elle est née la veille,
        # quand le catalogue était encore public). Un programme publié avant
        # n'a donc pas de code et n'est plus accessible à personne — c'est
        # exactement le comportement voulu : rien ne doit rester visible sans
        # code. À placer APRÈS la création de la table, sinon on tenterait
        # d'ALTER une table qui n'existe pas encore sur une base neuve.
        if not _colonne_existe(conn, "programmes_officiels", "code"):
            conn.execute("ALTER TABLE programmes_officiels ADD COLUMN code TEXT")

        _executer_creation_table(conn, """
            CREATE TABLE IF NOT EXISTS planning (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                joueur_id    INTEGER NOT NULL REFERENCES joueurs(id) ON DELETE CASCADE,
                date         TEXT NOT NULL,   -- 'AAAA-MM-JJ'
                programme_id INTEGER NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
                UNIQUE (joueur_id, date, programme_id)
            )
        """)


# ----- Programmes officiels (publiés par l'admin) -----

def creer_programme_officiel(code: str, nom: str, description: str,
                             contenu_json: str, auteur_id: int, cree_le: str) -> int:
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO programmes_officiels (code, nom, description, contenu, auteur_id, cree_le) "
            "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (code, nom, description, contenu_json, auteur_id, cree_le),
        )
        return curseur.lastrowid


def programme_officiel_par_code(code: str) -> dict | None:
    """Le SEUL moyen pour un joueur d'atteindre un programme partagé."""
    with connexion() as conn:
        ligne = conn.execute(
            "SELECT id, code, nom, description, contenu, cree_le "
            "FROM programmes_officiels WHERE code = ?", (code,)
        ).fetchone()
    return dict(ligne) if ligne else None


def programmes_officiels_de(auteur_id: int) -> list:
    """Ceux que MOI j'ai partagés — avec leurs codes, pour pouvoir les
    redonner. Réservé à leur auteur : personne d'autre n'a à voir cette liste."""
    with connexion() as conn:
        lignes = conn.execute(
            "SELECT id, code, nom, description, contenu, cree_le "
            "FROM programmes_officiels WHERE auteur_id = ? ORDER BY id DESC",
            (auteur_id,)
        ).fetchall()
    return [dict(ligne) for ligne in lignes]


def code_officiel_existe(code: str) -> bool:
    with connexion() as conn:
        return conn.execute(
            "SELECT 1 FROM programmes_officiels WHERE code = ?", (code,)
        ).fetchone() is not None


def supprimer_programme_officiel(programme_id: int) -> None:
    with connexion() as conn:
        conn.execute("DELETE FROM programmes_officiels WHERE id = ?", (programme_id,))


def creer_joueur(pseudo: str, sexe: str, poids: float, salle: str | None,
                 mot_de_passe_hash: str | None = None) -> int:
    """Crée un joueur. mot_de_passe_hash=None pour les joueurs de démo (ne peuvent pas se connecter)."""
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO joueurs (pseudo, sexe, poids, salle, mot_de_passe_hash) "
            "VALUES (?, ?, ?, ?, ?) RETURNING id",
            (pseudo, sexe, poids, salle, mot_de_passe_hash),
        )
        return curseur.lastrowid


def lire_joueur_par_pseudo(pseudo: str) -> dict | None:
    """Pour la connexion : retrouve un joueur par son pseudo (avec son hash de mot de passe)."""
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM joueurs WHERE pseudo = ?", (pseudo,)).fetchone()
        return dict(ligne) if ligne else None


def changer_mot_de_passe(joueur_id: int, nouveau_hash: str) -> None:
    """Remplace le hash du mot de passe (le mot de passe lui-même n'arrive jamais ici)."""
    with connexion() as conn:
        conn.execute(
            "UPDATE joueurs SET mot_de_passe_hash = ? WHERE id = ?", (nouveau_hash, joueur_id)
        )


def definir_code_recuperation(joueur_id: int, code_hash: str | None) -> None:
    """Enregistre le hash du code de secours (None = effacer, ex. après usage)."""
    with connexion() as conn:
        conn.execute(
            "UPDATE joueurs SET code_recuperation_hash = ? WHERE id = ?", (code_hash, joueur_id)
        )


def supprimer_sessions_du_joueur(joueur_id: int) -> None:
    """Déconnecte le joueur PARTOUT (tous ses tokens) — utilisé après un
    "mot de passe oublié" : si quelqu'un d'autre avait la main sur le compte,
    ses sessions volées meurent en même temps que l'ancien mot de passe."""
    with connexion() as conn:
        conn.execute("DELETE FROM sessions WHERE joueur_id = ?", (joueur_id,))


def lire_joueur(joueur_id: int) -> dict | None:
    """Un joueur avec toutes ses performances, au même format que le front.

    Ne contient JAMAIS le hash du mot de passe (voir lire_joueur_par_pseudo
    pour la connexion, qui elle en a besoin)."""
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM joueurs WHERE id = ?", (joueur_id,)).fetchone()
        if ligne is None:
            return None
        joueur = dict(ligne)
        joueur.pop("mot_de_passe_hash", None)
        joueur.pop("code_recuperation_hash", None)
        joueur["performances"] = {
            p["exercice"]: {"valeur": p["valeur"], "statut": p["statut"]}
            for p in conn.execute(
                "SELECT * FROM performances WHERE joueur_id = ?", (joueur_id,)
            )
        }
        # Les titres viennent des défis validés (ex. « Guerrier de la semaine »).
        joueur["titres"] = [
            ligne["titre"]
            for ligne in conn.execute(
                "SELECT titre FROM defis_valides WHERE joueur_id = ? AND titre IS NOT NULL "
                "ORDER BY id",
                (joueur_id,),
            )
        ]
        return joueur


def lire_tous_les_joueurs() -> list:
    """Tous les joueurs avec leurs perfs et titres — même format que lire_joueur().

    EN 3 REQUÊTES AU TOTAL (joueurs, perfs, titres), pas 2 par joueur : la
    version d'origine appelait `lire_joueur()` en boucle, ce qui rouvrait une
    connexion et refaisait 2 requêtes POUR CHAQUE joueur. Invisible sur SQLite
    (fichier local), mais très coûteux vers un Postgres distant où chaque
    aller-retour se paie en latence réseau — et le coût grandissait avec le
    nombre de joueurs. Ici il ne bouge plus : 3 requêtes, 5 joueurs ou 500."""
    with connexion() as conn:
        joueurs = []
        par_id = {}
        for ligne in conn.execute("SELECT * FROM joueurs ORDER BY id"):
            joueur = dict(ligne)
            joueur.pop("mot_de_passe_hash", None)
            joueur.pop("code_recuperation_hash", None)
            joueur["performances"] = {}
            joueur["titres"] = []
            joueurs.append(joueur)
            par_id[joueur["id"]] = joueur
        for perf in conn.execute("SELECT * FROM performances"):
            joueur = par_id.get(perf["joueur_id"])
            if joueur is not None:
                joueur["performances"][perf["exercice"]] = {
                    "valeur": perf["valeur"], "statut": perf["statut"],
                }
        # Les titres viennent des défis validés (ex. « Guerrier de la semaine »).
        for ligne in conn.execute(
            "SELECT joueur_id, titre FROM defis_valides WHERE titre IS NOT NULL ORDER BY id"
        ):
            joueur = par_id.get(ligne["joueur_id"])
            if joueur is not None:
                joueur["titres"].append(ligne["titre"])
        return joueurs


def enregistrer_performance(joueur_id: int, exercice: str, valeur: float, statut: str) -> None:
    """Ajoute ou remplace la perf du joueur sur cet exercice."""
    with connexion() as conn:
        conn.execute(
            """INSERT INTO performances (joueur_id, exercice, valeur, statut)
               VALUES (?, ?, ?, ?)
               ON CONFLICT (joueur_id, exercice)
               DO UPDATE SET valeur = excluded.valeur, statut = excluded.statut""",
            (joueur_id, exercice, valeur, statut),
        )


def changer_statut_performance(joueur_id: int, exercice: str, statut: str) -> bool:
    """Vérification d'une perf (communauté ou salle). Renvoie False si perf introuvable."""
    with connexion() as conn:
        curseur = conn.execute(
            "UPDATE performances SET statut = ? WHERE joueur_id = ? AND exercice = ?",
            (statut, joueur_id, exercice),
        )
        return curseur.rowcount > 0


def ajouter_points(joueur_id: int, points: int) -> None:
    """Points de compétition (duels + défis) — servent au départage."""
    with connexion() as conn:
        conn.execute(
            "UPDATE joueurs SET points = points + ? WHERE id = ?", (points, joueur_id)
        )


# ----- Duels BO3 en ligne -----

def creer_duel_en_attente(challenger_id: int, recompense: int, code: str) -> int:
    """Crée un duel EN ATTENTE d'adversaire, avec ses 3 rounds vides
    (R1 challenger, R2 adversaire, R3 IA). Peut lever une erreur si le code
    existe déjà (contrainte UNIQUE) — à l'appelant de réessayer avec un autre code."""
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO duels (challenger_id, recompense, code) VALUES (?, ?, ?) RETURNING id",
            (challenger_id, recompense, code),
        )
        duel_id = curseur.lastrowid
        for numero, choisi_par in [(1, "challenger"), (2, "adversaire"), (3, "ia")]:
            conn.execute(
                "INSERT INTO duel_rounds (duel_id, numero, choisi_par) VALUES (?, ?, ?)",
                (duel_id, numero, choisi_par),
            )
        return duel_id


def lire_duel_par_code(code: str) -> dict | None:
    with connexion() as conn:
        ligne = conn.execute("SELECT id FROM duels WHERE code = ?", (code,)).fetchone()
    return lire_duel(ligne["id"]) if ligne else None


def rejoindre_duel(duel_id: int, adversaire_id: int) -> None:
    """L'adversaire rejoint un duel en attente : le duel passe 'en_cours'."""
    with connexion() as conn:
        conn.execute(
            "UPDATE duels SET adversaire_id = ?, statut = 'en_cours' WHERE id = ?",
            (adversaire_id, duel_id),
        )


def lire_duel(duel_id: int) -> dict | None:
    """Un duel avec ses 3 rounds dans l'ordre."""
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM duels WHERE id = ?", (duel_id,)).fetchone()
        if ligne is None:
            return None
        duel = dict(ligne)
        duel["rounds"] = [
            dict(r)
            for r in conn.execute(
                "SELECT numero, choisi_par, exercice, charge, reps_challenger, reps_adversaire, "
                "challenger_debut, adversaire_debut "
                "FROM duel_rounds WHERE duel_id = ? ORDER BY numero",
                (duel_id,),
            )
        ]
        return duel


def duels_du_joueur(joueur_id: int) -> list:
    """Tous les duels où le joueur est challenger ou adversaire (récents d'abord)."""
    with connexion() as conn:
        ids = [
            ligne["id"]
            for ligne in conn.execute(
                "SELECT id FROM duels WHERE challenger_id = ? OR adversaire_id = ? "
                "ORDER BY id DESC",
                (joueur_id, joueur_id),
            )
        ]
    return [lire_duel(duel_id) for duel_id in ids]


def choisir_exercice_round(duel_id: int, numero: int, exercice: str, charge: float) -> None:
    """Fixe l'exercice/charge d'un round et RÉINITIALISE ses reps ET ses chronos
    — utile aussi bien pour le premier choix que pour rejouer un round à égalité."""
    with connexion() as conn:
        conn.execute(
            """UPDATE duel_rounds
               SET exercice = ?, charge = ?, reps_challenger = NULL, reps_adversaire = NULL,
                   challenger_debut = NULL, adversaire_debut = NULL
               WHERE duel_id = ? AND numero = ?""",
            (exercice, charge, duel_id, numero),
        )


def demarrer_round(duel_id: int, numero: int, cote: str, quand: str) -> None:
    """Signale que CE joueur commence sa série sur ce round — sert à afficher
    un chrono en direct à l'adversaire. cote : 'challenger' ou 'adversaire'."""
    assert cote in ("challenger", "adversaire")
    colonne = f"{cote}_debut"
    with connexion() as conn:
        conn.execute(
            f"UPDATE duel_rounds SET {colonne} = ? WHERE duel_id = ? AND numero = ?",
            (quand, duel_id, numero),
        )


def enregistrer_mes_reps(duel_id: int, numero: int, cote: str, reps: int) -> None:
    """Chaque joueur soumet SES PROPRES reps indépendamment (vrai duel à deux
    téléphones — pas de saisie groupée). cote : 'challenger' ou 'adversaire'."""
    assert cote in ("challenger", "adversaire")
    colonne = f"reps_{cote}"
    with connexion() as conn:
        conn.execute(
            f"UPDATE duel_rounds SET {colonne} = ? WHERE duel_id = ? AND numero = ?",
            (reps, duel_id, numero),
        )


def terminer_duel(duel_id: int, gagnant_id: int) -> None:
    """Marque le duel terminé et enregistre le vainqueur."""
    with connexion() as conn:
        conn.execute(
            "UPDATE duels SET statut = 'termine', gagnant_id = ? WHERE id = ?",
            (gagnant_id, duel_id),
        )


# ----- Séances (pour les défis) -----

def ajouter_seance(joueur_id: int, date: str, minutes: int) -> int:
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO seances (joueur_id, date, minutes) VALUES (?, ?, ?) RETURNING id",
            (joueur_id, date, minutes),
        )
        return curseur.lastrowid


def seances_du_joueur(joueur_id: int) -> list:
    """Toutes les séances du joueur : [{date, minutes}, ...] (récentes d'abord)."""
    with connexion() as conn:
        return [
            dict(ligne)
            for ligne in conn.execute(
                "SELECT id, date, minutes FROM seances WHERE joueur_id = ? "
                "ORDER BY date DESC, id DESC",
                (joueur_id,),
            )
        ]


# ----- Défis validés -----

def defi_deja_valide(joueur_id: int, type_defi: str, periode: str) -> bool:
    with connexion() as conn:
        ligne = conn.execute(
            "SELECT id FROM defis_valides WHERE joueur_id = ? AND type = ? AND periode = ?",
            (joueur_id, type_defi, periode),
        ).fetchone()
        return ligne is not None


def enregistrer_defi(joueur_id: int, type_defi: str, periode: str,
                     points: int, titre: str | None) -> None:
    with connexion() as conn:
        conn.execute(
            "INSERT INTO defis_valides (joueur_id, type, periode, points, titre) "
            "VALUES (?, ?, ?, ?, ?)",
            (joueur_id, type_defi, periode, points, titre),
        )


# ----- Authentification -----

def definir_mot_de_passe(joueur_id: int, mot_de_passe_hash: str) -> None:
    with connexion() as conn:
        conn.execute(
            "UPDATE joueurs SET mot_de_passe_hash = ? WHERE id = ?",
            (mot_de_passe_hash, joueur_id),
        )


def creer_session(token: str, joueur_id: int, cree_le: str) -> None:
    with connexion() as conn:
        conn.execute(
            "INSERT INTO sessions (token, joueur_id, cree_le) VALUES (?, ?, ?)",
            (token, joueur_id, cree_le),
        )


def joueur_id_pour_token(token: str) -> int | None:
    with connexion() as conn:
        ligne = conn.execute(
            "SELECT joueur_id FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        return ligne["joueur_id"] if ligne else None


def supprimer_session(token: str) -> None:
    with connexion() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


# ----- Preuves vidéo (upload + vote communauté) -----

def creer_preuve_video(joueur_id: int, exercice: str, fichier: str, cree_le: str) -> int:
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO preuves_video (joueur_id, exercice, fichier, cree_le) VALUES (?, ?, ?, ?) RETURNING id",
            (joueur_id, exercice, fichier, cree_le),
        )
        return curseur.lastrowid


def lire_video(video_id: int) -> dict | None:
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM preuves_video WHERE id = ?", (video_id,)).fetchone()
        return dict(ligne) if ligne else None


def videos_en_attente(exclure_joueur_id: int) -> list:
    """Vidéos en attente de vote, sauf les tiennes (tu ne peux pas voter sur toi-même)."""
    with connexion() as conn:
        return [
            dict(ligne)
            for ligne in conn.execute(
                "SELECT pv.*, j.pseudo FROM preuves_video pv "
                "JOIN joueurs j ON j.id = pv.joueur_id "
                "WHERE pv.statut = 'en_attente' AND pv.joueur_id != ? "
                "ORDER BY pv.id DESC",
                (exclure_joueur_id,),
            )
        ]


def enregistrer_vote(video_id: int, votant_id: int, valide: bool) -> None:
    with connexion() as conn:
        conn.execute(
            "INSERT INTO votes_video (video_id, votant_id, valide) VALUES (?, ?, ?)",
            (video_id, votant_id, 1 if valide else 0),
        )


def resoudre_video(video_id: int, statut: str) -> None:
    assert statut in ("validee", "refusee")
    with connexion() as conn:
        conn.execute("UPDATE preuves_video SET statut = ? WHERE id = ?", (statut, video_id))


# ----- Chat de clan (par salle) -----

def envoyer_message_clan(salle: str, joueur_id: int, texte: str, cree_le: str) -> int:
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO messages_clan (salle, joueur_id, texte, cree_le) VALUES (?, ?, ?, ?) RETURNING id",
            (salle, joueur_id, texte, cree_le),
        )
        return curseur.lastrowid


def messages_du_clan(salle: str, limite: int = 200) -> list:
    """Messages du clan, du plus ancien au plus récent, avec le pseudo de l'auteur."""
    with connexion() as conn:
        return [
            dict(ligne)
            for ligne in conn.execute(
                "SELECT mc.id, mc.salle, mc.joueur_id, j.pseudo, mc.texte, mc.cree_le "
                "FROM messages_clan mc JOIN joueurs j ON j.id = mc.joueur_id "
                "WHERE mc.salle = ? ORDER BY mc.id ASC LIMIT ?",
                (salle, limite),
            )
        ]


# ----- Entraînement : programmes (créés par le joueur, pas de modèles pré-faits) -----

def creer_programme(joueur_id: int, nom: str, cree_le: str,
                    jours: list | None = None,
                    duree_semaines: int | None = None,
                    date_debut: str | None = None) -> int:
    """jours = jours de la semaine prévus pour ce programme (ex. ["lundi", "jeudi"]),
    stockés en JSON — liste vide ou None si l'utilisateur n'en a pas choisi.
    duree_semaines + date_debut = planification sur plusieurs semaines (calendrier),
    tous les deux optionnels (None = programme permanent / non planifié)."""
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO programmes (joueur_id, nom, cree_le, jours, duree_semaines, date_debut) "
            "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
            (joueur_id, nom, cree_le, json.dumps(jours) if jours else None,
             duree_semaines, date_debut),
        )
        return curseur.lastrowid


def ajouter_exercice_programme(programme_id: int, exercice: str, ordre: int,
                               series_cibles: int, reps_cibles: int) -> None:
    with connexion() as conn:
        conn.execute(
            "INSERT INTO programme_exercices (programme_id, exercice, ordre, series_cibles, reps_cibles) "
            "VALUES (?, ?, ?, ?, ?)",
            (programme_id, exercice, ordre, series_cibles, reps_cibles),
        )


def lire_programme(programme_id: int) -> dict | None:
    """Un programme avec la liste ordonnée de ses exercices cibles."""
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM programmes WHERE id = ?", (programme_id,)).fetchone()
        if ligne is None:
            return None
        programme = dict(ligne)
        # Le JSON stocké redevient une vraie liste pour l'app (toujours une
        # liste, jamais None — plus simple à afficher côté front).
        programme["jours"] = json.loads(programme["jours"]) if programme.get("jours") else []
        programme["exercices"] = [
            dict(r) for r in conn.execute(
                "SELECT exercice, ordre, series_cibles, reps_cibles FROM programme_exercices "
                "WHERE programme_id = ? ORDER BY ordre",
                (programme_id,),
            )
        ]
        return programme


def programmes_du_joueur(joueur_id: int) -> list:
    """Les programmes du joueur, les plus récents d'abord."""
    with connexion() as conn:
        ids = [
            r["id"] for r in conn.execute(
                "SELECT id FROM programmes WHERE joueur_id = ? ORDER BY id DESC", (joueur_id,)
            )
        ]
    return [lire_programme(pid) for pid in ids]


def supprimer_programme(programme_id: int) -> None:
    with connexion() as conn:
        conn.execute("DELETE FROM programmes WHERE id = ?", (programme_id,))


def changer_salle(joueur_id: int, salle: str | None) -> None:
    """Change la salle de gym d'un joueur.

    Jusqu'au 01/09/2026 la salle n'existait que CÔTÉ APP (voir CLAUDE.md) :
    la modifier ne changeait rien sur le serveur. Ça ne se voyait pas tant que
    le champ vivait au Profil, mais il a déménagé dans l'onglet Clan — or le
    chat de clan vérifie la salle CÔTÉ SERVEUR. Sans cette fonction, changer
    de salle dans l'app faisait répondre 403 au chat.
    """
    with connexion() as conn:
        conn.execute("UPDATE joueurs SET salle = ? WHERE id = ?", (salle, joueur_id))


def renommer_programme(programme_id: int, nom: str) -> None:
    with connexion() as conn:
        conn.execute("UPDATE programmes SET nom = ? WHERE id = ?", (nom, programme_id))


def remplacer_exercices_programme(programme_id: int, exercices: list) -> None:
    """Remplace TOUTE la liste d'exercices cibles d'un programme (édition des
    séries × reps depuis la semaine type). exercices = [{exercice,
    series_cibles, reps_cibles}, ...] dans l'ordre voulu."""
    with connexion() as conn:
        conn.execute("DELETE FROM programme_exercices WHERE programme_id = ?", (programme_id,))
        for ordre, exo in enumerate(exercices, start=1):
            conn.execute(
                "INSERT INTO programme_exercices (programme_id, exercice, ordre, series_cibles, reps_cibles) "
                "VALUES (?, ?, ?, ?, ?)",
                (programme_id, exo["exercice"], ordre, exo["series_cibles"], exo["reps_cibles"]),
            )


def changer_jours_programme(programme_id: int, jours: list) -> None:
    """Remplace les jours RÉCURRENTS d'un programme (semaine type) — liste vide = aucun jour."""
    with connexion() as conn:
        conn.execute(
            "UPDATE programmes SET jours = ? WHERE id = ?",
            (json.dumps(jours) if jours else None, programme_id),
        )


# ----- Cycles : un programme complet réparti sur la semaine -----

def creer_cycle(joueur_id: int, nom: str, cree_le: str) -> int:
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO cycles (joueur_id, nom, cree_le) VALUES (?, ?, ?) RETURNING id",
            (joueur_id, nom, cree_le),
        )
        return curseur.lastrowid


def rattacher_programme_au_cycle(cycle_id: int, programme_id: int) -> None:
    with connexion() as conn:
        conn.execute(
            "INSERT INTO cycle_programmes (cycle_id, programme_id) VALUES (?, ?) ON CONFLICT (cycle_id, programme_id) DO NOTHING",
            (cycle_id, programme_id),
        )


def lire_cycle(cycle_id: int) -> dict | None:
    """Un cycle avec ses séances (programmes complets, dans l'ordre des jours)."""
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM cycles WHERE id = ?", (cycle_id,)).fetchone()
        if ligne is None:
            return None
        cycle = dict(ligne)
        ids = [
            r["programme_id"]
            for r in conn.execute(
                "SELECT programme_id FROM cycle_programmes WHERE cycle_id = ? ORDER BY id",
                (cycle_id,),
            )
        ]
    seances = [lire_programme(pid) for pid in ids]
    cycle["seances"] = [s for s in seances if s is not None]
    return cycle


def cycles_du_joueur(joueur_id: int) -> list:
    with connexion() as conn:
        ids = [
            r["id"] for r in conn.execute(
                "SELECT id FROM cycles WHERE joueur_id = ? ORDER BY id DESC", (joueur_id,)
            )
        ]
    return [lire_cycle(cid) for cid in ids]


def supprimer_cycle(cycle_id: int, avec_seances: bool = True) -> None:
    """Supprime le cycle. avec_seances=True supprime aussi ses programmes-séances
    (comportement voulu : un cycle et ses séances forment un tout)."""
    with connexion() as conn:
        if avec_seances:
            ids = [
                r["programme_id"]
                for r in conn.execute(
                    "SELECT programme_id FROM cycle_programmes WHERE cycle_id = ?", (cycle_id,)
                )
            ]
            for programme_id in ids:
                conn.execute("DELETE FROM programmes WHERE id = ?", (programme_id,))
        conn.execute("DELETE FROM cycles WHERE id = ?", (cycle_id,))


# ----- Mode test (comptes administrateurs) -----

def creer_joueur_test(pseudo: str, sexe: str, poids: float, salle: str | None,
                      points: int = 0) -> int:
    """Crée un joueur FACTICE (marqué est_test = 1) pour peupler le classement.
    Sans mot de passe : personne ne peut s'y connecter."""
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO joueurs (pseudo, sexe, poids, salle, points, est_test) "
            "VALUES (?, ?, ?, ?, ?, 1) RETURNING id",
            (pseudo, sexe, poids, salle, points),
        )
        return curseur.lastrowid


def supprimer_joueurs_test() -> int:
    """Supprime TOUS les joueurs factices (jamais les vrais comptes).
    Renvoie combien ont été supprimés."""
    with connexion() as conn:
        curseur = conn.execute("DELETE FROM joueurs WHERE est_test = 1")
        return curseur.rowcount


def definir_points(joueur_id: int, points: int) -> None:
    """Fixe les points à une valeur exacte (ajouter_points, lui, incrémente)."""
    with connexion() as conn:
        conn.execute("UPDATE joueurs SET points = ? WHERE id = ?", (points, joueur_id))


def effacer_performances(joueur_id: int) -> int:
    """Efface toutes les perfs d'un joueur — pour repartir de zéro en test."""
    with connexion() as conn:
        curseur = conn.execute("DELETE FROM performances WHERE joueur_id = ?", (joueur_id,))
        return curseur.rowcount


# ----- XP : compteurs d'activité (voir xp.py pour le barème) -----

def nb_jours_actifs(joueur_id: int) -> int:
    """Nombre de JOURS où le joueur s'est entraîné.

    On compte les DATES DISTINCTES, en réunissant les deux traces possibles :
    - `seances` : une durée déclarée depuis le Profil ;
    - `entrainements` : une séance loggée dans l'onglet Entraînement.
    Compter les dates distinctes évite de compter deux fois la même journée
    si les deux traces existent (ce qui arrivera quand les séances du Profil
    seront enfin envoyées au serveur — voir "À faire" dans CLAUDE.md)."""
    with connexion() as conn:
        ligne = conn.execute(
            """SELECT COUNT(*) AS n FROM (
                   SELECT date FROM seances WHERE joueur_id = ?
                   UNION
                   SELECT date FROM entrainements WHERE joueur_id = ?
               )""",
            (joueur_id, joueur_id),
        ).fetchone()
        return ligne["n"] if ligne else 0


def defis_valides_par_type(joueur_id: int) -> dict:
    """{'jour': 3, 'semaine': 1} — combien de défis de chaque type validés."""
    with connexion() as conn:
        return {
            ligne["type"]: ligne["n"]
            for ligne in conn.execute(
                "SELECT type, COUNT(*) AS n FROM defis_valides WHERE joueur_id = ? "
                "GROUP BY type",
                (joueur_id,),
            )
        }


def nb_duels_gagnes(joueur_id: int) -> int:
    with connexion() as conn:
        ligne = conn.execute(
            "SELECT COUNT(*) AS n FROM duels WHERE gagnant_id = ? AND statut = 'termine'",
            (joueur_id,),
        ).fetchone()
        return ligne["n"] if ligne else 0


# ----- Volume : objectifs de séries par groupe musculaire -----

def objectifs_series_du_joueur(joueur_id: int) -> list:
    with connexion() as conn:
        return [
            dict(ligne)
            for ligne in conn.execute(
                "SELECT groupe, series_cibles FROM objectifs_series WHERE joueur_id = ? "
                "ORDER BY groupe",
                (joueur_id,),
            )
        ]


def remplacer_objectifs_series(joueur_id: int, objectifs: list) -> None:
    """Remplace TOUS les objectifs du joueur (liste vide = plus aucun objectif).
    objectifs = [{groupe, series_cibles}, ...]"""
    with connexion() as conn:
        conn.execute("DELETE FROM objectifs_series WHERE joueur_id = ?", (joueur_id,))
        for objectif in objectifs:
            conn.execute(
                "INSERT INTO objectifs_series (joueur_id, groupe, series_cibles) VALUES (?, ?, ?)",
                (joueur_id, objectif["groupe"], objectif["series_cibles"]),
            )


def groupes_exercices_du_joueur(joueur_id: int) -> list:
    with connexion() as conn:
        return [
            dict(ligne)
            for ligne in conn.execute(
                "SELECT exercice, groupe FROM groupes_exercices WHERE joueur_id = ?",
                (joueur_id,),
            )
        ]


def definir_groupe_exercice(joueur_id: int, exercice: str, groupe: str) -> None:
    """Associe (ou réassocie) un exercice à un groupe musculaire."""
    with connexion() as conn:
        conn.execute(
            """INSERT INTO groupes_exercices (joueur_id, exercice, groupe) VALUES (?, ?, ?)
               ON CONFLICT (joueur_id, exercice) DO UPDATE SET groupe = excluded.groupe""",
            (joueur_id, exercice, groupe),
        )


# ----- Planning par date précise (calendrier interactif) -----

def planifier_lot(joueur_id: int, elements: list) -> list:
    """Place PLUSIEURS programmes sur plusieurs dates d'un coup (poser un cycle
    complet type PPL depuis le calendrier). elements = [{date, programme_id}].
    Les doublons (déjà planifiés) sont ignorés silencieusement. Renvoie les
    lignes réellement créées."""
    crees = []
    with connexion() as conn:
        for element in elements:
            curseur = conn.execute(
                "INSERT INTO planning (joueur_id, date, programme_id) VALUES (?, ?, ?) ON CONFLICT (joueur_id, date, programme_id) DO NOTHING RETURNING id",
                (joueur_id, element["date"], element["programme_id"]),
            )
            # PAS `curseur.rowcount` : peu fiable pour un INSERT...RETURNING
            # ignoré par ON CONFLICT DO NOTHING selon le moteur — `lastrowid`
            # (déduit de la ligne RETURNING, voir _CurseurAdapte) dit
            # directement si une ligne a vraiment été créée (None sinon).
            if curseur.lastrowid is not None:
                crees.append({
                    "id": curseur.lastrowid, "joueur_id": joueur_id,
                    "date": element["date"], "programme_id": element["programme_id"],
                })
    return crees


def planifier(joueur_id: int, date_jour: str, programme_id: int) -> int:
    """Place un programme sur une date précise. Peut lever ErreurIntegrite
    si ce programme est déjà planifié ce jour-là (contrainte UNIQUE)."""
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO planning (joueur_id, date, programme_id) VALUES (?, ?, ?) RETURNING id",
            (joueur_id, date_jour, programme_id),
        )
        return curseur.lastrowid


def lire_planification(planning_id: int) -> dict | None:
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM planning WHERE id = ?", (planning_id,)).fetchone()
        return dict(ligne) if ligne else None


def deplanifier(planning_id: int) -> None:
    with connexion() as conn:
        conn.execute("DELETE FROM planning WHERE id = ?", (planning_id,))


def planning_du_joueur(joueur_id: int) -> list:
    """Toutes les planifications par date du joueur, par date croissante."""
    with connexion() as conn:
        return [
            dict(ligne)
            for ligne in conn.execute(
                "SELECT * FROM planning WHERE joueur_id = ? ORDER BY date, id",
                (joueur_id,),
            )
        ]


# ----- Entraînement : journal de séance (workout log) -----

def creer_entrainement(joueur_id: int, programme_id: int | None, jour: str, cree_le: str) -> int:
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO entrainements (joueur_id, programme_id, date, cree_le) VALUES (?, ?, ?, ?) RETURNING id",
            (joueur_id, programme_id, jour, cree_le),
        )
        return curseur.lastrowid


def ajouter_serie(entrainement_id: int, exercice: str, numero_serie: int,
                  reps: int, poids: float) -> None:
    with connexion() as conn:
        conn.execute(
            "INSERT INTO series_journal (entrainement_id, exercice, numero_serie, reps, poids) "
            "VALUES (?, ?, ?, ?, ?)",
            (entrainement_id, exercice, numero_serie, reps, poids),
        )


def lire_entrainement(entrainement_id: int) -> dict | None:
    """Une séance loggée avec toutes ses séries réellement effectuées."""
    with connexion() as conn:
        ligne = conn.execute("SELECT * FROM entrainements WHERE id = ?", (entrainement_id,)).fetchone()
        if ligne is None:
            return None
        entrainement = dict(ligne)
        entrainement["series"] = [
            dict(r) for r in conn.execute(
                "SELECT exercice, numero_serie, reps, poids FROM series_journal "
                "WHERE entrainement_id = ? ORDER BY id",
                (entrainement_id,),
            )
        ]
        return entrainement


def entrainements_du_joueur(joueur_id: int) -> list:
    """Les séances loggées du joueur, les plus récentes d'abord."""
    with connexion() as conn:
        ids = [
            r["id"] for r in conn.execute(
                "SELECT id FROM entrainements WHERE joueur_id = ? ORDER BY date DESC, id DESC",
                (joueur_id,),
            )
        ]
    return [lire_entrainement(eid) for eid in ids]


def dernieres_series_pour_exercice(joueur_id: int, exercice: str, avant_date: str) -> dict | None:
    """Pour la SURCHARGE PROGRESSIVE : les séries du dernier entraînement (avant
    avant_date) où cet exercice a été loggé. None si jamais fait avant cette date."""
    with connexion() as conn:
        ligne = conn.execute(
            "SELECT e.id, e.date FROM entrainements e "
            "JOIN series_journal sj ON sj.entrainement_id = e.id "
            "WHERE e.joueur_id = ? AND sj.exercice = ? AND e.date < ? "
            "ORDER BY e.date DESC, e.id DESC LIMIT 1",
            (joueur_id, exercice, avant_date),
        ).fetchone()
        if ligne is None:
            return None
        series = [
            dict(r) for r in conn.execute(
                "SELECT numero_serie, reps, poids FROM series_journal "
                "WHERE entrainement_id = ? AND exercice = ? ORDER BY numero_serie",
                (ligne["id"], exercice),
            )
        ]
        return {"date": ligne["date"], "series": series}


# ----- Validation sans vidéo n°1 : code partagé avec un partenaire présent -----

def creer_code_validation(joueur_id: int, exercice: str, code: str, cree_le: str) -> int:
    with connexion() as conn:
        curseur = conn.execute(
            "INSERT INTO codes_validation (joueur_id, exercice, code, cree_le) VALUES (?, ?, ?, ?) RETURNING id",
            (joueur_id, exercice, code, cree_le),
        )
        return curseur.lastrowid


def lire_code_validation(code: str) -> dict | None:
    """Le code avec le pseudo du propriétaire de la perf (pour l'affichage côté partenaire)."""
    with connexion() as conn:
        ligne = conn.execute(
            "SELECT cv.*, j.pseudo FROM codes_validation cv "
            "JOIN joueurs j ON j.id = cv.joueur_id WHERE cv.code = ?",
            (code,),
        ).fetchone()
        return dict(ligne) if ligne else None


def valider_code(code_id: int) -> None:
    with connexion() as conn:
        conn.execute("UPDATE codes_validation SET statut = 'validee' WHERE id = ?", (code_id,))


# ----- Validation sans vidéo n°2 : vote communauté sur simple confiance -----

def perfs_declarees_en_attente(exclure_joueur_id: int) -> list:
    """Perfs 'declare' des AUTRES joueurs, SANS vidéo en attente dessus (si une
    vidéo est déjà en attente, on préfère qu'elle serve de base au vote --
    plus rigoureuse qu'un simple vote de confiance)."""
    with connexion() as conn:
        return [
            dict(ligne)
            for ligne in conn.execute(
                "SELECT p.joueur_id, j.pseudo, j.sexe, p.exercice, p.valeur "
                "FROM performances p JOIN joueurs j ON j.id = p.joueur_id "
                "WHERE p.statut = 'declare' AND p.joueur_id != ? "
                "AND NOT EXISTS ("
                "  SELECT 1 FROM preuves_video pv "
                "  WHERE pv.joueur_id = p.joueur_id AND pv.exercice = p.exercice "
                "  AND pv.statut = 'en_attente'"
                ") "
                "ORDER BY p.id DESC",
                (exclure_joueur_id,),
            )
        ]


def enregistrer_vote_perf(joueur_id: int, exercice: str, votant_id: int, valide: bool) -> None:
    """Peut lever ErreurIntegrite si ce votant a déjà voté sur cette perf
    (contrainte UNIQUE) -- à l'appelant de la traduire en erreur HTTP claire."""
    with connexion() as conn:
        conn.execute(
            "INSERT INTO votes_perf_declaree (joueur_id, exercice, votant_id, valide) "
            "VALUES (?, ?, ?, ?)",
            (joueur_id, exercice, votant_id, 1 if valide else 0),
        )
