import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Plus, Receipt, FileText, Wallet, Sparkles, SlidersHorizontal, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot, sumMinor } from '@/lib/useLedgerSnapshot';
import { docPath } from '@/api/accountingDocuments.mjs';
import { Money, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { Button } from '@/components/ui/button';
import { useAsk } from '@/components/ask/AskProvider';
import CustomDashboard from './CustomDashboard';

function Metric({ label, value, detail, to, icon: Icon }) {
  return <Link to={to} className="workspace-card group p-5 transition-colors hover:border-primary/40">
    <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div>
    <p className="metric-value"><Money value={value} /></p>
    <p className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">{detail}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></p>
  </Link>;
}
function OpenDocuments({ title, rows, to, date }) {
  return <section className="workspace-card overflow-hidden">
    <div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">{title}</h2><Link to={to} className="text-xs font-medium text-primary hover:underline">View all <span aria-hidden="true">→</span></Link></div>
    {rows.length ? <ul className="divide-y">{[...rows].sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0,4).map(d => <li key={d.id}>
      <Link to={docPath(d.kind,d.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">{d.party_name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.party_name}</p><p className="mt-1 text-xs text-muted-foreground">{d.number} · {d.due_date < date ? 'Overdue since' : 'Due'} {new Date(`${d.due_date}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p></div><Money className="text-sm font-semibold" value={d.open_minor} /><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>
    </li>)}</ul> : <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><CheckCircle2 className="h-5 w-5 text-primary" />No outstanding balances.</div>}
  </section>;
}
export default function Dashboard() {
  const { activeCompany, loading } = useCompany();
  const [params, setParams] = useSearchParams();
  const custom = params.get('view') === 'custom';
  const s = useLedgerSnapshot(activeCompany?.id, undefined, undefined, !custom);
  const { openAsk } = useAsk();
  const viewToggle = <div className="flex items-center gap-1 rounded-lg border bg-white p-1 text-sm"><button type="button" aria-pressed={!custom} className={`rounded-md px-3 py-1.5 ${!custom ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground'}`} onClick={() => setParams({})}>Overview</button><button type="button" aria-pressed={custom} className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${custom ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground'}`} onClick={() => setParams({view:'custom'})}><SlidersHorizontal className="h-3.5 w-3.5" />My dashboard</button></div>;
  if (custom) return <div className="workspace-page"><div className="flex justify-end">{viewToggle}</div><CustomDashboard /></div>;
  if (loading) return <SkeletonRows />;
  if (!activeCompany) return <div className="workspace-page"><header className="page-heading"><div><h1>Welcome to Ledgerly</h1><p>Your business, in one clear view.</p></div></header><section className="workspace-card max-w-2xl p-8"><h2 className="text-lg font-semibold">Choose a company to get started</h2><p className="mb-6 mt-2 text-sm text-muted-foreground">Open your business or create a company to start working.</p><Button asChild><Link to="/companies">Open companies</Link></Button></section></div>;
  const d=s.data;
  const invoices=d?.open_items.filter(r=>r.kind==='sales_invoice' && BigInt(r.open_minor)>0n) ?? [];
  const bills=d?.open_items.filter(r=>r.kind==='purchase_bill' && BigInt(r.open_minor)>0n) ?? [];
  const overdue=invoices.filter(r=>r.due_date<s.to);
  const draftInvoices=d?.drafts.filter(r=>r.kind==='sales_invoice') ?? [];
  const draftBills=d?.drafts.filter(r=>r.kind==='purchase_bill') ?? [];
  return <div className="workspace-page">
    <header className="page-heading"><div><span className="eyebrow">Your business at a glance</span><h1 className="mt-2">Overview</h1><p>{activeCompany.name}</p></div>{viewToggle}</header>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />Year to date · {s.from} — {s.to}</p><Button asChild><Link to="/invoices/new"><Plus />New invoice</Link></Button></div>
    <ErrorBox error={s.error} onRetry={s.refresh} />
    {!d && !s.error && <SkeletonRows rows={5} />}
    {d && <>
      <section aria-label="Business balances" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Customers owe you" value={sumMinor(invoices,'open_minor')} detail={`${invoices.length} unpaid invoices`} to="/invoices?status=awaiting" icon={ArrowDownLeft} />
        <Metric label="You owe suppliers" value={sumMinor(bills,'open_minor')} detail={`${bills.length} unpaid bills`} to="/bills?status=awaiting" icon={ArrowUpRight} />
        <Metric label="Revenue" value={d.pnl.revenue_minor} detail="This year · excluding VAT" to="/reports?tab=pnl" icon={FileText} />
        <Metric label="Net profit" value={d.pnl.profit_minor} detail="This year · after expenses" to="/reports?tab=pnl" icon={Wallet} />
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="workspace-card overflow-hidden"><div className="border-b px-5 py-4"><h2 className="font-semibold">Your next steps</h2><p className="mt-1 text-xs text-muted-foreground">Pick up where your business needs you.</p></div>
            {[{label:'Review invoice drafts',n:draftInvoices.length,detail:'Ready to finish and post',to:'/invoices?status=draft',icon:FileText},{label:'Review bill drafts',n:draftBills.length,detail:'Check purchases before posting',to:'/bills?status=draft',icon:Receipt},{label:'Follow up overdue invoices',n:overdue.length,detail:'Check balances and record payments received',to:'/invoices?status=overdue',icon:ArrowDownLeft}].map(({label,n,detail,to,icon:Icon})=><Link key={to} to={to} className="flex items-center gap-4 border-b px-5 py-4 last:border-0 hover:bg-muted/40"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary"><Icon className="h-5 w-5" /></span><div className="flex-1"><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="rounded-md bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">{n}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>)}
          </section>
          <div className="grid gap-6 2xl:grid-cols-2"><OpenDocuments title="Money coming in" rows={invoices} to="/invoices?status=awaiting" date={s.to} /><OpenDocuments title="Money going out" rows={bills} to="/bills?status=awaiting" date={s.to} /></div>
        </div>
        <div className="space-y-6">
          <section className="workspace-card p-5"><span className="eyebrow">Cash & bank</span><p className="metric-value">{d.cash.configured ? <Money value={d.cash.balance_minor} /> : 'Not set up'}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Posted cash balance. Bank-feed reconciliation is separate.</p><Link to="/payments" className="mt-5 flex items-center justify-between border-t pt-4 text-sm font-medium text-primary">Payments & balances<ArrowRight className="h-4 w-4" /></Link></section>
          <section className="rounded-xl border border-primary/20 bg-primary/[0.045] p-5"><Sparkles className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">A little help with the numbers</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Ask Ledgerly to explain a figure or help you find your next step.</p><Button variant="outline" className="mt-4 bg-white" onClick={()=>openAsk()}>Ask Ledgerly<ArrowRight /></Button></section>
          <section className="workspace-card p-5"><h2 className="font-semibold">Useful reports</h2><div className="mt-3 space-y-1">{[['Profit & loss','pnl'],['Balance sheet','bs'],['VAT workings','vat']].map(([label,tab])=><Link key={tab} to={`/reports?tab=${tab}`} className="flex items-center justify-between py-2.5 text-sm text-muted-foreground hover:text-primary">{label}<ArrowRight className="h-4 w-4" /></Link>)}</div></section>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Figures come from posted accounts. Drafts are excluded from balances; payments and credits reduce the amount outstanding.</p>
    </>}
  </div>;
}
