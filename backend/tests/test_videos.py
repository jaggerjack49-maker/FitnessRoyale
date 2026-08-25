"""Tests de la logique des preuves vidéo — lancer avec :  python -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.videos import extension_valide, nouveau_nom_fichier


class TestExtensionValide(unittest.TestCase):
    def test_extensions_video_courantes_acceptees(self):
        for nom in ("clip.mp4", "clip.MOV", "clip.m4v", "clip.avi", "clip.webm"):
            self.assertIsNotNone(extension_valide(nom))

    def test_extensions_non_video_refusees(self):
        for nom in ("virus.exe", "image.jpg", "archive.zip", "sans_extension"):
            self.assertIsNone(extension_valide(nom))

    def test_nom_vide_ou_none_refuse(self):
        self.assertIsNone(extension_valide(""))
        self.assertIsNone(extension_valide(None))

    def test_extension_normalisee_en_minuscules(self):
        self.assertEqual(extension_valide("Clip.MP4"), ".mp4")


class TestNouveauNomFichier(unittest.TestCase):
    def test_conserve_lextension(self):
        nom = nouveau_nom_fichier(".mp4")
        self.assertTrue(nom.endswith(".mp4"))

    def test_deux_noms_generes_sont_differents(self):
        # Sécurité : le nom ne doit JAMAIS dépendre du nom fourni par le client.
        noms = {nouveau_nom_fichier(".mp4") for _ in range(10)}
        self.assertEqual(len(noms), 10)


if __name__ == "__main__":
    unittest.main()
