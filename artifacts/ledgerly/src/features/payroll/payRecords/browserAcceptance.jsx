import { verifyCsvDownload, verifyLateCsvAfterSwitch } from './verifyCsvDownload';
// Disposable browser entry point. The component and HTTP client are the production implementations.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PayRecordsWorkspace} from './PayRecordsWorkspace';

const fixture = window.syntheticPayFixture;
const root = createRoot(document.getElementById('root'));
const nativeFetch = window.fetch.bind(window);
let actor = fixture.owner;
let loseResponse = true;
let heldPayRead;
const requests = [];
// Synthetic UI projection; the native route and audit are covered in the revision database suite.
const reviewId = crypto.randomUUID();
const reviewRun = crypto.randomUUID();
const previousRevision = crypto.randomUUID(), currentRevision = crypto.randomUUID();
let releaseReview;
let reviewReads = 0;
const exportStatuses = [];
window.fetch = async (url, options = {}) => {
  const target = new URL(url, location.href);
  if (target.origin === location.origin && target.pathname === '/api/capabilities/pay-revision-review') {
    return Response.json({enabled:true});
  }
  if (target.origin !== location.origin || !target.pathname.startsWith('/api/companies/')) throw Error('Unexpected browser request');
  if (target.pathname.endsWith('/payroll-run-revisions/'+reviewId)) {
    reviewReads++;
    if (actor !== fixture.owner || !target.pathname.startsWith('/api/companies/'+fixture.company+'/')) throw Error('Review scope');
    const amounts = {gross:'9007199254740993',net:'9007199254740995',deductions:{paye:'-3'},adjustments:{rounding:'-1'}};
    const taxed = {gross:'10000',net:'8000',deductions:{paye:'2000'},adjustments:{}};
    const totals = {line_count:2,gross:'9007199254750993',net:'9007199254748995',
      deductions:{paye:'1997'},adjustments:{rounding:'-1'}};
    if (reviewReads === 2) await new Promise(resolve => { releaseReview = resolve; });
    return Response.json({run_id:reviewRun,revision_id:reviewId,revision_number:2,period_start:'2026-10-01',
      period_end:'2026-10-31',payday:'2026-10-30',currency:'GBP',rules_version:'synthetic',prepared_by:'synthetic-preparer',prepared_at:'2026-10-30T10:00:00.000Z',is_current_revision:false,current_revision_id:currentRevision,
      previous_revision_id:previousRevision,next_revision_id:currentRevision,
      review_breakdown:{lines:[amounts,taxed].map(line=>({line_id:crypto.randomUUID(),...line})),totals}});
  }
  const headers = new Headers(options.headers);
  headers.set('x-test-actor', actor);
  const response = await nativeFetch(target.pathname.slice('/api/companies'.length), {...options, headers});
  if (target.pathname.endsWith('/export.csv')) exportStatuses.push(response.status);
  if (heldPayRead && response.ok && target.pathname.includes('/payroll-pay-records/')) {
    // Buffer a successful response before cancellation to model a transport that ignores abort.
    const buffered = new Response(await response.text(), {status:response.status, headers:response.headers});
    await new Promise(resolve => { heldPayRead.release = resolve; });
    return buffered;
  }
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
  const revisionInput = await wait(() => input('Pay-run revision ID'),'revision lookup');
  if (reviewReads !== 0) throw Error('Unexpected automatic review');
  fill(revisionInput,reviewId);
  (await ready('Load draft revision')).click();
  await wait(() => text().includes('Superseded') && text().includes('£90,071,992,547,409.95')
    && text().includes('-£0.01') && text().includes('Total (2 lines'), 'draft review');
  const table = document.querySelector('#revision-title')?.closest('section')?.querySelector('table');
  const lines = table.querySelectorAll('tbody tr');
  if (!lines[0].innerText.includes('PAYE refund £0.03') || !lines[1].innerText.includes('PAYE £20.00') ||
      !table.querySelector('tfoot').innerText.includes('PAYE £19.97') ||
      !text().includes('PAYE deducted £20.00 · PAYE refunded £0.03')) throw Error('Mixed PAYE breakdown mismatch');
  (await ready('Clear revision')).click();
  await wait(() => !text().includes('Superseded') && revisionInput.value === '', 'cleared draft review');
  if (reviewReads !== 1) throw Error('Unexpected review request count');
  fill(revisionInput,reviewId);
  (await ready('Load draft revision')).click();
  await wait(() => releaseReview,'pending review response');
  (await ready('Clear revision')).click();
  await wait(() => revisionInput.value === '', 'pending review cleared');
  releaseReview();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (text().includes('Superseded') || text().includes(reviewRun)) throw Error('Stale draft review');
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
  stage = 'company-change';
  await verifyLateCsvAfterSwitch(await ready('Download CSV'), async () => {
    mount(fixture.other, fixture.owner, 'owner');
    await wait(() => !text().includes('45,250.75') && input('Pay record ID')?.value === ''
      && !button('Download CSV'), 'destination workspace loaded');
  }, wait);
  stage = 'bank-detail';
  const previousBankInput = input('Employee UUID for bank lookup');
  mount(fixture.company, fixture.owner, 'owner');
  await wait(() => input('Employee UUID for bank lookup') && input('Employee UUID for bank lookup') !== previousBankInput, 'original company remounted');
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
  if (button('Load draft revision') || button('Look up bank details') || text().includes('Account number ending') || button('Download CSV') || text().includes(fixture.employee) || input('Employee reference')) throw Error('Reader projection');
  stage = 'company-change';
  mount(fixture.other, fixture.reader, 'payroll_reader');
  await wait(() => !text().includes('45,250.75') && input('Pay record ID')?.value === '', 'company scope reset');
  stage = 'denial';
  const originalClick = HTMLAnchorElement.prototype.click;
  let downloadAttempts = 0;
  HTMLAnchorElement.prototype.click = function () { downloadAttempts++; };
  try {
    for (const [requestActor, status] of [['', 401], [fixture.reader, 403]]) {
      mount(fixture.company, fixture.owner, 'owner');
      fill(await wait(() => input('Employee reference') && input('Pay record ID'), 'owner pay lookup'), requests[0]);
      (await ready('Look up pay record')).click();
      await wait(() => text().includes('45,250.75') && text().includes(fixture.employee), 'owner pay details');
      actor = requestActor;
      (await ready('Download CSV')).click();
      await wait(() => text().includes('Previous values have been cleared'), 'denied payroll export');
      if (exportStatuses.at(-1) !== status || downloadAttempts || text().includes('45,250.75')
        || text().includes(fixture.employee) || input('Employee reference') || input('Employee UUID for bank lookup')
        || input('Pay record ID')?.value !== '' || button('Download CSV')) throw Error('Denied payroll export retained data or downloaded');
      mount(fixture.other, fixture.reader, 'payroll_reader');
      await wait(() => !text().includes('Previous values have been cleared'), 'leave blocked payroll workspace');
    }
  } finally { HTMLAnchorElement.prototype.click = originalClick; }
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
  stage = 'denial';
  mount(fixture.company, fixture.approver, 'payroll_approver');
  fill(await wait(() => input('Pay record ID')?.value === '' && input('Employee UUID for bank lookup') && input('Pay record ID'), 'fresh approver lookup'), requests[0]);
  (await ready('Look up pay record')).click();
  await wait(() => text().includes('45,250.75'), 'salary before session expiry');
  actor = '';
  await lookupBank();
  await wait(() => text().includes('Previous values have been cleared') && !text().includes('45,250.75')
    && !input('Employee UUID for bank lookup') && !button('Download CSV'), 'bank session expiry clears salary');
  mount(fixture.company, fixture.owner, 'owner');
  fill(await wait(() => input('Employee reference') && input('Pay record ID'), 'new owner session'), requests[0]);
  heldPayRead = {};
  (await ready('Look up pay record')).click();
  await wait(() => heldPayRead.release, 'held successful pay read');
  actor = '';
  await lookupBank();
  await wait(() => text().includes('Previous values have been cleared') && !input('Employee UUID for bank lookup'), 'blocked pending read');
  heldPayRead.release();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (text().includes('Saved pay record') || text().includes('45,250.75') || button('Download CSV')) throw Error('Stale pay response');
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ok:true})});
}
exercise().catch(async () => {
  await nativeFetch('/pay-ui-result', {method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ok:false, stage})});
});
