# -*- coding: utf-8 -*-
"""Fabrique l'icône de l'app à partir de la direction artistique du projet.

À LANCER DEPUIS LA RACINE : `python scripts/generer_icone.py`
Écrit `assets/icon.png`, `assets/adaptive-icon.png` et `assets/favicon.png`.

POURQUOI UN SCRIPT plutôt qu'une image dessinée une fois : l'icône n'est que
la palette de `src/designSystem.js` (fond #0c0b0f, or #e8b23a) appliquée au
LOSANGE, le motif de marque déjà utilisé dans la barre d'onglets et à côté du
nom d'arène (`src/components/Losange.js`). Si la DA change, on relance.

LES TROIS FICHIERS NE SONT PAS INTERCHANGEABLES :
 - `icon.png` : l'icône classique. OPAQUE (iOS retire la transparence et
   afficherait du noir à la place). Le motif occupe ~62 % de la toile, parce
   que le système lui arrondit les coins.
 - `adaptive-icon.png` : le PREMIER PLAN de l'icône adaptative Android, sur
   fond TRANSPARENT (la couleur de fond est donnée à part dans app.json).
   Android masque cette image en cercle, en carré arrondi ou en goutte selon
   le téléphone : tout ce qui compte doit tenir dans le cercle central, qui
   ne fait que 66 % de la toile. D'où un losange volontairement petit — c'est
   normal qu'il paraisse perdu au milieu quand on ouvre le fichier.
 - `favicon.png` : la pastille de l'onglet du navigateur (version web).
"""
import os
from PIL import Image, ImageDraw, ImageFont

FOND = (12, 11, 15)          # designSystem.fond  #0c0b0f
OR_CLAIR = (244, 205, 96)
OR = (232, 178, 58)          # designSystem.or    #e8b23a
OR_SOMBRE = (198, 142, 32)

S = 1024
SUR = 4                      # on dessine en 4x puis on réduit : bords nets
POLICE = r"C:\Windows\Fonts\ariblk.ttf"   # Arial Black ≈ le poids 900 de la DA


def losange(taille, demi_diagonale, marge_texte=True):
    """Un losange or, avec « FR » évidé dedans, sur fond transparent."""
    n = taille * SUR
    r = int(demi_diagonale * SUR)
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    c = n // 2

    # Le dégradé vertical qui donne du relief à l'or.
    degrade = Image.new("RGB", (1, n))
    for y in range(n):
        t = y / (n - 1)
        if t < 0.5:
            k = t / 0.5
            col = tuple(int(OR_CLAIR[i] + (OR[i] - OR_CLAIR[i]) * k) for i in range(3))
        else:
            k = (t - 0.5) / 0.5
            col = tuple(int(OR[i] + (OR_SOMBRE[i] - OR[i]) * k) for i in range(3))
        degrade.putpixel((0, y), col)
    degrade = degrade.resize((n, n))

    forme = Image.new("L", (n, n), 0)
    ImageDraw.Draw(forme).polygon(
        [(c, c - r), (c + r, c), (c, c + r), (c - r, c)], fill=255)
    img.paste(degrade, (0, 0), forme)

    # « FR » évidé : on efface le pixel (alpha à 0) au lieu de peindre en noir,
    # pour que le fond de l'icône transparaisse — même effet sur les deux
    # variantes, opaque ou transparente.
    hauteur = int(r * 0.62)
    police = ImageFont.truetype(POLICE, hauteur)
    trou = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(trou)
    d.text((c, c), "FR", font=police, fill=255, anchor="mm")
    img.putalpha(Image.composite(Image.new("L", (n, n), 0), img.getchannel("A"), trou))

    return img.resize((taille, taille), Image.LANCZOS)


os.makedirs("assets", exist_ok=True)

# 1. Icône classique : opaque, motif à ~62 % de la toile.
classique = Image.new("RGB", (S, S), FOND)
motif = losange(S, S * 0.31)
classique.paste(motif, (0, 0), motif)
classique.save("assets/icon.png")

# 2. Icône adaptative Android : fond transparent, motif dans la zone sûre
#    (le cercle central de 66 % — on reste en dessous pour la marge).
adaptative = Image.new("RGBA", (S, S), (0, 0, 0, 0))
motif = losange(S, S * 0.24)
adaptative.paste(motif, (0, 0), motif)
adaptative.save("assets/adaptive-icon.png")

# 3. Favicon web.
classique.resize((64, 64), Image.LANCZOS).save("assets/favicon.png")

for f in ("icon.png", "adaptive-icon.png", "favicon.png"):
    print("=>", f, Image.open("assets/" + f).size,
          os.path.getsize("assets/" + f) // 1024, "ko")
