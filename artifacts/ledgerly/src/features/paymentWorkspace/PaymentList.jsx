import { Search, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/accounting/AccountingUI';
import EmptyState from '@/components/workspace/EmptyState';

const selectClass = 'h-11 w-full rounded-lg border bg-background px-3 text-sm';
const status = payment => payment.reversed ? 'Reversed' : BigInt(payment.refunded_minor) > 0n ? 'Refund recorded' : 'Posted';

export function PaymentFilters({ filters, onChange, disabled }) {
  return <div className="grid gap-4 border-b p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_200px] sm:p-5">
    <div className="sm:col-span-2 lg:col-span-1"><Label htmlFor="payment-search">Find a payment</Label><div className="relative mt-1.5"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input id="payment-search" className="h-11 pl-9" type="search" placeholder="Customer, supplier or reference" value={filters.search} disabled={disabled} onChange={event => onChange({ ...filters, search: event.target.value })} /></div></div>
    <div><Label htmlFor="payment-direction">Direction</Label><select id="payment-direction" className={`${selectClass} mt-1.5`} value={filters.direction} disabled={disabled} onChange={event => onChange({ ...filters, direction: event.target.value })}><option value="all">All payments</option><option value="received">Money received</option><option value="paid">Money paid</option></select></div>
    <div><Label htmlFor="payment-balance">Unapplied money</Label><select id="payment-balance" className={`${selectClass} mt-1.5`} value={filters.balance} disabled={disabled} onChange={event => onChange({ ...filters, balance: event.target.value })}><option value="all">All balances</option><option value="unapplied">Amount left to allocate</option></select></div>
  </div>;
}

function PaymentStatus({ payment }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${payment.reversed ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>{status(payment)}</span>;
}

export function PaymentBalanceSummary({ payment }) {
  return <dl className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-3">
    {[['Original amount', payment.amount_minor], ['Allocated', payment.allocated_minor], ['Unapplied', payment.unapplied_minor]].map(([label, value]) => <div key={label} className="flex min-w-0 justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-all text-sm font-semibold tabular-nums sm:mt-2 sm:text-lg"><Money value={value} /></dd></div>)}
  </dl>;
}

export function PaymentList({ payments, total, disabled, onReview, onClear }) {
  if (!payments.length) return <EmptyState icon={WalletCards} title={total ? 'No payments match this view' : 'Your payment history will appear here'} description={total ? 'Try a different name, reference or filter.' : 'Record money already received or paid to track allocations and unapplied balances.'} action={total ? <Button variant="outline" onClick={onClear}>Clear filters</Button> : null} />;
  const review = payment => <Button size="sm" variant="outline" className="min-h-11" disabled={disabled} aria-label={`Review payment ${payment.reference} for ${payment.source.party_name}`} onClick={() => onReview(payment)}>Review payment</Button>;
  return <>
    <p role="status" className="border-b px-5 py-3 text-xs text-muted-foreground">Showing {payments.length} of {total} payments · Latest payment date first</p>
    <ul className="divide-y md:hidden" aria-label="Payment history">{payments.map(payment => <li key={payment.id} className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{payment.source.party_name}</p><p className="mt-1 break-words text-sm text-muted-foreground">{payment.reference}</p><p className="mt-1 text-xs text-muted-foreground">{payment.effective_date} · {payment.party_type === 'customer' ? 'Money received' : 'Money paid'}</p></div><PaymentStatus payment={payment} /></div>
      <PaymentBalanceSummary payment={payment} />{review(payment)}
    </li>)}</ul>
    <div className="hidden overflow-auto md:block" role="region" tabIndex={0} aria-label="Payment history table"><table className="workspace-table"><caption className="sr-only">Recorded payments, allocations and unapplied balances</caption><thead><tr>{['Date', 'Party / reference', 'Direction', 'Amount', 'Allocated', 'Unapplied', 'Status', 'Actions'].map((heading, index) => <th scope="col" key={heading} className={index >= 3 && index <= 5 ? '!text-right' : ''}>{heading}</th>)}</tr></thead><tbody>{payments.map(payment => <tr key={payment.id}>
      <td className="whitespace-nowrap">{payment.effective_date}</td><td className="min-w-40"><p className="font-medium">{payment.source.party_name}</p><p className="mt-1 break-words text-xs text-muted-foreground">{payment.reference}</p></td><td>{payment.party_type === 'customer' ? 'Received' : 'Paid'}</td>
      {[payment.amount_minor, payment.allocated_minor, payment.unapplied_minor].map((amount, index) => <td key={index} className="whitespace-nowrap text-right"><Money value={amount} /></td>)}<td><PaymentStatus payment={payment} /></td><td>{review(payment)}</td>
    </tr>)}</tbody></table></div>
  </>;
}
