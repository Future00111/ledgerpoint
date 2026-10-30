import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Scale, BookOpen, Percent, Users, Clock3, ArrowUpRight, Table2 } from 'lucide-react';
import AccountingReports from './AccountingReports';
import PageHeader from '@/components/workspace/PageHeader';
import { Button } from '@/components/ui/button';
const reports=[
  {tab:'pnl',title:'Profit & loss',description:'See your income, costs and profit for a period.',icon:BarChart3},
  {tab:'bs',title:'Balance sheet',description:'Understand what your business owns and owes.',icon:Scale},
  {tab:'vat',title:'VAT workings',description:'Review the VAT recorded on sales and purchases.',icon:Percent},
  {tab:'parties',title:'Customer & supplier balances',description:'See outstanding balances and their transactions.',icon:Users},
  {tab:'ageing',title:'Aged balances',description:'See which customer invoices and supplier bills are overdue.',icon:Clock3},
  {tab:'tb',title:'Trial balance',description:'Review the debit and credit balances of your accounts.',icon:Table2},
  {tab:'gl',title:'General ledger',description:'Follow individual entries back to their source documents.',icon:BookOpen},
];
export default function ReportLibrary() {
  const [params]=useSearchParams();
  if(params.has('tab')) return <AccountingReports />;
  return <div className="workspace-page"><PageHeader eyebrow="Understand your business" title="Reports" description="Choose a question, review the figures and open the documents behind them." actions={<Button asChild variant="outline"><Link to="/statements">Account statements</Link></Button>} /><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Available reports">{reports.map(({tab,title,description,icon:Icon})=><Link key={tab} to={tab === 'vat' ? '/vat' : `/reports?tab=${tab}`} className="workspace-card group p-6 transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></div><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p></Link>)}</section><p className="text-xs text-muted-foreground">These reports use posted accounts. Choose a report to set dates, inspect the detail or export a CSV.</p><Link to="/reports/legacy" className="inline-block text-xs text-muted-foreground underline underline-offset-4">Open earlier report tools</Link></div>;
}
