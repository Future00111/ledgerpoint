// Disposable Chromium entry. Requests use the workspace's native API client.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PayRecordsWorkspace} from './PayRecordsWorkspace';

const {company,revision,latest,lineIds} = window.revisionFixture;
const root = createRoot(document.getElementById('root'));
root.render(<PayRecordsWorkspace companyId={company} actorId="browser-reviewer" role="payroll_approver"/>);
const wait = async read => {
  for (let attempt=0; attempt<200; attempt++) {
    const value = read();
    if (value) return value;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw Error('Review screen did not reach expected state');
};
async function exercise() {
  const input = await wait(()=>[...document.querySelectorAll('label')].find(label=>label.textContent.includes('Pay-run revision ID'))?.control);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,revision);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  const button = label => [...document.querySelectorAll('button')].find(node=>node.textContent === label);
  await wait(()=>button('Clear revision'));
  button('Load draft revision').click();
  const table = await wait(()=>document.querySelector('table'));
  const lines = [...table.querySelectorAll('tbody tr')];
  if (!document.body.innerText.includes('Revision 2 · Superseded') || lines.length !== 2 ||
    lines.some((row,i)=>row.querySelector('th').textContent !== lineIds[i]) ||
    !lines[1].innerText.includes('Priority order £50.00') || !lines[1].innerText.includes('Postgraduate loan £103.00') ||
    !lines[1].innerText.includes('Student loan £0.00') || !lines[1].innerText.includes('£2,450.84') ||
    !table.querySelector('tfoot').innerText.includes('Priority order £50.00') ||
    table.querySelector('tfoot tr td:last-child')?.textContent !== '£90,071,992,549,859.74') throw Error('Revision mismatch');
  button('Open current revision').click();
  await wait(()=>document.body.innerText.includes('Revision 4 · Current at lookup') && input.value === latest);
  if (button('Open current revision') || document.body.innerText.includes(lineIds[0])) throw Error('Old draft remained visible');
  button('Clear revision').click();
  await wait(()=>!document.querySelector('table') && input.value === '');
  document.body.dataset.revisionReview='passed';
}
exercise().catch(()=>{document.body.dataset.revisionReview='failed';});
