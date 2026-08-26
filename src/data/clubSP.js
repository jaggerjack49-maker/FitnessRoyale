// Barèmes officiels de Fitness Royale ("Fight for it").
// (le fichier garde son ancien nom clubSP.js : c'est un chemin d'import,
//  le renommer toucherait une dizaine de fichiers sans rien apporter.)
// Chaque exercice a des paliers : atteindre le palier N = ligue N.
// Hommes : 6 ligues (Bronze → Royal). Femmes : 5 ligues (Bronze → Titan).
// unite 'kg'  = charge à soulever pour le nombre de reps indiqué.
// unite 'reps' = nombre de répétitions au poids du corps
//               (les variantes avec lest existent, on les gérera plus tard).

export const nomsLigues = ['Bronze', 'Silver', 'Gold', 'Legend', 'Titan', 'Royal'];

// Couleurs des ligues — reprises de la maquette du designer (12/08/2026).
// Elles pilotent BEAUCOUP de choses : l'avatar évolutif, les losanges, le
// décor SVG de l'arène (qui fabrique ses dégradés à partir de cette seule
// couleur), les lignes de classement. Les changer suffit à reteinter l'app.
export const couleursLigues = {
  Aucune: '#75727c',
  Bronze: '#cd8a4b',
  Silver: '#c0c4cc',
  Gold: '#e8b23a',
  Legend: '#b06ef5',
  Titan: '#55c8f0',
  Royal: '#ff5470',
};

export const baremes = {
  homme: {
    // PECTORAUX
    'Développé couché': { unite: 'kg', reps: 10, paliers: [70, 85, 100, 120, 135, 145] },
    'Développé incliné': { unite: 'kg', reps: 10, paliers: [65, 80, 95, 110, 120, 130] },
    'Développé décliné': { unite: 'kg', reps: 10, paliers: [80, 95, 110, 125, 140, 155] },
    // DORSAUX
    'Traction prise large': { unite: 'reps', paliers: [10, 15, 20, 30, 35, 40] },
    'Soulevé de terre': { unite: 'kg', reps: 5, paliers: [120, 150, 170, 190, 210, 230] },
    'Rowing planche': { unite: 'kg', reps: 10, paliers: [60, 70, 80, 90, 100, 110] },
    // ÉPAULES
    'Développé avec haltères': { unite: 'kg', reps: 10, paliers: [20, 25, 30, 35, 40, 45] },
    // BICEPS
    'Curl barre': { unite: 'kg', reps: 10, paliers: [30, 37.5, 45, 50, 60, 65] },
    'Traction prise supination': { unite: 'reps', paliers: [10, 15, 20, 30, 35, 40] },
    'Curl incliné': { unite: 'kg', reps: 10, paliers: [14, 16, 18, 20, 22, 24] },
    // TRICEPS
    'Dips': { unite: 'reps', paliers: [20, 30, 40, 50, 60, 70] },
    'Développé couché prise serrée': { unite: 'kg', reps: 10, paliers: [60, 75, 90, 105, 120, 130] },
    // QUADRICEPS
    'Squat': { unite: 'kg', reps: 10, paliers: [80, 100, 120, 140, 160, 180] },
    'Squat avant': { unite: 'kg', reps: 10, paliers: [65, 80, 95, 110, 130, 150] },
    // ISCHIOS-JAMBIERS
    'Soulevé de terre jambes tendues': { unite: 'kg', reps: 10, paliers: [70, 90, 110, 135, 160, 180] },
  },
  femme: {
    // PECTORAUX
    'Développé couché': { unite: 'kg', reps: 10, paliers: [30, 37.5, 45, 52.5, 60] },
    'Développé incliné': { unite: 'kg', reps: 10, paliers: [22.5, 30, 37.5, 45, 52.5] },
    'Développé décliné': { unite: 'kg', reps: 10, paliers: [35, 42.5, 50, 57.5, 65] },
    // DORSAUX
    'Traction prise large': { unite: 'reps', paliers: [2, 5, 8, 12, 15] },
    'Soulevé de terre': { unite: 'kg', reps: 5, paliers: [60, 72.5, 85, 100, 115] },
    'Rowing planche': { unite: 'kg', reps: 10, paliers: [25, 30, 35, 42.5, 47.5] },
    // ÉPAULES
    'Développé avec haltères': { unite: 'kg', reps: 10, paliers: [8, 9, 10, 12, 14] },
    // BICEPS
    'Curl barre': { unite: 'kg', reps: 10, paliers: [15, 17.5, 22.5, 27.5, 32.5] },
    'Traction prise supination': { unite: 'reps', paliers: [3, 6, 9, 13, 16] },
    'Curl incliné': { unite: 'kg', reps: 10, paliers: [7, 8, 9, 10, 12] },
    // TRICEPS
    'Dips': { unite: 'reps', paliers: [8, 12, 16, 20, 25] },
    'Développé couché prise serrée': { unite: 'kg', reps: 10, paliers: [30, 37.5, 45, 52.5, 60] },
    // QUADRICEPS
    'Squat': { unite: 'kg', reps: 10, paliers: [40, 50, 60, 70, 80] },
    'Squat avant': { unite: 'kg', reps: 10, paliers: [30, 37.5, 45, 55, 65] },
    // ISCHIOS-JAMBIERS
    'Soulevé de terre jambes tendues': { unite: 'kg', reps: 10, paliers: [50, 57.5, 67.5, 80, 90] },
  },
};
