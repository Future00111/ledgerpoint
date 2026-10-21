import React from 'react';
import { Link } from 'react-router-dom';
import { useLedgerSnapshot, sumMinor } from '@/lib/useLedgerSnapshot';
import { docPath, penceToDisplay } from '@/api/accountingDocuments.mjs';
import { ErrorBox, SkeletonRows, Money } from '@/components/accounting/AccountingUI';

const report = tab => `/accounting/reports?tab=${tab}`;
function Metric({ label, value, to }) {
  return <Link to={to} className="block rounded-xl border bg-card p-3 hover:border-primary/50"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></Link>;
}
function Rows({ rows, empty = 'No posted activity in this period.' }) {
  return rows.length ? <div className="space-y-2">{rows.slice(0, 7).map((r, i) => <Link key={i} to={r.path} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50"><span className="min-w-0"><span className="block truncate text-sm font-medium">{r.label}</span><span className="text-xs text-muted-foreground">{r.detail}</span></span><Money value={r.amount} className="text-sm" /></Link>)}</div> : <p className="py-3 text-sm text-muted-foreground">{empty}</p>;
}
export function nativeLedgerWidget(kind) {
  return function LedgerWidget({ company }) { return <LedgerDashboardWidget company={company} kind={kind} />; };
}
export default function LedgerDashboardWidget({ company, kind }) {
  const s = useLedgerSnapshot(company?.id);
  if (s.error) return <ErrorBox error={s.error} onRetry={s.refresh} />;
  if (!s.data) return <SkeletonRows rows={2} />;
  const d = s.data, positive = r => BigInt(r.open_minor) > 0n;
  const invoices = d.open_items.filter(r => r.kind === 'sales_invoice' && positive(r));
  const bills = d.open_items.filter(r => r.kind === 'purchase_bill' && positive(r));
  const owed = sumMinor(invoices, 'open_minor'), owe = sumMinor(bills, 'open_minor');
  const due = invoices.filter(r => r.due_date < s.to), dueBills = bills.filter(r => r.due_date < s.to);
  const docRows = rows => rows.sort((a, b) => a.due_date.localeCompare(b.due_date)).map(r => ({ path: docPath(r.kind, r.id), label: `${r.number} · ${r.party_name}`, detail: `${r.due_date < s.to ? 'Overdue' : 'Due'} ${r.due_date}`, amount: r.open_minor }));
  const metric = (label, value, tab) => <Metric key={label} label={label} value={penceToDisplay(value)} to={report(tab)} />;
  let body;
  if (['snapshot', 'kpis'].includes(kind)) body = <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metric('Revenue this year', d.pnl.revenue_minor, 'pnl')}{metric('Net profit this year', d.pnl.profit_minor, 'pnl')}{metric('Customers owe', owed, 'parties')}{metric('You owe suppliers', owe, 'parties')}</div>;
  else if (['profit', 'profitLoss'].includes(kind)) body = <div className="grid gap-3 sm:grid-cols-3">{metric('Revenue', d.pnl.revenue_minor, 'pnl')}{metric('Expenses', d.pnl.expense_minor, 'pnl')}{metric('Profit', d.pnl.profit_minor, 'pnl')}</div>;
  else if (kind === 'revenue') body = metric('Net sales after credits, excluding VAT', d.pnl.revenue_minor, 'pnl');
  else if (['invoices', 'bills'].includes(kind)) body = <><div className="mb-3 text-xl font-semibold"><Money value={kind === 'invoices' ? owed : owe} /></div><Rows rows={docRows(kind === 'invoices' ? invoices : bills)} empty="No open posted documents. Drafts are excluded." /></>;
  else if (['agedDebtors', 'agedCreditors'].includes(kind)) body = <>{metric('Overdue', sumMinor(kind === 'agedDebtors' ? due : dueBills, 'open_minor'), 'ageing')}<Rows rows={docRows(kind === 'agedDebtors' ? due : dueBills)} empty="No overdue posted balances." /></>;
  else if (kind === 'vat') body = d.vat.applicable ? <div className="space-y-3">{metric('Net VAT for selected period', d.vat.net_payable_pence, 'vat')}<p className="text-xs text-muted-foreground">Output VAT <Money value={d.vat.box1_pence} /> · Input VAT <Money value={d.vat.box4_pence} />. Review workings; no filing has been made.</p></div> : <p>Not VAT registered.</p>;
  else if (['cashflow', 'banking'].includes(kind)) body = <div className="space-y-3"><Metric label="Posted cash balance" value={d.cash.configured ? penceToDisplay(d.cash.balance_minor) : 'Set up cash accounts'} to="/payments" /><p className="text-xs text-muted-foreground">{d.cash.basis}</p><Link className="text-sm text-primary hover:underline" to="/payments">Record or review a payment</Link></div>;
  else if (kind === 'balanceSheet') body = <div className="grid gap-3">{metric('Assets', d.balance_sheet.assets_minor, 'bs')}{metric('Liabilities', d.balance_sheet.liabilities_minor, 'bs')}{metric('Equity including earnings', (BigInt(d.balance_sheet.equity_minor) + BigInt(d.balance_sheet.current_earnings_minor)).toString(), 'bs')}</div>;
  else if (kind === 'trialBalance') body = <><div className="grid grid-cols-2 gap-3">{metric('Debits', sumMinor(d.trial_balance, 'debit_minor'), 'tb')}{metric('Credits', sumMinor(d.trial_balance, 'credit_minor'), 'tb')}</div><p className="mt-3 text-sm">{d.balance_sheet.balanced ? 'Balanced' : 'Review the ledger imbalance'}</p></>;
  else if (['recent', 'generalLedger'].includes(kind)) body = <Rows rows={[...d.party_transactions].reverse().map(r => ({ label: r.number, detail: `${r.date} · ${r.payment_kind ? `${r.party_type} ${r.payment_kind}` : r.source_type.replaceAll('_', ' ')}`, amount: r.event_amount_minor ?? r.balance_effect_minor, path: docPath(r.source_type, r.source_id) }))} />;
  else if (kind === 'topCustomers') {
    const totals = new Map();
    for (const r of d.posted_documents.filter(r => r.party_type === 'customer' && r.date >= s.from)) { const v = totals.get(r.party_id) || { name: r.party_name, amount: 0n }; v.amount += BigInt(r.net_minor); totals.set(r.party_id, v); }
    body = <Rows rows={[...totals].sort((a, b) => a[1].amount > b[1].amount ? -1 : 1).map(([id, r]) => ({ label: r.name, detail: 'Net revenue after credits', amount: r.amount.toString(), path: `/customers/${id}` }))} />;
  } else if (kind === 'topExpenses') body = <Rows rows={d.pnl.sections.filter(s => s.category !== 'income').flatMap(s => s.groups.flatMap(g => g.accounts)).sort((a, b) => BigInt(a.amount_minor) > BigInt(b.amount_minor) ? -1 : 1).map(r => ({ label: `${r.code} ${r.name}`, detail: 'Posted expense', amount: r.amount_minor, path: report('pnl') }))} />;
  else if (['workflow', 'priorities', 'billsApproval'].includes(kind)) body = <div className="space-y-3"><Link to="/invoices" className="block text-sm text-primary">{d.drafts.filter(r => r.kind === 'sales_invoice').length} invoice drafts to review</Link><Link to="/bills" className="block text-sm text-primary">{d.drafts.filter(r => r.kind === 'purchase_bill').length} bill drafts to review</Link><Link to={report('ageing')} className="block text-sm text-primary">{due.length} overdue invoices · {dueBills.length} overdue bills</Link><Link to="/payments" className="block text-sm text-primary">Manage payments and unapplied balances</Link></div>;
  else if (['forecast', 'aiForecasts'].includes(kind)) body = <><p className="mb-3 text-sm">Scheduled receivables from open invoices. This is a due-date view, not a prediction of when customers will pay.</p><Rows rows={docRows(invoices)} /></>;
  return <div className="space-y-3">{body}<p className="text-[11px] text-muted-foreground">Posted ledger · {s.from} to {s.to}. Open balances as at {s.to}.</p></div>;
}
