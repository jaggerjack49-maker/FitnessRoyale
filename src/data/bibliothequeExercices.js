// =============================================================================
// LA BIBLIOTHÈQUE D'EXERCICES (passe 3 de la refonte Entraînement)
// =============================================================================
//
// Demande de Hafiz : « il y aura donc une liste complète d'exercices avec des
// visuels ».
//
// -----------------------------------------------------------------------------
// ⚠️ CE FICHIER NE REMPLACE PAS LE TEXTE LIBRE, IL S'AJOUTE À CÔTÉ
// -----------------------------------------------------------------------------
// On peut TOUJOURS taper le nom qu'on veut — c'est une règle de fond de l'app
// (« Entraînement : INDÉPENDANCE TOTALE du barème »), et personne ne doit se
// retrouver bloqué parce que sa machine ne figure pas dans une liste. La
// bibliothèque est un RACCOURCI : elle évite de retaper, et surtout elle évite
// les fautes de frappe — or le NOM d'un exercice EST son identifiant dans ce
// projet (voir CLAUDE.md du 04/09/2026). « developé couché » et « développé
// couché » sont deux exercices différents pour l'app : deux historiques, deux
// records, deux suggestions de charge. Choisir dans une liste supprime ce
// problème à la source.
//
// -----------------------------------------------------------------------------
// LE SECOND SERVICE RENDU : LE GROUPE MUSCULAIRE EST CONNU D'AVANCE
// -----------------------------------------------------------------------------
// Jusqu'ici, le groupe d'un exercice était DEVINÉ par mots-clés
// (`deviner_groupe`, src/data/groupesMusculaires.js), ce qui a déjà produit des
// classements silencieusement faux (« unilatéral raises » comptées dans le Dos,
// bug du 03/09/2026). Un exercice de la bibliothèque porte son groupe NOIR SUR
// BLANC : plus rien à deviner pour lui. La détection par mots-clés reste là
// pour tout ce qui est tapé à la main.
//
// -----------------------------------------------------------------------------
// ⚠️ POURQUOI LE « VISUEL » EST LE MATÉRIEL, ET PAS UN DESSIN PAR EXERCICE
// -----------------------------------------------------------------------------
// Dessiner 95 pictogrammes distincts à la main est hors de portée, et des
// illustrations sur mesure demanderaient un graphiste (même décision que pour
// l'avatar évolutif, 20/07/2026 ; les arènes n'ont de vraies images que parce
// que Hafiz les a fournies). Surtout, à 28 px, « développé couché » et
// « développé incliné » donneraient deux bonshommes identiques : un dessin par
// exercice n'apporterait AUCUNE information.
// Le matériel, lui, se reconnaît d'un coup d'œil et c'est exactement ce qu'on
// cherche à savoir en parcourant une liste (« qu'est-ce que je peux faire avec
// une barre ? »). Chaque ligne porte donc le pictogramme de son matériel, et le
// groupe musculaire est écrit à côté.
//
// -----------------------------------------------------------------------------
// LES CHAMPS
// -----------------------------------------------------------------------------
//   nom      : le nom EXACT qui sera écrit dans le programme et l'historique.
//   groupe   : un des 12 groupes de `groupesMusculaires` (vérifié par un test).
//   materiel : une des clés de MATERIELS ci-dessous (vérifié par un test).
//   alias    : des mots pour la RECHERCHE seulement (anglais, abréviations…).
//              Jamais affichés, jamais enregistrés.

// Les familles de matériel. `icone` renvoie au répertoire de Icones.js.
export const MATERIELS = {
  barre: { libelle: 'Barre', icone: 'mat-barre' },
  halteres: { libelle: 'Haltères', icone: 'mat-halteres' },
  poulie: { libelle: 'Poulie', icone: 'mat-poulie' },
  machine: { libelle: 'Machine', icone: 'mat-machine' },
  corps: { libelle: 'Poids du corps', icone: 'mat-corps' },
  elastique: { libelle: 'Élastique', icone: 'mat-elastique' },
  kettlebell: { libelle: 'Kettlebell', icone: 'mat-kettlebell' },
  cardio: { libelle: 'Cardio', icone: 'mat-cardio' },
};

