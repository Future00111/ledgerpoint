import test from 'node:test';
import assert from 'node:assert/strict';
import { authPaths } from './authPaths.mjs';
import { readFileSync } from 'node:fs';
test('root app retains existing authentication routes', () => {
  assert.deepEqual(authPaths('/'), { home: '/', signIn: '/sign-in' });
});
test('mounted authentication never escapes its app prefix', () => {
  assert.deepEqual(authPaths('/job32-auth/'), { home: '/job32-auth/', signIn: '/job32-auth/sign-in' });
});
test('base paths with or without trailing slash agree', () => {
  assert.deepEqual(authPaths('/job32-auth'), authPaths('/job32-auth/'));
});
test('normal sidebar sign-out delegates to the base-aware authentication context', () => {
  const source = readFileSync(new URL('../components/layout/Sidebar.jsx', import.meta.url), 'utf8');
  assert.match(source, /onClick=\{logout\}/);
  assert.match(source, /\{\s*user,\s*logout\s*\}\s*=\s*useAuth\(\)/);
  assert.doesNotMatch(source, /signOut\s*\(|useClerk/);
});
