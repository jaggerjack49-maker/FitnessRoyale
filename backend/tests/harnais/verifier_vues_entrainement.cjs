// VÉRIFIE LE DÉCOUPAGE DE L'ONGLET ENTRAÎNEMENT (13/11/2026) — utilisé par
// backend/tests/test_vues_entrainement.py.
//
// EntrainementScreen.js appelle ses vues comme de simples FONCTIONS
// (`vueSeance(ctx)`), en leur passant un paquet de valeurs. Trois erreurs
// passeraient inaperçues jusqu'au moment où l'écran concerné s'affiche — et
// alors l'utilisateur verrait l'écran d'erreur à la place de sa séance :
//   1. un HOOK (useState, useEffect…) ajouté dans une vue : elle est appelée
//      sous condition, donc l'ordre des hooks changerait d'un rendu à l'autre ;
//   2. une vue qui lit un nom que son paquet ne fournit pas (undefined) ;
//   3. un nom qui n'est déclaré nulle part dans un fichier (ReferenceError).
//
// Usage : node verifier_vues_entrainement.cjs <racine du projet>
// Sortie : une ligne par problème, puis « TOTAL n ».
const fs = require('fs'), path = require('path');
const racine = process.argv[2];
const parser = require(path.join(racine, 'node_modules/@babel/parser'));
const traverse = require(path.join(racine, 'node_modules/@babel/traverse')).default;

const ecran = path.join(racine, 'src/screens/EntrainementScreen.js');
const dossier = path.join(racine, 'src/screens/entrainement');
const GLOBAUX = new Set(['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Math',
  'Date', 'Number', 'String', 'Object', 'Array', 'JSON', 'console', 'isNaN', 'parseInt',
  'parseFloat', 'Promise', 'Set', 'Map', 'undefined', 'Boolean', 'Infinity', 'NaN', 'Error',
  'RegExp', 'encodeURIComponent']);
const problemes = [];
const lire = (f) => parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });

function estReferenceJSX(p) {
  const parent = p.parentPath;
  if (parent.isJSXOpeningElement() || parent.isJSXClosingElement()) {
    return p.node === parent.node.name && /^[A-Z]/.test(p.node.name);
  }
  return parent.isJSXMemberExpression() && p.node === parent.node.object;
}

// 3. Aucun nom introuvable, dans aucun fichier.
const fichiers = [ecran, ...fs.readdirSync(dossier).map((f) => path.join(dossier, f))];
for (const f of fichiers) {
  const nom = path.relative(racine, f);
  traverse(lire(f), {
    Identifier(p) {
      if (p.isReferencedIdentifier() && !p.scope.hasBinding(p.node.name) && !GLOBAUX.has(p.node.name)) {
        problemes.push(`${nom}:${p.node.loc.start.line}: « ${p.node.name} » n'est déclaré nulle part`);
      }
    },
    JSXIdentifier(p) {
      if (estReferenceJSX(p) && !p.scope.hasBinding(p.node.name)) {
        problemes.push(`${nom}:${p.node.loc.start.line}: composant « ${p.node.name} » introuvable`);
      }
    },
  });
}

// Les paquets de l'écran principal : nom -> noms fournis (avec `...autre`).
const paquets = {};
const appels = {}; // vue -> paquet passé
traverse(lire(ecran), {
  VariableDeclarator(p) {
    const n = p.node;
    if (!/^ctx/.test(n.id.name) || !n.init || n.init.type !== 'ObjectExpression') return;
    const noms = new Set();
    for (const prop of n.init.properties) {
      if (prop.type === 'SpreadElement') (paquets[prop.argument.name] || []).forEach((x) => noms.add(x));
      else noms.add(prop.key.name);
    }
    paquets[n.id.name] = noms;
  },
  CallExpression(p) {
    const c = p.node.callee;
    if (c.type === 'Identifier' && /^vue[A-Z]/.test(c.name)) appels[c.name] = p.node.arguments[0].name;
  },
});

for (const f of fs.readdirSync(dossier).filter((x) => /^vue[A-Z].*\.js$/.test(x))) {
  const nom = `src/screens/entrainement/${f}`;
  traverse(lire(path.join(dossier, f)), {
    // 1. Pas de hook dans une vue.
    CallExpression(p) {
      const c = p.node.callee;
      const appel = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' ? c.property.name : '');
      if (/^use[A-Z]/.test(appel)) problemes.push(`${nom}:${p.node.loc.start.line}: hook ${appel}() dans une vue`);
    },
    // 2. Chaque nom lu dans `ctx` est bien dans le paquet passé à la vue.
    FunctionDeclaration(p) {
      if (!/^vue[A-Z]/.test(p.node.id.name)) return;
      const vue = p.node.id.name;
      const paquet = paquets[appels[vue]];
      if (!paquet) { problemes.push(`${nom}: ${vue} n'est jamais appelée par EntrainementScreen`); return; }
      const premiere = p.node.body.body[0];
      const decl = premiere && premiere.type === 'VariableDeclaration' && premiere.declarations[0];
      if (!decl || decl.id.type !== 'ObjectPattern' || decl.init.name !== 'ctx') {
        problemes.push(`${nom}: ${vue} doit commencer par « const { … } = ctx; »`); return;
      }
      for (const prop of decl.id.properties) {
        if (!paquet.has(prop.key.name)) {
          problemes.push(`${nom}: ${vue} lit « ${prop.key.name} », absent du paquet ${appels[vue]}`);
        }
      }
    },
  });
}

problemes.forEach((l) => console.log(l));
console.log('TOTAL ' + problemes.length);
