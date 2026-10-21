import React from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot, sumMinor } from '@/lib/useLedgerSnapshot';
import { docPath } from '@/api/accountingDocuments.mjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ErrorBox, SkeletonRows, Money, JournalLink } from './AccountingUI';

export default function PartyLedgerDetails({ party, type, open, onOpenChange, onEdit }) {
  const { activeCompany } = useCompany();
  const s = useLedgerSnapshot(activeCompany?.id, undefined, undefined, open);
  const customer = type === 'customer', base = customer ? '/invoices' : '/bills';
  const matching = !!party && party.company_id === activeCompany?.id;
  const d = matching ? s.data : null;
  const balance = d?.party_balances.find(p => p.party_id === party?.id);
  const docs = d?.posted_documents.filter(p => p.party_id === party?.id) || [];
  const openItems = d?.open_items.filter(p => p.party_id === party?.id) || [];
  const overdue = openItems.filter(p => p.due_date < s.to && BigInt(p.open_minor) > 0n);
  const drafts = d?.drafts.filter(p => p.party_id === party?.id) || [];
  const net = sumMinor(docs.filter(r => r.date >= s.from), 'net_minor');
  const suffix = `party_type=${type}&party_id=${encodeURIComponent(party?.id || '')}`;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] overflow-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{party?.name}</DialogTitle><DialogDescription>{customer ? 'Customer' : 'Supplier'} account · Figures from posted journals as at {s.to}. Drafts are separate.</DialogDescription></DialogHeader>
    <ErrorBox error={s.error} onRetry={s.refresh} />
    {!d && !s.error && <SkeletonRows />}
    {d && <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        [customer ? 'Outstanding invoices' : 'Outstanding bills', balance?.balance_minor || '0'],
        [customer ? 'Unapplied customer credit' : 'Supplier prepayment', balance?.unapplied_minor || '0'],
        ['Overdue', sumMinor(overdue, 'open_minor')],
        [customer ? 'Net revenue this year (ex VAT)' : 'Net purchases this year (ex VAT)', net],
      ].map(([label, value]) => <div key={label} className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold"><Money value={value} /></p></div>)}</div>
      <div className="flex flex-wrap gap-2"><Button asChild><Link onClick={() => onOpenChange(false)} to={`${base}/new`}>Create {customer ? 'invoice' : 'bill'}</Link></Button><Button asChild variant="outline"><Link onClick={() => onOpenChange(false)} to={`/payments?${suffix}`}>Record payment</Link></Button><Button asChild variant="outline"><Link onClick={() => onOpenChange(false)} to={`/statements?${suffix}`}>View statement</Link></Button>{onEdit && <Button variant="outline" onClick={() => { onOpenChange(false); onEdit(party); }}>Edit contact</Button>}</div>
      <section><h3 className="mb-3 font-semibold">Posted documents</h3><div className="overflow-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{['Date', 'Document', 'Type', 'Amount incl. VAT', 'Open', 'Journal'].map(x => <th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody>{docs.map(r => <tr key={r.id} className="border-t"><td className="p-3">{r.date}</td><td className="p-3"><Link onClick={() => onOpenChange(false)} className="text-primary underline" to={docPath(r.kind, r.id)}>{r.number}</Link></td><td className="p-3">{r.kind.replaceAll('_', ' ')}</td><td className="p-3"><Money value={r.gross_minor} /></td><td className="p-3">{openItems.some(o => o.id === r.id) ? <Money value={openItems.find(o => o.id === r.id).open_minor} /> : 'Offset against original'}</td><td className="p-3"><JournalLink id={r.journal_id} /></td></tr>)}</tbody></table>{!docs.length && <p className="p-4 text-sm text-muted-foreground">No posted documents.</p>}</div></section>
      <section><h3 className="mb-2 font-semibold">Drafts — excluded from balances and revenue</h3>{drafts.length ? <div className="flex flex-wrap gap-2">{drafts.map(r => <Link onClick={() => onOpenChange(false)} className="rounded-lg border px-3 py-2 text-sm text-primary" key={r.id} to={docPath(r.kind, r.id)}>{r.number} · <Money value={r.gross_minor} /></Link>)}</div> : <p className="text-sm text-muted-foreground">No drafts for this account.</p>}</section>
      <section><h3 className="mb-2 font-semibold">Payments and allocation history</h3>{d.party_transactions.filter(t => t.party_id === party.id && t.source_type === 'accounting_payment_event').map(t => <div key={t.source_id} className="flex justify-between gap-3 border-b py-2 text-sm"><Link onClick={() => onOpenChange(false)} className="text-primary" to={docPath(t.source_type, t.source_id)}>{t.date} · {t.number} · {t.payment_kind}</Link><JournalLink id={t.journal_id} /></div>)}<Link className="mt-2 inline-block text-sm text-primary underline" onClick={() => onOpenChange(false)} to={`/statements?${suffix}`}>Full statement and CSV export</Link></section>
      <section className="rounded-xl bg-muted/40 p-4"><h3 className="mb-2 font-semibold">Contact details</h3><div className="grid gap-3 text-sm sm:grid-cols-2"><p>Email: {party.email || 'Not provided'}</p><p>Phone: {party.phone || 'Not provided'}</p><p>Payment terms: {party.payment_terms ?? 30} days</p><p>VAT number: {party.vat_number || 'Not provided'}</p></div>{party.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{party.notes}</p>}</section>
    </div>}
  </DialogContent></Dialog>;
}
