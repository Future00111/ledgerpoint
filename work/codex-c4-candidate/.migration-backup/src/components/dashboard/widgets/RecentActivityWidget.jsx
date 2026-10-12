import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { fmtDateTime } from '@/lib/format';
import { History, FileText, Receipt, ArrowLeftRight, FolderOpen } from 'lucide-react';

export default function RecentActivityWidget({ company, h }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, bills, journals, docs] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-created_date', 15),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-created_date', 15),
      base44.entities.JournalEntry.filter({ company_id: cid }, '-created_date', 15),
      base44.entities.Document.filter({ company_id: cid }, '-created_date', 15),
    ]);
    return { inv, bills, journals, docs };
  });

  const items = useMemo(() => {
    if (!data) return [];
    const acts = [];
    (data.inv || []).forEach((i) => acts.push({ icon: FileText, label: `Invoice ${i.invoice_number || ''} created`, date: i.created_date, route: `/invoices/${i.id}` }));
    (data.bills || []).forEach((b) => acts.push({ icon: Receipt, label: `Bill ${b.bill_number || ''} ${b.status === 'approved' ? 'approved' : 'added'}`, date: b.created_date, route: `/bills/${b.id}` }));
    (data.journals || []).forEach((j) => acts.push({ icon: ArrowLeftRight, label: `Journal ${j.reference || ''} posted`, date: j.created_date, route: '/general-ledger' }));
    (data.docs || []).forEach((d) => acts.push({ icon: FolderOpen, label: `Document ${d.name || ''} uploaded`, date: d.created_date, route: '/documents' }));
    return acts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, h === 2 ? 10 : 6);
  }, [data, h]);

  if (loading) return <ListSkeleton />;
  if (!items.length)
    return <EmptyState icon={History} title="No recent activity" description="Invoices, payments, bills and journals you create will show up here." />;

  return (
    <div className="space-y-1">
      {items.map((a, i) => (
        <button key={i} onClick={() => nav(a.route)} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted transition-colors text-left">
          <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
          <span className="flex-1 text-xs font-medium truncate">{a.label}</span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">{fmtDateTime(a.date)}</span>
        </button>
      ))}
    </div>
  );
}