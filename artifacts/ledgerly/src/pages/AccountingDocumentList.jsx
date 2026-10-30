import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, FileText, Search, ArrowUpRight, FileUp, ListFilter } from 'lucide-react';
import { accounting, KINDS, docPath } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill, SettlementPill, Money, ErrorBox, SkeletonRows, JournalLink } from '@/components/accounting/AccountingUI';
import { canEditDrafts, documentActionLabel } from '@/features/documentDiscounts/model.mjs';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';

export function DocumentStatusFilters({ tabs, filter, counts, title, onChange }) {
  return <div className="workspace-segmented" role="group" aria-label={`${title} status`}>
    {tabs.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} data-testid={`tab-${value}`} onClick={() => onChange(value)}>{label}<span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs">{counts[value] ?? '—'}</span></button>)}
  </div>;
}

export function MobileDocumentCards({ docs, kind, capabilities, remaining, ledgerLoading }) {
  const meta = KINDS[kind];
  return <div className="divide-y border-t lg:hidden" aria-label={`${meta.plural} list`}>{docs.map(doc => {
    const item = remaining(doc);
    return <article key={doc.id} className="space-y-4 p-5" data-testid={`card-doc-${doc.id}`}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold"><Link className="text-primary hover:underline" to={docPath(kind, doc.id)}>{doc.source?.invoice_number || 'Untitled'}</Link></h2><p className="mt-1 break-words text-sm">{doc.party_name || '—'}</p>{doc.source?.reference && <p className="mt-1 break-words text-sm text-muted-foreground">{doc.source.reference}</p>}</div>{!meta.credit && item ? <SettlementPill item={item} /> : <StatusPill status={doc.status} />}</div>
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Date</dt><dd className="mt-1">{doc.source?.issue_date || '—'}</dd></div><div><dt className="text-muted-foreground">Total</dt><dd className="mt-1 font-medium"><Money value={doc.money?.gross_pence} /></dd></div>{!meta.credit && <><div><dt className="text-muted-foreground">Due</dt><dd className="mt-1">{doc.source?.due_date || '—'}</dd></div><div><dt className="text-muted-foreground">Still due</dt><dd className="mt-1 font-semibold">{doc.status !== 'posted' ? 'Not posted' : item ? <Money value={item.open_minor} /> : ledgerLoading ? 'Loading…' : 'Unavailable'}</dd></div><div><dt className="text-muted-foreground">Paid</dt><dd className="mt-1"><Money value={item?.paid_minor} /></dd></div><div><dt className="text-muted-foreground">Credited</dt><dd className="mt-1"><Money value={item?.credited_minor} /></dd></div></>}</dl>
      <Button asChild variant="outline" className="min-h-11 w-full"><Link to={docPath(kind, doc.id)}>{documentActionLabel(doc.status, capabilities)}</Link></Button>
    </article>;
  })}</div>;
}

export default function AccountingDocumentList({ kind, legacyLink }) {
  const { activeCompany } = useCompany();
  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;
  return <CompanyDocumentList key={`${activeCompany.id}:${kind}`} kind={kind} legacyLink={legacyLink} activeCompany={activeCompany} />;
}

