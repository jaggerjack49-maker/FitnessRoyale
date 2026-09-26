# -*- coding: utf-8 -*-
"""LE MODE HORS-LIGNE NE DOIT PAS REVENIR (26/09/2026, demande de Hafiz).

Ce fichier ne teste pas une fonctionnalité : il verrouille une ABSENCE. Même
méthode que `test_aucun_moyen_de_lister_les_programmes_des_autres`
(01/09/2026) — une non-fonctionnalité est facile à réintroduire par accident,
parce que rien ne la signale.

POURQUOI ÇA COMPTE : jusqu'au 26/09/2026, quand le serveur ne répondait pas,
l'app entrait quand même et affichait un profil de DÉMONSTRATION
(`src/data/mockData.js`) — mêmes écrans, mais sans les séances ni les
programmes du joueur. C'est exactement ce qu'on voit quand un compte a été
vidé, et ça a fait croire DEUX FOIS à Hafiz que ses données avaient disparu
(voir les sections des 16/09 et 23/09/2026 dans CLAUDE.md). Le remède a été de
supprimer ce mode : sans serveur, l'app s'arrête et le dit.

Comme `test_listes_partagees.py`, ce test LIT LES FICHIERS JS depuis Python :
la suite doit rester lançable sans l'outillage de l'app (pas de Node requis).
"""
import os
import unittest

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def fichiers_js():
    """Tous les .js de l'app (App.js + src/), sans node_modules ni scripts."""
    trouves = [os.path.join(RACINE, "App.js")]
    for dossier, sous_dossiers, fichiers in os.walk(os.path.join(RACINE, "src")):
        sous_dossiers[:] = [d for d in sous_dossiers if d != "node_modules"]
        for nom in fichiers:
            if nom.endswith(".js"):
                trouves.append(os.path.join(dossier, nom))
    return trouves


def lire(chemin):
    with open(chemin, encoding="utf-8") as f:
        return f.read()


class TestPlusDeModeHorsLigne(unittest.TestCase):

    def test_les_donnees_de_demonstration_ont_disparu(self):
        # Le fichier lui-même : tant qu'il existe, quelqu'un peut le réimporter.
        self.assertFalse(
            os.path.exists(os.path.join(RACINE, "src", "data", "mockData.js")),
            "src/data/mockData.js est revenu : c'étaient le faux joueur, le faux "
            "classement et les faux duels du mode hors-ligne.",
        )

    def test_aucun_ecran_n_importe_de_donnees_de_demonstration(self):
        for chemin in fichiers_js():
            contenu = lire(chemin)
            for ligne in contenu.split("\n"):
                # On ne regarde que les IMPORTS : les commentaires d'historique
                # ont parfaitement le droit de citer le fichier disparu.
                if ligne.strip().startswith(("import ", "export ")) and "mockData" in ligne:
                    self.fail(
                        "%s importe mockData : le mode hors-ligne revient par la "
                        "petite porte." % os.path.relpath(chemin, RACINE)
                    )

    def test_plus_aucun_ecran_ne_se_demande_s_il_est_connecte(self):
        # `estConnecte` était LE drapeau du mode hors-ligne : chaque écran avait
        # une version dégradée derrière lui (défi validé pour de faux, perf
        # auto-validée, programme « gardé en local »…). On est maintenant
        # toujours sur un vrai compte : le drapeau n'a plus de sens.
        coupables = []
        for chemin in fichiers_js():
            if "estConnecte" in lire(chemin):
                coupables.append(os.path.relpath(chemin, RACINE))
        self.assertEqual(
            coupables, [],
            "estConnecte est réapparu dans %s : s'il faut de nouveau distinguer "
            "« connecté » de « pas connecté », c'est que le mode hors-ligne "
            "revient." % ", ".join(coupables),
        )

    def test_l_app_ne_peut_plus_entrer_sans_serveur(self):
        app = lire(os.path.join(RACINE, "App.js"))
        # L'ancien aiguillage : `enLigne` à faux = on entre quand même.
        self.assertNotIn(
            "setEnLigne", app,
            "App.js a de nouveau un état « en ligne / hors-ligne ». Le serveur "
            "injoignable doit mener à l'écran d'échec, pas à un mode dégradé.",
        )
        # Et l'écran qui l'annonce, avec de quoi réessayer.
        self.assertIn("erreurServeur", app)
        self.assertIn("onReessayer", app)

    def test_la_file_d_attente_des_seances_reste_en_place(self):
        # ⚠️ CE QUI N'EST PAS UN MODE HORS-LIGNE et doit SURVIVRE : la séance en
        # cours et la file des séances terminées pas encore envoyées
        # (src/stockageSeance.js, 07/09/2026). C'est un filet contre la PERTE
        # d'une séance — une coupure en pleine salle, la base qui dort — pas une
        # app parallèle. Les supprimer « pour finir le ménage » ferait perdre
        # des séances.
        stockage = lire(os.path.join(RACINE, "src", "stockageSeance.js"))
        for fonction in ("lireSeanceEnCours", "ecrireSeanceEnCours",
                         "ajouterSeanceEnAttente", "retirerSeanceEnAttente"):
            self.assertIn("export async function %s" % fonction, stockage)


if __name__ == "__main__":
    unittest.main()
