import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { relativeTime } from '@/lib/format';
import {
  Bell, CheckCircle2, AlertTriangle, Unplug, Sparkles, FileCheck, Copy,
} from 'lucide-react';

export default function NotificationsWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [vat, insights, accts, docs] = await Promise.all([
      base44.entities.VATReturn.filter({ company_id: cid }, '-created_date', 5),
      base44.entities.Insight.filter({ company_id: cid, is_dismissed: false }, '-generated_date', 10),
      base44.entities.BankAccount.filter({ company_id: cid }),
      base44.entities.Document.filter({ company_id: cid }, '-created_date', 10),
    ]);
    return { vat, insights, accts, docs };
  });

  const notifs = useMemo(() => {
    if (!data) return [];
    const { vat, insights, accts, docs } = data;
    const out = [];
    const submitted = (vat || []).find((v) => v.status === 'submitted' || v.status === 'filed');
    if (submitted) out.push({ icon: CheckCircle2, color: 'text-emerald-600', title: 'HMRC submission successful', desc: 'Your VAT return was submitted to HMRC.', route: '/vat', date: submitted.created_date });
    (insights || []).filter((i) => i.category === 'duplicate').slice(0, 1).forEach((i) => out.push({ icon: Copy, color: 'text-amber-600', title: i.title, desc: i.description, route: '/insights', date: i.generated_date }));
    if ((accts || []).some((a) => a.connection_type === 'open_banking' && a.open_banking_status !== 'connected')) out.push({ icon: Unplug, color: 'text-rose-600', title: 'Bank feed disconnected', desc: 'Reconnect to resume automatic imports.', route: '/bank-accounts' });
    if ((insights || []).some((i) => !i.is_dismissed)) out.push({ icon: Sparkles, color: 'text-primary', title: 'AI suggestion available', desc: 'New insights are ready to review.', route: '/insights', date: (insights || [])[0]?.generated_date });
    (docs || []).filter((d) => d.status === 'approved').slice(0, 1).forEach((d) => out.push({ icon: FileCheck, color: 'text-emerald-600', title: 'Document extraction complete', desc: `${d.name} was extracted and reviewed.`, route: '/documents', date: d.updated_date }));
    return out.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);
  }, [data]);

  if (loading) return <ListSkeleton />;
  if (!notifs.length)
    return <EmptyState icon={Bell} title="No notifications" description="Submission confirmations, alerts and AI suggestions appear here." />;

  return (
    <div className="space-y-1.5">
      {notifs.map((n, i) => (
        <button
          key={i}
          onClick={() => nav(n.route)}
          className="w-full flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted transition-colors text-left"
        >
          <n.icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${n.color}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
            {n.desc && <p className="text-[11px] text-muted-foreground truncate">{n.desc}</p>}
          </div>
          {n.date && <span className="text-[10px] text-muted-foreground flex-shrink-0">{relativeTime(n.date)}</span>}
        </button>
      ))}
    </div>
  );
}