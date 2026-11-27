// Disposable Chromium entry. Requests use the workspace's native API client.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PayRecordsWorkspace} from './PayRecordsWorkspace';

const {company,revision,latest,refundRevision,lineIds} = window.revisionFixture;
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
  function enterRevision(id) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,id);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  enterRevision(revision);
  const button = label => [...document.querySelectorAll('button')].find(node=>node.textContent === label);
  await wait(()=>button('Clear revision'));
  button('Load draft revision').click();
  const table = await wait(()=>document.querySelector('table'));
  if (!document.body.innerText.includes('Prepared by synthetic-preparer') || !document.querySelector('time[datetime]') ||
      !document.body.innerText.includes('Approval unavailable for superseded revisions.')) throw Error('Missing review context');
  const lines = [...table.querySelectorAll('tbody tr')];
  if (!document.body.innerText.includes('Revision 2 · Superseded') || lines.length !== 2 ||
    lines.some((row,i)=>row.querySelector('th').textContent !== lineIds[i]) ||
    !lines[1].innerText.includes('Priority order £50.00') || !lines[1].innerText.includes('Postgraduate loan £103.00') ||
    !lines[1].innerText.includes('Student loan £0.00') || !lines[1].innerText.includes('£2,450.84') ||
    !table.querySelector('tfoot').innerText.includes('Priority order £50.00') ||
    table.querySelector('tfoot tr td:last-child')?.textContent !== '£90,071,992,549,859.74') throw Error('Revision mismatch');
  if (document.body.innerText.includes('Change from revision')) throw Error('Unexpected comparison on direct lookup');
  button('Previous revision').click();
  await wait(()=>document.body.innerText.includes('Revision 1 · Superseded'));
  if (button('Previous revision') || !document.body.innerText.includes('No employee lines in this revision.')) throw Error('First revision mismatch');
  const firstChange = 'Change from revision 1 to 2: gross pay £90,071,992,550,909.93, net pay £90,071,992,549,859.74. Employee count changed from 0 to 2.';
  if (!document.body.innerText.includes(firstChange) || !document.body.innerText.includes('PAYE: -£701.00') ||
      !document.body.innerText.includes('Rounding: -£0.03')) throw Error('Backward comparison mismatch');
  button('Next revision').click();
  await wait(()=>document.body.innerText.includes('Revision 2 · Superseded') && input.value === revision);
  if (!document.body.innerText.includes(firstChange)) throw Error('Forward comparison mismatch');
  button('Open current revision').click();
  await wait(()=>document.body.innerText.includes('Revision 4 · Current at lookup') && input.value === latest);
  if (!document.body.innerText.includes('Change from revision 2 to 4: gross pay -£90,071,992,550,909.93, net pay -£90,071,992,549,859.74. Employee count changed from 2 to 0.')) throw Error('Current revision comparison mismatch');
  if (button('Open current revision') || document.body.innerText.includes(lineIds[0])) throw Error('Old draft remained visible');
  if (!document.body.innerText.includes('Approval requires at least one employee line.')) throw Error('Missing empty revision status');
  if (button('Next revision')) throw Error('Unexpected successor');
  button('Previous revision').click();
  await wait(()=>document.body.innerText.includes('Revision 3 · Superseded'));
  if (document.body.innerText.includes('Employee count changed')) throw Error('Unexpected count change between empty revisions');
  if (button('Open current revision') || !button('Next revision')) throw Error('Duplicate current revision link');
  button('Clear revision').click();
  await wait(()=>!document.querySelector('table') && input.value === '');
  enterRevision(refundRevision);
  await wait(()=>button('Clear revision'));
  button('Load draft revision').click();
  const refundTable = await wait(()=>document.querySelector('table'));
  const rows = refundTable.querySelectorAll('tbody tr, tfoot tr');
  if (rows.length !== 2) throw Error('Expected one refund line and one total');
  for (const row of rows) {
    const [gross,deductions,,net] = row.querySelectorAll('td');
    if (gross.textContent !== '£2,893.83' || net.textContent !== '£8,548.83' ||
        !deductions.innerText.includes('PAYE refund £5,872.00') ||
        !deductions.innerText.includes('Student loan £217.00')) throw Error('Stored refund display mismatch');
  }
  document.body.dataset.revisionReview='passed';
}
exercise().catch(()=>{document.body.dataset.revisionReview='failed';});
