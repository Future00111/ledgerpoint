import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { accounting, KINDS, docPath } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill, SettlementPill, Money, ErrorBox, SkeletonRows, JournalLink } from '@/components/accounting/AccountingUI';

export default function AccountingDocumentList({ kind, legacyLink }) {
  const meta = KINDS[kind];
  const { activeCompany } = useCompany();
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const ledger = useLedgerSnapshot(activeCompany?.id, undefined, undefined, !meta.credit);
  const remaining = d => ledger.data?.open_items.find(o => o.id === d.id);

  const load = useCallback((signal) => {
    if (!activeCompany) return;
    setDocs(null); setError(null);
    accounting.list(activeCompany.id, kind, signal).then(d => setDocs(Array.isArray(d) ? d : [])).catch(e => { if (!signal?.aborted) setError(e); });
  }, [activeCompany?.id, kind]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);

  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;
  const tabs = meta.credit ? [['all','All'],['draft','Draft'],['posted','Posted']] : [['all','All'],['draft','Draft'],['awaiting','Awaiting payment'],['partial','Partially paid / credited'],['overdue','Overdue'],['settled','Settled']];
  const matches = (d, selected) => {
    if (selected === 'all') return true;
    if (selected === 'draft' || selected === 'posted') return d.status === selected;
    const item = remaining(d);
    if (!item || d.status !== 'posted') return false;
    if (selected === 'awaiting') return BigInt(item.open_minor) > 0n;
    if (selected === 'partial') return item.settlement === 'part_paid';
    if (selected === 'overdue') return BigInt(item.open_minor) > 0n && d.source?.due_date < ledger.to;
    return item.settlement === 'settled';
  };
  const searched = (docs ?? []).filter(d => `${d.source?.invoice_number ?? ''} ${d.party_name ?? ''} ${d.source?.reference ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const shown = searched.filter(d => matches(d, filter));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{meta.section} · Accounts</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{meta.plural}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta.credit ? 'Track credit notes and their original documents.' : 'See what is owed, what has been paid and what has been credited.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {legacyLink && <Button variant="outline" asChild><Link to={legacyLink} data-testid="link-legacy">Earlier drafts</Link></Button>}
          <Button asChild><Link to={`${meta.path}/new`} data-testid="button-new-doc" className="gap-2"><Plus className="h-4 w-4" />New {meta.label.toLowerCase()}</Link></Button>
        </div>
      </header>
      <Input aria-label={`Search ${meta.plural.toLowerCase()}`} placeholder="Search number, name or reference" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1 w-fit" role="tablist">
        {tabs.map(([f,label]) => (
          <button key={f} type="button" role="tab" aria-selected={filter === f} data-testid={`tab-${f}`} onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${filter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>{label} <span className="ml-1 text-xs text-muted-foreground">{!meta.credit && !['all','draft'].includes(f) && (ledger.loading || ledger.error) ? '—' : searched.filter(d => matches(d,f)).length}</span></button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={() => load()} />
      {!meta.credit && <ErrorBox error={ledger.error} onRetry={ledger.refresh} />}
      {!docs && !error && <SkeletonRows />}
      {docs && shown.length === 0 && (meta.credit || !ledger.loading) && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No {meta.plural.toLowerCase()} match this view</p>
          <p className="mt-1 text-sm text-muted-foreground">Change the search or status filter, or create a new draft.</p>
        </div>
      )}
      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Number</th><th className="px-4 py-3 capitalize">{meta.party}</th><th className="px-4 py-3">Date / due</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Original total</th>{!meta.credit && <><th className="px-4 py-3 text-right">Payments</th><th className="px-4 py-3 text-right">Credits</th><th className="px-4 py-3 text-right">Still due</th></>}<th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {shown.map(d => (
                <tr key={d.id} data-testid={`row-doc-${d.id}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium"><Link className="hover:underline" to={docPath(kind, d.id)}>{d.source?.invoice_number || 'Untitled'}</Link></td>
                  <td className="px-4 py-3">{d.party_name || '—'}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{d.source?.issue_date}{!meta.credit && <p className={`mt-1 text-xs ${matches(d,'overdue') ? 'text-red-700' : 'text-muted-foreground'}`}>Due {d.source?.due_date}{matches(d,'overdue') ? ' · Overdue' : ''}</p>}</td>
                  <td className="px-4 py-3">{!meta.credit && remaining(d) ? <SettlementPill item={remaining(d)} /> : <StatusPill status={d.status} />}</td>
                  <td className="px-4 py-3 text-right"><Money value={d.money?.gross_pence} /></td>
                  {!meta.credit && <>{['paid_minor','credited_minor'].map(field => <td key={field} className="px-4 py-3 text-right"><Money value={remaining(d)?.[field]} /></td>)}<td className="px-4 py-3 text-right font-semibold">{d.status !== 'posted' ? 'Draft — not owed' : remaining(d) ? <Money value={remaining(d).open_minor} /> : ledger.loading ? 'Loading…' : 'Unavailable'}</td></>}
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
