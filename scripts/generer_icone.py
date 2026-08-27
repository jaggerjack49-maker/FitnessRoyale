# -*- coding: utf-8 -*-
"""Fabrique l'icône de l'app à partir du logo fourni par Hafiz.

À LANCER DEPUIS LA RACINE : `python scripts/generer_icone.py`
Écrit `assets/icon.png`, `assets/adaptive-icon.png` et `assets/favicon.png`.

SOURCE : le logo le plus récent de `icones/` (dossier versionné exprès) — une
tuile sombre à coins arrondis portant la couronne, « FITNESS ROYALE » et le
buste. Le script le recadre lui-même : rien à préparer à la main.

LES TROIS FICHIERS NE SONT PAS INTERCHANGEABLES :
 - `icon.png` : l'icône classique. OPAQUE (iOS retire la transparence et
   afficherait du noir à la place). C'est la tuile entière : le système lui
   arrondit les coins par-dessus, ce qui ne se voit pas puisqu'ils sont noirs.
 - `adaptive-icon.png` : le PREMIER PLAN de l'icône adaptative Android, sur
   fond TRANSPARENT (la couleur de fond est donnée à part dans app.json).
   Android masque cette image en cercle, en carré arrondi ou en goutte selon
   le téléphone, et ne garde qu'un cercle central de ~66 % — d'où un logo
   volontairement plus petit, calculé pour tenir dedans SANS ÊTRE ROGNÉ (on
   mesure le rayon réel du dessin, pas sa boîte, sinon on perdrait de la
   place pour rien : les coins du logo sont vides). C'est normal qu'il
   paraisse petit quand on ouvre le fichier seul.
   Les bords de la tuile sont ESTOMPÉS et la couleur de fond est celle de la
   tuile : le carré sombre disparaît dans le fond, on ne voit que le logo.
 - `favicon.png` : la pastille de l'onglet du navigateur (version web).
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 1024
DIAMETRE_SUR = 660      # cercle où le dessin doit tenir (Android en montre ~682)

sources = sorted(
    (f for f in os.listdir("icones") if f.lower().endswith(".png")),
    key=lambda f: os.path.getmtime(os.path.join("icones", f)))
SRC = os.path.join("icones", sources[-1])
print("source :", SRC)

brut = Image.open(SRC).convert("RGB")
a = np.array(brut).astype(int)
lum = a.max(axis=2)

# 1. Recadrer sur la TUILE : tout ce qui n'est pas le noir pur autour.
ys, xs = np.nonzero(lum > 2)
tuile = brut.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
print("tuile :", tuile.size)

# 2. Mesurer le DESSIN lui-même (nettement plus clair que la tuile) pour savoir
#    de combien le réduire : on veut son rayon, pas sa boîte.
t = np.array(tuile.convert("RGB")).astype(int)
dessin = t.max(axis=2) > 90
dy, dx = np.nonzero(dessin)
cx, cy = (dx.min() + dx.max()) / 2, (dy.min() + dy.max()) / 2
rayon = float(np.sqrt((dx - cx) ** 2 + (dy - cy) ** 2).max())
couleur_fond = tuple(int(v) for v in np.median(
    np.concatenate([t[2:6].reshape(-1, 3), t[-6:-2].reshape(-1, 3)]), axis=0))
print("rayon du dessin :", round(rayon), "| couleur de la tuile :", couleur_fond)

# 3. L'icône classique : la tuile, telle quelle, opaque.
tuile.resize((S, S), Image.LANCZOS).save("assets/icon.png")

# 4. L'icône adaptative : la tuile réduite pour que le dessin tienne dans le
#    cercle sûr, bords estompés, sur fond transparent.
echelle = (DIAMETRE_SUR / 2) / rayon
n = max(1, int(round(tuile.size[0] * echelle)))
petite = tuile.resize((n, n), Image.LANCZOS).convert("RGBA")

flou = max(6, n // 24)
masque = Image.new("L", (n, n), 0)
ImageDraw.Draw(masque).rounded_rectangle(
    (flou, flou, n - 1 - flou, n - 1 - flou), radius=n // 5, fill=255)
petite.putalpha(masque.filter(ImageFilter.GaussianBlur(flou)))

adaptative = Image.new("RGBA", (S, S), (0, 0, 0, 0))
# On recentre sur le DESSIN, pas sur la tuile : le logo n'est pas parfaitement
# centré dedans, et c'est lui qui doit être au milieu du cercle.
decalage = (int(round((S - n) / 2 - (cx - tuile.size[0] / 2) * echelle)),
            int(round((S - n) / 2 - (cy - tuile.size[1] / 2) * echelle)))
adaptative.paste(petite, decalage, petite)
adaptative.save("assets/adaptive-icon.png")

# 5. Favicon web.
tuile.resize((64, 64), Image.LANCZOS).save("assets/favicon.png")

print("couleur de fond à mettre dans app.json : #%02x%02x%02x" % couleur_fond)
for f in ("icon.png", "adaptive-icon.png", "favicon.png"):
    print("=>", f, Image.open("assets/" + f).size,
          os.path.getsize("assets/" + f) // 1024, "ko")
