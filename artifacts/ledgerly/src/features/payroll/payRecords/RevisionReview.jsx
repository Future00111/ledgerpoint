import {useLayoutEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {recordId,requestScope} from './model.mjs';
import {approvalAvailability,validatedReview,formatDraftPence,deductionNames,adjustmentNames} from './revisionReview.mjs';

function amounts(values,names) {
  return Object.entries(values).map(([key,value]) => <div key={key}>{names[key]} {formatDraftPence(value)}</div>);
}
function Cells({row}) {
  return <><td>{formatDraftPence(row.gross)}</td><td>{amounts(row.deductions,deductionNames)}</td>
    <td>{amounts(row.adjustments,adjustmentNames)}</td><td>{formatDraftPence(row.net)}</td></>;
}
export function RevisionReview({companyId,onSessionExpired}) {
  const scope = useRef(null);
  if (!scope.current) scope.current = requestScope();
  useLayoutEffect(() => () => scope.current.cancel(),[]);
  const [id,setId] = useState(''), [result,setResult] = useState(null), [message,setMessage] = useState(''), [busy,setBusy] = useState(false);
  function change(value) {
    scope.current.cancel(); setId(value); setResult(null); setMessage(''); setBusy(false);
  }
  async function read(target,expectedRun,expectedNumber) {
    if (busy) return;
    const token = scope.current.begin();
    setResult(null); setMessage('');
    let revision;
    try { revision = recordId(target); } catch { setMessage('Enter a valid revision ID.'); return; }
    setId(revision); setBusy(true);
    try {
      const response = await fetch('/api/companies/'+recordId(companyId)+'/payroll-run-revisions/'+revision+'?history=adjacent',
        {credentials:'include',cache:'no-store',redirect:'error',signal:token.signal});
      if (!token.isCurrent()) return;
      if (response.status === 401) { onSessionExpired(); return; }
      if (response.status !== 200) throw Error();
      const value = validatedReview(await response.json(),revision,true);
      if ((expectedRun && value.run_id !== expectedRun) || (expectedNumber && value.revision_number !== expectedNumber)) throw Error();
      if (token.isCurrent()) setResult(value);
    } catch { if (token.isCurrent()) setMessage('The draft could not be loaded. Check the revision ID and your company access.'); }
    finally { if (token.isCurrent()) setBusy(false); }
  }
  return <section className="workspace-card space-y-4 p-4 sm:p-6" aria-labelledby="revision-title" aria-busy={busy}>
    <h2 id="revision-title" className="text-lg font-semibold">Review a draft pay run</h2>
    <form onSubmit={event=>{event.preventDefault(); void read(id);}} autoComplete="off" className="space-y-3">
      <label className="block space-y-1 text-sm">Pay-run revision ID<Input value={id} onChange={e=>change(e.target.value)} spellCheck={false}/></label>
      <Button type="submit" disabled={busy} variant="outline">Load draft revision</Button>
      {id && <Button type="button" variant="ghost" onClick={()=>change('')}>Clear revision</Button>}
    </form>
    {message && <p role="alert">{message}</p>}
    {result && <div className="space-y-3">
      <h3 className="font-semibold">Revision {result.revision_number} · {result.is_current_revision ? 'Current at lookup' : 'Superseded'}</h3>
      <nav aria-label="Pay-run revision history" className="flex flex-wrap gap-2">
        {result.previous_revision_id && <Button variant="outline" onClick={()=>read(result.previous_revision_id,result.run_id,result.revision_number-1)}>Previous revision</Button>}
        {result.next_revision_id && <Button variant="outline" onClick={()=>read(result.next_revision_id,result.run_id,result.revision_number+1)}>Next revision</Button>}
        {!result.is_current_revision && result.next_revision_id !== result.current_revision_id && <Button variant="outline" onClick={()=>read(result.current_revision_id,result.run_id)}>Open current revision</Button>}
      </nav>
      <p>Period {result.period_start} to {result.period_end} · Payday {result.payday}</p>
      <p>Prepared by {result.prepared_by} · <time dateTime={result.prepared_at}>{result.prepared_at.slice(0,10)} {result.prepared_at.slice(11,19)} UTC</time></p>
      <p>{approvalAvailability(result)}</p>
      <p>Run {result.run_id} · Rules {result.rules_version}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Draft pay-run amounts in GBP</caption>
        <thead><tr>{['Review line','Gross','Deductions','Adjustments','Net'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{result.review_breakdown.lines.length === 0 && <tr><td colSpan={5}>No employee lines in this revision.</td></tr>}{result.review_breakdown.lines.map(line=><tr key={line.line_id}><th scope="row">{line.line_id}</th><Cells row={line}/></tr>)}</tbody>
        <tfoot><tr><th scope="row">Total ({result.review_breakdown.totals.line_count} {result.review_breakdown.totals.line_count === 1 ? 'line' : 'lines'})</th><Cells row={result.review_breakdown.totals}/></tr></tfoot>
      </table></div>
    </div>}
  </section>;
}
