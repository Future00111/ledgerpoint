import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot, ledgerDates } from '@/lib/useLedgerSnapshot';
import { accounting, docPath } from '@/api/accountingDocuments.mjs';
import { statementRows, downloadCsv, decimalMinor } from '@/lib/ledgerCsv.mjs';
import { ErrorBox, SkeletonRows, Money, JournalLink } from '@/components/accounting/AccountingUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Statements() {
  const { activeCompany } = useCompany(), company = activeCompany?.id;
  const [params, setParams] = useSearchParams();
  const [from, setFrom] = useState(ledgerDates().from), [to, setTo] = useState(ledgerDates().to);
  const [parties, setParties] = useState([]), [error, setError] = useState(null);
  const s = useLedgerSnapshot(company, from, to), id = params.get('party_id') || '';
  useEffect(() => { setParties([]); setError(null); if (!company) return; const c = new AbortController();
    accounting.paymentContext(company, c.signal).then(d => setParties([...d.customers.map(p => ({ ...p, type: 'customer' })), ...d.suppliers.map(p => ({ ...p, type: 'supplier' }))])).catch(e => { if (!c.signal.aborted) setError(e); }); return () => c.abort(); }, [company]);
  const party = parties.find(p => p.id === id), st = s.data && party ? statementRows(s.data, id) : null;
  const exportStatement = () => downloadCsv(`statement-${id}-${to}.csv`, [
    ['Company', activeCompany.name], ['Party', party.name], ['Period', from, to],
    ['Date', 'Reference', 'Type', 'AR/AP change GBP', 'Unapplied change GBP', 'Running AR/AP GBP', 'Running unapplied GBP'],
    [from, 'Opening balance', '', '', '', decimalMinor(st.opening), decimalMinor(st.openingUnapplied)],
    ...st.rows.map(t => [t.date, t.number, t.payment_kind || t.source_type, decimalMinor(t.balance_effect_minor), decimalMinor(t.unapplied_effect_minor), decimalMinor(t.running_balance_minor), decimalMinor(t.running_unapplied_minor)]),
    [to, 'Closing balance', '', '', '', decimalMinor(st.closing), decimalMinor(st.unapplied)],
    ['Net balance after unapplied credit/prepayment', decimalMinor(st.net)],
  ]);
  return <div className="mx-auto max-w-6xl space-y-6 pb-28"><header><p className="text-sm text-primary">Posted account history</p><h1 className="text-3xl font-semibold">Customer & supplier statements</h1><p className="mt-2 text-sm text-muted-foreground">Invoices, credits, payments, allocations and refunds from the same posted ledger.</p></header>
    <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]"><div><Label htmlFor="statement-party">Account</Label><select id="statement-party" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={party ? id : ''} onChange={e => setParams({ party_id: e.target.value })}><option value="">Choose customer or supplier</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name} · {p.type}</option>)}</select></div><div><Label htmlFor="statement-from">From</Label><Input id="statement-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div><div><Label htmlFor="statement-to">To</Label><Input id="statement-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div></div>
    <ErrorBox error={error || s.error} onRetry={s.refresh} />{s.loading && company && <SkeletonRows />}
    {st && <><div className="flex flex-wrap justify-between gap-4"><h2 className="text-xl font-semibold">{party.name}</h2><Button variant="outline" onClick={exportStatement}>Download statement CSV</Button></div><div className="grid gap-3 sm:grid-cols-3">{[['Outstanding documents', st.closing], [party.type === 'customer' ? 'Unapplied customer credit' : 'Supplier prepayments', st.unapplied], ['Net account balance', st.net]].map(([name, value]) => <div className="rounded-xl border p-4" key={name}><p className="text-xs text-muted-foreground">{name}</p><p className="mt-2 text-xl font-semibold"><Money value={value} /></p></div>)}</div><p className="text-sm">Opening document balance: <Money value={st.opening} /> · Opening unapplied balance: <Money value={st.openingUnapplied} /></p><div className="overflow-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{['Date', 'Reference / event', 'Document balance change', 'Unapplied change', 'Running document balance', 'Journal'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{st.rows.map(t => <tr key={t.source_id} className="border-t"><td className="p-3">{t.date}</td><td className="p-3"><Link to={docPath(t.source_type, t.source_id)} className="text-primary underline">{t.number}</Link><p className="text-xs text-muted-foreground">{(t.payment_kind || t.source_type).replaceAll('_', ' ')}</p></td><td className="p-3"><Money value={t.balance_effect_minor} /></td><td className="p-3"><Money value={t.unapplied_effect_minor || '0'} /></td><td className="p-3"><Money value={t.running_balance_minor} /></td><td className="p-3"><JournalLink id={t.journal_id} /></td></tr>)}</tbody></table>{!st.rows.length && <p className="p-4 text-sm text-muted-foreground">No posted movements in this period. Opening balances are retained.</p>}</div><p className="text-xs text-muted-foreground">Drafts are excluded. Unapplied money remains separate until explicitly allocated or refunded. Downloading does not email this statement.</p></>}
  </div>;
}
