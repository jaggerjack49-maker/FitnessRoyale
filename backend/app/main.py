"""API Fitness Royale — le « cerveau » du jeu, en Python avec FastAPI.

Lancer le serveur (depuis le dossier backend/) :
    pip install -r requirements.txt
    uvicorn app.main:app --reload --host 0.0.0.0

Documentation interactive automatique : http://localhost:8000/docs
(FastAPI génère une page où tu peux tester chaque endpoint à la main !)
"""

import json
from datetime import date, datetime

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from . import auth
from . import basededonnees as db
from . import defis as regles_defis
from . import duels as regles_duels
from . import videos as regles_videos
from . import xp as regles_xp
from . import modetest
from .baremes import BAREMES, NOMS_LIGUES
from .logique import (
    classer_global,
    classer_par_categories,
    classer_salles,
    cle_salle,
    ligue_joueur,
    nom_salle_affiche,
    palier_exercice,
)

app = FastAPI(title="Fitness Royale API", version="0.2.0")

# CORS : nécessaire pour qu'un frontend web (hébergé sur un AUTRE domaine que
# l'API) puisse l'appeler depuis le navigateur — sans ça, le navigateur bloque
# les requêtes par sécurité. Ouvert à tous les domaines ("*") pour rester
# simple (projet perso, pas de données sensibles à protéger par domaine ;
# l'authentification par token reste la vraie protection). L'app mobile
# (Expo Go, APK) n'est PAS concernée par CORS — seuls les navigateurs
# appliquent cette règle, donc ce middleware ne change rien côté téléphone.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def au_demarrage():
    """Créer les tables de la base au lancement du serveur (+ démo si base vide)."""
    db.initialiser()
    regles_videos.preparer_dossier()
    seed_demo()


def seed_demo():
    """Si la base est VIDE, insérer des joueurs de démo (les mêmes que mockData.js).

    Comme ça, les classements en ligne ne sont jamais vides pour tester l'app.
    """
    if db.lire_tous_les_joueurs():
        return  # la base a déjà des joueurs : on ne touche à rien
    demo = [
        ("IronMax", "homme", 96, "Titan Gym", 520, {
            "Développé couché": (125, "salle"), "Squat": (150, "salle"),
            "Soulevé de terre": (200, "salle"), "Traction prise large": (18, "communaute"),
            "Dips": (38, "communaute"),
        }),
        ("SarahFit", "femme", 58, "Iron Temple", 610, {
            "Développé couché": (47.5, "salle"), "Squat": (72, "salle"),
            "Soulevé de terre": (102, "salle"), "Traction prise large": (12, "communaute"),
            "Dips": (21, "communaute"),
        }),
        ("KenzoLift", "homme", 70, "PowerHouse", 300, {
            "Développé couché": (95, "communaute"), "Squat": (125, "salle"),
            "Soulevé de terre": (165, "salle"), "Traction prise large": (25, "communaute"),
            "Dips": (45, "declare"),
        }),
        ("NoraRun", "femme", 52, "Titan Gym", 150, {
            "Développé couché": (32, "communaute"), "Squat": (55, "salle"),
            "Soulevé de terre": (75, "communaute"), "Traction prise large": (6, "salle"),
            "Dips": (13, "declare"),
        }),
        ("Djibril93", "homme", 82, "PowerHouse", 210, {
            "Développé couché": (85, "salle"), "Squat": (100, "communaute"),
            "Soulevé de terre": (150, "salle"), "Traction prise large": (15, "communaute"),
            "Dips": (30, "salle"),
        }),
    ]
    for pseudo, sexe, poids, salle, points, perfs in demo:
        joueur_id = db.creer_joueur(pseudo, sexe, poids, salle)
        db.ajouter_points(joueur_id, points)
        for exercice, (valeur, statut) in perfs.items():
            db.enregistrer_performance(joueur_id, exercice, valeur, statut)


# ----- Modèles de données (ce que l'API accepte en entrée) -----

class Inscription(BaseModel):
    pseudo: str = Field(min_length=2, max_length=30)
    mot_de_passe: str = Field(min_length=4, max_length=100)
    sexe: str = Field(pattern="^(homme|femme)$")
    poids: float = Field(gt=30, lt=300)
    salle: str | None = None


class Connexion(BaseModel):
    pseudo: str
    mot_de_passe: str


class ChangerMotDePasse(BaseModel):
    ancien_mot_de_passe: str
    nouveau_mot_de_passe: str = Field(min_length=4, max_length=100)


class MotDePasseOublie(BaseModel):
    pseudo: str
    code_recuperation: str = Field(min_length=4, max_length=20)
    nouveau_mot_de_passe: str = Field(min_length=4, max_length=100)


class NouvellePerformance(BaseModel):
    exercice: str
    valeur: float = Field(gt=0)
    # Une perf commence toujours 'declare' — la vérification vient après.


class Verification(BaseModel):
    statut: str = Field(pattern="^(communaute|salle)$")


class NouveauDuel(BaseModel):
    recompense: int = Field(default=100, gt=0, le=1000)


class RejoindreDuel(BaseModel):
    code: str = Field(min_length=4, max_length=10)


class ChoixExercice(BaseModel):
    exercice: str
    charge: float = Field(gt=0)


class MesReps(BaseModel):
    reps: int = Field(ge=0, le=500)


class NouvelleSeance(BaseModel):
    minutes: int = Field(gt=0, lt=600)
    date: str | None = None  # 'AAAA-MM-JJ' — par défaut : aujourd'hui


class VoteVideo(BaseModel):
    valide: bool


class RejoindreValidation(BaseModel):
    code: str = Field(min_length=4, max_length=10)


class VotePerf(BaseModel):
    valide: bool


class NouveauMessage(BaseModel):
    texte: str = Field(min_length=1, max_length=500)


class ExerciceProgramme(BaseModel):
    exercice: str = Field(min_length=1, max_length=100)
    series_cibles: int = Field(gt=0, le=20)
    reps_cibles: int = Field(gt=0, le=100)


# Les jours acceptés pour un programme (toujours en minuscules).
JOURS_SEMAINE = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]

# Les groupes musculaires acceptés pour les objectifs de volume.
# DOIT rester identique à `groupesMusculaires` dans src/data/groupesMusculaires.js.
GROUPES_MUSCULAIRES = [
    "Pectoraux", "Dos", "Épaules", "Biceps", "Triceps",
    "Quadriceps", "Ischio-jambiers", "Fessiers", "Mollets",
    "Abdos", "Avant-bras", "Cardio",
]


