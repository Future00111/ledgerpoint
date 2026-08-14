import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { cn } from '@/lib/utils';
import {
  FileText, Wallet, Clock, Users, Pause, AlertTriangle, ArrowRight,
} from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// Workflow Dashboard Widget — answers "where are my invoices in the workflow
// and who needs attention right now?" Six headline metrics + the customers
// requiring immediate attention.
export default function WorkflowWidget({ company, h }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, cust] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-due_date', 500),
      base44.entities.Customer.filter({ company_id: cid }, '-created_date', 500),
    ]);
    return { inv: inv || [], cust: cust || [] };
  });

  if (loading) return <ListSkeleton rows={4} />;
  const { inv, cust } = data || { inv: [], cust: [] };
  const now = new Date();

  const customerById = (id) => cust.find((c) => c.id === id);
  const awaitingApproval = inv.filter((i) => i.status === 'draft');
  const activeOpen = inv.filter((i) => ['approved', 'sent', 'part_paid'].includes(i.status) && (Number(i.balance_due) || 0) > 0);
  const overdue = inv.filter((i) => i.status !== 'cancelled' && i.due_date && new Date(i.due_date) < now && (Number(i.balance_due) || 0) > 0);
  const overdueCustomerIds = new Set(overdue.map((i) => i.customer_id));
  const onHoldCustomers = cust.filter((c) => (c.tags || []).includes('Credit Hold'));

  const attention = cust
    .map((c) => {
      const cInv = inv.filter((i) => i.customer_id === c.id);
      const cOverdue = cInv.filter((i) => i.due_date && new Date(i.due_date) < now && (Number(i.balance_due) || 0) > 0 && i.status !== 'cancelled');
      const oldest = cOverdue.length ? Math.max(...cOverdue.map((i) => Math.floor((now - new Date(i.due_date)) / 86400000))) : 0;
      const balance = cOverdue.reduce((s, i) => s + Number(i.balance_due || 0), 0);
      const hold = (c.tags || []).includes('Credit Hold');
      const urgent = oldest > 60 || hold || balance > 5000;
      return { c, oldest, balance, hold, urgent };
    })
    .filter((r) => r.urgent)
    .sort((a, b) => b.oldest - a.oldest);

  const metrics = [
    { icon: FileText, label: 'Awaiting approval', value: String(awaitingApproval.length), tone: 'text-blue-600', onClick: () => nav('/invoices') },
    { icon: Wallet, label: 'Awaiting payment', value: String(activeOpen.length), tone: 'text-slate-600', onClick: () => nav('/invoices') },
    { icon: Clock, label: 'Overdue invoices', value: String(overdue.length), tone: 'text-rose-600', onClick: () => nav('/collections') },
    { icon: Users, label: 'In collections', value: String(overdueCustomerIds.size), tone: 'text-amber-600', onClick: () => nav('/collections') },
    { icon: Pause, label: 'Accounts on hold', value: String(onHoldCustomers.length), tone: 'text-rose-600', onClick: () => nav('/customers') },
    { icon: AlertTriangle, label: 'Need attention', value: String(attention.length), tone: 'text-orange-600', onClick: () => nav('/collections') },
  ];

  const showList = h === 2 && attention.length > 0;

  if (metrics.every((m) => m.value === '0') && !showList) {
    return (
      <EmptyState
        icon={FileText}
        title="Workflow is clear"
        description="No invoices awaiting approval, payment or collection. Ledgerly will guide you the moment something needs action."
        actionLabel="View invoices"
        onAction={() => nav('/invoices')}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={m.onClick}
            className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-muted/30 hover:border-primary/30 transition-colors"
          >
            <m.icon className={cn('w-4 h-4 flex-shrink-0', m.tone)} />
            <div className="min-w-0">
              <p className="text-base font-semibold leading-none">{m.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 truncate">{m.label}</p>
            </div>
          </button>
        ))}
      </div>

      {showList && (
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5">Requiring immediate attention</p>
          <div className="space-y-1.5">
            {attention.slice(0, 5).map((r) => (
              <button
                key={r.c.id}
                type="button"
                onClick={() => nav(`/customers/${r.c.id}`)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.oldest} days overdue · {gbp.format(r.balance)}{r.hold ? ' · on hold' : ''}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}