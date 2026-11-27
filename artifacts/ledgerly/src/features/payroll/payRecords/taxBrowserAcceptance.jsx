import { verifyCsvDownload, verifyLateCsvAfterSwitch } from './verifyCsvDownload';
// Disposable browser entry point. The component and HTTP client are the production implementations.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from '@/lib/AuthContext';
import {rememberCompanySelection} from '@/lib/companySelection.mjs';
import {CompanyProvider} from '@/lib/useCompany';
import TaxPreparations from './TaxPreparations';
import {TaxPreparationsWorkspace} from './TaxPreparationsWorkspace';

const fixture = window.syntheticPayFixture;
const root = createRoot(document.getElementById('root'));
const nativeFetch = window.fetch.bind(window);
let actor = fixture.preparer;
let loseResponse = true;
const requests = [];
const exportStatuses = [];
const createStatuses = [];
let membershipReads = 0;
window.fetch = async (url, options = {}) => {
  const target = new URL(url, location.href);
  const membership = target.pathname === '/api/companies';
  if (target.origin !== location.origin || (!membership && !target.pathname.startsWith('/api/companies/'))) {
    throw Error('Unexpected browser request');
  }
  if (membership && ++membershipReads === 1) return new Response(null,{status:503});
  const headers = new Headers(options.headers);
  headers.set('x-test-actor', actor);
  const response = await nativeFetch(target.pathname.slice('/api/companies'.length) || '/', {...options, headers});
  if (target.pathname.endsWith('/export.csv')) exportStatuses.push(response.status);
  if (options.method === 'POST') {
    createStatuses.push(response.status);
    requests.push(JSON.parse(options.body).id);
    if (loseResponse && response.ok) {
      loseResponse = false;
      await response.text();
      throw Error('Synthetic lost creation response');
    }
  }
  return response;
};
const mount = (companyId, actorId, role, onRefreshAccess) => {
  actor = actorId;
  root.render(<TaxPreparationsWorkspace companyId={companyId} companyName="Synthetic tax company" actorId={actorId} role={role} onRefreshAccess={onRefreshAccess}/>);
};
const wait = async (read, stage) => {
  for (let i = 0; i < 250; i++) {
    const result = read();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw Error(stage);
};
const button = name => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === name);
const input = label => [...document.querySelectorAll('label')].find(el => el.textContent.includes(label))?.control;
function fill(el, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', {bubbles:true}));
  el.dispatchEvent(new Event('change', {bubbles:true}));
}
const ready = name => wait(() => {const el=button(name); return el && !el.disabled && el;}, name);
const text = () => document.body.innerText;
let stage = 'entry';
async function exercise() {
  mount(fixture.company, fixture.preparer, 'personal_tax_preparer');
  fill(await wait(() => input('Taxpayer reference'), 'employee input'), fixture.taxpayer);
  fill(await wait(() => input('Tax year starting'), 'date input'), '2026');
  fill(await wait(() => input('Employment income'), 'amount input'), '45250.75');
  (await ready('Save tax input')).click();
  stage = 'retry';
  (await ready('Retry same request')).click();
  await wait(() => text().includes('45,250.75') && text().includes(fixture.taxpayer), 'saved native readback');
  if(requests.length !== 2 || requests[0] !== requests[1]) throw Error('Retry identity');
  stage = 'csv-download';
  await verifyCsvDownload(await ready('Download CSV'), 'personal-tax-input.csv',
    'tax_year_start,employment_income_pence,currency\r\n2026,4525075,GBP\r\n', wait);
  stage = 'company-change';
  await verifyLateCsvAfterSwitch(await ready('Download CSV'), async () => {
    mount(fixture.other, fixture.preparer, 'personal_tax_preparer');
    await wait(() => !text().includes('45,250.75') && input('Tax input ID')?.value === ''
      && !button('Download CSV'), 'destination workspace loaded');
  }, wait);
  stage = 'reader';
  mount(fixture.company, fixture.submitter, 'personal_tax_submitter');
  await wait(() => !button('Save tax input') && !text().includes('45,250.75'), 'reader scope reset');
  fill(await wait(() => button('Look up tax input')?.form?.querySelector('input'), 'lookup input'), requests[0]);
  (await ready('Look up tax input')).click();
  await wait(() => text().includes('45,250.75'), 'reader native readback');
  if (button('Download CSV') || text().includes(fixture.taxpayer) || input('Taxpayer reference')) throw Error('Reader projection');
  stage = 'company-change';
  mount(fixture.other, fixture.submitter, 'personal_tax_submitter');
  await wait(() => !text().includes('45,250.75') && button('Look up tax input')?.form?.querySelector('input')?.value === '', 'company scope reset');
  stage = 'denial';
  const click = HTMLAnchorElement.prototype.click;
  let downloadAttempts = 0;
  HTMLAnchorElement.prototype.click = function () { downloadAttempts++; };
  try {
    for (const [requestActor, expectedStatus] of [['', 401], [fixture.submitter, 403]]) {
      mount(fixture.company, fixture.preparer, 'personal_tax_preparer');
      fill(await wait(() => input('Taxpayer reference') && input('Tax input ID'), 'preparer lookup'), requests[0]);
      (await ready('Look up tax input')).click();
      await wait(() => text().includes('45,250.75') && text().includes(fixture.taxpayer), 'preparer readback');
      actor = requestActor;
      (await ready('Download CSV')).click();
      await wait(() => text().includes('Previous values have been cleared'), 'denied export clears tax input');
      if (exportStatuses.at(-1) !== expectedStatus || downloadAttempts || text().includes('45,250.75')
        || text().includes(fixture.taxpayer) || input('Taxpayer reference') || button('Download CSV')
        || input('Tax input ID')?.value !== '') throw Error('Denied export retained tax details or requested a download');
      mount(fixture.other, fixture.submitter, 'personal_tax_submitter');
      await wait(() => !text().includes('Previous values have been cleared'), 'leave blocked workspace');
    }
  } finally { HTMLAnchorElement.prototype.click = click; }
  // Keep the preparer form mounted. The native API sees either an expired
  // session or a signed-in submitter whose displayed role is stale.
  for (const [identity, expectedStatus] of [['', 401], [fixture.submitter, 403]]) {
    const refresh = identity === fixture.submitter
      ? () => mount(fixture.company, fixture.submitter, 'personal_tax_submitter')
      : undefined;
    mount(fixture.company, identity || fixture.preparer, 'personal_tax_preparer', refresh);
    const unsavedTaxpayer = crypto.randomUUID();
    fill(await wait(() => input('Taxpayer reference'), 'new tax entry'), unsavedTaxpayer);
    fill(input('Tax year starting'), '2026');
    fill(input('Employment income'), '32100.12');
    actor = identity;
    const postsBeforeSave = createStatuses.length;
    (await ready('Save tax input')).click();
    await wait(() => text().includes('Previous values have been cleared'), 'denied tax save');
    if (createStatuses.length !== postsBeforeSave + 1 || createStatuses.at(-1) !== expectedStatus ||
        input('Taxpayer reference') || input('Employment income') || button('Retry same request') ||
        button('Save tax input') || input('Tax input ID')?.value !== '' || text().includes(unsavedTaxpayer)) {
      throw Error('Denied save retained tax details or retry controls');
    }
  }
  const savesBeforeRefresh = requests.length;
  (await ready('Refresh company access')).click();
  await wait(() => !text().includes('Previous values have been cleared') && input('Tax input ID')?.value === '', 'refreshed submitter');
  fill(input('Tax input ID'), requests[0]);
  (await ready('Look up tax input')).click();
  await wait(() => text().includes('45,250.75'), 'submitter read after refresh');
  if (text().includes(fixture.taxpayer) || input('Taxpayer reference') || button('Save tax input') ||
      button('Download CSV') || requests.length !== savesBeforeRefresh) throw Error('Unexpected access after refresh');
  stage = 'refresh';
  rememberCompanySelection(window.localStorage,fixture.submitter,fixture.company);
  root.render(<AuthProvider><CompanyProvider><TaxPreparations /></CompanyProvider></AuthProvider>);
  await wait(() => text().includes('Your company access could not be loaded.'), 'membership failure');
  if (membershipReads !== 1 || input('Tax input ID') || input('Taxpayer reference')) throw Error('Failed membership exposed controls');
  (await ready('Retry company access')).click();
  await wait(() => input('Tax input ID'), 'membership recovery');
  if (membershipReads !== 2 || input('Taxpayer reference') || button('Save tax input')) throw Error('Unexpected recovered role');
  fill(input('Tax input ID'), requests[0]);
  (await ready('Look up tax input')).click();
  await wait(() => text().includes('45,250.75'), 'native read after membership retry');
  if (text().includes(fixture.taxpayer) || button('Download CSV') || requests.length !== savesBeforeRefresh) throw Error('Unexpected recovered access');
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ok:true})});
}
exercise().catch(async () => {
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ok:false, stage})});
});
