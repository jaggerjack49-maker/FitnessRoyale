"""Aucun emoji dans l'interface de l'app — verrou posé le 08/11/2026.

Demande de Hafiz : « change également la DA des autres onglets ainsi que les
emojis en t'inspirant de l'onglet Entraînement ». Les emojis d'interface ont
tous été remplacés par les icônes dessinées de `src/components/Icones.js`.

POURQUOI UN TEST POUR UNE ABSENCE : un emoji ne se teinte pas (impossible de
le passer en or quand il est actif), ne s'aligne pas sur une grille, et change
de dessin d'un téléphone à l'autre. Rien n'empêche d'en recoller un en
écrivant un bouton à la hâte — et rien ne le signalerait. Même méthode que
`test_plus_de_mode_hors_ligne.py` : on verrouille ce qui ne doit PAS revenir.

⚠️ CE QUE CE TEST NE COMPTE PAS :
- les COMMENTAIRES (on y cite volontairement les anciens emojis pour expliquer
  ce qui a été remplacé) ;
- `src/notifications.js` : le texte d'une NOTIFICATION du téléphone est du
  texte brut affiché par le système — il ne peut pas contenir de dessin.

Il a été vu ÉCHOUER en recollant un emoji dans un écran, puis repasser au vert
une fois retiré.
"""

import re
import unittest
from pathlib import Path

RACINE = Path(__file__).parent.parent.parent

# Le seul fichier où un emoji est légitime (voir la docstring).
EXCEPTIONS = {"src/notifications.js"}

# Les plages pictographiques, plus le sélecteur de variante emoji (U+FE0F) :
# c'est lui qui transforme un symbole ordinaire (▶, ✏, ⚠) en emoji coloré.
# Sans lui, « ▶️ DÉMARRER CE BLOC » était passé entre les mailles d'un premier
# inventaire (vu à l'écran, 08/11/2026).
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF]"
    "|[☀-➿⭐⬆⬇⏩-⏺⌚⌛]"
    "|️"
)

# Les signes typographiques gardés EXPRÈS, parce qu'ils font partie de la
# phrase et prennent la couleur du texte (voir l'en-tête de Icones.js) :
# ✕ • ○ ● → ↑ = ↓ ! › ‹ ✓ ◎ ↺ ↻. Ils ne sont pas dans les plages ci-dessus,
# sauf ✓ (U+2713) et ✕ (U+2715), qu'on autorise explicitement.
SIGNES_AUTORISES = {"✓", "✕"}


def sans_commentaires(source):
    """Retire les commentaires /* … */ (y compris JSX {/* … */}) et // …"""
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    lignes = []
    for ligne in source.split("\n"):
        # Un « // » en début de ligne (ou après du code) : on coupe là. Les
        # URL « https:// » n'existent pas dans les écrans, mais on les épargne.
        coupe = re.split(r"(?<![:'\"])//", ligne, maxsplit=1)[0]
        lignes.append(coupe)
    return "\n".join(lignes)


def emojis_du_fichier(chemin):
    texte = sans_commentaires(chemin.read_text(encoding="utf-8"))
    trouves = []
    for numero, ligne in enumerate(texte.split("\n"), 1):
        for m in EMOJI.findall(ligne):
            if m not in SIGNES_AUTORISES:
                trouves.append((numero, m, ligne.strip()[:70]))
    return trouves


class TestPasDEmojiDansLInterface(unittest.TestCase):
    def fichiers(self):
        yield RACINE / "App.js"
        yield from sorted((RACINE / "src").rglob("*.js"))

    def test_aucun_emoji_d_interface(self):
        fautifs = []
        for chemin in self.fichiers():
            relatif = chemin.relative_to(RACINE).as_posix()
            if relatif in EXCEPTIONS:
                continue
            for numero, emoji, extrait in emojis_du_fichier(chemin):
                fautifs.append(f"  {relatif}:{numero}  {ascii(emoji)}  « {extrait} »")
        if fautifs:
            self.fail(
                f"{len(fautifs)} emoji(s) dans l'interface. Remplace-les par une "
                "icône de src/components/Icones.js (<Icone>, <TexteIcone>, "
                "<LibelleIcone>) :\n" + "\n".join(fautifs)
            )

    def test_le_repertoire_existe_et_a_de_quoi_remplacer(self):
        """Contre-épreuve : le test ci-dessus ne veut rien dire si les icônes
        de remplacement n'existent pas."""
        icones = (RACINE / "src" / "components" / "Icones.js").read_text(encoding="utf-8")
        for nom in ("medaille", "salle", "bulle", "globe", "eclair", "cadenas",
                    "porte", "pousse", "flamme", "diamant"):
            self.assertIn(f"{nom}:", icones.split("export const NOMS_ICONES")[1],
                          f"L'icône « {nom} » manque au répertoire.")


if __name__ == "__main__":
    unittest.main()
