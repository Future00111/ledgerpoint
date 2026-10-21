import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react';
import { KINDS, docPath } from '@/api/accountingDocuments.mjs';
import { pnlTransactions } from '@/lib/reportTrace.mjs';
import { decimalMinor, downloadCsv } from '@/lib/ledgerCsv.mjs';
import { Money, JournalLink } from './AccountingUI';

const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const sum = rows => rows.reduce((n, row) => n + BigInt(row.amount_minor), 0n).toString();
export default function ProfitLossReport({ data, company, from, to }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const accountId = params.get('pnl_account');
  const categoryId = params.get('pnl_category');
  const groupName = params.get('pnl_group');
  const sections = data.pnl.sections ?? [];
  const allAccounts = sections.flatMap(s => s.groups.flatMap(g => g.accounts));
  const account = allAccounts.find(a => a.account_id === accountId);
  const section = sections.find(s => s.category === categoryId);
  const focused = !!(accountId || categoryId);
  const rows = pnlTransactions(data, { accountId, categoryId, groupName });
  const query = search.trim().toLowerCase();
  const visible = rows.filter(row => !query || [row.number, row.party, row.description, ...row.accounts, KINDS[row.kind]?.label].join(' ').toLowerCase().includes(query));
  const heading = account ? `${account.code} · ${account.name}` : groupName || section?.label || 'Account transactions';
  const focus = values => {
    const p = new URLSearchParams(params);
    for (const key of ['pnl_account', 'pnl_category', 'pnl_group', 'account_id', 'document_id']) p.delete(key);
    for (const [key, value] of Object.entries(values)) p.set(key, value);
    setSearch(''); setParams(p);
  };
  const openAccount = id => focus({ pnl_account: id });
  const openCategory = id => focus({ pnl_category: id });
  const openGroup = (id, name) => focus({ pnl_category: id, pnl_group: name });
  const exportDetail = () => downloadCsv(`profit-loss-transactions-${to}.csv`, [
    ['Company', company.name], ['Report', heading], ['From', from, 'To', to],
    ['Date', 'Document', 'Type', 'Customer / supplier', 'Accounts', 'Amount GBP'],
    ...visible.map(r => [r.date, r.number, KINDS[r.kind]?.label || r.kind, r.party, r.accounts.join('; '), decimalMinor(r.amount_minor)]),
    ['Total', '', '', '', '', decimalMinor(sum(visible))],
  ]);
  if (focused) return <section className="workspace-card overflow-hidden" aria-label="Profit and loss transactions">
    <div className="border-b p-6"><button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" onClick={() => focus({})}><ArrowLeft className="h-4 w-4" />Back to profit &amp; loss</button>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><span className="eyebrow">Transactions behind the figure</span><h2 className="mt-2 text-xl font-semibold">{heading}</h2><p className="mt-1 text-sm text-muted-foreground">{date(from)} – {date(to)} · {rows.length} transactions</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Report total</p><Money className="mt-1 block text-2xl font-semibold" value={sum(rows)} /></div></div>
      <p className="mt-3 text-xs text-muted-foreground">Amounts are the contribution to this category or account, including credit notes. Recoverable VAT is shown separately in the VAT report.</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-6 py-4"><label className="flex w-full items-center gap-2 rounded-lg border bg-background px-3 sm:w-80"><Search className="h-4 w-4 text-muted-foreground" /><input className="w-full bg-transparent py-2 text-sm outline-none" aria-label="Search report transactions" placeholder="Find a document or contact…" value={search} onChange={e => setSearch(e.target.value)} /></label><button type="button" className="rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted" onClick={exportDetail}>Export these transactions</button></div>
    <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Date</th><th>Document</th><th>Customer / supplier</th><th className="text-right">Amount</th><th><span className="sr-only">Journal</span></th></tr></thead><tbody>
      {visible.map(r => <tr key={r.journal_id}><td className="whitespace-nowrap text-muted-foreground">{date(r.date)}</td><td>{docPath(r.kind, r.id) ? <Link className="inline-flex items-center gap-1 font-medium text-primary hover:underline" to={docPath(r.kind, r.id)}>{r.number}<ArrowUpRight className="h-3 w-3" /></Link> : <span>{r.number}</span>}<p className="mt-1 text-xs text-muted-foreground">{KINDS[r.kind]?.label || r.kind.replaceAll('_', ' ')}</p></td><td>{r.party}{!accountId && <p className="mt-1 text-xs text-muted-foreground">{r.accounts.join(', ')}</p>}</td><td className="text-right font-medium"><Money value={r.amount_minor} /></td><td className="text-right"><JournalLink id={r.journal_id} /></td></tr>)}
      {!visible.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">{query ? 'No transactions match your search.' : 'No posted transactions in this category for these dates.'}</td></tr>}
    </tbody><tfoot className="border-t bg-muted/30 font-semibold"><tr><td colSpan={3}>{query ? `Matching total · ${visible.length} transactions` : 'Total'}</td><td className="text-right"><Money value={sum(visible)} /></td><td /></tr></tfoot></table></div>
  </section>;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">{[['Revenue', data.pnl.revenue_minor, 'income'], ['Total costs', data.pnl.expense_minor, null], ['Net profit', data.pnl.profit_minor, null]].map(([label, amount, cat]) => <div key={label} className={`workspace-card p-5 ${label === 'Net profit' ? 'border-primary/25 bg-primary/5' : ''}`}><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>{cat ? <button className="mt-2 text-2xl font-semibold text-primary hover:underline" onClick={() => openCategory(cat)}><Money value={amount} /></button> : <Money className="mt-2 block text-2xl font-semibold" value={amount} />}</div>)}</div>
    <section className="workspace-card overflow-hidden" aria-label="Profit and loss statement">
      <header className="flex flex-wrap justify-between gap-4 border-b px-6 py-5"><div><h2 className="font-semibold">{company.name}</h2><p className="mt-1 text-sm text-muted-foreground">{date(from)} – {date(to)}</p></div><p className="max-w-xs text-xs leading-relaxed text-muted-foreground">Select a category, account or amount to see its invoices, bills and credits.</p></header>
      <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th colSpan={2}>Account</th><th className="text-right">Amount · GBP</th></tr></thead>
        {sections.map(s => <tbody key={s.category}>
          <tr className="border-t bg-muted/40"><th colSpan={2} className="text-left"><button className="inline-flex items-center gap-2 font-semibold text-primary hover:underline" onClick={() => openCategory(s.category)} aria-label={`View ${s.label} transactions`}>{s.label}<ArrowUpRight className="h-3.5 w-3.5" /></button></th><th className="text-right"><button className="font-semibold text-primary hover:underline" onClick={() => openCategory(s.category)} aria-label={`View ${s.label} total`}><Money value={s.total_minor} /></button></th></tr>
          {s.groups.map((g, i) => <Group key={i} section={s} group={g} openAccount={openAccount} openGroup={openGroup} />)}
          {!s.groups.length && <tr><td colSpan={3} className="text-sm text-muted-foreground">No activity in this period</td></tr>}
          {s.category === 'cost_of_sales' && <tr className="border-y bg-primary/5 font-semibold"><td colSpan={2}>Gross profit</td><td className="text-right"><Money value={data.pnl.gross_profit_minor} /></td></tr>}
        </tbody>)}
        <tfoot className="border-t-2 border-primary/20 bg-primary/5 text-base font-semibold"><tr><td colSpan={2}>Net profit for the period</td><td className="text-right"><Money value={data.pnl.profit_minor} /></td></tr></tfoot>
      </table></div>
      <p className="border-t px-6 py-4 text-xs text-muted-foreground">Accrual basis · posted transactions only. Credit notes reduce the relevant category. Drafts are excluded.</p>
    </section>
  </div>;
}

function Group({ section, group, openAccount, openGroup }) {
  const showGroup = group.name !== section.label || section.groups.length > 1;
  return <>
    {showGroup && <tr><td colSpan={2}><button className="text-sm font-medium text-primary hover:underline" onClick={() => openGroup(section.category, group.name)}>{group.name}</button></td><td className="text-right"><button className="text-sm font-medium text-primary hover:underline" onClick={() => openGroup(section.category, group.name)}><Money value={group.subtotal_minor} /></button></td></tr>}
    {group.accounts.map(a => <tr key={a.account_id}><td className="w-24 font-mono text-xs text-muted-foreground">{a.code}</td><td><button className="text-left text-primary hover:underline" onClick={() => openAccount(a.account_id)}>{a.name}</button></td><td className="text-right"><button className="font-medium text-primary underline decoration-primary/25 underline-offset-4" aria-label={`View transactions for ${a.code} ${a.name}`} onClick={() => openAccount(a.account_id)}><Money value={a.amount_minor} /></button></td></tr>)}
  </>;
}
