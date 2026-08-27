# -*- coding: utf-8 -*-
"""Découpe les 6 arènes de la maquette en 7 images prêtes pour l'app.

À LANCER DEPUIS LA RACINE DU PROJET : `python scripts/decouper_arenes.py`
(nécessite Pillow et numpy). Lit la maquette la plus récente du dossier
`maquette-arène/` et écrit `assets/arenes/*.png`, en écrasant les précédentes.

Ce script EST la recette : si la maquette change un jour, on le relance au
lieu de refaire le découpage à la main.

VERSION DU 27/08/2026 — GRANDEMENT SIMPLIFIÉE. La première maquette avait un
bandeau de titre et une ligne de trophées peints PAR-DESSUS chaque arène : il
avait fallu les effacer par diffusion, ce qui abîmait toujours un coin. Hafiz
a régénéré une maquette PROPRE (aucun texte, aucun cadre) — tout ce travail de
retouche a donc disparu, et avec lui les dégâts qu'il causait.

CE QUI RESTE, ET POURQUOI :
 1. On ne découpe PAS en cases de 512×512 : sur cette maquette les arènes
    débordent de leur case. On enlève le fond sur l'image ENTIÈRE, puis on
    isole les 6 blocs d'un seul tenant — chaque bloc EST une arène, quelle que
    soit sa position.
 2. Le fond est un bleu nuit très sombre. On le retire par propagation depuis
    les bords, en interdisant à la propagation de sortir de la famille
    « bleu » — sinon elle part dans la pierre des murs, tout aussi sombre.
    Ça emporte au passage le halo lumineux autour de chaque arène.
 3. Toutes les images finissent sur une TOILE DE MÊME TAILLE, calées en bas
    (le socle est l'ancre visuelle). Sans ça, `resizeMode="contain"` les
    affichait à des échelles différentes selon leur format — c'est ce qui
    donnait l'impression que « seule OLYMPE rend bien ».
"""
import os
from collections import deque
from PIL import Image, ImageEnhance
import numpy as np

DOSSIER = "maquette-arène"
OUT = "assets/arenes"
NOMS = ["1-initiation", "2-forge", "3-colosse", "4-titan", "5-olympe", "6-royale"]
TOILE = (512, 470)   # au plus pres du format des arenes de la maquette
MARGE_BAS = 6


def maquette_la_plus_recente():
    fichiers = [os.path.join(DOSSIER, f) for f in os.listdir(DOSSIER)
                if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    return max(fichiers, key=os.path.getmtime)


def voisins(y, x, h, w):
    if y > 0: yield y - 1, x
    if y < h - 1: yield y + 1, x
    if x > 0: yield y, x - 1
    if x < w - 1: yield y, x + 1


def masque_fond(rgb):
    """Le fond bleu nuit, en partant de tout le pourtour de l'image et en
    s'étendant de proche en proche (le fond est un dégradé, on ne peut donc
    pas le comparer à une couleur unique)."""
    h, w, _ = rgb.shape
    arr = rgb.astype(np.int16)
    # Garde-fou : la propagation ne peut vivre que dans le « bleu sombre ».
    bleu = (arr.max(axis=2) < 95) & (arr[:, :, 2] >= arr[:, :, 0] + 6) \
        & (arr[:, :, 2] >= arr[:, :, 1] + 3)
    vu = np.zeros((h, w), dtype=bool)
    file = deque()
    bord = [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] \
        + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]
    for y, x in bord:
        if bleu[y, x] and not vu[y, x]:
            vu[y, x] = True
            file.append((y, x))
    while file:
        y, x = file.popleft()
        c = arr[y, x]
        for ny, nx in voisins(y, x, h, w):
            if vu[ny, nx] or not bleu[ny, nx]:
                continue
            v = arr[ny, nx]
            if abs(v[0] - c[0]) + abs(v[1] - c[1]) + abs(v[2] - c[2]) <= 26:
                vu[ny, nx] = True
                file.append((ny, nx))
    return vu


def blocs(alpha, mini):
    """Les blocs d'un seul tenant d'au moins `mini` pixels, du plus gros au
    plus petit. Renvoie des listes de points."""
    h, w = alpha.shape
    vu = np.zeros((h, w), dtype=bool)
    trouves = []
    for sy in range(h):
        for sx in range(w):
            if alpha[sy, sx] and not vu[sy, sx]:
                pile, pts = [(sy, sx)], []
                vu[sy, sx] = True
                while pile:
                    y, x = pile.pop()
                    pts.append((y, x))
                    for ny, nx in voisins(y, x, h, w):
                        if alpha[ny, nx] and not vu[ny, nx]:
                            vu[ny, nx] = True
                            pile.append((ny, nx))
                if len(pts) >= mini:
                    trouves.append(pts)
    trouves.sort(key=len, reverse=True)
    return trouves


source = maquette_la_plus_recente()
print("maquette :", source)
rgb = np.array(Image.open(source).convert("RGB"))
h, w, _ = rgb.shape

alpha = ~masque_fond(rgb)
arenes = blocs(alpha, mini=5000)
print("blocs trouvés :", len(arenes), [len(p) for p in arenes])
assert len(arenes) == 6, "on attend exactement 6 arènes (grille 3 x 2)"

# On les remet dans l'ordre de lecture (ligne du haut de gauche à droite,
# puis ligne du bas) d'après leur centre.
def rang(pts):
    ys = [y for y, _ in pts]; xs = [x for _, x in pts]
    cy, cx = sum(ys) / len(ys), sum(xs) / len(xs)
    return (0 if cy < h / 2 else 1, cx)

arenes.sort(key=rang)

decoupes = []
for pts in arenes:
    m = np.zeros((h, w), dtype=bool)
    for y, x in pts:
        m[y, x] = True
    ys = np.nonzero(m.any(axis=1))[0]
    xs = np.nonzero(m.any(axis=0))[0]
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([rgb[y0:y1, x0:x1], (m[y0:y1, x0:x1] * 255).astype(np.uint8)])
    decoupes.append(Image.fromarray(rgba, "RGBA"))
    print("  découpe", decoupes[-1].size)

# --- Cadrage commun -------------------------------------------------------
larg_max = max(im.width for im in decoupes)
haut_max = max(im.height for im in decoupes)
echelle = min((TOILE[0] - 8) / larg_max, (TOILE[1] - MARGE_BAS - 4) / haut_max)

finales = []
for im in decoupes:
    im = im.resize((max(1, int(im.width * echelle)), max(1, int(im.height * echelle))), Image.LANCZOS)
    toile = Image.new("RGBA", TOILE, (0, 0, 0, 0))
    toile.paste(im, ((TOILE[0] - im.width) // 2, TOILE[1] - MARGE_BAS - im.height), im)
    finales.append(toile)

# L'arène 0 (DÉBUT) n'existe pas dans la maquette : c'est INITIATION en
# version grise et assombrie — « l'arène n'est pas encore allumée ».
debut = finales[0].copy()
r, v, b, a = debut.split()
gris = Image.merge("RGB", (r, v, b)).convert("L").convert("RGB")
gris = ImageEnhance.Brightness(gris).enhance(0.55)
debut = Image.merge("RGBA", (*gris.split(), a))

for nom, im in zip(["0-debut"] + NOMS, [debut] + finales):
    # Palette réduite : divise le poids par ~6 sans différence visible.
    q = im.quantize(colors=200, method=Image.FASTOCTREE).convert("RGBA")
    chemin = "%s/%s.png" % (OUT, nom)
    q.save(chemin, optimize=True)
    print("=>", nom, q.size, os.path.getsize(chemin) // 1024, "ko")
