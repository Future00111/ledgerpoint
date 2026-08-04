import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAsk } from '@/components/ask/AskProvider';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import CountUp from '../CountUp';
import { gbp, fmtDate } from '@/lib/format';
import { FileText, Eye, Mail, CreditCard, Sparkles } from 'lucide-react';

function dueStatus(inv, today) {
  if (inv.due_date < today) return { label: 'Overdue', tone: 'text-rose-600', dot: 'bg-rose-500', bar: 'bg-rose-500' };
  const days = Math.ceil((new Date(inv.due_date) - new Date(today)) / 86400000);
  if (days <= 7) return { label: 'Due soon', tone: 'text-amber-600', dot: 'bg-amber-500', bar: 'bg-amber-500' };
  return { label: 'Current', tone: 'text-emerald-600', dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
}

export default function OutstandingInvoicesWidget({ company, h }) {
  const nav = useNavigate();
  const { openAsk } = useAsk();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.SalesInvoice.filter({ company_id: cid }, 'due_date', 500)
  );

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
        description="All sales invoices are paid. Create a new invoice to track payments and send reminders from here."
        actionLabel="New Invoice"
        onAction={() => nav('/invoices/new')}
        askLabel="Ask"
        onAsk={() => openAsk('Which customers owe me money?')}
      />
    );

  return (
    <div className="space-y-2">
      {items.map((i) => {
        const st = dueStatus(i, today);
        return (
          <div key={i.id} className="rounded-lg border border-border p-2.5 relative overflow-hidden">
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />
            <div className="flex items-center justify-between gap-2 pl-1.5">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{i.customer_name || '—'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {i.invoice_number} · due {fmtDate(i.due_date)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold">
                  <CountUp value={i.balance_due} format={(v) => gbp(v)} duration={600} />
                </p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${st.tone}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 pl-1.5">
              <Action icon={Eye} label="View" onClick={() => nav(`/invoices/${i.id}`)} />
              <Action icon={CreditCard} label="Record Payment" onClick={() => nav(`/invoices/${i.id}`)} />
              <Action icon={Mail} label="Send Reminder" onClick={() => { window.location.href = `mailto:?subject=Reminder: Invoice ${i.invoice_number}`; }} />
              <Action icon={Sparkles} label="Ask" onClick={() => openAsk(`What's the status of invoice ${i.invoice_number}?`)} />
            </div>
          </div>
        );
      })}
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