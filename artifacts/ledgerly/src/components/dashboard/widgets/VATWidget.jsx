import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { nextVatDeadlineDate, currentQuarter } from '@/lib/vat';
import { Percent, ArrowRight, ShieldCheck } from 'lucide-react';
import { aiApi } from '@/components/ai-accountant/api';

export default function VATWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    return aiApi.vatOverview(cid);
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

  const estimate = Number(data?.boxes?.[5] || 0);
  const period = data?.period ? `${data.period.start} – ${data.period.end}` : currentQuarter();
  const dueDate = nextVatDeadlineDate(data?.settings?.frequency || company?.vat_frequency);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] text-muted-foreground font-medium">Estimated VAT</p>
        <p className="text-2xl font-semibold tracking-tight">{gbp(estimate)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">Period</p>
          <p className="text-sm font-semibold">{period}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2.5 py-2 text-xs flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" />VAT health</span>
          <span className="font-semibold">{data?.health?.score ?? 0}/100 · {data?.health?.open_exception_count ?? 0} review</span>
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