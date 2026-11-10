import test from 'node:test';
import assert from 'node:assert/strict';
import { guidancePreferenceKey, readGuidancePreference, saveGuidancePreference, GUIDANCE_STORAGE_WARNING, GUIDANCE_INVALID_WARNING } from './preferences.mjs';

function memoryStorage() {
  const values = new Map();
  return { values, getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value) };
}

test('new business defaults to professional view and a reload restores either explicit choice', () => {
  const storage = memoryStorage(), getStorage = () => storage;
  assert.equal(readGuidancePreference('user-a', 'company-a', getStorage).guided, false);
  assert.equal(storage.values.size, 0);
  for (const choice of [true, false, true]) {
    saveGuidancePreference('user-a', 'company-a', choice, getStorage);
    assert.equal(readGuidancePreference('user-a', 'company-a', getStorage).guided, choice);
  }
  assert.deepEqual([...storage.values.values()], ['true']);
});

test('preferences are isolated by both authenticated account and company, including delimiter-like IDs', () => {
  const storage = memoryStorage(), getStorage = () => storage;
  saveGuidancePreference('user-a', 'company-a', true, getStorage);
  for (const [account, company] of [['user-b', 'company-a'], ['user-a', 'company-b'], ['user-b', 'company-b']]) {
    assert.equal(readGuidancePreference(account, company, getStorage).guided, false);
  }
  assert.notEqual(guidancePreferenceKey('a:b', 'c'), guidancePreferenceKey('a', 'b:c'));
  saveGuidancePreference('user-b', 'company-a', false, getStorage);
  assert.equal(readGuidancePreference('user-a', 'company-a', getStorage).guided, true);
});

test('missing identity never reads or writes browser storage or creates a shared fallback key', () => {
  const getStorage = () => { throw new Error('must not access storage'); };
  for (const [account, company] of [[null, 'company-a'], ['user-a', null], ['', 'company-a'], [' user-a', 'company-a'], ['user-a', 'x'.repeat(513)]]) {
    assert.deepEqual(readGuidancePreference(account, company, getStorage), { key: null, guided: false, warning: '' });
    assert.deepEqual(saveGuidancePreference(account, company, true, getStorage), { key: null, guided: false, warning: '' });
  }
});

test('corrupt, older and non-boolean values cannot enable explanations and can be replaced explicitly', () => {
  const storage = memoryStorage(), getStorage = () => storage, key = guidancePreferenceKey('user-a', 'company-a');
  for (const corrupt of ['1', 'TRUE', '"true"', '{}', '{"guided":true}', 'false\n', '']) {
    storage.setItem(key, corrupt);
    assert.deepEqual(readGuidancePreference('user-a', 'company-a', getStorage), { key, guided: false, warning: GUIDANCE_INVALID_WARNING });
  }
  saveGuidancePreference('user-a', 'company-a', true, getStorage);
  assert.equal(readGuidancePreference('user-a', 'company-a', getStorage).warning, '');
});

test('blocked storage getter or read fails safely without exposing the underlying error', () => {
  for (const getStorage of [() => { throw new Error('private browser failure'); }, () => ({ getItem() { throw new Error('private read failure'); } }), () => undefined]) {
    const state = readGuidancePreference('user-a', 'company-a', getStorage);
    assert.equal(state.guided, false);
    assert.equal(state.warning, GUIDANCE_STORAGE_WARNING);
    assert.equal(JSON.stringify(state).includes('private'), false);
  }
});

test('failed writes retain the explicit choice for this visit and a later successful write clears warning', () => {
  const getStorage = () => ({ setItem() { throw new Error('quota full'); } });
  assert.deepEqual(saveGuidancePreference('user-a', 'company-a', true, getStorage), {
    key: guidancePreferenceKey('user-a', 'company-a'), guided: true, warning: GUIDANCE_STORAGE_WARNING,
  });
  assert.equal(saveGuidancePreference('user-a', 'company-a', false, () => memoryStorage()).warning, '');
});

test('only a boolean is accepted; no object or financial payload can be stored', () => {
  const storage = memoryStorage();
  for (const invalid of ['true', 1, null, { guided: true, amount: '100.00' }]) {
    assert.throws(() => saveGuidancePreference('user-a', 'company-a', invalid, () => storage), /must be true or false/);
  }
  assert.equal(storage.values.size, 0);
});
