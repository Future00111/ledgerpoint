import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, FileText, Search, ArrowUpRight } from 'lucide-react';
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
  const [params, setParams] = useSearchParams();
  const validFilters = meta.credit ? ['all','draft','posted'] : ['all','draft','awaiting','partial','overdue','settled'];
  const filter = validFilters.includes(params.get('status')) ? params.get('status') : 'all';
  const setFilter = value => { const next = new URLSearchParams(params); next.set('status',value); setParams(next,{replace:true}); };
  const [search, setSearch] = useState('');
  const ledger = useLedgerSnapshot(activeCompany?.id, undefined, undefined, !meta.credit);
  const remaining = d => ledger.data?.open_items.find(o => o.id === d.id);

  const load = useCallback((signal) => {
    if (!activeCompany) return;
    setDocs(null); setError(null);
    accounting.list(activeCompany.id, kind, signal).then(d => { if (!signal?.aborted) setDocs(Array.isArray(d) ? d : []); }).catch(e => { if (!signal?.aborted) setError(e); });
  }, [activeCompany?.id, kind]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);

  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;
  const tabs = meta.credit ? [['all','All'],['draft','Draft'],['posted','Posted']] : [['all','All'],['draft','Draft'],['awaiting','Awaiting payment'],['partial','Part-paid / credited'],['overdue','Overdue'],['settled','Settled']];
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

  const sumOpen = selected => !ledger.data || ledger.error ? null : (docs ?? []).filter(d => matches(d,selected)).reduce((total,d) => total + BigInt(remaining(d)?.open_minor ?? '0'), 0n).toString();
  const title = {sales_invoice:'Invoices',purchase_bill:'Bills',sales_credit_note:'Customer credits',supplier_credit_note:'Supplier credits'}[kind];
  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div><span className="eyebrow">{meta.section}</span><h1 className="mt-2">{title}</h1><p>{meta.credit ? 'Every credit, clearly linked to its original document.' : kind === 'sales_invoice' ? 'Keep track of your sales and what customers owe you.' : 'Keep purchases organised and see what needs paying.'}</p></div>
        <div className="flex flex-wrap gap-2">
          {legacyLink && <Button variant="ghost" asChild><Link to={legacyLink} data-testid="link-legacy">Earlier drafts</Link></Button>}
          <Button asChild><Link to={`${meta.path}/new`} data-testid="button-new-doc"><Plus />New {kind==='purchase_bill' ? 'bill' : kind==='sales_invoice' ? 'invoice' : 'credit note'}</Link></Button>
        </div>
      </header>
      {!meta.credit && <section className="grid gap-4 sm:grid-cols-3" aria-label="Document balances">
        {[['awaiting',kind === 'sales_invoice' ? 'Outstanding invoices' : 'Outstanding bills','Total still to be paid'],['overdue','Overdue','Past the payment due date'],['draft','Drafts','Not yet included in your accounts']].map(([key,label,detail]) => <button key={key} type="button" onClick={()=>setFilter(key)} className={`workspace-card p-5 text-left transition-colors hover:border-primary/40 ${filter===key ? 'border-primary/40' : ''}`}><p className="flex items-center justify-between text-sm text-muted-foreground">{label}<ArrowUpRight className="h-4 w-4" /></p><p className={`metric-value ${key==='overdue' ? 'text-amber-800' : ''}`}>{!docs ? '—' : key==='draft' ? docs.filter(d=>d.status==='draft').length : <Money value={sumOpen(key)} />}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></button>)}
      </section>}
      <ErrorBox error={error} onRetry={() => load()} />
      {!meta.credit && <ErrorBox error={ledger.error} onRetry={ledger.refresh} />}
      <section className="workspace-card overflow-hidden" aria-label={title}>
        <div className="document-tabs" role="tablist" aria-label={`${title} status`}>
          {tabs.map(([f,label]) => <button key={f} type="button" role="tab" aria-selected={filter===f} data-testid={`tab-${f}`} onClick={()=>setFilter(f)}>{label}<span className={`ml-2 rounded-md px-1.5 py-0.5 text-[11px] ${filter===f ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{!docs || (!meta.credit && !['all','draft'].includes(f) && (ledger.loading || ledger.error)) ? '—' : searched.filter(d=>matches(d,f)).length}</span></button>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={`Search ${meta.plural.toLowerCase()}`} placeholder="Search name, number or reference…" value={search} onChange={e=>setSearch(e.target.value)} className="bg-white pl-9" /></div><span className="text-xs text-muted-foreground">{docs ? `${shown.length} ${shown.length===1 ? 'document' : 'documents'}` : 'Loading…'}</span></div>
        {!docs && !error && <div className="p-5"><SkeletonRows /></div>}
        {docs && shown.length === 0 && (meta.credit || !ledger.loading) && <div className="flex flex-col items-center border-t px-6 py-16 text-center"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted"><FileText className="h-6 w-6 text-muted-foreground" /></span><h2 className="font-medium">{search || filter!=='all' ? 'Nothing matches this view' : `Your ${title.toLowerCase()} will appear here`}</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">{search || filter!=='all' ? 'Try another search or choose a different status.' : 'Create your first draft. You can review it before posting it to your accounts.'}</p>{!search && filter==='all' && <Button variant="outline" className="mt-5" asChild><Link to={`${meta.path}/new`}>Create a draft</Link></Button>}</div>}
        {shown.length>0 && <div className="overflow-x-auto"><table className="workspace-table">
          <thead><tr><th>Document</th><th className="capitalize">{meta.party}</th><th>Date / due</th><th>Status</th><th className="text-right">Total</th>{!meta.credit && <><th className="text-right">Paid</th><th className="text-right">Credited</th><th className="text-right">Still due</th></>}<th><span className="sr-only">Open document</span></th></tr></thead>
          <tbody>{shown.map(d=><tr key={d.id} data-testid={`row-doc-${d.id}`}>
            <td><Link className="whitespace-nowrap font-medium text-primary hover:underline" to={docPath(kind,d.id)}>{d.source?.invoice_number || 'Untitled'}</Link>{d.source?.reference && <p className="mt-1 max-w-[160px] truncate text-xs text-muted-foreground">{d.source.reference}</p>}</td>
            <td className="min-w-[140px]">{d.party_name || '—'}</td>
            <td className="whitespace-nowrap text-xs tabular-nums">{d.source?.issue_date}{!meta.credit && <p className={`mt-1 ${matches(d,'overdue') ? 'text-amber-800' : 'text-muted-foreground'}`}>Due {d.source?.due_date}</p>}</td>
            <td>{!meta.credit && remaining(d) ? <SettlementPill item={remaining(d)} /> : <StatusPill status={d.status} />}</td>
            <td className="whitespace-nowrap text-right"><Money value={d.money?.gross_pence} /></td>
            {!meta.credit && <>{['paid_minor','credited_minor'].map(field=><td key={field} className="whitespace-nowrap text-right text-muted-foreground"><Money value={remaining(d)?.[field]} /></td>)}<td className="whitespace-nowrap text-right font-semibold">{d.status!=='posted' ? <span className="text-xs font-normal text-muted-foreground">Not posted</span> : remaining(d) ? <Money value={remaining(d).open_minor} /> : ledger.loading ? 'Loading…' : 'Unavailable'}</td></>}
            <td><Link className="text-xs font-medium text-primary hover:underline" to={docPath(kind,d.id)}>{d.status==='posted' ? 'View' : 'Review'}</Link></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
      <p className="text-xs text-muted-foreground">{meta.credit ? 'Posted credits adjust the original balance. They do not represent a cash payment.' : 'Drafts do not affect your accounts. Payments and credits are shown separately against the original total.'}</p>
    </div>
  );
}
