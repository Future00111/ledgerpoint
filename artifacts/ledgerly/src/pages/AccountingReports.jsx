import { downloadCsv, reportRows } from '@/lib/ledgerCsv.mjs';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { accounting, docPath } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money, ErrorBox, SkeletonRows, JournalLink, today } from '@/components/accounting/AccountingUI';
import { columnTotals } from '@/lib/accountingEditor.mjs';

const TABS = [['tb', 'Trial balance'], ['gl', 'General ledger'], ['pnl', 'Profit & loss'], ['bs', 'Balance sheet'], ['vat', 'VAT'], ['parties', 'Customer & supplier'], ['ageing', 'Ageing']];
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const th = 'px-4 py-3'; const tr = 'border-b last:border-0';

function Table({ head, children, footer }) {
  return <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{head.map((h, i) => <th key={i} className={`${th} ${i >= head.length - (head.r ?? 0) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
    <tbody>{children}</tbody>{footer && <tfoot className="border-t bg-muted/40 font-semibold">{footer}</tfoot>}</table></div>;
}
const R = (n, h) => Object.assign(h, { r: n });
const Stat = ({ label, value }) => <div className="rounded-xl border bg-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold"><Money value={value} /></p></div>;
function ReportSections({ sections, testid, extraEquity }) {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  return <div className="space-y-4" data-testid={`sections-${testid}`}>{sections.map(sec => (
    <div key={sec.category} className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left"><tr><th className={`${th} text-xs uppercase tracking-wide text-muted-foreground`} colSpan={2}>{sec.label}</th><th className={`${th} text-right text-xs uppercase tracking-wide text-muted-foreground`}>Amount</th></tr></thead>
        {(sec.groups ?? []).map((g, gi) => <tbody key={gi} className="border-b">
          <tr><td colSpan={3} className="px-4 pt-3 text-xs font-semibold text-muted-foreground">{g.name || 'Ungrouped'}</td></tr>
          {[...(g.accounts ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map(a => <tr key={a.account_id} data-testid={`row-${testid}-account-${a.account_id}`}>
            <td className="w-24 px-4 py-1.5 font-mono text-xs text-muted-foreground">{a.code}</td><td className="px-4 py-1.5">{a.name}</td><td className="px-4 py-1.5 text-right"><Money value={a.amount_minor} /></td></tr>)}
          <tr className="border-t border-dashed"><td /><td className="px-4 py-1.5 text-xs font-medium">Total {g.name || 'ungrouped'}</td><td className="px-4 py-1.5 text-right text-xs font-medium"><Money value={g.subtotal_minor} /></td></tr>
        </tbody>)}
        <tfoot className="bg-muted/40 font-semibold">
          {sec.category === 'equity' && extraEquity != null && <tr><td /><td className="px-4 py-2 font-normal">Current earnings (cumulative, unclosed)</td><td className="px-4 py-2 text-right font-normal"><Money value={extraEquity} /></td></tr>}
          <tr><td colSpan={2} className="px-4 py-2.5">Total {sec.label.toLowerCase()}{sec.category === 'equity' && extraEquity != null ? ' (accounts only)' : ''}</td><td className="px-4 py-2.5 text-right"><Money value={sec.total_minor} /></td></tr>
        </tfoot>
      </table>
    </div>))}</div>;
}
const SrcLink = ({ type, id, children }) => { const p = docPath(type, id); return p ? <Link to={p} className="text-primary hover:underline">{children}</Link> : <>{children}</>; };

export default function AccountingReports({ defaultTab = 'tb' }) {
  const { activeCompany } = useCompany();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || defaultTab;
  const [from, setFrom] = useState(params.get('from') || yearStart());
  const [to, setTo] = useState(params.get('to') || today());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const partyFilter = params.get('party_id') || params.get('party');
  useEffect(() => {
    if (!activeCompany || !from || !to) return;
    const c = new AbortController(); setData(null); setError(null);
    accounting.reports(activeCompany.id, from, to, c.signal).then(setData).catch(e => { if (!c.signal.aborted) setError(e); });
    return () => c.abort();
  }, [activeCompany?.id, from, to, tick]);
  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company first.</p>;
  const setTab = t => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-primary">Accounting · Posted ledger</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ledger reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Built only from posted journals. Drafts never appear here.</p></div>
        <div className="flex gap-3">
          <div><Label htmlFor="from">From</Label><Input id="from" data-testid="input-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label htmlFor="to">To</Label><Input id="to" data-testid="input-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
      </header>
      <nav className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1 w-fit">
        {TABS.map(([k, l]) => <button key={k} type="button" data-testid={`tab-${k}`} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm ${tab === k ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>)}
      </nav>
      {data && <div className="flex gap-4"><button type="button" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted" onClick={() => downloadCsv(`ledger-${tab}-${to}.csv`, [['Company', activeCompany.name], ['From', from, 'To', to], ...reportRows(data, tab, partyFilter)])}>Download report CSV</button><Link to={`/statements${partyFilter ? `?party_id=${encodeURIComponent(partyFilter)}` : ''}`} className="self-center text-sm text-primary underline">Account statements</Link></div>}
      <ErrorBox error={error} onRetry={() => setTick(t => t + 1)} />
      {!data && !error && <SkeletonRows rows={6} />}
      {data && <p className="text-xs text-muted-foreground" data-testid="text-report-basis">
        {['pnl', 'vat', 'gl'].includes(tab) ? `Movements posted from ${from} to ${to} inclusive.` : tab === 'tb' ? `Closing trial balance as at ${to}: cumulative debits, credits and balances from all postings up to and including that date (the from date does not limit it).` : `Closing balances as at ${to}, cumulative from the first posting (period from ${from} applies to earnings only where stated).`}
        {' '}Business accounting basis: accrual.
      </p>}
      {data && tab === 'tb' && <Table head={R(3, ['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance'])}
        footer={<tr data-testid="totals-trial-balance"><th colSpan={3} scope="row" className={`${th} text-left`}>Closing totals</th>
          <td className={`${th} text-right`}><Money value={columnTotals(data.trial_balance).debit_minor} /></td>
          <td className={`${th} text-right`}><Money value={columnTotals(data.trial_balance).credit_minor} /></td><td className={`${th} text-right`}>—</td></tr>}>
        {data.trial_balance.map(a => <tr key={a.account_id} className={tr}><td className={`${th} font-mono text-xs`}>{a.code}</td><td className={th}>{a.name}</td><td className={`${th} capitalize text-muted-foreground`}>{a.account_type}</td><td className={`${th} text-right`}><Money value={a.debit_minor} /></td><td className={`${th} text-right`}><Money value={a.credit_minor} /></td><td className={`${th} text-right font-medium`}><Money value={a.balance_minor} /></td></tr>)}
      </Table>}
      {data && tab === 'gl' && <Table head={R(2, ['Date', 'Account', 'Document', 'Source', 'Journal', 'Debit', 'Credit'])}
        footer={<tr data-testid="totals-general-ledger"><th colSpan={5} scope="row" className={`${th} text-left`}>Movement totals</th>
          <td className={`${th} text-right`}><Money value={columnTotals(data.general_ledger).debit_minor} /></td>
          <td className={`${th} text-right`}><Money value={columnTotals(data.general_ledger).credit_minor} /></td></tr>}>
        {data.general_ledger.map((g, i) => <tr key={i} className={tr}><td className={`${th} tabular-nums`}>{g.posting_date}</td><td className={th}><span className="font-mono text-xs text-muted-foreground">{g.account_code}</span> {g.account_name}</td><td className={`${th} font-medium`} data-testid={`text-gl-number-${i}`}><SrcLink type={g.source_type} id={g.source_id}>{g.source_number || '—'}</SrcLink></td><td className={th}><SrcLink type={g.source_type} id={g.source_id}>{g.source_type.replace(/_/g, ' ')}</SrcLink></td><td className={th}><JournalLink id={g.journal_id} /></td><td className={`${th} text-right`}><Money value={g.debit_minor} /></td><td className={`${th} text-right`}><Money value={g.credit_minor} /></td></tr>)}
      </Table>}
      {data && tab === 'pnl' && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><Stat label="Revenue" value={data.pnl.revenue_minor} /><Stat label="Expenses" value={data.pnl.expense_minor} /><Stat label="Profit" value={data.pnl.profit_minor} /></div>
        {(data.pnl.gross_profit_minor != null || data.pnl.cost_of_sales_minor != null) && <div className="grid gap-4 sm:grid-cols-3">
          {data.pnl.cost_of_sales_minor != null && <Stat label="Cost of sales" value={data.pnl.cost_of_sales_minor} />}
          {data.pnl.gross_profit_minor != null && <Stat label="Gross profit" value={data.pnl.gross_profit_minor} />}
          {data.pnl.operating_expenses_minor != null && <Stat label="Operating expenses" value={data.pnl.operating_expenses_minor} />}
        </div>}
        <ReportSections sections={data.pnl.sections} testid="pnl" />
        {Array.isArray(data.pnl.sections) && <div className="flex justify-between rounded-xl border bg-card px-4 py-3 text-sm font-semibold" data-testid="total-pnl-profit"><span>Profit for the period</span><Money value={data.pnl.profit_minor} /></div>}</div>}
      {data && tab === 'bs' && <div className="space-y-3"><div className="grid gap-4 sm:grid-cols-4"><Stat label="Assets" value={data.balance_sheet.assets_minor} /><Stat label="Liabilities" value={data.balance_sheet.liabilities_minor} /><Stat label="Equity" value={data.balance_sheet.equity_minor} /><Stat label="Current earnings (cumulative, unclosed)" value={data.balance_sheet.current_earnings_minor} /></div>
        <ReportSections sections={data.balance_sheet.sections} testid="bs" extraEquity={data.balance_sheet.current_earnings_minor} />
        <div className="grid gap-4 sm:grid-cols-3">
          {data.balance_sheet.net_vat_payable_minor != null && <Stat label="Net VAT payable (output − input)" value={data.balance_sheet.net_vat_payable_minor} />}
          {data.balance_sheet.net_assets_minor != null && <Stat label="Assets after VAT offset" value={data.balance_sheet.net_assets_minor} />}
          {data.balance_sheet.net_liabilities_minor != null && <Stat label="Liabilities after VAT offset" value={data.balance_sheet.net_liabilities_minor} />}
        </div>
        <p className="text-xs text-muted-foreground">Assets and liabilities show gross balances, so input VAT sits in assets and output VAT in liabilities. Net VAT payable reconciles the two. Current earnings are cumulative, unclosed {data.balance_sheet.earnings_basis ? `(${data.balance_sheet.earnings_basis})` : ''} profit as at {to}.</p>
        <p className={`text-sm font-medium ${data.balance_sheet.balanced ? 'text-emerald-700' : 'text-red-700'}`} data-testid="status-balanced">{data.balance_sheet.balanced ? 'Balanced' : 'Not balanced — review journals'}</p></div>}
      {data && tab === 'vat' && data.vat?.applicable === false && <p className="rounded-xl border bg-card p-5 text-sm" data-testid="text-not-vat-registered">Not VAT registered. There are no VAT return workings for this company.</p>}
      {data && tab === 'vat' && data.vat?.applicable !== false && <Table head={R(1, ['Box', 'Description', 'Amount'])}>
        {[['1', 'VAT due on sales', 'box1_pence'], ['4', 'VAT reclaimed on purchases', 'box4_pence'], ['5', 'Net VAT', 'box5_pence'], ['6', 'Total sales ex VAT', 'box6_pence'], ['7', 'Total purchases ex VAT', 'box7_pence']].map(([b, d, k]) => <tr key={b} className={tr}><td className={`${th} font-semibold`}>{b}</td><td className={th}>{d}</td><td className={`${th} text-right`}><Money value={data.vat[k]} /></td></tr>)}
      </Table>}
      {data && tab === 'parties' && <div className="space-y-6">
        <Table head={R(3, ['Party', 'Type', 'Outstanding', 'Unapplied', 'Net'])}>{data.party_balances.filter(p => !partyFilter || p.party_id === partyFilter).map(p => <tr key={p.party_id} className={tr}><td className={th}><button type="button" className="text-primary hover:underline" onClick={() => { const q = new URLSearchParams(params); q.set('party_id', p.party_id); setParams(q, { replace: true }); }}>{p.party_name}</button></td><td className={`${th} capitalize`}>{p.party_type}</td><td className={`${th} text-right`}><Money value={p.balance_minor} /></td><td className={`${th} text-right`}><Money value={p.unapplied_minor || '0'} /></td><td className={`${th} text-right`}><Money value={p.net_balance_minor ?? p.balance_minor} /></td></tr>)}</Table>
        {partyFilter && <button type="button" className="text-sm underline" onClick={() => { const q = new URLSearchParams(params); q.delete('party'); q.delete('party_id'); setParams(q, { replace: true }); }}>Show all transactions</button>}
        <Table head={R(1, ['Date', 'Number', 'Party', 'Type', 'Due', 'Journal', 'Effect'])}>{data.party_transactions.filter(t => !partyFilter || t.party_id === partyFilter).map((t, i) => <tr key={i} className={tr}><td className={th}>{t.date}</td><td className={th}><SrcLink type={t.source_type} id={t.source_id}>{t.number}</SrcLink></td><td className={th}>{t.party_name}</td><td className={`${th} capitalize`}>{t.source_type.replace(/_/g, ' ')}</td><td className={th}>{t.due_date}</td><td className={th}><JournalLink id={t.journal_id} /></td><td className={`${th} text-right`}><Money value={t.balance_effect_minor} /></td></tr>)}</Table>
      </div>}
      {data && tab === 'ageing' && <Table head={R(5, ['Party', 'Type', 'Current', '1–30', '31–60', '61–90', '90+'])}>
        {data.ageing.map(a => <tr key={a.party_id} className={tr}><td className={th}>{a.party_name}</td><td className={`${th} capitalize`}>{a.party_type}</td>{['current_minor', 'days_1_30_minor', 'days_31_60_minor', 'days_61_90_minor', 'days_90_plus_minor'].map(k => <td key={k} className={`${th} text-right`}><Money value={a[k]} /></td>)}</tr>)}
      </Table>}
    </div>
  );
}
