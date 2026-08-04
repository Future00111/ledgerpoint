import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { nextVatDeadlineDate, currentQuarter } from '@/lib/vat';
import { Percent, ArrowRight } from 'lucide-react';

export default function VATWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [vat, inv, bills] = await Promise.all([
      base44.entities.VATReturn.filter({ company_id: cid }, '-created_date', 5),
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-issue_date', 500),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-bill_date', 500),
    ]);
    return { vat, inv, bills };
  });

  if (loading) return <Skeleton className="h-28 w-full" />;

  if (!company?.vat_registered)
    return (
      <EmptyState
        icon={Percent}
        title="VAT not registered"
        description="Once you register for VAT, Ledgerly will estimate and prepare your returns here."
        askLabel="Ask about VAT"
        onAsk={() => nav('/vat')}
      />
    );

  const { vat, inv, bills } = data || {};
  const latest = vat && vat[0];
  const estimate =
    (latest && Number(latest.vat_due)) ||
    (inv || []).reduce((s, i) => s + (Number(i.vat_total) || 0), 0) - (bills || []).reduce((s, b) => s + (Number(b.vat_total) || 0), 0);
  const dueDate = nextVatDeadlineDate(company?.vat_frequency);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] text-muted-foreground font-medium">Estimated VAT</p>
        <p className="text-2xl font-semibold tracking-tight">{gbp(estimate)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">Period</p>
          <p className="text-sm font-semibold">{latest?.period || currentQuarter()}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">Submission Due</p>
          <p className="text-sm font-semibold">{dueDate ? fmtDate(dueDate) : '—'}</p>
        </div>
      </div>
      <button
        onClick={() => nav('/vat')}
        className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Prepare VAT Return
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}