import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { documentReportLink, postedAccountMovement } from '@/lib/reportTrace.mjs';
import { Money, ErrorBox, SkeletonRows } from './AccountingUI';

export default function DocumentPostingImpact({ doc, kind, journal }) {
  const sales = kind === 'sales_invoice' || kind === 'sales_credit_note';
  const lines = journal.data?.lines ?? [];
  const link = tab => documentReportLink(doc, tab, journal.data?.entry?.posting_date);
  const rows = [
    [sales ? 'Sales in profit & loss' : 'Costs in profit & loss', sales ? 'revenue' : 'expense', sales, 'pnl'],
    [sales ? 'Customer balance posted' : 'Supplier balance posted', sales ? 'receivables' : 'payables', !sales, 'bs'],
    [sales ? 'Output VAT' : 'Recoverable input VAT', sales ? 'output_vat' : 'input_vat', sales, 'vat'],
  ];
  return <section className="workspace-card p-5" aria-label="Where this appears" data-testid="posting-impact">
    <h2 className="font-semibold">Where this appears</h2>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">This document’s original posting. Payments and credits have their own entries.</p>
    {journal.status === 'loading' ? <SkeletonRows rows={3} /> : journal.error ? <ErrorBox error={journal.error} /> : journal.data && <dl className="mt-4 divide-y">
      {rows.map(([label, role, creditPositive, tab]) => {
        const movement = postedAccountMovement(doc, lines, role, creditPositive);
        return <div key={role} className="py-3 first:pt-0"><dt><Link className="flex items-center justify-between gap-2 text-sm font-medium text-primary hover:underline" to={link(tab)}>{label}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></Link></dt><dd className="mt-1 flex items-baseline justify-between gap-3"><span className="text-xs text-muted-foreground">{movement.account ? `${movement.account.account_code} · ${movement.account.account_name}` : 'No VAT entry'}</span><Money value={movement.amount} className="text-sm font-semibold" /></dd></div>;
      })}
    </dl>}
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs font-medium text-primary">
      <Link className="hover:underline" to={link('gl')}>View ledger entries</Link>
      <Link className="hover:underline" to={`${link('parties')}&party_id=${encodeURIComponent(doc.party_id)}`}>{sales ? 'Customer account' : 'Supplier account'}</Link>
    </div>
  </section>;
}
