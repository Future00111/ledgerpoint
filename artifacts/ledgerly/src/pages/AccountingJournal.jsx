import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { accounting, docPath } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { Money, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';

export default function AccountingJournal() {
  const { id } = useParams();
  const { activeCompany } = useCompany();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activeCompany) return;
    const c = new AbortController(); setData(null); setError(null);
    accounting.journal(activeCompany.id, id, c.signal).then(setData).catch(e => { if (!c.signal.aborted) setError(e); });
    return () => c.abort();
  }, [activeCompany?.id, id, tick]);
  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company first.</p>;
  const entry = data?.entry; const src = entry && docPath(entry.source_type, entry.source_id);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Accounting · Journal</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Journal entry</h1>
        {entry && <p className="mt-1 text-sm text-muted-foreground">Posted {entry.posting_date} · {entry.source_type?.replace(/_/g, ' ')} {src && <> · <Link to={src} className="text-primary hover:underline" data-testid="link-source-doc">Open source document</Link></>}</p>}
      </header>
      <ErrorBox error={error} onRetry={() => setTick(t => t + 1)} />
      {!data && !error && <SkeletonRows />}
      {data && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Line ref</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr>
            </thead>
            <tbody>{data.lines.map((l, i) => (
              <tr key={i} className="border-b" data-testid={`row-journal-${i}`}>
                <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground">{l.account_code}</span> {l.account_name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.source_line_ref ?? ''}</td>
                <td className="px-4 py-3 text-right">{l.debit_minor !== '0' && <Money value={l.debit_minor} />}</td>
                <td className="px-4 py-3 text-right">{l.credit_minor !== '0' && <Money value={l.credit_minor} />}</td>
              </tr>))}</tbody>
            <tfoot className="font-semibold"><tr><td className="px-4 py-3" colSpan={2}>Totals</td><td className="px-4 py-3 text-right"><Money value={entry.total_debit_minor} /></td><td className="px-4 py-3 text-right"><Money value={entry.total_credit_minor} /></td></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
