import { ArrowDownLeft, ArrowUpRight, Layers3 } from 'lucide-react';
import { filterPayments } from './model.mjs';

/** Counts select existing records. No cash total or account balance is inferred. */
export default function PaymentOverview({ payments, filters, onChange }) {
  const choices = [
    {title:'Money received', detail:'Customer payment records', direction:'received', balance:'all', icon:ArrowDownLeft},
    {title:'Money paid', detail:'Supplier payment records', direction:'paid', balance:'all', icon:ArrowUpRight},
    {title:'Left to allocate', detail:'Payments with an unapplied amount', direction:'all', balance:'unapplied', icon:Layers3},
  ];
  return <section aria-label="Payment views" className="grid gap-3 sm:grid-cols-3">{choices.map(({ title, detail, direction, balance, icon:Icon }) => {
    const selected = filters.direction === direction && filters.balance === balance && !filters.search;
    return <button key={title} type="button" aria-pressed={selected} disabled={!payments} onClick={() => onChange({ search:'', direction, balance })}
      className={`workspace-panel group flex items-center gap-4 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait sm:p-5 ${selected ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/30'}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span>
      <span className="text-2xl font-semibold tabular-nums">{payments ? filterPayments(payments, { direction, balance }).length : '—'}</span>
    </button>;
  })}</section>;
}
