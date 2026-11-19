import { verifyCsvDownload } from './verifyCsvDownload';
// Disposable browser entry point. The component and HTTP client are the production implementations.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PayRecordsWorkspace} from './PayRecordsWorkspace';

const fixture = window.syntheticPayFixture;
const root = createRoot(document.getElementById('root'));
const nativeFetch = window.fetch.bind(window);
let actor = fixture.owner;
let loseResponse = true;
const requests = [];
window.fetch = async (url, options = {}) => {
  const target = new URL(url, location.href);
  if (target.origin !== location.origin || !target.pathname.startsWith('/api/companies/')) throw Error('Unexpected browser request');
  const headers = new Headers(options.headers);
  headers.set('x-test-actor', actor);
  const response = await nativeFetch(target.pathname.slice('/api/companies'.length), {...options, headers});
  if (options.method === 'POST') {
    requests.push(JSON.parse(options.body).id);
    if (loseResponse && response.ok) {
      loseResponse = false;
      await response.text();
      throw Error('Synthetic lost creation response');
    }
  }
  return response;
};
const mount = (companyId, actorId, role) => {
  actor = actorId;
  root.render(<PayRecordsWorkspace companyId={companyId} companyName="Synthetic payroll company" actorId={actorId} role={role}/>);
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
  mount(fixture.company, fixture.owner, 'owner');
  fill(await wait(() => input('Employee reference'), 'employee input'), fixture.employee);
  fill(await wait(() => input('Effective from'), 'date input'), '2026-04-06');
  fill(await wait(() => input('Annual salary'), 'amount input'), '45250.75');
  (await ready('Save pay record')).click();
  stage = 'retry';
  (await ready('Retry same request')).click();
  await wait(() => text().includes('45,250.75') && text().includes(fixture.employee), 'saved native readback');
  if(requests.length !== 2 || requests[0] !== requests[1]) throw Error('Retry identity');
  stage = 'csv-download';
  await verifyCsvDownload(await ready('Download CSV'), 'payroll-pay-record.csv',
    'effective_from,annual_salary_pence,currency\r\n2026-04-06,4525075,GBP\r\n', wait);
  stage = 'bank-detail';
  const lookupBank = async () => {
    fill(await wait(() => input('Employee UUID for bank lookup'), 'bank lookup'), fixture.employee);
    (await ready('Look up bank details')).click();
  };
  await lookupBank();
  await wait(() => text().includes('00123456'), 'full account');
  mount(fixture.company, fixture.approver, 'payroll_approver');
  await wait(() => !text().includes('00123456') && input('Employee UUID for bank lookup')?.value === '', 'prior account cleared');
  await lookupBank();
  await wait(() => text().includes('Account number ending') && text().includes('3456'), 'masked account');
  if (text().includes('00123456')) throw Error('Approver projection');
  (await ready('Clear bank lookup')).click();
  await wait(() => !text().includes('Account number ending') && !text().includes('••••3456')
    && input('Employee UUID for bank lookup')?.value === '' && !button('Clear bank lookup')
    && document.activeElement === input('Employee UUID for bank lookup'), 'clear bank lookup');
  await lookupBank();
  await wait(() => text().includes('••••3456'), 'masked account restored before role change');
  stage = 'reader';
  mount(fixture.company, fixture.reader, 'payroll_reader');
  await wait(() => !input('Employee UUID for bank lookup') && !text().includes('Account number ending') && !button('Save pay record') && !text().includes('45,250.75'), 'reader scope reset');
  fill(await wait(() => input('Pay record ID'), 'lookup input'), requests[0]);
  (await ready('Look up pay record')).click();
  await wait(() => text().includes('45,250.75'), 'reader native readback');
  if (button('Look up bank details') || text().includes('Account number ending') || button('Download CSV') || text().includes(fixture.employee) || input('Employee reference')) throw Error('Reader projection');
  stage = 'company-change';
  mount(fixture.other, fixture.reader, 'payroll_reader');
  await wait(() => !text().includes('45,250.75') && input('Pay record ID')?.value === '', 'company scope reset');
  stage = 'pay-denial-clears-bank';
  mount(fixture.company, fixture.owner, 'owner');
  await lookupBank();
  await wait(() => text().includes('00123456'), 'owner bank result before denial');
  // Keep the displayed scope mounted while the next server request loses its identity.
  actor = '';
  fill(await wait(() => input('Pay record ID'), 'owner lookup input'), requests[0]);
  (await ready('Look up pay record')).click();
  await wait(() => text().includes('Previous values have been cleared') && !text().includes('00123456')
    && !input('Employee UUID for bank lookup') && !button('Look up bank details'), 'bank details cleared on denial');
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ok:true})});
}
exercise().catch(async () => {
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ok:false, stage})});
});