export const bibliothequeExercices = [
  // --- PECTORAUX ---
  { nom: 'Développé couché', groupe: 'Pectoraux', materiel: 'barre', alias: ['bench press', 'bench'] },
  { nom: 'Développé couché prise serrée', groupe: 'Pectoraux', materiel: 'barre', alias: ['close grip bench'] },
  { nom: 'Développé incliné', groupe: 'Pectoraux', materiel: 'barre', alias: ['incline bench press'] },
  { nom: 'Développé décliné', groupe: 'Pectoraux', materiel: 'barre', alias: ['decline bench press'] },
  { nom: 'Développé couché haltères', groupe: 'Pectoraux', materiel: 'halteres', alias: ['dumbbell bench press'] },
  { nom: 'Développé incliné haltères', groupe: 'Pectoraux', materiel: 'halteres', alias: ['incline dumbbell press'] },
  { nom: 'Écarté couché haltères', groupe: 'Pectoraux', materiel: 'halteres', alias: ['dumbbell fly', 'flye'] },
  { nom: 'Écarté à la poulie', groupe: 'Pectoraux', materiel: 'poulie', alias: ['cable crossover', 'cable fly'] },
  { nom: 'Pec deck', groupe: 'Pectoraux', materiel: 'machine', alias: ['butterfly', 'chest fly machine'] },
  { nom: 'Développé poitrine machine', groupe: 'Pectoraux', materiel: 'machine', alias: ['chest press'] },
  { nom: 'Pompes', groupe: 'Pectoraux', materiel: 'corps', alias: ['push up', 'pushup'] },
  { nom: 'Pompes inclinées', groupe: 'Pectoraux', materiel: 'corps', alias: ['incline push up'] },
  { nom: 'Dips', groupe: 'Pectoraux', materiel: 'corps', alias: ['dip', 'chest dips'] },

  // --- DOS ---
  { nom: 'Soulevé de terre', groupe: 'Dos', materiel: 'barre', alias: ['deadlift'] },
  { nom: 'Rowing barre', groupe: 'Dos', materiel: 'barre', alias: ['barbell row', 'bent over row'] },
  { nom: 'Rowing haltère un bras', groupe: 'Dos', materiel: 'halteres', alias: ['one arm dumbbell row'] },
  { nom: 'Rowing T-barre', groupe: 'Dos', materiel: 'machine', alias: ['t bar row'] },
  { nom: 'Rowing assis machine', groupe: 'Dos', materiel: 'machine', alias: ['seated row'] },
  { nom: 'Tirage vertical', groupe: 'Dos', materiel: 'poulie', alias: ['lat pulldown', 'pulldown'] },
  { nom: 'Tirage horizontal', groupe: 'Dos', materiel: 'poulie', alias: ['cable row'] },
  { nom: 'Pull over à la poulie', groupe: 'Dos', materiel: 'poulie', alias: ['cable pullover', 'straight arm pulldown'] },
  { nom: 'Tirage à l’élastique', groupe: 'Dos', materiel: 'elastique', alias: ['band row'] },
  { nom: 'Tractions', groupe: 'Dos', materiel: 'corps', alias: ['pull up', 'pullup'] },
  { nom: 'Tractions supination', groupe: 'Dos', materiel: 'corps', alias: ['chin up', 'chinup'] },
  { nom: 'Shrug barre', groupe: 'Dos', materiel: 'barre', alias: ['shrugs', 'trapeze'] },
  { nom: 'Shrug haltères', groupe: 'Dos', materiel: 'halteres', alias: ['dumbbell shrugs'] },

  // --- ÉPAULES ---
  { nom: 'Développé militaire', groupe: 'Épaules', materiel: 'barre', alias: ['military press', 'overhead press', 'ohp'] },
  { nom: 'Développé haltères assis', groupe: 'Épaules', materiel: 'halteres', alias: ['seated dumbbell press'] },
  { nom: 'Développé Arnold', groupe: 'Épaules', materiel: 'halteres', alias: ['arnold press'] },
  { nom: 'Développé épaules machine', groupe: 'Épaules', materiel: 'machine', alias: ['shoulder press machine'] },
  { nom: 'Élévations latérales', groupe: 'Épaules', materiel: 'halteres', alias: ['lateral raise', 'side raise'] },
  { nom: 'Élévations latérales à la poulie', groupe: 'Épaules', materiel: 'poulie', alias: ['cable lateral raise'] },
  { nom: 'Élévations frontales', groupe: 'Épaules', materiel: 'halteres', alias: ['front raise'] },
  { nom: 'Oiseau haltères', groupe: 'Épaules', materiel: 'halteres', alias: ['rear delt raise', 'bent over raise'] },
  { nom: 'Face pull', groupe: 'Épaules', materiel: 'poulie', alias: ['facepull', 'rear delt'] },
  { nom: 'Rowing menton', groupe: 'Épaules', materiel: 'barre', alias: ['upright row'] },
  { nom: 'Rotation externe à l’élastique', groupe: 'Épaules', materiel: 'elastique', alias: ['external rotation', 'coiffe'] },

  // --- BICEPS ---
  { nom: 'Curl barre', groupe: 'Biceps', materiel: 'barre', alias: ['barbell curl'] },
  { nom: 'Curl haltères', groupe: 'Biceps', materiel: 'halteres', alias: ['dumbbell curl'] },
  { nom: 'Curl marteau', groupe: 'Biceps', materiel: 'halteres', alias: ['hammer curl'] },
  { nom: 'Curl incliné', groupe: 'Biceps', materiel: 'halteres', alias: ['incline curl'] },
  { nom: 'Curl pupitre', groupe: 'Biceps', materiel: 'barre', alias: ['preacher curl'] },
  { nom: 'Curl à la poulie', groupe: 'Biceps', materiel: 'poulie', alias: ['cable curl'] },
  { nom: 'Curl concentré', groupe: 'Biceps', materiel: 'halteres', alias: ['concentration curl'] },

  // --- TRICEPS ---
  { nom: 'Barre au front', groupe: 'Triceps', materiel: 'barre', alias: ['skull crusher', 'skullcrusher'] },
  { nom: 'Extension triceps nuque', groupe: 'Triceps', materiel: 'halteres', alias: ['overhead extension'] },
  { nom: 'Extension triceps à la corde', groupe: 'Triceps', materiel: 'poulie', alias: ['rope pushdown'] },
  { nom: 'Pushdown à la poulie', groupe: 'Triceps', materiel: 'poulie', alias: ['triceps pushdown'] },
  { nom: 'Kickback haltère', groupe: 'Triceps', materiel: 'halteres', alias: ['triceps kickback'] },
  { nom: 'Dips triceps', groupe: 'Triceps', materiel: 'corps', alias: ['bench dips'] },

  // --- QUADRICEPS ---
  { nom: 'Squat', groupe: 'Quadriceps', materiel: 'barre', alias: ['back squat'] },
  { nom: 'Squat avant', groupe: 'Quadriceps', materiel: 'barre', alias: ['front squat'] },
  { nom: 'Squat gobelet', groupe: 'Quadriceps', materiel: 'halteres', alias: ['goblet squat'] },
  { nom: 'Presse à cuisses', groupe: 'Quadriceps', materiel: 'machine', alias: ['leg press'] },
  { nom: 'Hack squat', groupe: 'Quadriceps', materiel: 'machine', alias: ['hacksquat'] },
  { nom: 'Leg extension', groupe: 'Quadriceps', materiel: 'machine', alias: ['extension jambes'] },
  { nom: 'Fentes haltères', groupe: 'Quadriceps', materiel: 'halteres', alias: ['lunges'] },
  { nom: 'Fentes marchées', groupe: 'Quadriceps', materiel: 'halteres', alias: ['walking lunges'] },
  { nom: 'Fentes bulgares', groupe: 'Quadriceps', materiel: 'halteres', alias: ['bulgarian split squat'] },
  { nom: 'Step up', groupe: 'Quadriceps', materiel: 'halteres', alias: ['stepup', 'montee de banc'] },
  { nom: 'Pistol squat', groupe: 'Quadriceps', materiel: 'corps', alias: ['squat une jambe'] },

  // --- ISCHIO-JAMBIERS ---
  { nom: 'Soulevé de terre roumain', groupe: 'Ischio-jambiers', materiel: 'barre', alias: ['romanian deadlift', 'rdl'] },
  { nom: 'Soulevé de terre jambes tendues', groupe: 'Ischio-jambiers', materiel: 'barre', alias: ['stiff leg deadlift'] },
  { nom: 'Leg curl allongé', groupe: 'Ischio-jambiers', materiel: 'machine', alias: ['lying leg curl'] },
  { nom: 'Leg curl assis', groupe: 'Ischio-jambiers', materiel: 'machine', alias: ['seated leg curl'] },
  { nom: 'Good morning', groupe: 'Ischio-jambiers', materiel: 'barre', alias: ['goodmorning'] },
  { nom: 'Nordic curl', groupe: 'Ischio-jambiers', materiel: 'corps', alias: ['nordic hamstring'] },

  // --- FESSIERS ---
  { nom: 'Hip thrust', groupe: 'Fessiers', materiel: 'barre', alias: ['hipthrust'] },
  { nom: 'Soulevé de terre sumo', groupe: 'Fessiers', materiel: 'barre', alias: ['sumo deadlift'] },
  { nom: 'Kickback fessier', groupe: 'Fessiers', materiel: 'poulie', alias: ['glute kickback'] },
  { nom: 'Abduction à la machine', groupe: 'Fessiers', materiel: 'machine', alias: ['hip abduction'] },
  { nom: 'Abduction à l’élastique', groupe: 'Fessiers', materiel: 'elastique', alias: ['band abduction'] },
  { nom: 'Pont fessier', groupe: 'Fessiers', materiel: 'corps', alias: ['glute bridge'] },
  { nom: 'Kettlebell swing', groupe: 'Fessiers', materiel: 'kettlebell', alias: ['swing'] },

  // --- MOLLETS ---
  { nom: 'Extension mollets debout', groupe: 'Mollets', materiel: 'machine', alias: ['standing calf raise'] },
  { nom: 'Extension mollets assis', groupe: 'Mollets', materiel: 'machine', alias: ['seated calf raise'] },
  { nom: 'Mollets à la presse', groupe: 'Mollets', materiel: 'machine', alias: ['calf press'] },
  { nom: 'Calf raise haltères', groupe: 'Mollets', materiel: 'halteres', alias: ['dumbbell calf raise'] },

  // --- ABDOS ---
  { nom: 'Crunch', groupe: 'Abdos', materiel: 'corps', alias: ['crunchs'] },
  { nom: 'Crunch à la poulie', groupe: 'Abdos', materiel: 'poulie', alias: ['cable crunch'] },
  { nom: 'Relevé de jambes suspendu', groupe: 'Abdos', materiel: 'corps', alias: ['hanging leg raise'] },
  { nom: 'Gainage planche', groupe: 'Abdos', materiel: 'corps', alias: ['plank'] },
  { nom: 'Planche latérale', groupe: 'Abdos', materiel: 'corps', alias: ['side plank'] },
  { nom: 'Russian twist', groupe: 'Abdos', materiel: 'corps', alias: ['twist russe'] },
  { nom: 'Roue abdominale', groupe: 'Abdos', materiel: 'corps', alias: ['ab wheel', 'ab roller'] },
  { nom: 'Sit up', groupe: 'Abdos', materiel: 'corps', alias: ['situp'] },

  // --- AVANT-BRAS ---
  { nom: 'Curl poignets barre', groupe: 'Avant-bras', materiel: 'barre', alias: ['wrist curl'] },
  { nom: 'Extension poignets barre', groupe: 'Avant-bras', materiel: 'barre', alias: ['reverse wrist curl'] },
  { nom: 'Marche du fermier', groupe: 'Avant-bras', materiel: 'halteres', alias: ['farmer walk', 'farmers carry'] },

  // --- CARDIO ---
  { nom: 'Course à pied', groupe: 'Cardio', materiel: 'cardio', alias: ['running', 'footing'] },
  { nom: 'Tapis de course', groupe: 'Cardio', materiel: 'cardio', alias: ['treadmill'] },
  { nom: 'Vélo', groupe: 'Cardio', materiel: 'cardio', alias: ['bike', 'velo elliptique'] },
  { nom: 'Rameur', groupe: 'Cardio', materiel: 'cardio', alias: ['rower', 'rowing machine'] },
  { nom: 'Elliptique', groupe: 'Cardio', materiel: 'cardio', alias: ['elliptical'] },
  { nom: 'Corde à sauter', groupe: 'Cardio', materiel: 'cardio', alias: ['jump rope'] },
  { nom: 'Burpees', groupe: 'Cardio', materiel: 'corps', alias: ['burpee'] },
];