class NouveauProgramme(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    exercices: list[ExerciceProgramme] = Field(min_length=1)
    # Jours de la semaine prévus (optionnel), ex. ["lundi", "jeudi"].
    jours: list[str] = Field(default_factory=list, max_length=7)
    # Planification sur plusieurs semaines (calendrier) — tous deux optionnels.
    duree_semaines: int | None = Field(default=None, gt=0, le=52)
    date_debut: str | None = None  # 'AAAA-MM-JJ'


class JoursProgramme(BaseModel):
    jours: list[str] = Field(default_factory=list, max_length=7)


class NouvellePlanification(BaseModel):
    date: str  # 'AAAA-MM-JJ'
    programme_id: int


class LotPlanification(BaseModel):
    # Placement groupé (cycle complet type PPL) : jusqu'à 200 dates d'un coup.
    elements: list[NouvellePlanification] = Field(min_length=1, max_length=200)


class ExercicesProgramme(BaseModel):
    exercices: list[ExerciceProgramme] = Field(min_length=1)


class NomProgramme(BaseModel):
    nom: str = Field(min_length=1, max_length=100)


class SeanceOfficielle(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    jours: list[str] = []
    exercices: list[ExerciceProgramme] = []


class ProgrammeOfficiel(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    seances: list[SeanceOfficielle] = Field(min_length=1)


class RenommageExercice(BaseModel):
    nouveau: str = Field(min_length=1, max_length=100)


class SalleJoueur(BaseModel):
    # Chaîne vide autorisée = « je quitte ma salle » (stockée NULL).
    salle: str = Field(default="", max_length=100)


class SeanceCycle(BaseModel):
    """Une séance d'un cycle : le ou les jours où elle se fait + ses exercices.

    Une même séance peut revenir plusieurs fois dans la semaine (ex. « Push »
    le lundi ET le jeudi dans un PPL 6 jours)."""
    jours: list[str] = Field(min_length=1, max_length=7)
    nom: str = Field(min_length=1, max_length=100)
    exercices: list[ExerciceProgramme] = Field(min_length=1)


class RemplirPerfs(BaseModel):
    # 0 = aucune perf, 1 = Bronze … 6 = Royal (ramené au max du barème).
    palier: int = Field(ge=0, le=6)
    # Sur combien d'exercices (None = tout le barème). Levier clé pour tester
    # le classement : la moyenne se calcule sur TOUS les exercices du barème.
    nb_exercices: int | None = Field(default=None, ge=0, le=30)


class FixerPoints(BaseModel):
    points: int = Field(ge=0, le=100000)


class GenererJoueurs(BaseModel):
    nombre: int = Field(gt=0, le=50)
    palier_min: int = Field(default=1, ge=1, le=6)
    palier_max: int = Field(default=6, ge=1, le=6)
    sexe: str = Field(default="homme", pattern="^(homme|femme)$")
    salle: str | None = None


class ObjectifSeries(BaseModel):
    groupe: str
    series_cibles: int = Field(gt=0, le=100)


class ObjectifsSeries(BaseModel):
    objectifs: list[ObjectifSeries] = Field(default_factory=list, max_length=30)


class GroupeExercice(BaseModel):
    groupe: str


class NouveauCycle(BaseModel):
    nom: str = Field(min_length=1, max_length=100)
    seances: list[SeanceCycle] = Field(min_length=1, max_length=7)


class SerieLoggee(BaseModel):
    exercice: str = Field(min_length=1, max_length=100)
    numero_serie: int = Field(gt=0, le=50)
    reps: int = Field(gt=0, le=200)
    poids: float = Field(ge=0, le=500)


class NouvelEntrainement(BaseModel):
    programme_id: int | None = None
    date: str | None = None  # 'AAAA-MM-JJ' — par défaut : aujourd'hui
    series: list[SerieLoggee] = Field(min_length=1)


# ----- Endpoints -----

@app.get("/")
def accueil():
    return {"app": "Fitness Royale", "slogan": "FIGHT FOR IT", "ligues": NOMS_LIGUES}


@app.get("/bareme/{sexe}")
def bareme(sexe: str):
    """Le barème Fitness Royale complet pour un sexe donné."""
    if sexe not in BAREMES:
        raise HTTPException(404, "Sexe inconnu : utilise 'homme' ou 'femme'.")
    return BAREMES[sexe]


@app.post("/auth/inscription", status_code=201)
def inscription(donnees: Inscription):
    """Crée un compte : pseudo + mot de passe (hashé, jamais stocké en clair).

    Renvoie un token à garder côté app (en-tête "Authorization: Bearer <token>"
    sur les prochains appels) — voir src/api.js et backend/app/auth.py."""
    if db.lire_joueur_par_pseudo(donnees.pseudo):
        raise HTTPException(409, "Ce pseudo est déjà pris.")
    hash_mdp = auth.hacher_mot_de_passe(donnees.mot_de_passe)
    # Espaces normalisés dès l'entrée : une salle saisie « Iron Temple  »
    # ne doit pas former un clan à part (voir logique.cle_salle).
    salle = nom_salle_affiche(donnees.salle) or None
    joueur_id = db.creer_joueur(donnees.pseudo, donnees.sexe, donnees.poids, salle, hash_mdp)
    # CODE DE SECOURS ("mot de passe oublié") : généré à l'inscription et
    # renvoyé EN CLAIR UNE SEULE FOIS — l'app l'affiche pour que le joueur le
    # note. Côté base, seul son hash est stocké (comme un mot de passe) :
    # impossible de le réafficher plus tard, seulement d'en regénérer un autre.
    code_recuperation = regles_duels.generer_code(8)
    db.definir_code_recuperation(joueur_id, auth.hacher_mot_de_passe(code_recuperation))
    token = auth.creer_session_pour(joueur_id)
    return {"token": token, "joueur": db.lire_joueur(joueur_id),
            "code_recuperation": code_recuperation}


@app.post("/auth/connexion")
def connexion(donnees: Connexion):
    """Vérifie pseudo + mot de passe, renvoie un nouveau token de session."""
    joueur = db.lire_joueur_par_pseudo(donnees.pseudo)
    if joueur is None or not auth.verifier_mot_de_passe(donnees.mot_de_passe, joueur.get("mot_de_passe_hash")):
        raise HTTPException(401, "Pseudo ou mot de passe incorrect.")
    token = auth.creer_session_pour(joueur["id"])
    return {"token": token, "joueur": db.lire_joueur(joueur["id"])}


@app.post("/auth/deconnexion")
def deconnexion(authorization: str | None = Header(default=None)):
    """Supprime la session : le token utilisé ne sera plus valide après ça."""
    if authorization and authorization.startswith("Bearer "):
        db.supprimer_session(authorization.removeprefix("Bearer ").strip())
    return {"deconnecte": True}


@app.get("/auth/moi")
def moi(courant: dict = Depends(auth.utilisateur_courant)):
    """Le profil du joueur connecté (à partir du token) — utilisé au démarrage de l'app."""
    courant["ligue"] = ligue_joueur(courant)
    courant["xp"] = regles_xp.xp_totale(courant["id"])
    return courant


@app.get("/joueurs/{joueur_id}/xp")
def xp_du_joueur(joueur_id: int):
    """L'XP du joueur et son détail par source.

    RAPPEL : l'XP ne change NI l'arène, NI la ligue, NI le classement — elle
    mesure l'activité (séances, défis, duels gagnés) et alimentera l'Arena
    Pass. Voir backend/app/xp.py et docs/VISION_ARENA_PASS.md."""
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return regles_xp.detail_xp(joueur_id)


@app.post("/auth/changer-mot-de-passe")
def changer_mot_de_passe(donnees: ChangerMotDePasse,
                         courant: dict = Depends(auth.utilisateur_courant)):
    """Change le mot de passe du joueur CONNECTÉ (l'ancien est exigé en plus du
    token : si quelqu'un met la main sur un téléphone déverrouillé, il ne peut
    pas s'approprier le compte en changeant le mot de passe)."""
    complet = db.lire_joueur_par_pseudo(courant["pseudo"])
    if not auth.verifier_mot_de_passe(donnees.ancien_mot_de_passe, complet.get("mot_de_passe_hash")):
        raise HTTPException(403, "Ancien mot de passe incorrect.")
    db.changer_mot_de_passe(courant["id"], auth.hacher_mot_de_passe(donnees.nouveau_mot_de_passe))
    return {"change": True}


@app.post("/auth/code-recuperation", status_code=201)
def regenerer_code_recuperation(courant: dict = Depends(auth.utilisateur_courant)):
    """(Re)génère le code de secours du joueur connecté — affiché UNE SEULE fois
    par l'app. L'ancien code (s'il existait) ne marche plus après ça."""
    code = regles_duels.generer_code(8)
    db.definir_code_recuperation(courant["id"], auth.hacher_mot_de_passe(code))
    return {"code_recuperation": code}


@app.post("/auth/mot-de-passe-oublie")
def mot_de_passe_oublie(donnees: MotDePasseOublie):
    """Réinitialise le mot de passe avec le CODE DE SECOURS (pas de connexion
    requise — c'est justement pour ceux qui ne peuvent plus se connecter).

    Le code est à USAGE UNIQUE : consommé ici, il faut en regénérer un autre
    (une fois reconnecté) pour être couvert la prochaine fois. Toutes les
    sessions existantes sont supprimées (déconnexion partout), puis une
    nouvelle est ouverte — la réponse a la même forme que /auth/connexion."""
    joueur = db.lire_joueur_par_pseudo(donnees.pseudo)
    code = donnees.code_recuperation.strip().upper()
    if joueur is None or not auth.verifier_mot_de_passe(code, joueur.get("code_recuperation_hash")):
        raise HTTPException(401, "Pseudo ou code de secours incorrect.")
    db.changer_mot_de_passe(joueur["id"], auth.hacher_mot_de_passe(donnees.nouveau_mot_de_passe))
    db.definir_code_recuperation(joueur["id"], None)
    db.supprimer_sessions_du_joueur(joueur["id"])
    token = auth.creer_session_pour(joueur["id"])
    return {"token": token, "joueur": db.lire_joueur(joueur["id"])}


@app.get("/joueurs")
def liste_joueurs():
    return db.lire_tous_les_joueurs()


@app.get("/joueurs/{joueur_id}")
def detail_joueur(joueur_id: int):
    joueur = db.lire_joueur(joueur_id)
    if joueur is None:
        raise HTTPException(404, "Joueur introuvable.")
    joueur["ligue"] = ligue_joueur(joueur)
    return joueur


@app.post("/joueurs/{joueur_id}/performances", status_code=201)
def ajouter_performance(joueur_id: int, perf: NouvellePerformance,
                        courant: dict = Depends(auth.utilisateur_courant)):
    """Connexion requise : on ne peut ajouter une perf qu'à SON PROPRE profil."""
    auth.verifier_proprietaire(courant, joueur_id)
    joueur = db.lire_joueur(joueur_id)
    if joueur is None:
        raise HTTPException(404, "Joueur introuvable.")
    if perf.exercice not in BAREMES[joueur["sexe"]]:
        raise HTTPException(400, f"Exercice inconnu : {perf.exercice}")
    db.enregistrer_performance(joueur_id, perf.exercice, perf.valeur, "declare")
    return {
        "exercice": perf.exercice,
        "valeur": perf.valeur,
        "statut": "declare",
        "palier": palier_exercice(joueur["sexe"], perf.exercice, perf.valeur),
        "rappel": "Perf déclarée : fais-la vérifier pour qu'elle compte au classement.",
    }


@app.post("/joueurs/{joueur_id}/performances/{exercice}/verifier")
def verifier_performance(joueur_id: int, exercice: str, verif: Verification,
                         courant: dict = Depends(auth.utilisateur_courant)):
    """Vérification communauté (vidéo validée) ou salle (partenaire).

    Connexion requise. Interdiction de valider SA PROPRE performance par la
    COMMUNAUTÉ (ça n'a de sens que si c'est quelqu'un d'autre qui valide).
    La vérification "salle" reste auto-appliquée par l'utilisateur affilié
    (simulation du partenariat salle — pas de vrai compte "salle" pour
    l'instant, voir décision dans CLAUDE.md)."""
    # EXCEPTION MODE TEST : un compte administrateur peut valider ses propres
    # perfs (voir modetest.py). Sans ça, tester le classement obligerait à
    # jongler entre deux comptes pour chaque perf saisie à la main.
    if verif.statut == "communaute" and courant["id"] == joueur_id and not courant.get("admin"):
        raise HTTPException(403, "Tu ne peux pas valider ta propre performance par la communauté.")
    if not db.changer_statut_performance(joueur_id, exercice, verif.statut):
        raise HTTPException(404, "Performance introuvable.")
    return {"exercice": exercice, "statut": verif.statut}


@app.get("/classement/global")
def classement_global():
    """Tout le monde, classé par rang (palier moyen interne, points en départage)."""
    return classer_global(db.lire_tous_les_joueurs())


@app.get("/classement/poids")
def classement_par_poids():
    """Par catégories de poids : -60 / -70 / -80 / -90 / +90 kg."""
    return classer_par_categories(db.lire_tous_les_joueurs())


@app.get("/classement/salles")
def classement_salles():
    """Le classement des salles (clans)."""
    return classer_salles(db.lire_tous_les_joueurs())


@app.get("/sante")
def sante():
    """Petit endpoint que l'app appelle pour savoir si le serveur répond."""
    return {"statut": "ok"}


# ----- Duels BO3 en ligne (charge fixe, le plus de reps gagne, premier à 2 victoires) -----
# Flux : challenger crée (POST /duels/creer) → reçoit un CODE à partager →
# adversaire rejoint avec ce code (POST /duels/rejoindre) → chacun joue son
# tour depuis SON téléphone (choisir-exercice / mes-reps), synchronisé par le
# serveur. Pas de WebSocket pour l'instant : l'app doit re-consulter
# GET /duels/{id} de temps en temps pour voir les coups de l'adversaire.

def _duel_ou_404(duel_id: int) -> dict:
    duel = db.lire_duel(duel_id)
    if duel is None:
        raise HTTPException(404, "Duel introuvable.")
    return duel


def _round_ou_404(duel: dict, numero: int) -> dict:
    for round_ in duel["rounds"]:
        if round_["numero"] == numero:
            return round_
    raise HTTPException(400, "Numéro de round invalide (1, 2 ou 3).")


def _resoudre_duel(duel_id: int) -> dict:
    """Après une soumission de reps : si quelqu'un a 2 victoires, le duel se
    termine et le vainqueur touche la récompense (points de compétition)."""
    duel = db.lire_duel(duel_id)
    gagnant = regles_duels.gagnant_duel(duel["rounds"])
    if gagnant and duel["statut"] == "en_cours":
        gagnant_id = (
            duel["challenger_id"] if gagnant == "challenger" else duel["adversaire_id"]
        )
        db.terminer_duel(duel_id, gagnant_id)
        db.ajouter_points(gagnant_id, duel["recompense"])
        duel = db.lire_duel(duel_id)
    return duel


@app.post("/duels/creer", status_code=201)
def creer_duel(nouveau: NouveauDuel, courant: dict = Depends(auth.utilisateur_courant)):
    """Crée un duel EN ATTENTE avec un code à partager (ex. 'K7XPQR')."""
    for _ in range(5):  # au cas (très rare) où le code tiré existerait déjà
        code = regles_duels.generer_code()
        try:
            duel_id = db.creer_duel_en_attente(courant["id"], nouveau.recompense, code)
            return db.lire_duel(duel_id)
        except Exception:
            continue
    raise HTTPException(500, "Impossible de générer un code unique, réessaie.")


@app.post("/duels/rejoindre")
def rejoindre_duel(donnees: RejoindreDuel, courant: dict = Depends(auth.utilisateur_courant)):
    """L'adversaire rejoint un duel en attente grâce à son code."""
    duel = db.lire_duel_par_code(donnees.code.strip().upper())
    if duel is None or duel["statut"] != "en_attente":
        raise HTTPException(404, "Code de duel invalide, déjà utilisé, ou duel déjà rejoint.")
    if duel["challenger_id"] == courant["id"]:
        raise HTTPException(400, "Tu ne peux pas rejoindre ton propre duel !")
    db.rejoindre_duel(duel["id"], courant["id"])
    return db.lire_duel(duel["id"])


@app.get("/duels/{duel_id}")
def detail_duel(duel_id: int):
    return _duel_ou_404(duel_id)


@app.get("/joueurs/{joueur_id}/duels")
def duels_du_joueur(joueur_id: int):
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.duels_du_joueur(joueur_id)


@app.post("/duels/{duel_id}/rounds/{numero}/choisir-exercice")
def choisir_exercice(duel_id: int, numero: int, choix: ChoixExercice,
                     courant: dict = Depends(auth.utilisateur_courant)):
    """Round 1 ou 2 : SEUL celui dont c'est le tour choisit l'exercice
    (R1 = challenger, R2 = adversaire) — pas l'IA, voir /tirer-ia pour le round 3.
    Rejouable si le round précédent était à égalité (reps remises à zéro)."""
    duel = _duel_ou_404(duel_id)
    if duel["statut"] != "en_cours":
        raise HTTPException(400, "Ce duel n'est pas en cours (en attente d'adversaire, ou déjà terminé).")
    if numero not in (1, 2):
        raise HTTPException(400, "Le round 3 (départage) est tiré par l'IA — voir /tirer-ia.")
    qui_doit_choisir = duel["challenger_id"] if numero == 1 else duel["adversaire_id"]
    if courant["id"] != qui_doit_choisir:
        raise HTTPException(403, "Ce n'est pas à toi de choisir l'exercice de ce round.")
    round_ = _round_ou_404(duel, numero)
    if regles_duels.round_verrouille(round_):
        raise HTTPException(400, "Ce round a déjà un résultat décisif — impossible de le rechoisir.")
    challenger = db.lire_joueur(duel["challenger_id"])
    if choix.exercice not in BAREMES[challenger["sexe"]]:
        raise HTTPException(400, f"Exercice inconnu : {choix.exercice}")
    db.choisir_exercice_round(duel_id, numero, choix.exercice, choix.charge)
    return db.lire_duel(duel_id)


@app.post("/duels/{duel_id}/rounds/3/tirer-ia")
def tirer_ia_departage(duel_id: int, courant: dict = Depends(auth.utilisateur_courant)):
    """Round 3 (départage) : l'IA choisit l'exercice (charge Bronze, accessible
    aux deux). N'importe lequel des 2 joueurs peut déclencher le tirage."""
    duel = _duel_ou_404(duel_id)
    if duel["statut"] != "en_cours":
        raise HTTPException(400, "Ce duel n'est pas en cours.")
    if courant["id"] not in (duel["challenger_id"], duel["adversaire_id"]):
        raise HTTPException(403, "Tu ne participes pas à ce duel.")
    round_3 = _round_ou_404(duel, 3)
    if regles_duels.round_verrouille(round_3):
        raise HTTPException(400, "Le départage a déjà un résultat décisif.")
    rounds_1_2 = [r for r in duel["rounds"] if r["numero"] in (1, 2)]
    if any(r["reps_challenger"] is None or r["reps_adversaire"] is None for r in rounds_1_2):
        raise HTTPException(400, "Joue d'abord les rounds 1 et 2 avant le départage.")
    challenger = db.lire_joueur(duel["challenger_id"])
    choix = regles_duels.exercice_aleatoire_ia(challenger["sexe"])
    db.choisir_exercice_round(duel_id, 3, choix["exercice"], choix["charge"])
    return db.lire_duel(duel_id)


@app.post("/duels/{duel_id}/rounds/{numero}/commencer")
def commencer_round(duel_id: int, numero: int, courant: dict = Depends(auth.utilisateur_courant)):
    """Signale que JE commence ma série sur ce round — l'adversaire voit alors
    un chrono en direct de son côté (voir "Statut en direct des duels" dans
    CLAUDE.md). Pas de vérification vidéo, juste une présence en temps réel."""
    duel = _duel_ou_404(duel_id)
    if duel["statut"] != "en_cours":
        raise HTTPException(400, "Ce duel n'est pas en cours.")
    if courant["id"] == duel["challenger_id"]:
        cote = "challenger"
    elif courant["id"] == duel["adversaire_id"]:
        cote = "adversaire"
    else:
        raise HTTPException(403, "Tu ne participes pas à ce duel.")
    round_ = _round_ou_404(duel, numero)
    if round_["exercice"] is None:
        raise HTTPException(400, "L'exercice de ce round n'a pas encore été choisi.")
    db.demarrer_round(duel_id, numero, cote, datetime.now().isoformat(timespec="milliseconds"))
    return db.lire_duel(duel_id)


@app.post("/duels/{duel_id}/rounds/{numero}/mes-reps")
def mes_reps(duel_id: int, numero: int, donnees: MesReps,
            courant: dict = Depends(auth.utilisateur_courant)):
    """Chaque joueur soumet SES PROPRES reps pour le round (indépendamment de
    l'autre) — c'est ici que la synchronisation à 2 téléphones se joue."""
    duel = _duel_ou_404(duel_id)
    if duel["statut"] != "en_cours":
        raise HTTPException(400, "Ce duel n'est pas en cours.")
    if courant["id"] == duel["challenger_id"]:
        cote = "challenger"
    elif courant["id"] == duel["adversaire_id"]:
        cote = "adversaire"
    else:
        raise HTTPException(403, "Tu ne participes pas à ce duel.")
    round_ = _round_ou_404(duel, numero)
    if round_["exercice"] is None:
        raise HTTPException(400, "L'exercice de ce round n'a pas encore été choisi.")
    if regles_duels.round_verrouille(round_):
        raise HTTPException(400, "Ce round est déjà décidé.")
    db.enregistrer_mes_reps(duel_id, numero, cote, donnees.reps)
    return _resoudre_duel(duel_id)


# ----- Séances (elles servent à valider les défis avec de vraies dates) -----

@app.post("/joueurs/{joueur_id}/seances", status_code=201)
def ajouter_seance(joueur_id: int, seance: NouvelleSeance,
                   courant: dict = Depends(auth.utilisateur_courant)):
    auth.verifier_proprietaire(courant, joueur_id)
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    jour = seance.date or date.today().isoformat()
    try:
        date.fromisoformat(jour)
    except ValueError:
        raise HTTPException(400, "Date invalide : utilise le format AAAA-MM-JJ.")
    db.ajouter_seance(joueur_id, jour, seance.minutes)
    return {"date": jour, "minutes": seance.minutes}


@app.get("/joueurs/{joueur_id}/seances")
def seances_du_joueur(joueur_id: int):
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.seances_du_joueur(joueur_id)


# ----- Défis récurrents (journalier / hebdomadaire) -----

@app.get("/joueurs/{joueur_id}/defis")
def etat_des_defis(joueur_id: int):
    """L'état des 2 défis : réussi ? déjà validé aujourd'hui / cette semaine ?"""
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    seances = db.seances_du_joueur(joueur_id)
    aujourdhui = date.today()
    etats = []
    for type_defi, defi in regles_defis.DEFIS.items():
        if type_defi == "jour":
            periode = regles_defis.periode_jour(aujourdhui)
            reussi = regles_defis.defi_jour_reussi(seances, aujourdhui)
        else:
            periode = regles_defis.periode_semaine(aujourdhui)
            reussi = regles_defis.defi_semaine_reussi(seances, aujourdhui)
        etats.append({
            **defi,
            "reussi": reussi,
            "deja_valide": db.defi_deja_valide(joueur_id, type_defi, periode),
        })
    return etats


@app.post("/joueurs/{joueur_id}/defis/{type_defi}/valider")
def valider_defi(joueur_id: int, type_defi: str,
                 courant: dict = Depends(auth.utilisateur_courant)):
    """Valide un défi si les VRAIES conditions sont remplies (séances + dates).

    Récompense : points, et le titre pour le défi de la semaine."""
    auth.verifier_proprietaire(courant, joueur_id)
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    if type_defi not in regles_defis.DEFIS:
        raise HTTPException(404, "Défi inconnu : utilise 'jour' ou 'semaine'.")
    defi = regles_defis.DEFIS[type_defi]
    seances = db.seances_du_joueur(joueur_id)
    aujourdhui = date.today()
    if type_defi == "jour":
        periode = regles_defis.periode_jour(aujourdhui)
        reussi = regles_defis.defi_jour_reussi(seances, aujourdhui)
        message_echec = "Pas encore : enregistre une séance d'au moins 30 minutes aujourd'hui."
    else:
        periode = regles_defis.periode_semaine(aujourdhui)
        reussi = regles_defis.defi_semaine_reussi(seances, aujourdhui)
        message_echec = "Pas encore : il faut 4 séances enregistrées cette semaine."
    if db.defi_deja_valide(joueur_id, type_defi, periode):
        raise HTTPException(409, "Défi déjà validé pour cette période.")
    if not reussi:
        raise HTTPException(400, message_echec)
    db.enregistrer_defi(joueur_id, type_defi, periode, defi["points"], defi["titre_recompense"])
    db.ajouter_points(joueur_id, defi["points"])
    return {
        "valide": True,
        "points": defi["points"],
        "titre": defi["titre_recompense"],
        "periode": periode,
    }


# ----- Preuves vidéo (upload + vote communauté) -----
# Flux : le joueur joint une vidéo à sa perf (encore "declare") → elle attend
# un vote → le PREMIER autre joueur qui vote décide : valider fait vraiment
# passer la perf en "communaute" (compte au classement), refuser clôt cette
# tentative (le joueur peut réessayer avec une nouvelle vidéo).

@app.post("/joueurs/{joueur_id}/performances/{exercice}/video", status_code=201)
async def joindre_video(joueur_id: int, exercice: str, fichier: UploadFile = File(...),
                        courant: dict = Depends(auth.utilisateur_courant)):
    """Upload d'une vidéo pour prouver SA PROPRE perf (connexion + propriété requises)."""
    auth.verifier_proprietaire(courant, joueur_id)
    joueur = db.lire_joueur(joueur_id)
    if joueur is None:
        raise HTTPException(404, "Joueur introuvable.")
    if exercice not in joueur["performances"]:
        raise HTTPException(404, "Ajoute d'abord cette performance avant d'y joindre une vidéo.")
    extension = regles_videos.extension_valide(fichier.filename)
    if extension is None:
        raise HTTPException(400, "Format de vidéo non supporté (utilise .mp4, .mov, .m4v, .avi ou .webm).")
    contenu = await fichier.read()
    if len(contenu) > regles_videos.TAILLE_MAX_OCTETS:
        raise HTTPException(413, "Vidéo trop lourde (50 Mo maximum).")
    nom_fichier = regles_videos.nouveau_nom_fichier(extension)
    regles_videos.chemin_video(nom_fichier).write_bytes(contenu)
    video_id = db.creer_preuve_video(joueur_id, exercice, nom_fichier, datetime.now().isoformat(timespec="milliseconds"))
    return db.lire_video(video_id)


@app.get("/videos/en-attente")
def videos_en_attente(courant: dict = Depends(auth.utilisateur_courant)):
    """Vidéos des AUTRES joueurs en attente d'un vote (jamais les tiennes)."""
    return db.videos_en_attente(courant["id"])


@app.get("/videos/{video_id}/fichier")
def fichier_video(video_id: int):
    """Sert le fichier vidéo lui-même (pour le lire dans l'app)."""
    video = db.lire_video(video_id)
    if video is None:
        raise HTTPException(404, "Vidéo introuvable.")
    chemin = regles_videos.chemin_video(video["fichier"])
    if not chemin.exists():
        raise HTTPException(404, "Fichier vidéo introuvable sur le serveur.")
    return FileResponse(chemin)


@app.post("/videos/{video_id}/voter")
def voter_video(video_id: int, vote: VoteVideo, courant: dict = Depends(auth.utilisateur_courant)):
    """Le PREMIER vote décide (valider ou refuser) — voir videos.py pour la règle."""
    video = db.lire_video(video_id)
    if video is None:
        raise HTTPException(404, "Vidéo introuvable.")
    if video["statut"] != "en_attente":
        raise HTTPException(400, "Cette vidéo a déjà été tranchée.")
    if video["joueur_id"] == courant["id"]:
        raise HTTPException(403, "Tu ne peux pas voter sur ta propre vidéo.")
    db.enregistrer_vote(video_id, courant["id"], vote.valide)
    if vote.valide:
        db.resoudre_video(video_id, "validee")
        db.changer_statut_performance(video["joueur_id"], video["exercice"], "communaute")
    else:
        db.resoudre_video(video_id, "refusee")
    # AUCUNE vidéo n'est conservée après son vote (validée ou refusée) —
    # décision de Hafiz du 20/08/2026. Le fichier disparaît du disque ; la
    # ligne `preuves_video` reste (trace du statut), mais /fichier renverra
    # désormais 404.
    regles_videos.supprimer_fichier(video["fichier"])
    return db.lire_video(video_id)


# ----- Validation SANS VIDÉO n°1 : code partagé avec un partenaire présent -----
# Flux : le joueur génère un code pour SA perf déclarée (comme un duel en
# ligne) et le partage verbalement à un partenaire de salle PRÉSENT au moment
# de la perf. Le partenaire saisit ce code sur SON téléphone -> la perf passe
# directement en "salle". Aucune preuve formelle, mais ça exige que les deux
# soient vraiment ensemble (voir "À faire" : vrai système de salle partenaire).

@app.post("/joueurs/{joueur_id}/performances/{exercice}/code-validation", status_code=201)
def creer_code_validation(joueur_id: int, exercice: str,
                          courant: dict = Depends(auth.utilisateur_courant)):
    """Génère un code à usage unique pour faire valider SA PROPRE perf par un partenaire présent."""
    auth.verifier_proprietaire(courant, joueur_id)
    joueur = db.lire_joueur(joueur_id)
    if joueur is None:
        raise HTTPException(404, "Joueur introuvable.")
    perf = joueur["performances"].get(exercice)
    if perf is None:
        raise HTTPException(404, "Ajoute d'abord cette performance.")
    if perf["statut"] != "declare":
        raise HTTPException(400, "Cette performance est déjà vérifiée.")
    for _ in range(5):  # au cas (très rare) où le code tiré existerait déjà
        code = regles_duels.generer_code()
        try:
            db.creer_code_validation(joueur_id, exercice, code, datetime.now().isoformat(timespec="milliseconds"))
            return {"code": code, "exercice": exercice}
        except db.ErreurIntegrite:
            continue
    raise HTTPException(500, "Impossible de générer un code unique, réessaie.")


@app.post("/validations/rejoindre")
def rejoindre_validation(rejoindre: RejoindreValidation, courant: dict = Depends(auth.utilisateur_courant)):
    """Le PARTENAIRE saisit le code : confirme la perf en direct (statut 'salle')."""
    validation = db.lire_code_validation(rejoindre.code.strip().upper())
    if validation is None:
        raise HTTPException(404, "Code introuvable.")
    if validation["statut"] != "en_attente":
        raise HTTPException(400, "Ce code a déjà été utilisé.")
    if validation["joueur_id"] == courant["id"]:
        raise HTTPException(403, "Tu ne peux pas valider ta propre performance.")
    db.valider_code(validation["id"])
    db.changer_statut_performance(validation["joueur_id"], validation["exercice"], "salle")
    return {
        "pseudo": validation["pseudo"],
        "exercice": validation["exercice"],
        "statut": "salle",
    }


# ----- Validation SANS VIDÉO n°2 : vote communauté sur simple confiance -----
# Même règle "premier vote décide" que pour les vidéos (voir plus haut), mais
# sans preuve jointe -- juste la confiance d'un autre joueur. Une perf qui a
# déjà une vidéo en attente n'apparaît PAS ici (voir basededonnees.py :
# on préfère que le vote se base sur la vidéo, plus rigoureuse, si elle existe).

@app.get("/performances/a-valider-sans-video")
def performances_a_valider_sans_video(courant: dict = Depends(auth.utilisateur_courant)):
    """Perfs déclarées des AUTRES joueurs, en attente d'un vote de confiance (sans vidéo)."""
    return db.perfs_declarees_en_attente(courant["id"])


@app.post("/joueurs/{joueur_id}/performances/{exercice}/voter-sans-video")
def voter_sans_video(joueur_id: int, exercice: str, vote: VotePerf,
                     courant: dict = Depends(auth.utilisateur_courant)):
    """Vote de confiance (sans vidéo) sur la perf déclarée d'un AUTRE joueur."""
    if courant["id"] == joueur_id:
        raise HTTPException(403, "Tu ne peux pas voter sur ta propre performance.")
    joueur = db.lire_joueur(joueur_id)
    if joueur is None:
        raise HTTPException(404, "Joueur introuvable.")
    perf = joueur["performances"].get(exercice)
    if perf is None or perf["statut"] != "declare":
        raise HTTPException(400, "Cette performance n'est plus en attente de vote.")
    try:
        db.enregistrer_vote_perf(joueur_id, exercice, courant["id"], vote.valide)
    except db.ErreurIntegrite:
        raise HTTPException(409, "Tu as déjà voté sur cette performance.")
    if vote.valide:
        db.changer_statut_performance(joueur_id, exercice, "communaute")
    return {"exercice": exercice, "statut": "communaute" if vote.valide else "declare"}


# ----- Chat de clan (par salle) -----
# Chaque salle de gym = un clan. Réservé aux MEMBRES (joueur.salle == la salle
# du chat) : ni les autres joueurs, ni les non-affiliés, ne peuvent lire ou
# écrire dans un clan qui n'est pas le leur.

def _verifier_membre_salle(courant: dict, salle: str) -> None:
    """L'appartenance se juge sur la forme NORMALISÉE de la salle.

    Correctif du 04/09/2026 : comparées telles quelles, « Iron Temple » et
    « iron temple » étaient deux clans distincts — un membre qui écrivait sa
    salle avec une casse différente se voyait refuser l'accès à son propre chat.
    """
    if cle_salle(courant.get("salle")) != cle_salle(salle):
        raise HTTPException(403, "Tu dois être membre de cette salle pour accéder à son chat.")


@app.get("/clans/{salle}/messages")
def messages_clan(salle: str, courant: dict = Depends(auth.utilisateur_courant)):
    _verifier_membre_salle(courant, salle)
    return db.messages_du_clan(salle)


@app.post("/clans/{salle}/messages", status_code=201)
def envoyer_message(salle: str, message: NouveauMessage,
                    courant: dict = Depends(auth.utilisateur_courant)):
    _verifier_membre_salle(courant, salle)
    message_id = db.envoyer_message_clan(salle, courant["id"], message.texte, datetime.now().isoformat(timespec="milliseconds"))
    return {
        "id": message_id, "salle": salle, "joueur_id": courant["id"],
        "pseudo": courant["pseudo"], "texte": message.texte,
    }


# ----- Entraînement : programmes + journal de séance (workout log) -----
# INDÉPENDANT du barème Fitness Royale : rien ici ne touche à la table `performances`
# ni au classement. C'est un outil de suivi perso ; l'utilisateur met à jour
# ses perfs officielles à la main dans l'onglet Perfs.

@app.post("/joueurs/{joueur_id}/programmes", status_code=201)
def creer_programme(joueur_id: int, programme: NouveauProgramme,
                    courant: dict = Depends(auth.utilisateur_courant)):
    """Crée un programme avec sa liste d'exercices cibles, ses jours de la
    semaine (optionnels) et sa planification multi-semaines (optionnelle)."""
    auth.verifier_proprietaire(courant, joueur_id)
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    jours_invalides = [j for j in programme.jours if j not in JOURS_SEMAINE]
    if jours_invalides:
        raise HTTPException(400, f"Jour(s) inconnu(s) : {', '.join(jours_invalides)}. "
                                 f"Utilise : {', '.join(JOURS_SEMAINE)}.")
    if programme.date_debut is not None:
        try:
            date.fromisoformat(programme.date_debut)
        except ValueError:
            raise HTTPException(400, "Date de début invalide : utilise le format AAAA-MM-JJ.")
    programme_id = db.creer_programme(
        joueur_id, programme.nom, datetime.now().isoformat(timespec="milliseconds"),
        programme.jours, programme.duree_semaines, programme.date_debut,
    )
    for ordre, exo in enumerate(programme.exercices, start=1):
        db.ajouter_exercice_programme(
            programme_id, exo.exercice, ordre, exo.series_cibles, exo.reps_cibles
        )
    return db.lire_programme(programme_id)


@app.get("/joueurs/{joueur_id}/programmes")
def programmes_du_joueur(joueur_id: int):
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.programmes_du_joueur(joueur_id)


@app.get("/programmes/{programme_id}")
def detail_programme(programme_id: int):
    programme = db.lire_programme(programme_id)
    if programme is None:
        raise HTTPException(404, "Programme introuvable.")
    return programme


@app.delete("/programmes/{programme_id}")
def supprimer_programme(programme_id: int, courant: dict = Depends(auth.utilisateur_courant)):
    programme = db.lire_programme(programme_id)
    if programme is None:
        raise HTTPException(404, "Programme introuvable.")
    auth.verifier_proprietaire(courant, programme["joueur_id"])
    db.supprimer_programme(programme_id)
    return {"supprime": True}


@app.put("/programmes/{programme_id}/jours")
def changer_jours_programme(programme_id: int, donnees: JoursProgramme,
                            courant: dict = Depends(auth.utilisateur_courant)):
    """Change les jours RÉCURRENTS d'un programme (la « semaine type ») —
    remplace toute la liste (liste vide = plus aucun jour)."""
    programme = db.lire_programme(programme_id)
    if programme is None:
        raise HTTPException(404, "Programme introuvable.")
    auth.verifier_proprietaire(courant, programme["joueur_id"])
    jours_invalides = [j for j in donnees.jours if j not in JOURS_SEMAINE]
    if jours_invalides:
        raise HTTPException(400, f"Jour(s) inconnu(s) : {', '.join(jours_invalides)}.")
    db.changer_jours_programme(programme_id, donnees.jours)
    return db.lire_programme(programme_id)


def _programme_officiel_lisible(ligne: dict) -> dict:
    """Met une ligne de la base à la forme attendue par l'app (mêmes champs
    qu'un modèle standard de src/data/programmesStandards.js)."""
    try:
        seances = json.loads(ligne["contenu"])
    except (TypeError, ValueError):
        seances = []
    return {
        "id": ligne["id"],
        "code": ligne["code"],
        "nom": ligne["nom"],
        "description": ligne["description"],
        "seances": seances,
        "cree_le": ligne["cree_le"],
    }


@app.get("/programmes-partages/{code}")
def programme_partage_par_code(code: str,
                               courant: dict = Depends(auth.utilisateur_courant)):
    """Récupère un programme partagé À PARTIR DE SON CODE.

    C'est le SEUL moyen d'en atteindre un : il n'existe pas d'endpoint qui
    liste tous les programmes partagés (correction du 02/09/2026 — ils ne
    doivent pas être visibles de tout le monde). Sans le code, un joueur ne
    peut même pas savoir qu'un programme existe.

    Le code n'est PAS à usage unique : il est fait pour être donné à
    plusieurs personnes, et sert tant que l'admin ne le retire pas.
    """
    ligne = db.programme_officiel_par_code(code.strip().upper())
    if ligne is None:
        raise HTTPException(404, "Aucun programme ne correspond à ce code.")
    return _programme_officiel_lisible(ligne)


@app.get("/admin/programmes-officiels")
def mes_programmes_partages(courant: dict = Depends(auth.utilisateur_admin)):
    """Les programmes que J'AI partagés, avec leurs codes — pour pouvoir les
    redonner ou les retirer. RÉSERVÉ À L'ADMIN, et filtré sur ses propres
    programmes."""
    return [_programme_officiel_lisible(l) for l in db.programmes_officiels_de(courant["id"])]


@app.post("/admin/programmes-officiels", status_code=201)
def publier_programme_officiel(donnees: ProgrammeOfficiel,
                               courant: dict = Depends(auth.utilisateur_admin)):
    """Partage un programme et renvoie le CODE à donner. RÉSERVÉ À L'ADMIN."""
    for seance in donnees.seances:
        for jour in seance.jours:
            if jour not in JOURS_SEMAINE:
                raise HTTPException(400, f"Jour inconnu : {jour}")
    contenu = json.dumps(
        [seance.model_dump() for seance in donnees.seances], ensure_ascii=False
    )
    # Même générateur que les codes de duel et de validation de perf.
    # On retente si le tirage tombe sur un code déjà pris (la colonne est UNIQUE).
    code = regles_duels.generer_code(6)
    for _ in range(10):
        if not db.code_officiel_existe(code):
            break
        code = regles_duels.generer_code(6)
    programme_id = db.creer_programme_officiel(
        code, donnees.nom, donnees.description, contenu, courant["id"],
        datetime.now().isoformat(timespec="milliseconds"),
    )
    return {"id": programme_id, "code": code}


@app.delete("/admin/programmes-officiels/{programme_id}", status_code=204)
def retirer_programme_officiel(programme_id: int,
                               courant: dict = Depends(auth.utilisateur_admin)):
    """Retire un programme du catalogue. RÉSERVÉ À L'ADMIN.

    Les copies déjà faites par les joueurs ne bougent pas : ce sont leurs
    programmes à eux depuis le jour où ils les ont copiés.
    """
    db.supprimer_programme_officiel(programme_id)
    return None


@app.put("/joueurs/{joueur_id}/exercices/{ancien}/nom")
def renommer_exercice(joueur_id: int, ancien: str, donnees: RenommageExercice,
                      courant: dict = Depends(auth.utilisateur_courant)):
    """Renomme un exercice PARTOUT chez ce joueur : ses programmes, son
    historique de séries, et sa correction de groupe musculaire.

    Le nom d'un exercice est son seul identifiant (texte libre, aucune table
    d'exercices) : le changer à un seul endroit coupait le lien avec tout le
    reste — records, suggestion de charge, comptage de séries par groupe.
    """
    auth.verifier_proprietaire(courant, joueur_id)
    nouveau = donnees.nouveau.strip()
    if not nouveau:
        raise HTTPException(400, "Le nouveau nom ne peut pas être vide.")
    if nouveau == ancien:
        return {"programmes": 0, "series": 0, "groupes": 0}
    return db.renommer_exercice_partout(joueur_id, ancien, nouveau)


@app.put("/joueurs/{joueur_id}/salle")
def changer_salle(joueur_id: int, donnees: SalleJoueur,
                  courant: dict = Depends(auth.utilisateur_courant)):
    """Change MA salle de gym (= mon clan).

    Nécessaire depuis que le champ vit dans l'onglet Clan : le chat de clan
    et le classement des membres se basent sur la salle enregistrée ICI, pas
    sur une valeur qui ne vivrait que dans l'app.
    """
    auth.verifier_proprietaire(courant, joueur_id)
    salle = nom_salle_affiche(donnees.salle)
    db.changer_salle(joueur_id, salle or None)
    return db.lire_joueur(joueur_id)


@app.put("/programmes/{programme_id}/nom")
def renommer_programme(programme_id: int, donnees: NomProgramme,
                       courant: dict = Depends(auth.utilisateur_courant)):
    """Renomme un programme (édition depuis la semaine type)."""
    programme = db.lire_programme(programme_id)
    if programme is None:
        raise HTTPException(404, "Programme introuvable.")
    auth.verifier_proprietaire(courant, programme["joueur_id"])
    db.renommer_programme(programme_id, donnees.nom)
    return db.lire_programme(programme_id)


@app.put("/programmes/{programme_id}/exercices")
def changer_exercices_programme(programme_id: int, donnees: ExercicesProgramme,
                                courant: dict = Depends(auth.utilisateur_courant)):
    """Remplace la liste d'exercices cibles d'un programme (édition des
    séries × reps depuis la semaine type de l'onglet Entraînement)."""
    programme = db.lire_programme(programme_id)
    if programme is None:
        raise HTTPException(404, "Programme introuvable.")
    auth.verifier_proprietaire(courant, programme["joueur_id"])
    db.remplacer_exercices_programme(
        programme_id,
        [exo.model_dump() for exo in donnees.exercices],
    )
    return db.lire_programme(programme_id)


# ----- MODE TEST (comptes administrateur uniquement) -----
# Sert à peupler le classement pour tester le RANKING sans saisir 15 exercices
# à la main pour chaque joueur. Le drapeau `admin` ne s'active QUE en base —
# voir backend/app/modetest.py et la section « Mode test » de CLAUDE.md.

@app.post("/admin/mes-perfs")
def admin_remplir_mes_perfs(donnees: RemplirPerfs,
                            courant: dict = Depends(auth.utilisateur_admin)):
    """Me place à un palier donné : remplit mes perfs, déjà VÉRIFIÉES."""
    if donnees.palier == 0:
        effacees = db.effacer_performances(courant["id"])
        return {"palier": 0, "perfs_ecrites": 0, "perfs_effacees": effacees}
    # On repart d'une base propre, sinon un ancien exercice à un palier plus
    # haut fausserait la moyenne qu'on cherche justement à contrôler.
    db.effacer_performances(courant["id"])
    ecrites = modetest.remplir_performances(
        courant["id"], courant["sexe"], donnees.palier, donnees.nb_exercices
    )
    joueur = db.lire_joueur(courant["id"])
    return {
        "palier": donnees.palier,
        "perfs_ecrites": ecrites,
        "ligue": ligue_joueur(joueur),
    }


@app.post("/admin/mes-points")
def admin_fixer_mes_points(donnees: FixerPoints,
                           courant: dict = Depends(auth.utilisateur_admin)):
    """Fixe mes points de compétition (ils départagent les égalités au rang)."""
    db.definir_points(courant["id"], donnees.points)
    return {"points": donnees.points}


@app.post("/admin/joueurs-test", status_code=201)
def admin_generer_joueurs(donnees: GenererJoueurs,
                          courant: dict = Depends(auth.utilisateur_admin)):
    """Crée des joueurs FACTICES répartis entre deux paliers, pour remplir le
    classement. Ils n'ont pas de mot de passe : personne ne peut s'y connecter."""
    crees = modetest.generer_joueurs(
        donnees.nombre, donnees.palier_min, donnees.palier_max,
        donnees.sexe, donnees.salle,
    )
    return {"crees": len(crees), "joueurs": crees}


@app.delete("/admin/joueurs-test")
def admin_supprimer_joueurs_test(courant: dict = Depends(auth.utilisateur_admin)):
    """Supprime TOUS les joueurs factices — jamais les vrais comptes."""
    supprimes = db.supprimer_joueurs_test()
    return {"supprimes": supprimes}


# ----- Volume : objectifs de SÉRIES par groupe musculaire -----
# L'objectif ("je veux 12 séries de pectoraux par semaine") est stocké ici ;
# le COMPTAGE des séries réellement faites est calculé par l'app à partir des
# séances loggées (elle a déjà toute la liste, pas besoin d'un aller-retour).

@app.get("/joueurs/{joueur_id}/objectifs-series")
def objectifs_series(joueur_id: int):
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.objectifs_series_du_joueur(joueur_id)


@app.put("/joueurs/{joueur_id}/objectifs-series")
def definir_objectifs_series(joueur_id: int, donnees: ObjectifsSeries,
                             courant: dict = Depends(auth.utilisateur_courant)):
    """Remplace tous les objectifs de volume du joueur."""
    auth.verifier_proprietaire(courant, joueur_id)
    groupes_inconnus = [
        o.groupe for o in donnees.objectifs if o.groupe not in GROUPES_MUSCULAIRES
    ]
    if groupes_inconnus:
        raise HTTPException(400, f"Groupe(s) musculaire(s) inconnu(s) : {', '.join(groupes_inconnus)}.")
    doublons = [o.groupe for o in donnees.objectifs]
    if len(doublons) != len(set(doublons)):
        raise HTTPException(400, "Un même groupe musculaire est présent deux fois.")
    db.remplacer_objectifs_series(joueur_id, [o.model_dump() for o in donnees.objectifs])
    return db.objectifs_series_du_joueur(joueur_id)


@app.get("/joueurs/{joueur_id}/groupes-exercices")
def groupes_exercices(joueur_id: int):
    """Les corrections manuelles « cet exercice = ce groupe musculaire »."""
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.groupes_exercices_du_joueur(joueur_id)


@app.put("/joueurs/{joueur_id}/groupes-exercices/{exercice}")
def definir_groupe_exercice(joueur_id: int, exercice: str, donnees: GroupeExercice,
                            courant: dict = Depends(auth.utilisateur_courant)):
    auth.verifier_proprietaire(courant, joueur_id)
    if donnees.groupe not in GROUPES_MUSCULAIRES:
        raise HTTPException(400, f"Groupe musculaire inconnu : {donnees.groupe}.")
    db.definir_groupe_exercice(joueur_id, exercice, donnees.groupe)
    return {"exercice": exercice, "groupe": donnees.groupe}


# ----- Cycles : un programme COMPLET réparti sur la semaine -----
# (ex. « Mon PPL » = Push lundi + Pull mardi + Legs mercredi…). Chaque séance
# est enregistrée comme un programme classique portant son jour ; le cycle les
# groupe pour pouvoir tout poser d'un coup dans le calendrier.

@app.post("/joueurs/{joueur_id}/cycles", status_code=201)
def creer_cycle(joueur_id: int, cycle: NouveauCycle,
                courant: dict = Depends(auth.utilisateur_courant)):
    auth.verifier_proprietaire(courant, joueur_id)
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    jours_invalides = [
        j for seance in cycle.seances for j in seance.jours if j not in JOURS_SEMAINE
    ]
    if jours_invalides:
        raise HTTPException(400, f"Jour(s) inconnu(s) : {', '.join(jours_invalides)}.")
    maintenant = datetime.now().isoformat(timespec="milliseconds")
    cycle_id = db.creer_cycle(joueur_id, cycle.nom, maintenant)
    for seance in cycle.seances:
        programme_id = db.creer_programme(joueur_id, seance.nom, maintenant, seance.jours)
        for ordre, exo in enumerate(seance.exercices, start=1):
            db.ajouter_exercice_programme(
                programme_id, exo.exercice, ordre, exo.series_cibles, exo.reps_cibles
            )
        db.rattacher_programme_au_cycle(cycle_id, programme_id)
    return db.lire_cycle(cycle_id)


@app.get("/joueurs/{joueur_id}/cycles")
def cycles_du_joueur(joueur_id: int):
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.cycles_du_joueur(joueur_id)


@app.delete("/cycles/{cycle_id}")
def supprimer_cycle(cycle_id: int, courant: dict = Depends(auth.utilisateur_courant)):
    """Supprime le cycle ET ses séances (elles n'existent que pour lui)."""
    cycle = db.lire_cycle(cycle_id)
    if cycle is None:
        raise HTTPException(404, "Programme introuvable.")
    auth.verifier_proprietaire(courant, cycle["joueur_id"])
    db.supprimer_cycle(cycle_id)
    return {"supprime": True}


# ----- Planning par date précise (calendrier interactif) -----

@app.get("/joueurs/{joueur_id}/planning")
def planning_du_joueur(joueur_id: int):
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.planning_du_joueur(joueur_id)


@app.post("/joueurs/{joueur_id}/planning", status_code=201)
def planifier_un_jour(joueur_id: int, planif: NouvellePlanification,
                      courant: dict = Depends(auth.utilisateur_courant)):
    """Place un programme sur une DATE PRÉCISE du calendrier (ex. « le
    2026-08-21 → programme Push »). S'ajoute aux jours récurrents éventuels."""
    auth.verifier_proprietaire(courant, joueur_id)
    try:
        date.fromisoformat(planif.date)
    except ValueError:
        raise HTTPException(400, "Date invalide : utilise le format AAAA-MM-JJ.")
    programme = db.lire_programme(planif.programme_id)
    if programme is None:
        raise HTTPException(404, "Programme introuvable.")
    if programme["joueur_id"] != joueur_id:
        raise HTTPException(403, "Ce programme ne t'appartient pas.")
    try:
        planning_id = db.planifier(joueur_id, planif.date, planif.programme_id)
    except db.ErreurIntegrite:
        raise HTTPException(409, "Ce programme est déjà planifié ce jour-là.")
    return {"id": planning_id, "joueur_id": joueur_id,
            "date": planif.date, "programme_id": planif.programme_id}


@app.post("/joueurs/{joueur_id}/planning/lot", status_code=201)
def planifier_un_lot(joueur_id: int, lot: LotPlanification,
                     courant: dict = Depends(auth.utilisateur_courant)):
    """Placement GROUPÉ : pose un cycle complet (ex. PPL sur 4 semaines = des
    dizaines de dates) en un seul appel. Les jours déjà planifiés à l'identique
    sont ignorés (pas d'erreur). Renvoie les planifications réellement créées."""
    auth.verifier_proprietaire(courant, joueur_id)
    programmes_verifies = {}
    for element in lot.elements:
        try:
            date.fromisoformat(element.date)
        except ValueError:
            raise HTTPException(400, f"Date invalide : {element.date} (format attendu AAAA-MM-JJ).")
        if element.programme_id not in programmes_verifies:
            programme = db.lire_programme(element.programme_id)
            if programme is None:
                raise HTTPException(404, f"Programme {element.programme_id} introuvable.")
            if programme["joueur_id"] != joueur_id:
                raise HTTPException(403, "Ce programme ne t'appartient pas.")
            programmes_verifies[element.programme_id] = True
    return db.planifier_lot(
        joueur_id,
        [{"date": el.date, "programme_id": el.programme_id} for el in lot.elements],
    )


@app.delete("/planning/{planning_id}")
def deplanifier_un_jour(planning_id: int, courant: dict = Depends(auth.utilisateur_courant)):
    planif = db.lire_planification(planning_id)
    if planif is None:
        raise HTTPException(404, "Planification introuvable.")
    auth.verifier_proprietaire(courant, planif["joueur_id"])
    db.deplanifier(planning_id)
    return {"supprime": True}


@app.post("/joueurs/{joueur_id}/entrainements", status_code=201)
def creer_entrainement(joueur_id: int, entrainement: NouvelEntrainement,
                       courant: dict = Depends(auth.utilisateur_courant)):
    """Enregistre une séance loggée complète (toutes ses séries en un coup)."""
    auth.verifier_proprietaire(courant, joueur_id)
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    jour = entrainement.date or date.today().isoformat()
    try:
        date.fromisoformat(jour)
    except ValueError:
        raise HTTPException(400, "Date invalide : utilise le format AAAA-MM-JJ.")
    entrainement_id = db.creer_entrainement(
        joueur_id, entrainement.programme_id, jour, datetime.now().isoformat(timespec="milliseconds")
    )
    for serie in entrainement.series:
        db.ajouter_serie(entrainement_id, serie.exercice, serie.numero_serie, serie.reps, serie.poids)
    return db.lire_entrainement(entrainement_id)


@app.get("/joueurs/{joueur_id}/entrainements")
def entrainements_du_joueur(joueur_id: int):
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    return db.entrainements_du_joueur(joueur_id)


@app.get("/joueurs/{joueur_id}/exercices/{exercice}/dernier")
def dernieres_series(joueur_id: int, exercice: str, avant: str | None = None):
    """SURCHARGE PROGRESSIVE : dernières séries loggées pour cet exercice,
    avant la date donnée (par défaut aujourd'hui) — pour savoir quoi battre."""
    if db.lire_joueur(joueur_id) is None:
        raise HTTPException(404, "Joueur introuvable.")
    avant_date = avant or date.today().isoformat()
    resultat = db.dernieres_series_pour_exercice(joueur_id, exercice, avant_date)
    return resultat or {"date": None, "series": []}
