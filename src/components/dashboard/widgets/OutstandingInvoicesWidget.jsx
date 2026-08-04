import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAsk } from '@/components/ask/AskProvider';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState, StatusBadge } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { FileText, Eye, Mail, CreditCard, Sparkles } from 'lucide-react';

export default function OutstandingInvoicesWidget({ company, h }) {
  const nav = useNavigate();
  const { openAsk } = useAsk();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const inv = await base44.entities.SalesInvoice.filter({ company_id: cid }, 'due_date', 500);
    return inv;
  });

  if (loading) return <ListSkeleton />;
  const today = new Date().toISOString().slice(0, 10);
  const items = (data || [])
    .filter((i) => ['approved', 'sent', 'part_paid', 'overdue'].includes(i.status) && (Number(i.balance_due) || 0) > 0)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, h === 2 ? 8 : 5);

  if (!items.length)
    return (
      <EmptyState
        icon={FileText}
        title="No outstanding invoices"
        description="All sales invoices are paid. Create a new invoice to track payments here."
        actionLabel="New Invoice"
        onAction={() => nav('/invoices/new')}
      />
    );

  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.id} className="rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{i.customer_name || '—'}</p>
              <p className="text-[11px] text-muted-foreground">
                {i.invoice_number} · due {fmtDate(i.due_date)}
                {i.due_date < today && <span className="text-rose-600 font-medium"> · overdue</span>}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold">{gbp(i.balance_due)}</p>
              <StatusBadge status={i.status} />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <Action icon={Eye} label="View" onClick={() => nav(`/invoices/${i.id}`)} />
            <Action icon={Mail} label="Email" onClick={() => (window.location.href = `mailto:?subject=Invoice ${i.invoice_number}`)} />
            <Action icon={CreditCard} label="Payment" onClick={() => nav(`/invoices/${i.id}`)} />
            <Action icon={Sparkles} label="Ask" onClick={() => openAsk(`What's the status of invoice ${i.invoice_number}?`)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Action({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}