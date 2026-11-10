import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, FileCheck2, PackageCheck, Plus, RotateCcw, Search, X } from 'lucide-react';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Money, ErrorBox, SkeletonRows, today } from '@/components/accounting/AccountingUI';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';
import ClaimList from './ClaimList';
import { creditQueue, queueSummary } from './queuePresentation.mjs';
import { useCreditClaims } from './useCreditClaims';

const filters = [['open', 'Still waiting'], ['matches', 'Ready to review'], ['overdue', 'Overdue'], ['received', 'Received'], ['needs_review', 'Needs review'], ['cancelled', 'Cancelled'], ['all', 'All items']];

export function CreditQueueFilters({ filter, counts, onChange }) {
  return <div role="group" aria-label="Credit tracking status" className="flex flex-wrap gap-1.5">{filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => onChange(value)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${filter === value ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{label}<span className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${filter === value ? 'bg-white/15 text-white' : 'bg-muted'}`}>{counts[value] ?? '—'}</span></button>)}</div>;
}

export function CreditRecoverySummary({ summary, onChange, ready }) {
  return <section className="workspace-hero" aria-label="Credit tracking summary">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
      <div className="min-w-0"><p className="workspace-kicker">Money you are waiting to recover</p><p className="mt-3 break-words text-4xl font-semibold tracking-tight sm:text-5xl">{ready ? <Money value={summary.remaining} /> : '—'}</p><p className="mt-3 text-sm text-muted-foreground">Expected supplier credits · including VAT · tracked items only</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['open', 'Items waiting', summary.waiting, PackageCheck, 'Includes partial credits'],
          ['matches', 'Ready to review', summary.matches, FileCheck2, 'Posted credit matches'],
          ['overdue', 'Overdue', summary.overdue, Clock3, 'Past your expected date'],
        ].map(([value, label, count, Icon, detail]) => <button key={value} type="button" disabled={!ready} onClick={() => onChange(value)} className="rounded-xl border border-white/70 bg-white/70 p-4 text-left transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default">
          <Icon className={`h-4 w-4 ${value === 'overdue' && count > 0 ? 'text-orange-700' : 'text-primary'}`} aria-hidden="true" /><p className="mt-3 text-2xl font-semibold tabular-nums">{ready ? count : '—'}</p><p className="mt-1 text-sm font-medium">{label}</p><p className="mt-2 text-[11px] leading-4 text-muted-foreground">{detail}</p>
        </button>)}
      </div>
    </div>
  </section>;
}

function CompanyAwaitingCredits({ companyId }) {
  const { data, loading, error, refresh } = useCreditClaims(companyId);
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const claims = data?.claims ?? [];
  const date = today();
  const shown = creditQueue(claims, filter, search, date);
  const summary = queueSummary(claims, date);
  const canManage = data?.can_manage === true && !loading;
  const reset = () => { setSearch(''); setFilter('all'); };
  const counts = Object.fromEntries(filters.map(([value]) => [value, data ? creditQueue(claims, value, '', date).length : null]));
  return <div className="workspace-page">
    <PageHeader eyebrow="Purchases · Credit recovery" title="Awaiting credits" description="Every returned item. Every credit owed. One place to follow up."
      actions={<Button asChild className="min-h-11"><Link to="/bills">{canManage ? <><Plus className="h-4 w-4" />Select items from a bill</> : <>Open supplier bills<ArrowRight className="h-4 w-4" /></>}</Link></Button>} />
    <CreditRecoverySummary summary={summary} ready={Boolean(data)} onChange={setFilter} />
    <ErrorBox error={error} onRetry={refresh} />
    <section className="workspace-panel" aria-label="Tracked credits">
      <div className="workspace-panel-header"><div><h2 className="workspace-section-title">Your recovery queue</h2><p className="mt-1 text-xs text-muted-foreground">Review issues first, then posted matches and overdue items. Older items appear first within each priority.</p></div><Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={refresh} disabled={loading}><RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />{loading ? 'Refreshing…' : 'Refresh'}</Button></div>
      <div className="space-y-4 border-b px-4 py-4 sm:px-6">
        <CreditQueueFilters filter={filter} counts={counts} onChange={setFilter} />
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input className="h-11 bg-muted/30 pl-9 pr-10 shadow-none" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search awaiting credits" placeholder="Supplier, invoice, part, return note or vehicle…" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear credit search" className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-lg text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X className="h-4 w-4" aria-hidden="true" /></button>}</div><p role="status" className="text-xs text-muted-foreground">{data ? `${shown.length} ${shown.length === 1 ? 'item' : 'items'} in this view` : 'Loading tracked items…'}</p></div>
      </div>
      {loading && !data && <div className="p-5"><SkeletonRows rows={4} /></div>}
      {data && !data.can_manage && <p className="border-b bg-muted/30 px-6 py-3 text-xs text-muted-foreground">View-only access. An owner, administrator or accountant can add items and confirm matches.</p>}
      {data && shown.length > 0 && <ClaimList claims={shown} companyId={companyId} canManage={canManage} onChanged={refresh} showBill />}
      {data && shown.length === 0 && <EmptyState icon={filter === 'matches' ? FileCheck2 : PackageCheck}
        title={claims.length ? filter === 'matches' && !search ? 'No posted matches to review' : 'No items match this view' : 'Keep your returns out of spreadsheets'}
        description={claims.length ? filter === 'matches' && !search ? 'Possible posted credits appear here for your review. Unposted drafts stay in the item details.' : 'Try another search or choose a different status.' : 'Open a supplier bill, select the items waiting for credit and keep the original references together.'}
        action={claims.length ? <Button type="button" variant="outline" className="min-h-11" onClick={reset}>Show all items</Button> : <Button asChild className="min-h-11"><Link to="/bills">Open supplier bills<ArrowRight className="h-4 w-4" /></Link></Button>} />}
    </section>
    <p className="max-w-3xl text-xs leading-5 text-muted-foreground">This is your expected-credit tracker. Bill balances and accounts change through the existing review and posting workflow. Confirming a match records a received credit against the tracked item.</p>
  </div>;
}

export default function AwaitingCreditsPage() {
  const { activeCompany, loading } = useCompany();
  if (loading) return <div className="workspace-page"><SkeletonRows rows={4} /></div>;
  if (!activeCompany) return <div className="workspace-page"><PageHeader eyebrow="Purchases" title="Awaiting credits" /><section className="workspace-panel"><EmptyState icon={PackageCheck} title="Choose your business" description="Select a company to see its returned items and expected supplier credits." action={<Button asChild><Link to="/companies">Open companies</Link></Button>} /></section></div>;
  return <CompanyAwaitingCredits key={activeCompany.id} companyId={activeCompany.id} />;
}
