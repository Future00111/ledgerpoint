import { downloadCsv } from '@/lib/ledgerCsv.mjs';
import { Link, useSearchParams } from 'react-router-dom';
import { docPath } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money, ErrorBox, SkeletonRows, JournalLink } from '@/components/accounting/AccountingUI';
import { columnTotals } from '@/lib/accountingEditor.mjs';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';
import { Button } from '@/components/ui/button';
import ReportToolbar, { ReportNavigation } from '@/features/reporting/ReportToolbar';
import LedgerTable from '@/features/reporting/LedgerTable';
import { useReportRead } from '@/features/reporting/useReportRead';
import { REPORT_TABS, reportTab, reportPeriod, reportPeriodLabel, periodPreset, closingReport, ledgerRows, ledgerAccountPath, reportExport, statementPath, vatPath } from '@/features/reporting/model.mjs';
import ProfitLossReport from '@/components/accounting/ProfitLossReport';

const th = 'px-4 py-3'; const tr = 'border-b last:border-0';

function Table({ head, children, footer, caption = "Posted accounting figures, amounts in GBP" }) {
  return <div tabIndex={0} role="region" aria-label={caption} className="overflow-x-auto rounded-xl border bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><table className="w-full text-sm"><caption className="sr-only">{caption}</caption>
    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{head.map((h, i) => <th key={i} scope="col" className={`${th} ${i >= head.length - (head.r ?? 0) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
    <tbody>{children}</tbody>{footer && <tfoot className="border-t bg-muted/40 font-semibold">{footer}</tfoot>}</table></div>;
}
const R = (n, h) => Object.assign(h, { r: n });
const Stat = ({ label, value }) => <div className="rounded-xl border bg-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold"><Money value={value} /></p></div>;
function ReportSections({ sections, testid, extraEquity, accountLink }) {
  if (!Array.isArray(sections) || sections.length === 0) return null;
  return <div className="space-y-4" data-testid={`sections-${testid}`}>{sections.map(sec => (
    <div key={sec.category} className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left"><tr><th className={`${th} text-xs uppercase tracking-wide text-muted-foreground`} colSpan={2}>{sec.label}</th><th className={`${th} text-right text-xs uppercase tracking-wide text-muted-foreground`}>Amount</th></tr></thead>
        {(sec.groups ?? []).map((g, gi) => <tbody key={gi} className="border-b">
          <tr><td colSpan={3} className="px-4 pt-3 text-xs font-semibold text-muted-foreground">{g.name || 'Ungrouped'}</td></tr>
          {[...(g.accounts ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map(a => <tr key={a.account_id} data-testid={`row-${testid}-account-${a.account_id}`}>
            <td className="w-24 px-4 py-1.5 font-mono text-xs text-muted-foreground">{a.code}</td><td className="px-4 py-1.5">{a.name}</td><td className="px-4 py-1.5 text-right"><Link className="font-medium text-primary underline decoration-primary/30 underline-offset-4" aria-label={`View transactions for ${a.code} ${a.name}`} to={accountLink(a.account_id)}><Money value={a.amount_minor} /></Link></td></tr>)}
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
  return activeCompany ? <CompanyReports key={activeCompany.id} company={activeCompany} defaultTab={defaultTab} />
    : <EmptyState title="Select a company" description="Choose a company to review its posted accounts." />;
}

export function CompanyReports({ company, defaultTab }) {
  const [params, setParams] = useSearchParams();
  const tab = reportTab(params.get('tab'), defaultTab);
  const { from, to } = reportPeriod(params, tab);
  const { data, error, loading, validation, refresh } = useReportRead(company.id, from, to);
  const partyFilter = params.get('party_id') || params.get('party');
  const accountFilter = params.get('account_id');
  const documentFilter = params.get('document_id');
  const search = params.get('q') || '';
  const setTab = t => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };
  const setDate = (key, value) => { const p = new URLSearchParams(params); p.set(key, value); setParams(p, { replace: true }); };
  const setPeriod = preset => {
    const p = new URLSearchParams(params), period = periodPreset(preset);
    p.set('from', period.from); p.set('to', period.to); setParams(p, { replace: true });
  };
  const accountLink = id => ledgerAccountPath(id, from, to, closingReport(tab));
  const visibleLedger = ledgerRows(data?.general_ledger ?? [], { accountId: accountFilter, documentId: documentFilter, search });
  const documentLines = ledgerRows(data?.general_ledger ?? [], { documentId: documentFilter });
  const traced = documentFilter && documentLines[0];
  const clearTrace = () => { const p = new URLSearchParams(params); for (const key of ['account_id', 'document_id', 'q']) p.delete(key); setParams(p, { replace: true }); };
  const exportCurrent = () => {
    const rows = reportExport(data, tab, { companyName: company.name, from, to, accountId: accountFilter, documentId: documentFilter, partyId: partyFilter, search });
    if (rows.length) downloadCsv(`ledger-${tab}-${to}.csv`, rows);
  };
  const canExport = data && !(tab === 'vat' && !data.vat.applicable) && !(tab === 'pnl' && (params.has('pnl_account') || params.has('pnl_category')));

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Financial reports" title={REPORT_TABS.find(([key]) => key === tab)?.[1]} description="Understand your posted accounts and follow the detail behind each figure."
        context={<><span className="font-medium text-foreground">{company.name}</span><span aria-hidden="true">·</span><span>{validation ? 'Choose valid dates' : reportPeriodLabel(tab, from, to)}</span></>}
        actions={<><Button asChild variant="outline"><Link to="/reports">All reports</Link></Button>{canExport && <Button onClick={exportCurrent}>Export {tab === 'gl' ? 'matching entries' : tab === 'parties' ? 'balances' : 'report'} CSV</Button>}</>} />
      <div className="grid items-start gap-5 xl:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-0"><ReportNavigation tab={tab} onChange={setTab} vertical /><p className="hidden px-3 text-xs leading-5 text-muted-foreground xl:block">Your figures are linked to posted documents. Select an amount to follow the detail.</p></aside>
      <div className="min-w-0 space-y-5">
      <ReportToolbar tab={tab} from={from} to={to} validation={validation} onDate={setDate} onPreset={setPeriod} />
      {!validation && <div className="flex flex-wrap items-center gap-4"><Button variant="outline" disabled={loading} onClick={refresh}>{loading ? 'Loading report…' : 'Refresh report'}</Button><Link to={partyFilter ? statementPath(partyFilter, from, to) : '/statements'} className="text-sm font-medium text-primary underline">Account statements</Link></div>}
      <ErrorBox error={error} onRetry={refresh} />
      {loading && <div role="status" aria-label="Loading report for the selected company and dates"><SkeletonRows rows={6} /></div>}
      {data && tab === 'gl' && <section aria-label="Ledger filters" className="workspace-card space-y-3 p-4"><div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Label htmlFor="ledger-search">Find a document, account or entry</Label><Input id="ledger-search" type="search" placeholder="Search the posted ledger…" value={search} onChange={e => setDate('q', e.target.value)} /></div>{(search || accountFilter || documentFilter) && <Button variant="outline" onClick={clearTrace}>Clear filters</Button>}</div><p className="text-xs text-muted-foreground" aria-live="polite">{visibleLedger.length} matching ledger lines. The totals and CSV contain these matching lines.</p></section>}
      {data && (documentFilter || (tab === 'gl' && accountFilter)) && <section className="rounded-xl border border-primary/20 bg-primary/5 p-5" aria-label="Report trace">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{documentFilter ? (traced ? <>Included: <SrcLink type={traced.source_type} id={traced.source_id}>{traced.source_number}</SrcLink></> : 'Document not found in this period') : `Transactions for ${visibleLedger[0]?.account_code ?? ''} ${visibleLedger[0]?.account_name ?? 'selected account'}`}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tab === 'gl' ? 'Only matching ledger entries are shown. The totals and CSV follow this filter.' : traced ? 'The company totals below include this posting alongside other transactions. Its entries are shown here.' : 'Check the company, posting date and report dates. Drafts are excluded from financial reports.'}</p></div><button type="button" className="shrink-0 text-sm text-primary underline" onClick={clearTrace}>Clear focus</button></div>
        {traced && tab !== 'gl' && <div className="mt-4"><Table head={R(2, ['Posting date', 'Account', 'Debit', 'Credit'])}>{documentLines.filter(l => tab !== 'pnl' || ['income','revenue','expense','expenses','cost_of_sales'].includes(l.account_type?.toLowerCase())).map((l,i) => <tr className={tr} key={i}><td className={th}>{l.posting_date}</td><td className={th}>{l.account_code} · {l.account_name}</td><td className={`${th} text-right`}><Money value={l.debit_minor} /></td><td className={`${th} text-right`}><Money value={l.credit_minor} /></td></tr>)}</Table></div>}
      </section>}
      {data && <p className="text-xs text-muted-foreground" data-testid="text-report-basis">{closingReport(tab) ? `Closing balances as at ${to}, including every posting through that date.` : tab === 'parties' ? `Transactions from ${from} to ${to}; balances include all postings through ${to}.` : `Movements posted from ${from} to ${to} inclusive.`} Business accounting basis: accrual.</p>}
      {data && tab === 'tb' && <Table head={R(3, ['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance'])}
        footer={<tr data-testid="totals-trial-balance"><th colSpan={3} scope="row" className={`${th} text-left`}>Closing totals</th>
          <td className={`${th} text-right`}><Money value={columnTotals(data.trial_balance).debit_minor} /></td>
          <td className={`${th} text-right`}><Money value={columnTotals(data.trial_balance).credit_minor} /></td><td className={`${th} text-right`}>—</td></tr>}>
        {data.trial_balance.map(a => <tr key={a.account_id} className={tr}><td className={`${th} font-mono text-xs`}>{a.code}</td><td className={th}><Link to={accountLink(a.account_id)} className="font-medium text-primary underline">{a.name}</Link></td><td className={`${th} capitalize text-muted-foreground`}>{a.account_type}</td><td className={`${th} text-right`}><Money value={a.debit_minor} /></td><td className={`${th} text-right`}><Money value={a.credit_minor} /></td><td className={`${th} text-right font-medium`}><Money value={a.balance_minor} /></td></tr>)}
      </Table>}
      {data && tab === 'gl' && <LedgerTable rows={visibleLedger} from={from} to={to} />}
      {data && tab === 'pnl' && <ProfitLossReport key={`${company.id}:${from}:${to}`} data={data} company={company} from={from} to={to} />}
      {data && tab === 'bs' && <div className="space-y-3"><div className="grid gap-4 sm:grid-cols-4"><Stat label="Assets" value={data.balance_sheet.assets_minor} /><Stat label="Liabilities" value={data.balance_sheet.liabilities_minor} /><Stat label="Equity" value={data.balance_sheet.equity_minor} /><Stat label="Current earnings (cumulative, unclosed)" value={data.balance_sheet.current_earnings_minor} /></div>
        <ReportSections sections={data.balance_sheet.sections} testid="bs" extraEquity={data.balance_sheet.current_earnings_minor} accountLink={accountLink} />
        <div className="grid gap-4 sm:grid-cols-3">
          {data.balance_sheet.net_vat_payable_minor != null && <Stat label="Net VAT payable (output − input)" value={data.balance_sheet.net_vat_payable_minor} />}
          {data.balance_sheet.net_assets_minor != null && <Stat label="Assets after VAT offset" value={data.balance_sheet.net_assets_minor} />}
          {data.balance_sheet.net_liabilities_minor != null && <Stat label="Liabilities after VAT offset" value={data.balance_sheet.net_liabilities_minor} />}
        </div>
        <p className="text-xs text-muted-foreground">Assets and liabilities show gross balances, so input VAT sits in assets and output VAT in liabilities. Net VAT payable reconciles the two. Current earnings are cumulative, unclosed {data.balance_sheet.earnings_basis ? `(${data.balance_sheet.earnings_basis})` : ''} profit as at {to}.</p>
        <p className={`text-sm font-medium ${data.balance_sheet.balanced ? 'text-emerald-700' : 'text-red-700'}`} data-testid="status-balanced">{data.balance_sheet.balanced ? 'Balanced' : 'Not balanced — review journals'}</p></div>}
      {data && tab === 'vat' && data.vat?.applicable === false && <p className="rounded-xl border bg-card p-5 text-sm" data-testid="text-not-vat-registered">Not VAT registered. There are no VAT return workings for this company.</p>}
      {data && tab === 'vat' && data.vat?.applicable !== false && <><section className="workspace-card flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{data.vat.net_payable_pence === '0' ? 'No net VAT for this period' : data.vat.repayment ? 'Net VAT to reclaim' : 'Net VAT to pay'} · <Money value={data.vat.box5_pence} /></p><p className="mt-1 text-xs text-muted-foreground">Review only: five supported boxes, not a complete VAT return or HMRC submission.</p></div><Button asChild><Link to={vatPath(from, to)}>Review VAT sources</Link></Button></section><Table head={R(1, ['Box', 'Description', 'Amount'])}>
        {[['1', 'VAT due on sales', 'box1_pence'], ['4', 'VAT reclaimed on purchases', 'box4_pence'], ['5', 'Net VAT', 'box5_pence'], ['6', 'Total sales ex VAT', 'box6_pence'], ['7', 'Total purchases ex VAT', 'box7_pence']].map(([b, d, k]) => <tr key={b} className={tr}><td className={`${th} font-semibold`}>{b}</td><td className={th}>{d}</td><td className={`${th} text-right`}><Money value={data.vat[k]} /></td></tr>)}
      </Table></>}
      {data && tab === 'parties' && <div className="space-y-6">
        <Table head={R(3, ['Party', 'Type', 'Outstanding', 'Unapplied', 'Net'])}>{data.party_balances.filter(p => !partyFilter || p.party_id === partyFilter).map(p => <tr key={p.party_id} className={tr}><td className={th}><button type="button" className="text-primary hover:underline" onClick={() => { const q = new URLSearchParams(params); q.set('party_id', p.party_id); setParams(q, { replace: true }); }}>{p.party_name}</button><p className="mt-1"><Link to={statementPath(p.party_id, from, to)} className="text-xs text-primary underline">View statement</Link></p></td><td className={`${th} capitalize`}>{p.party_type}</td><td className={`${th} text-right`}><Money value={p.balance_minor} /></td><td className={`${th} text-right`}><Money value={p.unapplied_minor || '0'} /></td><td className={`${th} text-right`}><Money value={p.net_balance_minor ?? p.balance_minor} /></td></tr>)}</Table>
        {partyFilter && <button type="button" className="text-sm underline" onClick={() => { const q = new URLSearchParams(params); q.delete('party'); q.delete('party_id'); setParams(q, { replace: true }); }}>Show all transactions</button>}
        <Table head={R(1, ['Date', 'Number', 'Party', 'Type', 'Due', 'Journal', 'Effect'])}>{data.party_transactions.filter(t => !partyFilter || t.party_id === partyFilter).map((t, i) => <tr key={i} className={tr}><td className={th}>{t.date}</td><td className={th}><SrcLink type={t.source_type} id={t.source_id}>{t.number}</SrcLink></td><td className={th}>{t.party_name}</td><td className={`${th} capitalize`}>{t.source_type.replace(/_/g, ' ')}</td><td className={th}>{t.due_date}</td><td className={th}><JournalLink id={t.journal_id} /></td><td className={`${th} text-right`}><Money value={t.balance_effect_minor} /></td></tr>)}</Table>
      </div>}
      {data && tab === 'ageing' && <Table head={R(5, ['Party', 'Type', 'Current', '1–30', '31–60', '61–90', '90+'])}>
        {data.ageing.map(a => <tr key={a.party_id} className={tr}><td className={th}><Link to={statementPath(a.party_id, from, to)} className="font-medium text-primary underline">{a.party_name}</Link><p className="mt-1 text-xs text-muted-foreground">Open statement</p></td><td className={`${th} capitalize`}>{a.party_type}</td>{['current_minor', 'days_1_30_minor', 'days_31_60_minor', 'days_61_90_minor', 'days_90_plus_minor'].map(k => <td key={k} className={`${th} text-right`}><Money value={a[k]} /></td>)}</tr>)}
      </Table>}
      </div></div>
    </div>
  );
}
