import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Plus, Receipt, FileText, Wallet, Sparkles, SlidersHorizontal, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot, sumMinor } from '@/lib/useLedgerSnapshot';
import { docPath } from '@/api/accountingDocuments.mjs';
import { Money, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { Button } from '@/components/ui/button';
import { useAsk } from '@/components/ask/AskProvider';
import CustomDashboard from './CustomDashboard';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';
import DailyWork from '@/features/workspaceNavigation/DailyWork';
import { DailyTaskQueue } from '@/features/workspaceNavigation/DailyTaskQueue';
import { useWorkspaceCapabilities } from '@/features/workspaceNavigation/WorkspaceCapabilities';

function Metric({ label, value, detail, to, icon: Icon }) {
  return <Link to={to} className="group min-w-0 border-b p-5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:even:border-l xl:border-b-0 xl:border-l xl:first:border-l-0">
    <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{label}</span><Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></div>
    <p className="mt-3 break-words text-[28px] font-semibold tracking-tight tabular-nums"><Money value={value} /></p>
    <p className="mt-2 flex items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">{detail}<ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /></p>
  </Link>;
}

function OpenDocuments({ title, rows, to, date, icon: Icon }) {
  return <section className="workspace-panel">
    <div className="workspace-panel-header"><h2 className="workspace-section-title flex items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{title}</h2><Link to={to} className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary hover:underline">View all<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></div>
    {rows.length ? <ul className="divide-y">{[...rows].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 4).map(d => <li key={d.id}>
      <Link to={docPath(d.kind, d.id)} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30 sm:px-6"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden="true">{d.party_name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.party_name}</p><p className="mt-1 text-xs text-muted-foreground">{d.number} · <span className={d.due_date < date ? 'text-amber-800' : ''}>{d.due_date < date ? 'Overdue since' : 'Due'} {new Date(`${d.due_date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></p></div><Money className="shrink-0 text-sm font-semibold" value={d.open_minor} /><ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" /></Link>
    </li>)}</ul> : <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />No outstanding balances.</div>}
  </section>;
}


