import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { accounting, KINDS, docPath } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
import { Button } from '@/components/ui/button';
import { StatusPill, Money, ErrorBox, SkeletonRows, JournalLink } from '@/components/accounting/AccountingUI';

export default function AccountingDocumentList({ kind, legacyLink }) {
  const meta = KINDS[kind];
  const { activeCompany } = useCompany();
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const ledger = useLedgerSnapshot(activeCompany?.id, undefined, undefined, !meta.credit);
  const remaining = d => ledger.data?.open_items.find(o => o.id === d.id);

  const load = useCallback((signal) => {
    if (!activeCompany) return;
    setDocs(null); setError(null);
    accounting.list(activeCompany.id, kind, signal).then(d => setDocs(Array.isArray(d) ? d : [])).catch(e => { if (!signal?.aborted) setError(e); });
  }, [activeCompany?.id, kind]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);

  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;
  const shown = (docs ?? []).filter(d => filter === 'all' || d.status === filter);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{meta.section} · Accounts</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{meta.plural}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Drafts stay editable. Posting writes a balanced journal and locks the document.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {legacyLink && <Button variant="outline" asChild><Link to={legacyLink} data-testid="link-legacy">Earlier drafts</Link></Button>}
          <Button asChild><Link to={`${meta.path}/new`} data-testid="button-new-doc" className="gap-2"><Plus className="h-4 w-4" />New {meta.label.toLowerCase()}</Link></Button>
        </div>
      </header>
      <div className="flex gap-1 rounded-lg bg-muted/60 p-1 w-fit" role="tablist">
        {['all', 'draft', 'posted'].map(f => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} data-testid={`tab-${f}`} onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${filter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>{f}</button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={() => load()} />
      {!meta.credit && <ErrorBox error={ledger.error} onRetry={ledger.refresh} />}
      {!docs && !error && <SkeletonRows />}
      {docs && shown.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No {filter === 'all' ? '' : filter + ' '}{meta.plural.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a draft, review it, then post it to the accounts.</p>
        </div>
      )}
      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Number</th><th className="px-4 py-3 capitalize">{meta.party}</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Gross</th>{!meta.credit && <th className="px-4 py-3 text-right">Remaining at {ledger.to}</th>}<th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {shown.map(d => (
                <tr key={d.id} data-testid={`row-doc-${d.id}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium"><Link className="hover:underline" to={docPath(kind, d.id)}>{d.source?.invoice_number || 'Untitled'}</Link></td>
                  <td className="px-4 py-3">{d.party_name || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{d.source?.issue_date}</td>
                  <td className="px-4 py-3"><StatusPill status={d.status} />{remaining(d) && <p className="mt-1 text-xs capitalize text-muted-foreground">{remaining(d).settlement.replaceAll('_', ' ')}</p>}</td>
                  <td className="px-4 py-3 text-right"><Money value={d.money?.gross_pence} /></td>
                  {!meta.credit && <td className="px-4 py-3 text-right">{d.status !== 'posted' ? 'Draft — not owed' : remaining(d) ? <Money value={remaining(d).open_minor} /> : ledger.loading ? 'Loading…' : 'Unavailable'}</td>}
                  <td className="px-4 py-3 text-right">{d.status === 'posted' ? <JournalLink id={d.journal_id} /> : <Link className="text-primary hover:underline" to={docPath(kind, d.id)}>Review</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
