"""Authentification : mots de passe hashés + tokens de session.

Simple et robuste, SANS dépendance externe (pas besoin d'installer bcrypt) :
- Le mot de passe n'est JAMAIS stocké en clair. On stocke "sel$empreinte",
  où empreinte = PBKDF2-HMAC-SHA256(mot_de_passe, sel, 200 000 itérations).
  PBKDF2 est fourni par la bibliothèque standard de Python (hashlib) — c'est
  un algorithme reconnu pour hasher des mots de passe (résiste au brute-force
  grâce aux 200 000 itérations).
- Le token de session est une chaîne aléatoire opaque (secrets.token_hex),
  stockée en base et envoyée par l'app dans l'en-tête "Authorization: Bearer
  <token>". Pas d'expiration pour l'instant (projet perso, pas de vrais
  enjeux de sécurité production) ; se déconnecter supprime la session.
"""

import hashlib
import hmac
import secrets
from datetime import datetime

from fastapi import Depends, Header, HTTPException

from . import basededonnees as db

ITERATIONS = 200_000


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    """Transforme un mot de passe en clair en "sel$empreinte" à stocker en base."""
    sel = secrets.token_hex(16)
    empreinte = hashlib.pbkdf2_hmac(
        "sha256", mot_de_passe.encode("utf-8"), bytes.fromhex(sel), ITERATIONS
    )
    return f"{sel}${empreinte.hex()}"


def verifier_mot_de_passe(mot_de_passe: str, hash_stocke: str | None) -> bool:
    """Vérifie qu'un mot de passe en clair correspond au hash stocké en base."""
    if not hash_stocke or "$" not in hash_stocke:
        return False
    sel, empreinte_attendue = hash_stocke.split("$", 1)
    empreinte = hashlib.pbkdf2_hmac(
        "sha256", mot_de_passe.encode("utf-8"), bytes.fromhex(sel), ITERATIONS
    )
    # compare_digest évite les attaques par mesure du temps de réponse.
    return hmac.compare_digest(empreinte.hex(), empreinte_attendue)


def generer_token() -> str:
    return secrets.token_hex(32)


def creer_session_pour(joueur_id: int) -> str:
    """Crée une nouvelle session et renvoie son token (à donner à l'app)."""
    token = generer_token()
    db.creer_session(token, joueur_id, datetime.now().isoformat())
    return token


def utilisateur_courant(authorization: str | None = Header(default=None)) -> dict:
    """Dépendance FastAPI : lit le token dans l'en-tête "Authorization: Bearer <token>".

    Utilisation dans un endpoint : `courant: dict = Depends(utilisateur_courant)`.
    Lève une 401 si le token est absent, inconnu, ou si le compte a disparu.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Connexion requise (token manquant).")
    token = authorization.removeprefix("Bearer ").strip()
    joueur_id = db.joueur_id_pour_token(token)
    if joueur_id is None:
        raise HTTPException(401, "Session invalide — reconnecte-toi.")
    joueur = db.lire_joueur(joueur_id)
    if joueur is None:
        raise HTTPException(401, "Compte introuvable.")
    return joueur


def verifier_proprietaire(courant: dict, joueur_id_cible: int) -> None:
    """Lève une 403 si le joueur connecté n'est pas le propriétaire de la ressource ciblée."""
    if courant["id"] != joueur_id_cible:
        raise HTTPException(403, "Tu ne peux modifier que tes propres données.")


def utilisateur_admin(courant: dict = Depends(utilisateur_courant)) -> dict:
    """Dépendance FastAPI pour les endpoints du MODE TEST.

    À utiliser ainsi : `courant: dict = Depends(auth.utilisateur_admin)`.
    Lève une 403 si le compte connecté n'a pas le drapeau `admin`.
    Ce drapeau ne s'active QUE à la main en base — voir modetest.py."""
    if not courant.get("admin"):
        raise HTTPException(403, "Réservé aux comptes administrateur (mode test).")
    return courant
