import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { useGuidancePreference } from './useGuidancePreference';
import { saveGuidancePreference } from './preferences.mjs';
import SetupWorkspace from './SetupWorkspace';
import { deriveReadiness } from './model.mjs';
import { fixture, DATE } from './fixtures.mjs';

function SavedSetup({ accountId, companyId, getStorage }) {
  const preference = useGuidancePreference(accountId, companyId, getStorage);
  const data = fixture();
  return <MemoryRouter><SetupWorkspace company={data.sales.company} date={DATE}
    readiness={deriveReadiness('synthetic-company', data, DATE)} onDateChange={() => {}} onRefresh={() => {}}
    guided={preference.guided} onGuidedChange={preference.changeGuidance} guidanceWarning={preference.guidanceWarning} /></MemoryRouter>;
}

test('saved guidance reaches the first render without showing another account or company preference', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const getStorage = () => storage;
  saveGuidancePreference('user-a', 'company-a', true, getStorage);
  for (const [accountId, companyId, expected] of [['user-a', 'company-a', true], ['user-b', 'company-a', false], ['user-a', 'company-b', false]]) {
    const html = renderToStaticMarkup(<SavedSetup {...{ accountId, companyId, getStorage }} />);
    assert.match(html, expected ? /Hide explanations/ : /Show explanations/);
    assert.equal(html.includes('Your actual VAT position must be recorded.'), expected);
    assert.match(html, /href="\/invoices\/new"/);
  }
});

test('unavailable storage shows a recoverable preference message without blocking setup or native tasks', () => {
  const html = renderToStaticMarkup(<SavedSetup accountId="user-a" companyId="company-a" getStorage={() => { throw new Error('blocked'); }} />);
  assert.match(html, /Your browser could not remember this explanation preference/);
  assert.match(html, /role="status"/);
  assert.match(html, /Show explanations/);
  assert.match(html, /href="\/bills\/new"/);
  assert.equal(html.includes('Setup checks could not be verified'), false);
});