export default function Dashboard() {
  const { activeCompany, loading } = useCompany();
  const [params, setParams] = useSearchParams();
  const custom = params.get('view') === 'custom';
  const s = useLedgerSnapshot(activeCompany?.id, undefined, undefined, !custom);
  const { openAsk } = useAsk();
  const { permissions } = useWorkspaceCapabilities();
  const selectView = value => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set('view', value); else next.delete('view'); return next; });
  const viewToggle = <div className="workspace-segmented" role="group" aria-label="Dashboard view"><button type="button" aria-pressed={!custom} onClick={() => selectView(null)}>Today</button><button type="button" aria-pressed={custom} className="flex items-center gap-2" onClick={() => selectView('custom')}><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />My dashboard</button></div>;
  if (custom) return <div className="workspace-page"><div className="flex justify-end">{viewToggle}</div><CustomDashboard /></div>;
  if (loading) return <SkeletonRows />;
  if (!activeCompany) return <div className="workspace-page"><PageHeader title="Welcome to Ledgerly" description="Your business, in one clear view." /><section className="workspace-card"><EmptyState icon={Wallet} title="Choose a company to get started" description="Open your business or create a company to start working." action={<Button asChild><Link to="/companies">Open companies</Link></Button>} /></section></div>;
  const d = s.data;
  const invoices = d?.open_items.filter(r => r.kind === 'sales_invoice' && BigInt(r.open_minor) > 0n) ?? [];
  const bills = d?.open_items.filter(r => r.kind === 'purchase_bill' && BigInt(r.open_minor) > 0n) ?? [];
  const overdue = invoices.filter(r => r.due_date < s.to);
  const draftInvoices = d?.drafts.filter(r => r.kind === 'sales_invoice') ?? [];
  const draftBills = d?.drafts.filter(r => r.kind === 'purchase_bill') ?? [];
  return <div className="workspace-page">
    <PageHeader eyebrow={activeCompany.name} title="Today" description="Your paperwork, priorities and business balances." actions={viewToggle} />
    <DailyWork />
    <ErrorBox error={s.error} onRetry={s.refresh} />
    {!d && !s.error && <SkeletonRows rows={5} />}
    {d && <>
      <DailyTaskQueue tasks={[
        { label: 'Overdue invoices', count: overdue.length, detail: 'Follow up or record a payment', to: '/invoices?status=overdue', icon: ArrowDownLeft, urgent: true },
        { label: 'Invoice drafts', count: draftInvoices.length, detail: 'Check the details before posting', to: '/invoices?status=draft', icon: FileText },
        { label: 'Bill drafts', count: draftBills.length, detail: 'Review your supplier purchases', to: '/bills?status=draft', icon: Receipt },
      ]} />
      <section className="space-y-3" aria-label="Business snapshot">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Your business in numbers</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Year to date · {s.from} — {s.to}</p></div>{permissions.drafts && <Button asChild variant="outline" className="min-h-11 rounded-xl bg-white"><Link to="/invoices/new"><Plus aria-hidden="true" />New invoice</Link></Button>}</div>
        <div className="workspace-panel grid sm:grid-cols-2 xl:grid-cols-4" aria-label="Business balances">
          <Metric label="Customers owe you" value={sumMinor(invoices, 'open_minor')} detail={`${invoices.length} unpaid invoices`} to="/invoices?status=awaiting" icon={ArrowDownLeft} />
          <Metric label="You owe suppliers" value={sumMinor(bills, 'open_minor')} detail={`${bills.length} unpaid bills`} to="/bills?status=awaiting" icon={ArrowUpRight} />
          <Metric label="Revenue" value={d.pnl.revenue_minor} detail="This year · excluding VAT" to="/reports?tab=pnl" icon={FileText} />
          <Metric label="Net profit" value={d.pnl.profit_minor} detail="This year · after expenses" to="/reports?tab=pnl" icon={Wallet} />
        </div>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-2"><OpenDocuments title="Money coming in" rows={invoices} to="/invoices?status=awaiting" date={s.to} icon={ArrowDownLeft} /><OpenDocuments title="Money going out" rows={bills} to="/bills?status=awaiting" date={s.to} icon={ArrowUpRight} /></div>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="workspace-panel p-5 sm:p-6"><p className="workspace-kicker">Cash & bank</p><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{d.cash.configured ? <Money value={d.cash.balance_minor} /> : 'Not set up'}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Posted cash balance. Bank-feed reconciliation is separate.</p><Link to="/payments" className="mt-4 flex min-h-11 items-center justify-between border-t pt-3 text-sm font-semibold text-primary">Payments & balances<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></section>
        <section className="workspace-panel p-5 sm:p-6"><p className="workspace-kicker">Look a little closer</p><h2 className="mt-3 text-base font-semibold">Useful reports</h2><div className="mt-2">{[['Profit & loss', 'pnl'], ['Balance sheet', 'bs'], ['VAT workings', 'vat']].map(([label, tab]) => <Link key={tab} to={`/reports?tab=${tab}`} className="flex min-h-11 items-center justify-between text-sm text-muted-foreground hover:text-primary">{label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>)}</div></section>
        <section className="flex flex-col items-start rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 sm:p-6"><span className="flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="h-4 w-4" aria-hidden="true" />Ask Ledgerly</span><h2 className="mt-3 text-lg font-semibold tracking-tight">Make sense of your numbers.</h2><p className="mb-4 mt-2 flex-1 text-sm leading-6 text-muted-foreground">Ask a question about a figure or find your next step.</p><Button variant="outline" className="min-h-11 rounded-xl bg-white" onClick={() => openAsk()}>Ask a question<ArrowRight aria-hidden="true" /></Button></section>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Figures come from posted accounts. Drafts are excluded from balances; payments and credits reduce the amount outstanding.</p>
    </>}
  </div>;
}