// -----------------------------------------------------------------------------
// RECHERCHE ET CONSULTATION
// -----------------------------------------------------------------------------

// Même normalisation que `groupesMusculaires.js` (minuscules, sans accents,
// ponctuation en espaces) : « Developpe couche », « développé-couché » et
// « DÉVELOPPÉ COUCHÉ » doivent se retrouver pareil.
//
// ⚠️ ELLE EST RECOPIÉE ICI VOLONTAIREMENT, ET C'EST LE SEUL ENDROIT DU PROJET
// OÙ JE M'AUTORISE ÇA : l'importer depuis `groupesMusculaires.js` créerait un
// CYCLE D'IMPORTS (ce fichier-là a besoin de la bibliothèque pour connaître le
// groupe d'un exercice). Un cycle entre deux modules JS ne lève pas d'erreur :
// il laisse simplement une des deux valeurs à `undefined` au chargement, donc
// un plantage bien plus tard et très difficile à relier à sa cause. Un test
// compare les deux fonctions sur une liste de mots pour qu'elles ne puissent
// pas divergir en silence.
export function normaliserNomExercice(texte) {
  return String(texte == null ? '' : texte)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// L'index nom normalisé -> exercice, construit UNE fois au chargement.
const parNomNormalise = new Map();
bibliothequeExercices.forEach((exo) => {
  parNomNormalise.set(normaliserNomExercice(exo.nom), exo);
});

// Cet exercice est-il DÉJÀ dans la liste qu'on est en train de remplir ?
//
// ⚠️ LA COMPARAISON DOIT ÊTRE NORMALISÉE, et ça s'est vu à l'écran : le
// programme de test contenait « developpe couche » (tapé à la main, sans
// accents) et la bibliothèque proposait « Développé couché » sans le griser.
// En l'ajoutant, on se retrouvait avec DEUX exercices pour un seul mouvement —
// deux historiques, deux records, deux suggestions de charge. C'est le piège
// de fond du projet : le NOM est l'identifiant (CLAUDE.md du 04/09/2026).
export function dejaChoisi(nom, dejaPris) {
  const cherche = normaliserNomExercice(nom);
  if (!cherche) return false;
  return (Array.isArray(dejaPris) ? dejaPris : [])
    .some((autre) => normaliserNomExercice(autre) === cherche);
}

// L'exercice de la bibliothèque portant ce nom, ou null.
// La comparaison est normalisée : un nom tapé à la main sans accent ou avec un
// tiret retrouve quand même sa fiche.
export function exerciceDeLaBibliotheque(nom) {
  return parNomNormalise.get(normaliserNomExercice(nom)) || null;
}

// Le groupe musculaire d'un exercice de la bibliothèque, ou null s'il n'en est
// pas. C'est ce que `groupeDeLExercice` consulte avant de deviner.
export function groupeDeLaBibliotheque(nom) {
  const exo = exerciceDeLaBibliotheque(nom);
  return exo ? exo.groupe : null;
}

// Les exercices qui correspondent à une recherche, éventuellement filtrés par
// groupe. Triés par GROUPE puis par nom : une liste de 95 lignes doit rester
// lisible, et on cherche presque toujours « un exercice de dos », pas « un
// exercice dont le nom commence par T ».
//
// La recherche porte sur le nom ET les alias (« bench press » trouve
// « Développé couché »), mot à mot : taper « curl halteres » trouve « Curl
// haltères » même si les mots sont dans un autre ordre.
export function chercherExercices(recherche, groupe) {
  const mots = normaliserNomExercice(recherche).split(' ').filter(Boolean);
  return bibliothequeExercices
    .filter((exo) => {
      if (groupe && exo.groupe !== groupe) return false;
      if (mots.length === 0) return true;
      const botte = normaliserNomExercice(`${exo.nom} ${(exo.alias || []).join(' ')} ${exo.groupe}`);
      return mots.every((mot) => botte.indexOf(mot) >= 0);
    })
    .sort((a, b) => (
      a.groupe === b.groupe
        ? a.nom.localeCompare(b.nom, 'fr')
        : a.groupe.localeCompare(b.groupe, 'fr')
    ));
}

// La ligne de description d'un exercice : « Pectoraux · Barre ».
//
// ⚠️ ELLE ÉVITE UN DOUBLON QUI SE VOIT : pour les exercices de cardio, le
// groupe musculaire ET le matériel s'appellent tous les deux « Cardio », ce
// qui affichait « Cardio · Cardio ». On n'écrit alors le mot qu'une fois.
// UNE SEULE DÉFINITION parce que deux écrans affichent cette ligne (la liste
// et la fiche) — recopier le ternaire, c'est se garantir qu'un des deux
// gardera le doublon le jour où on le corrigera dans l'autre.
export function descriptionExercice(exo) {
  if (!exo) return '';
  const materiel = MATERIELS[exo.materiel];
  const libelle = materiel ? materiel.libelle : 'autre';
  return libelle === exo.groupe ? exo.groupe : `${exo.groupe} · ${libelle}`;
}

// Combien d'exercices par groupe — pour afficher « Dos (13) » sur les filtres.
export function nombreParGroupe() {
  const total = {};
  bibliothequeExercices.forEach((exo) => {
    total[exo.groupe] = (total[exo.groupe] || 0) + 1;
  });
  return total;
}
