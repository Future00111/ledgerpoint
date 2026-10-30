import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Scale, BookOpen, Percent, Users, Clock3, ArrowUpRight, ArrowRight, Table2, FileText } from 'lucide-react';
import AccountingReports from './AccountingReports';
import PageHeader from '@/components/workspace/PageHeader';
import { Button } from '@/components/ui/button';

const everyday = [
  {tab:'bs', title:'What does my business own and owe?', name:'Balance sheet', description:'Assets, liabilities and the value held in your business.', icon:Scale},
  {tab:'parties', title:'Who owes what?', name:'Customer & supplier balances', description:'Outstanding balances with a direct route to each statement.', icon:Users},
  {tab:'ageing', title:'What needs following up?', name:'Aged balances', description:'See how long invoices and bills have been outstanding.', icon:Clock3},
];
const detail = [
  {tab:'tb', title:'Trial balance', description:'Check debit and credit balances across every account.', icon:Table2},
  {tab:'gl', title:'General ledger', description:'Trace individual entries to documents and journals.', icon:BookOpen},
];

export default function ReportLibrary() {
  const [params] = useSearchParams();
  if (params.has('tab')) return <AccountingReports />;
  return <div className="workspace-page">
    <PageHeader eyebrow="Your numbers, explained" title="Reports" description="Start with a question. Follow any figure back to the work behind it."
      actions={<Button asChild variant="outline"><Link to="/statements"><FileText aria-hidden="true" />Account statements</Link></Button>} />
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]" aria-label="Featured reports">
      <div className="workspace-hero flex flex-col items-start justify-between gap-8">
        <div><span className="inline-flex items-center gap-2 text-sm font-medium text-primary"><BarChart3 className="h-5 w-5" aria-hidden="true" />Profit &amp; loss</span><h2 className="mt-5 max-w-lg text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">How is your business doing?</h2><p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">See income, costs and profit together. Open a category or account to see the invoices, bills and credits behind it.</p></div>
        <Button asChild className="min-h-11"><Link to="/reports?tab=pnl">Open profit &amp; loss<ArrowRight aria-hidden="true" /></Link></Button>
      </div>
      <Link to="/vat" className="workspace-panel group flex flex-col items-start justify-between gap-8 p-6 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:p-7">
        <div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-primary"><Percent className="h-5 w-5" aria-hidden="true" /></span><h2 className="mt-5 text-xl font-semibold tracking-tight">Get ready for VAT review</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Review supported VAT workings and the source documents behind each figure.</p></div>
        <span className="flex w-full items-center justify-between border-t pt-4 text-sm font-semibold text-primary">VAT workings<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
      </Link>
    </section>
    <section aria-label="Everyday business reports"><div className="mb-4 flex items-center gap-3"><h2 className="workspace-section-title">Keep an eye on your business</h2><span className="h-px flex-1 bg-border" /></div><div className="grid gap-4 md:grid-cols-3">{everyday.map(({tab,title,name,description,icon:Icon}) => <Link key={tab} to={`/reports?tab=${tab}`} className="workspace-panel group p-5 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:p-6"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></div><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><p className="mt-5 text-xs font-semibold text-primary">{name}</p></Link>)}</div></section>
    <section className="workspace-panel" aria-label="Detailed accounting reports"><div className="workspace-panel-header"><div><h2 className="workspace-section-title">For a closer look</h2><p className="mt-1 text-sm text-muted-foreground">Account-level detail for you and your accountant.</p></div><BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div><div className="divide-y md:grid md:grid-cols-2 md:divide-x md:divide-y-0">{detail.map(({tab,title,description,icon:Icon}) => <Link key={tab} to={`/reports?tab=${tab}`} className="flex items-start gap-4 p-5 transition-colors hover:bg-muted/30 sm:p-6"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><span className="flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Link>)}</div></section>
    <div className="flex flex-wrap items-start justify-between gap-3 text-xs leading-5 text-muted-foreground"><p className="max-w-2xl">Reports use posted accounts. Drafts are excluded. Choose dates within each report and export exact figures. VAT workings are for review; they do not submit a return.</p><Link to="/reports/legacy" className="underline underline-offset-4">Earlier report tools</Link></div>
  </div>;
}
