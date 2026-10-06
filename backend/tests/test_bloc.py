"""Les règles du BLOC d'entraînement (src/logic/bloc.js).

Demande de Hafiz du 05/10/2026 : « il faut qu'on puisse maintenant créer des
cycles… un cycle sur un mois… à partir du programme, on peut faire le cycle qui
sera visualisé en tableau », avec le choix « le plan, mais qui se rattrape ».

⚠️ LE HARNAIS TOURNE SOUS PLUSIEURS FUSEAUX HORAIRES, et c'est le point le plus
important de ce fichier. Les règles du bloc sont du calcul de DATES ; écrites en
heure locale, elles se trompent d'une semaine au changement d'heure (Europe) ou
de jour sur la date de fin (fuseaux très à l'est). Or la machine de développement
est en Africa/Ouagadougou — UTC+0, sans changement d'heure : le bug y est
TOTALEMENT INVISIBLE. Vérifié en mutant le calcul en heure locale :
  - Africa/Ouagadougou → tout vert (on n'aurait rien vu) ;
  - Europe/Paris       → « le changement d'heure ne décale pas la semaine » rouge ;
  - Pacific/Auckland   → les deux cas de « fin du bloc » rouges.
Un seul fuseau de test n'aurait donc rien prouvé.

Le test s'ignore si Node est absent (voir les autres harnais, CLAUDE.md).
"""

import json
import os
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

HARNAIS = Path(__file__).parent / "harnais"

# UTC+0 sans changement d'heure (la machine de dev) · changement d'heure ·
# très à l'est, où la date locale est souvent le lendemain de la date UTC.
FUSEAUX = ("Africa/Ouagadougou", "Europe/Paris", "Pacific/Auckland")


class TestBloc(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if shutil.which("node") is None:
            raise unittest.SkipTest(
                "Node n'est pas installé : impossible d'exécuter le code de l'app."
            )
        cls.par_fuseau = {}
        for fuseau in FUSEAUX:
            env = dict(os.environ)
            env["TZ"] = fuseau
            sortie = subprocess.run(
                ["node", "--import", "./resolveur.mjs", "harnais_bloc.mjs"],
                cwd=HARNAIS, capture_output=True, text=True,
                encoding="utf-8", timeout=120, env=env,
            )
            if sortie.returncode != 0:
                raise AssertionError(
                    "Le harnais du bloc n'a pas pu tourner en %s :\n%s"
                    % (fuseau, sortie.stderr or "")
                )
            cls.par_fuseau[fuseau] = json.loads(sortie.stdout)

    def test_tous_les_cas_sous_tous_les_fuseaux(self):
        for fuseau, resultats in self.par_fuseau.items():
            self.assertGreater(len(resultats), 0, "aucun cas n'a été exécuté")
            for resultat in resultats:
                with self.subTest(fuseau=fuseau, cas=resultat["nom"]):
                    self.assertNotIn(
                        "erreur", resultat, f"plantage : {resultat.get('erreur')}"
                    )
                    self.assertEqual(
                        resultat["obtenu"], resultat["attendu"],
                        f"cas « {resultat['nom']} » en {fuseau}",
                    )

    def test_les_regles_de_date_ne_dependent_pas_du_fuseau(self):
        """Le MÊME calcul doit donner le MÊME résultat partout.

        C'est ce qui interdit de revenir un jour à `new Date('...T12:00:00')`,
        dont la réponse dépend de l'endroit où tourne le code.
        """
        reference = self.par_fuseau[FUSEAUX[0]]
        for fuseau in FUSEAUX[1:]:
            autre = self.par_fuseau[fuseau]
            for attendu, obtenu in zip(reference, autre):
                with self.subTest(fuseau=fuseau, cas=attendu["nom"]):
                    self.assertEqual(
                        attendu.get("obtenu"), obtenu.get("obtenu"),
                        f"« {attendu['nom']} » répond autre chose en {fuseau}",
                    )


if __name__ == "__main__":
    unittest.main()
