// This entry is bundled only by the loopback PostgreSQL/Chromium acceptance test.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from '@/lib/AuthContext';
import {CompanyProvider} from '@/lib/useCompany';
import {rememberCompanySelection} from '@/lib/companySelection.mjs';
import AccessHistory from './AccessHistory';
import {AccessHistoryWorkspace} from './AccessHistoryWorkspace';

const f = window.syntheticPayFixture, root = createRoot(document.getElementById('root'));
const nativeFetch = window.fetch.bind(window);
let membershipReads = 0;
let actor = f.owner, reads = 0, hold = false, release;
window.fetch = async (url, options = {}) => {
  const target = new URL(url, location.href);
  if (target.origin === location.origin && target.pathname === '/api/companies') {
    if (++membershipReads === 1) return new Response(null,{status:503});
    return nativeFetch('/',{...options,headers:{'x-test-actor':actor}});
  }
  if (target.origin !== location.origin || !target.pathname.endsWith('/specialist-access-history') ||
      !target.pathname.startsWith('/api/companies/')) throw Error('Unexpected request');
  reads++;
  const headers = new Headers(options.headers);
  headers.set('x-test-actor',actor);
  // Delay a genuine committed response and model a transport that ignores cancellation.
  const response = await nativeFetch(target.pathname.slice('/api/companies'.length), {...options,headers,signal:undefined});
  if (hold) { hold = false; await new Promise(resolve => { release = resolve; }); }
  return response;
};
const mount = (companyId, actorId, role) => {
  actor = actorId;
  root.render(<AccessHistoryWorkspace companyId={companyId} companyName="Synthetic company" actorId={actorId} role={role}/>);
};
const button = name => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === name && !el.disabled);
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
async function until(read) {
  for (let i=0;i<200;i++) { const value=read(); if(value) return value; await pause(25); }
  throw Error('Timed out');
}
const text = () => document.body.innerText;
let stage = 'initial';
async function exercise() {
  rememberCompanySelection(window.localStorage,f.owner,f.company);
  root.render(<AuthProvider><CompanyProvider><AccessHistory /></CompanyProvider></AuthProvider>);
  const retry = await until(() => button('Retry company access'));
  if (membershipReads !== 1 || reads !== 0 || button('View history') || document.querySelector('table')) {
    throw Error('Failed membership exposed history');
  }
  retry.click();
  const view = await until(() => button('View history'));
  if (membershipReads !== 2 || reads !== 0) throw Error('Unexpected retry read');
  stage = 'history';
  view.click();
  await until(() => text().includes(f.membership));
  if (!/payroll reader/i.test(text()) || !/personal tax preparer/i.test(text()) || text().includes(f.reader))
    throw Error('Invalid owner projection');
  stage = 'refresh';
  hold = true;
  (await until(() => button('Refresh history'))).click();
  await until(() => release && !text().includes(f.membership));
  stage = 'scope';
  mount(f.other,f.owner,'owner');
  await until(() => button('View history'));
  release(); await pause(75);
  if (text().includes(f.membership) || reads !== 2) throw Error('Previous company history visible');
  stage = 'empty';
  button('View history').click();
  await until(() => text().includes('No specialist access changes recorded'));
  stage = 'denial';
  mount(f.company,f.owner,'owner');
  const reload = await until(() => button('View history'));
  actor = f.reader; // Stale owner UI, current server membership denies the request.
  reload.click();
  await until(() => document.querySelector('[role=alert]'));
  if (text().includes(f.membership)) throw Error('Denied history visible');
  mount(f.company,f.reader,'personal_tax_preparer');
  await pause(75);
  if (button('View history') || button('Refresh history') || text().includes(f.membership) || reads !== 4)
    throw Error('Unexpected non-owner access');
}
exercise().then(() => nativeFetch('/pay-ui-result',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"ok":true}'}))
  .catch(() => nativeFetch('/pay-ui-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,stage})}));
