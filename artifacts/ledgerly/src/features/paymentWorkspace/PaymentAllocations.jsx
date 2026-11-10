import { Link } from 'react-router-dom';
import { docPath } from '@/api/accountingDocuments.mjs';
import { Money } from '@/components/accounting/AccountingUI';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PaymentAllocations({ documents, form, onChange }) {
  const undo = form.kind === 'unallocation';
  return <section className="space-y-3">
    <h3 className="font-medium">{undo ? 'Amounts to unallocate' : 'Allocate to posted documents'}</h3>
    {documents.length ? documents.map(document => <div key={document.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto_140px] sm:items-center">
      <div className="min-w-0"><Link to={docPath(document.kind, document.id)} className="break-words text-sm font-medium text-primary underline-offset-4 hover:underline">{document.number}</Link><p className="mt-1 text-xs text-muted-foreground">Due {document.due_date}</p></div>
      <p className="text-sm text-muted-foreground">{undo ? 'Allocated' : 'Open'} <Money value={undo ? form.payment.allocation_balances.find(allocation => allocation.document_id === document.id)?.amount_minor : document.open_minor} /></p>
      <div><Label className="text-xs" htmlFor={`allocate-${document.id}`}>Amount for {document.number}</Label><Input id={`allocate-${document.id}`} className="mt-1.5 h-11" inputMode="decimal" placeholder="0.00" value={form.allocations[document.id] || ''} onChange={event => onChange({ allocations: { ...form.allocations, [document.id]: event.target.value } })} /></div>
    </div>) : <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No eligible posted documents for this party.</p>}
    <p className="text-xs leading-5 text-muted-foreground">Any unallocated receipt becomes customer credit; an unallocated supplier payment becomes a supplier prepayment. Allocating later does not record cash twice.</p>
  </section>;
}
