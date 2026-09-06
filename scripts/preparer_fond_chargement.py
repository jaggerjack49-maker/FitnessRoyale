# -*- coding: utf-8 -*-
"""Prépare le fond de l'écran de chargement à partir de l'illustration fournie.

À LANCER DEPUIS LA RACINE : `python scripts/preparer_fond_chargement.py`
Écrit `assets/fond-chargement.jpg`.

CE QU'IL FAIT, ET POURQUOI :

1. IL COUPE LE BANDEAU PEINT EN BAS. L'illustration contient déjà, dessinés
   dedans, « INITIALISATION DU SERVEUR… », une barre de progression et
   « PLUS FORTS ENSEMBLE ». On les retire pour que l'app pose SON PROPRE
   bandeau au même endroit.
   Raison : ce message doit CHANGER. L'app dit « Connexion au serveur… » au
   premier essai, puis « Réveil du serveur — jusqu'à 1 min » si le serveur
   dormait (hébergement gratuit, voir CLAUDE.md). C'est précisément cette
   phrase qui évite de croire à une panne pendant l'attente — un texte peint
   ne peut pas la porter. Et une barre FIGÉE à 65 % pendant une minute donne
   exactement l'impression de blocage qu'on cherche à éviter : celle de l'app
   est animée.
   La découpe s'arrête juste au-dessus du bandeau ; les haltères du premier
   plan sont coupées, mais elles servaient déjà de cadre.

2. IL PASSE EN JPEG. Aucune transparence n'est utile pour un fond, et le PNG
   d'origine pèse 2,1 Mo pour une image photographique — inutile de le
   transporter dans l'APK.
"""
import os
from PIL import Image

DOSSIER_SOURCE = "icones"
SORTIE = "assets/fond-chargement.jpg"

# La première ligne du bandeau peint, mesurée sur l'illustration d'origine
# (la luminosité y bondit : c'est le panneau sombre puis la barre dorée).
HAUTEUR_UTILE = 1395


def image_la_plus_recente(dossier):
    """La dernière image déposée dans le dossier — même principe que les
    scripts des arènes et de l'icône : on dépose, on relance."""
    candidates = [
        os.path.join(dossier, f) for f in os.listdir(dossier)
        if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    ]
    if not candidates:
        raise SystemExit(f"Aucune image dans {dossier}/")
    return max(candidates, key=os.path.getmtime)


source = image_la_plus_recente(DOSSIER_SOURCE)
image = Image.open(source).convert("RGB")

hauteur = min(HAUTEUR_UTILE, image.height)
image = image.crop((0, 0, image.width, hauteur))

os.makedirs("assets", exist_ok=True)
image.save(SORTIE, "JPEG", quality=88, optimize=True, progressive=True)

print(f"source  : {source}")
print(f"découpe : {image.size[0]} x {image.size[1]}")
print(f"=> {SORTIE}  {os.path.getsize(SORTIE) // 1024} ko")
