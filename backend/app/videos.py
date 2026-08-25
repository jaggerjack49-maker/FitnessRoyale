"""Upload vidéo pour prouver une performance — règles et stockage des fichiers.

Règle de validation (simple et robuste, pas de quorum compliqué) :
- Un joueur joint une vidéo à une de SES perfs → elle attend un vote.
- Le PREMIER autre joueur qui vote décide : "valider" → la perf passe
  vraiment en "communaute" (compte au classement) ; "refuser" → la vidéo
  est classée refusée (le joueur peut réessayer avec une nouvelle vidéo).
- Limite connue (notée dans CLAUDE.md) : un seul vote suffit, pas de
  quorum — un système à plusieurs votes viendra si le besoin se fait sentir.

DÉCISION (20/08/2026, demande de Hafiz) : AUCUNE vidéo n'est stockée de façon
permanente. Le fichier vit sur le disque UNIQUEMENT le temps qu'un vote la
résolve (validée ou refusée) -- voir supprimer_fichier() plus bas, appelée
depuis /videos/{id}/voter dans main.py.
"""

import os
import uuid
from pathlib import Path

# Même variable d'environnement que basededonnees.py (FITNESS_ROYALE_DATA_DIR)
# pour que la base ET les vidéos vivent sur le même disque persistant en
# hébergement — voir "Hébergement du backend" dans CLAUDE.md.
_DOSSIER_DONNEES = Path(os.environ.get("FITNESS_ROYALE_DATA_DIR") or (Path(__file__).parent.parent))
DOSSIER_VIDEOS = _DOSSIER_DONNEES / "videos"
EXTENSIONS_AUTORISEES = {".mp4", ".mov", ".m4v", ".avi", ".webm"}
TAILLE_MAX_OCTETS = 50 * 1024 * 1024  # 50 Mo — large pour un clip de quelques secondes


def extension_valide(nom_original: str) -> str | None:
    """Renvoie l'extension (avec le point) si elle est autorisée, sinon None."""
    suffixe = Path(nom_original or "").suffix.lower()
    return suffixe if suffixe in EXTENSIONS_AUTORISEES else None


def nouveau_nom_fichier(extension: str) -> str:
    """Nom de fichier JAMAIS dérivé du client (sécurité) — juste un identifiant unique."""
    return f"{uuid.uuid4().hex}{extension}"


def chemin_video(nom_fichier: str) -> Path:
    return DOSSIER_VIDEOS / nom_fichier


def preparer_dossier():
    DOSSIER_VIDEOS.mkdir(parents=True, exist_ok=True)


def supprimer_fichier(nom_fichier: str) -> None:
    """Efface le fichier vidéo du disque -- appelée dès qu'un vote résout
    la vidéo (validée ou refusée). DÉCISION (20/08/2026, demande de Hafiz) :
    aucune vidéo n'est conservée sur le serveur au-delà du temps nécessaire
    au vote. La ligne `preuves_video` reste en base (trace du statut et de
    qui a voté), mais son `fichier` ne pointe plus vers rien de réel --
    `GET /videos/{id}/fichier` renvoie alors 404 (voir main.py).
    Silencieuse si le fichier est déjà absent (idempotent)."""
    chemin_video(nom_fichier).unlink(missing_ok=True)
