// LES TEXTES AFFICHÉS PAR L'APP qui contiennent un motif — utilisé par
// backend/tests/test_pas_de_serveur_a_l_ecran.py (10/11/2026).
//
// Pourquoi le parseur Babel et pas une expression régulière : il faut ne voir
// QUE ce qui s'affiche (chaînes, gabarits `…`, texte JSX), jamais les
// commentaires ni les noms de variables (`moiServeur`, `reveillerServeur`…).
// Une regex se perd dans les apostrophes du texte JSX (« l'app »).
//
// Usage : node textes_affiches.cjs <racine du projet> <motif>
// Sortie : une ligne « fichier:ligne: texte » par trouvaille, puis « TOTAL n ».
const fs = require('fs'), path = require('path');
const racine = process.argv[2];
const parser = require(path.join(racine, 'node_modules/@babel/parser'));
const motif = new RegExp(process.argv[3] || 'serveur', 'i');
function fichiers(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? fichiers(p) : (p.endsWith('.js') ? [p] : []); }); }
const liste = [path.join(racine, 'App.js'), ...fichiers(path.join(racine, 'src'))];
let n = 0;
for (const f of liste) {
  const code = fs.readFileSync(f, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  (function visite(noeud, parent) {
    if (!noeud || typeof noeud.type !== 'string') return;
    let texte = null;
    if (noeud.type === 'StringLiteral' && !(parent && (parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration'))) texte = noeud.value;
    if (noeud.type === 'TemplateElement') texte = noeud.value.cooked;
    if (noeud.type === 'JSXText') texte = noeud.value;
    if (texte && motif.test(texte)) { n++; console.log(path.relative(racine, f) + ':' + noeud.loc.start.line + ': ' + texte.replace(/\s+/g, ' ').trim().slice(0, 140)); }
    for (const k of Object.keys(noeud)) {
      if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
      const v = noeud[k];
      if (Array.isArray(v)) v.forEach((x) => visite(x, noeud)); else if (v && typeof v.type === 'string') visite(v, noeud);
    }
  })(ast.program, null);
}
console.log('TOTAL', n);
