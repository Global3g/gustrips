/* Audit (AST-based): find React components where a hook is called AFTER an
 * early return / guard at the top level of the function — the React #310
 * pattern ("rendered more hooks than the previous render"). ESLint's
 * rules-of-hooks does NOT catch this. Used by the react-hooks-reviewer agent.
 *
 * Run: node scripts/scan-hooks-after-return.js
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const roots = [
  'src/app/(app)/trips',
  'src/components/trips',
  'src/components/expenses',
  'src/components/onboarding-wizard',
];

function walk(d, acc) {
  let entries;
  try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return acc; }
  for (const x of entries) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p, acc);
    else if (x.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

let files = [];
for (const r of roots) walk(r, files);
files = [...new Set(files)];

const isHookName = (n) => /^use[A-Z]/.test(n);

function statementHookName(stmt) {
  if (ts.isVariableStatement(stmt)) {
    for (const d of stmt.declarationList.declarations) {
      let init = d.initializer;
      if (init && ts.isAwaitExpression(init)) init = init.expression;
      if (init && ts.isCallExpression(init) && ts.isIdentifier(init.expression) && isHookName(init.expression.text)) {
        return init.expression.text;
      }
    }
  }
  if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
    const c = stmt.expression;
    if (ts.isIdentifier(c.expression) && isHookName(c.expression.text)) return c.expression.text;
  }
  return null;
}

function isGuard(stmt) {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (ts.isIfStatement(stmt)) {
    let has = false;
    const check = (n) => {
      if (!n) return;
      if (ts.isReturnStatement(n) || ts.isThrowStatement(n)) { has = true; return; }
      if (ts.isFunctionLike(n)) return;
      n.forEachChild(check);
    };
    check(stmt.thenStatement);
    if (stmt.elseStatement) check(stmt.elseStatement);
    return has;
  }
  return false;
}

const flagged = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    let body = null;
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.body && ts.isBlock(node.body)) {
      body = node.body;
    }
    if (body && body.statements.some((s) => statementHookName(s))) {
      let guardLine = -1;
      for (const stmt of body.statements) {
        if (guardLine < 0 && isGuard(stmt)) {
          guardLine = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1;
          continue;
        }
        const hook = statementHookName(stmt);
        if (hook && guardLine > 0) {
          const hookLine = sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1;
          flagged.push(`${file}  →  ${hook}@${hookLine} viene DESPUÉS de un return/guard@${guardLine}`);
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
}

console.log(flagged.length ? flagged.join('\n') : '✅ Sin hooks después de returns (ningún #310 de este tipo).');
console.log(`\nArchivos escaneados: ${files.length} · hallazgos: ${flagged.length}`);
process.exit(flagged.length > 0 ? 1 : 0);
