import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money, ErrorBox, SkeletonRows, today } from '@/components/accounting/AccountingUI';
import ClaimList from './ClaimList';
import { filterClaims, isOpenClaim, isOverdue, remainingTotal } from './model.mjs';
import { useCreditClaims } from './useCreditClaims';

const filters = [['open', 'Still waiting'], ['received', 'Received'], ['needs_review', 'Needs review'], ['cancelled', 'Cancelled'], ['all', 'All']];

function CompanyAwaitingCredits({ companyId }) {
  const { data, loading, error, refresh } = useCreditClaims(companyId);
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const claims = data?.claims ?? [];
  const shown = filterClaims(claims, filter, search);
  const open = claims.filter(isOpenClaim);
  return <div className="workspace-page">
    <header className="page-heading"><div><span className="eyebrow">Purchases</span><h1 className="mt-2">Awaiting credits</h1><p>Keep track of returned items and see which supplier credits have arrived.</p></div><Button asChild variant="outline"><Link to="/bills">Select items from a bill<ArrowRight className="h-4 w-4" /></Link></Button></header>
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Credit tracking summary">
      <div className="workspace-card p-5"><p className="text-sm text-muted-foreground">Credit still expected</p><p className="metric-value">{data ? <Money value={remainingTotal(claims)} /> : '—'}</p><p className="mt-2 text-xs text-muted-foreground">Including VAT · tracked items only</p></div>
      <div className="workspace-card p-5"><p className="text-sm text-muted-foreground">Items still waiting</p><p className="metric-value">{data ? open.length : '—'}</p><p className="mt-2 text-xs text-muted-foreground">Includes partially received credits</p></div>
      <div className="workspace-card p-5"><p className="text-sm text-muted-foreground">Past the expected date</p><p className="metric-value text-amber-800">{data ? claims.filter(claim => isOverdue(claim, today())).length : '—'}</p><p className="mt-2 text-xs text-muted-foreground">Ready for you to follow up</p></div>
    </section>
    <ErrorBox error={error} onRetry={refresh} />
    <section className="workspace-card overflow-hidden" aria-label="Tracked credits">
      <div className="document-tabs" role="tablist" aria-label="Credit tracking status">{filters.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{label}<span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{data ? filterClaims(claims, value).length : '—'}</span></button>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="relative w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search awaiting credits" placeholder="Supplier, invoice, part, return note or vehicle…" /></div><Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button></div>
      {loading && !data && <div className="p-5"><SkeletonRows rows={4} /></div>}
      {data && !data.can_manage && <p className="px-5 pb-4 text-xs text-muted-foreground">You have view-only access. An owner, administrator or accountant can add items and confirm credit matches.</p>}
      {data && shown.length > 0 && <div className="px-5 pb-5"><ClaimList claims={shown} companyId={companyId} canManage={data.can_manage && !loading} onChanged={refresh} showBill /></div>}
      {data && shown.length === 0 && <div className="flex flex-col items-center border-t px-6 py-14 text-center"><RotateCcw className="mb-4 h-9 w-9 text-muted-foreground/50" /><h2 className="font-semibold">{claims.length ? 'No items match this view' : 'Stop keeping a separate returns list'}</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">{claims.length ? 'Try another search or status.' : 'Open a posted supplier bill and select the items you are waiting to be credited. Their original details are filled in for you.'}</p>{!claims.length && <Button className="mt-5" asChild><Link to="/bills">Open supplier bills<ArrowRight className="h-4 w-4" /></Link></Button>}</div>}
    </section>
    <p className="text-xs leading-relaxed text-muted-foreground">This tracker records expected supplier credits. Your accounts and bill balances change only through the existing review and posting workflow. A draft credit is never counted as received.</p>
  </div>;
}

export default function AwaitingCreditsPage() {
  const { activeCompany, loading } = useCompany();
  if (loading) return <div className="workspace-page"><SkeletonRows rows={4} /></div>;
  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;
  return <CompanyAwaitingCredits key={activeCompany.id} companyId={activeCompany.id} />;
}
