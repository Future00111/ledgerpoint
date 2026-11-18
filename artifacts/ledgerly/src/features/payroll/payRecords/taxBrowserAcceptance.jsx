// Disposable browser entry point. The component and HTTP client are the production implementations.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {TaxPreparationsWorkspace} from './TaxPreparationsWorkspace';

const fixture = window.syntheticPayFixture;
const root = createRoot(document.getElementById('root'));
const nativeFetch = window.fetch.bind(window);
let actor = fixture.preparer;
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
  root.render(<TaxPreparationsWorkspace companyId={companyId} companyName="Synthetic tax company" actorId={actorId} role={role}/>);
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
  // Read the blob at the browser's download boundary, before the object URL is revoked.
  let download;
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.href.startsWith('blob:') || this.download !== 'personal-tax-input.csv') throw Error('Unexpected attachment');
    download = nativeFetch(this.href).then(response => response.text());
  };
  try {
    (await ready('Download CSV')).click();
    await wait(() => Boolean(download), 'CSV attachment');
    if (await download !== 'tax_year_start,employment_income_pence,currency\r\n2026,4525075,GBP\r\n') throw Error('CSV contents');
  } finally { HTMLAnchorElement.prototype.click = click; }
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
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ok:true})});
}
exercise().catch(async () => {
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ok:false, stage})});
});