function CompanyDocumentList({ kind, legacyLink, activeCompany }) {
  const meta = KINDS[kind];
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const loadVersion = useRef(0);
  const canEdit = canEditDrafts(capabilities);
  const [params, setParams] = useSearchParams();
  const validFilters = meta.credit ? ['all','draft','posted'] : ['all','draft','awaiting','partial','overdue','settled'];
  const filter = validFilters.includes(params.get('status')) ? params.get('status') : 'all';
  const setFilter = value => { const next = new URLSearchParams(params); next.set('status',value); setParams(next,{replace:true}); };
  const [search, setSearch] = useState('');
  const ledger = useLedgerSnapshot(activeCompany?.id, undefined, undefined, !meta.credit);
  const remaining = d => ledger.data?.open_items.find(o => o.id === d.id);

  const load = useCallback((signal) => {
    if (!activeCompany) return;
    const version = ++loadVersion.current;
    const current = () => version === loadVersion.current && !signal?.aborted;
    setDocs(null); setError(null); setCapabilities(null); setAccessError(null);
    accounting.list(activeCompany.id, kind, signal).then(d => { if (current()) setDocs(Array.isArray(d) ? d : []); }).catch(e => { if (current()) setError(e); });
    accounting.context(activeCompany.id, kind, signal).then(context => { if (current()) setCapabilities(context?.capabilities ?? null); }).catch(e => { if (current()) setAccessError(e); });
  }, [activeCompany?.id, kind]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => { c.abort(); loadVersion.current++; }; }, [load]);

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
      <PageHeader eyebrow={meta.section} title={title}
        description={meta.credit ? 'Every credit, clearly linked to its original document.' : kind === 'sales_invoice' ? 'Keep track of your sales and what customers owe you.' : 'Keep purchases organised and see what needs paying.'}
        actions={<>
          {legacyLink && <Button variant="ghost" asChild className="min-h-11"><Link to={legacyLink} data-testid="link-legacy">Earlier drafts</Link></Button>}
          {canEdit && meta.party === 'supplier' && <Button variant="outline" asChild className="min-h-11"><Link to="/documents"><FileUp aria-hidden="true" />Upload supplier files</Link></Button>}
          {canEdit && <Button asChild className="min-h-11"><Link to={`${meta.path}/new`} data-testid="button-new-doc"><Plus />New {kind==='purchase_bill' ? 'bill' : kind==='sales_invoice' ? 'invoice' : 'credit note'}</Link></Button>}
        </>} />
      {!meta.credit && <section className="grid overflow-hidden rounded-2xl border bg-white sm:grid-cols-3" aria-label="Document balances">
        {[['awaiting',kind === 'sales_invoice' ? 'Outstanding invoices' : 'Outstanding bills','Total still to be paid'],['overdue','Overdue','Past the payment due date'],['draft','Drafts','Not yet included in your accounts']].map(([key,label,detail]) => <button key={key} type="button" aria-pressed={filter === key} onClick={()=>setFilter(key)} className={`border-b p-5 text-left transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:border-b-0 sm:border-r sm:last:border-r-0 ${filter===key ? 'bg-primary/5' : ''}`}><p className="flex items-center justify-between text-sm text-muted-foreground">{label}<ArrowUpRight className="h-4 w-4" /></p><p className={`metric-value ${key==='overdue' ? 'text-amber-800' : ''}`}>{!docs ? '—' : key==='draft' ? docs.filter(d=>d.status==='draft').length : <Money value={sumOpen(key)} />}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></button>)}
      </section>}
      <ErrorBox error={error} onRetry={() => load()} />
      {accessError && <p role="status" className="text-sm text-muted-foreground">Editing permissions could not be verified. You can still view documents; retry to enable permitted actions.</p>}
      {accessError && <Button type="button" variant="outline" onClick={() => load()}>Retry permissions</Button>}
      {!meta.credit && <ErrorBox error={ledger.error} onRetry={ledger.refresh} />}
      <section className="workspace-panel" aria-label={title}>
        <div className="workspace-panel-header"><div className="flex items-center gap-2"><ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><h2 className="workspace-section-title">All {title.toLowerCase()}</h2></div><span className="text-xs text-muted-foreground">{docs ? `${shown.length} ${shown.length === 1 ? 'document' : 'documents'}` : 'Loading…'}</span></div>
        <div className="px-5 pt-4"><DocumentStatusFilters tabs={tabs} filter={filter} title={title} onChange={setFilter}
          counts={Object.fromEntries(tabs.map(([value]) => [value, !docs || (!meta.credit && !['all', 'draft'].includes(value) && (ledger.loading || ledger.error)) ? null : searched.filter(doc => matches(doc, value)).length]))} /></div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={`Search ${meta.plural.toLowerCase()}`} placeholder="Search name, number or reference…" value={search} onChange={e=>setSearch(e.target.value)} className="min-h-11 bg-background pl-9" /></div><span className="text-xs text-muted-foreground">Open a document to review its details</span></div>
        {!docs && !error && <div className="p-5"><SkeletonRows /></div>}
        {docs && shown.length === 0 && (meta.credit || !ledger.loading) && <EmptyState icon={FileText}
          title={search || filter !== 'all' ? 'Nothing matches this view' : `Your ${title.toLowerCase()} will appear here`}
          description={search || filter !== 'all' ? 'Try another search or choose a different status.' : 'Create your first draft. You can review it before posting it to your accounts.'}
          action={search || filter !== 'all' ? <Button type="button" variant="outline" className="min-h-11" onClick={() => { setSearch(''); setFilter('all'); }}>Show all documents</Button> : canEdit && <Button variant="outline" asChild className="min-h-11"><Link to={`${meta.path}/new`}>Create a draft</Link></Button>} />}
        {shown.length > 0 && <MobileDocumentCards docs={shown} kind={kind} capabilities={capabilities} remaining={remaining} ledgerLoading={ledger.loading} />}
        {shown.length>0 && <div className="hidden overflow-x-auto lg:block"><table className="workspace-table">
          <thead><tr><th>Document</th><th className="capitalize">{meta.party}</th><th>Date / due</th><th>Status</th><th className="text-right">Total</th>{!meta.credit && <><th className="text-right">Paid</th><th className="text-right">Credited</th><th className="text-right">Still due</th></>}<th><span className="sr-only">Open document</span></th></tr></thead>
          <tbody>{shown.map(d=><tr key={d.id} data-testid={`row-doc-${d.id}`}>
            <td><Link className="whitespace-nowrap font-medium text-primary hover:underline" to={docPath(kind,d.id)}>{d.source?.invoice_number || 'Untitled'}</Link>{d.source?.reference && <p className="mt-1 max-w-[160px] truncate text-xs text-muted-foreground">{d.source.reference}</p>}</td>
            <td className="min-w-[140px]">{d.party_name || '—'}</td>
            <td className="whitespace-nowrap text-xs tabular-nums">{d.source?.issue_date}{!meta.credit && <p className={`mt-1 ${matches(d,'overdue') ? 'text-amber-800' : 'text-muted-foreground'}`}>Due {d.source?.due_date}</p>}</td>
            <td>{!meta.credit && remaining(d) ? <SettlementPill item={remaining(d)} /> : <StatusPill status={d.status} />}</td>
            <td className="whitespace-nowrap text-right"><Money value={d.money?.gross_pence} /></td>
            {!meta.credit && <>{['paid_minor','credited_minor'].map(field=><td key={field} className="whitespace-nowrap text-right text-muted-foreground"><Money value={remaining(d)?.[field]} /></td>)}<td className="whitespace-nowrap text-right font-semibold">{d.status!=='posted' ? <span className="text-xs font-normal text-muted-foreground">Not posted</span> : remaining(d) ? <Money value={remaining(d).open_minor} /> : ledger.loading ? 'Loading…' : 'Unavailable'}</td></>}
            <td><Link className="text-xs font-medium text-primary hover:underline" to={docPath(kind,d.id)}>{documentActionLabel(d.status, capabilities)}</Link></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
      <p className="text-xs text-muted-foreground">{meta.credit ? 'Posted credits adjust the original balance. They do not represent a cash payment.' : 'Drafts do not affect your accounts. Payments and credits are shown separately against the original total.'}</p>
    </div>
  );
}
