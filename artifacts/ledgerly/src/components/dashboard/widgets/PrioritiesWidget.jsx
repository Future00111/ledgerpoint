import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { nextVatDeadlineDays } from '@/lib/vat';
import {
  ListChecks, ArrowLeftRight, Receipt, Percent, FileText, FolderOpen, Unplug, ArrowRight,
} from 'lucide-react';

export default function PrioritiesWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, bills, txns, docs, accts] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-due_date', 300),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-due_date', 300),
      base44.entities.BankTransaction.filter({ company_id: cid }, '-date', 500),
      base44.entities.Document.filter({ company_id: cid }),
      base44.entities.BankAccount.filter({ company_id: cid }),
    ]);
    return { inv, bills, txns, docs, accts };
  });

  if (loading) return <ListSkeleton />;
  const { inv, bills, txns, docs, accts } = data || {};
  const today = new Date().toISOString().slice(0, 10);
  const review = (txns || []).filter((t) => t.status === 'review').length;
  const approve = (bills || []).filter((b) => b.status === 'awaiting_review' || b.status === 'draft').length;
  const vd = nextVatDeadlineDays(company?.vat_frequency);
  const overdue = (inv || []).filter(
    (i) => ['approved', 'sent', 'part_paid'].includes(i.status) && (Number(i.balance_due) || 0) > 0 && i.due_date < today
  ).length;
  const pendingDocs = (docs || []).filter((d) => d.status === 'pending_review' || d.status === 'pending_extraction').length;
  const feedDown = (accts || []).some((a) => a.connection_type === 'open_banking' && a.open_banking_status !== 'connected');

  const tasks = [];
  if (review > 0) tasks.push({ label: `Review ${review} bank transaction${review > 1 ? 's' : ''}`, route: '/transactions', icon: ArrowLeftRight });
  if (approve > 0) tasks.push({ label: `Approve ${approve} supplier bill${approve > 1 ? 's' : ''}`, route: '/bills', icon: Receipt });
  if (vd != null && vd <= 60) tasks.push({ label: `Submit VAT in ${vd} day${vd > 1 ? 's' : ''}`, route: '/vat', icon: Percent });
  if (overdue > 0) tasks.push({ label: `Chase ${overdue} overdue invoice${overdue > 1 ? 's' : ''}`, route: '/invoices', icon: FileText });
  if (pendingDocs > 0) tasks.push({ label: `Review ${pendingDocs} uploaded document${pendingDocs > 1 ? 's' : ''}`, route: '/documents', icon: FolderOpen });
  if (feedDown) tasks.push({ label: 'Reconnect bank feed', route: '/bank-accounts', icon: Unplug });

  if (!tasks.length)
    return (
      <EmptyState
        icon={ListChecks}
        title="You're all caught up"
        description="Nothing needs your attention today. Ledgerly will flag tasks here as they arise."
      />
    );

  return (
    <div className="space-y-1.5">
      {tasks.map((t, i) => (
        <button
          key={i}
          onClick={() => nav(t.route)}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
        >
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <t.icon className="w-4 h-4" />
          </span>
          <span className="flex-1 text-sm font-medium text-foreground truncate">{t.label}</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </div>
  );
}