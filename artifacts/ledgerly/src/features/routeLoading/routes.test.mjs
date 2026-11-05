import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('App.jsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function nodes(predicate) {
  const found = [];
  function visit(node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(tree);
  return found;
}
const jsxElements = nodes(node => ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node));
const attr = (node, name) => node.attributes.properties.find(item => item.name?.getText(tree) === name)?.initializer;

test('all existing paths retain their exact page, document-kind props, fallbacks and redirects', () => {
  const expected = JSON.parse(readFileSync(new URL('./route-inventory.json', import.meta.url), 'utf8'));
  const actual = jsxElements.filter(node => node.tagName.getText(tree) === 'Route' && attr(node, 'path'))
    .map(node => ({ path: attr(node, 'path').text, element: attr(node, 'element').expression.getText(tree) }));
  assert.deepEqual(actual, expected);
});

test('auth and company boundaries remain around the workspace; feature pages load only on demand', () => {
  const eager = nodes(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
  for (const module of ['@clerk/react', '@/lib/AuthContext', '@/components/ProtectedRoute', '@/lib/useCompany', '@/components/layout/AppLayout']) {
    assert.ok(eager.includes(module), `Missing preserved eager boundary ${module}`);
  }
  assert.equal(eager.some(module => module.startsWith('@/pages/')), false);
  const routes = jsxElements.filter(node => node.tagName.getText(tree) === 'Route' && !attr(node, 'path'));
  assert.ok(routes.some(node => attr(node, 'element').expression.getText(tree) === '<ProtectedRoute unauthenticatedElement={<Navigate to="/sign-in" replace />} />'));
  assert.ok(routes.some(node => attr(node, 'element').expression.getText(tree) === '<CompanyProvider><AppLayout /></CompanyProvider>'));
  const lazyPages = nodes(ts.isCallExpression).filter(node => node.expression.getText(tree) === 'lazyRoute');
  assert.equal(lazyPages.length, 42);
  assert.ok(lazyPages.every(node => node.arguments[0] && ts.isArrowFunction(node.arguments[0])));
});
