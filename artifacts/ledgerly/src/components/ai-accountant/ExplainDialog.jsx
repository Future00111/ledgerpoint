import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { aiApi, gbp } from './api';

const STATUS = {
  green: { icon: CheckCircle2, text: 'text-emerald-700', chip: 'bg-emerald-50 border-emerald-200', label: 'Ready for approval' },
  amber: { icon: AlertTriangle, text: 'text-amber-700', chip: 'bg-amber-50 border-amber-200', label: 'Review required' },
  red: { icon: XCircle, text: 'text-red-700', chip: 'bg-red-50 border-red-200', label: 'Investigation required' },
};

const WEIGHT = { strong: 'bg-emerald-500', moderate: 'bg-amber-400', weak: 'bg-slate-300' };

/** "Explain this" — transparent breakdown of the AI's reasoning for one bank transaction. */
export default function ExplainDialog({ transactionId, open, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !transactionId) return;
    setLoading(true); setError(null); setData(null);
    aiApi.explain(transactionId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, transactionId]);

  const s = data ? (STATUS[data.verdict?.status] || STATUS.red) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-explain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-[#007bff]" /> Explain this transaction
          </DialogTitle>
          <DialogDescription className="text-xs">
            How the AI Accountant reached its conclusion — the data points and matching factors it used.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-slate-500 py-6 text-center">Analysing…</p>}
        {error && <p className="text-sm text-red-600 py-4">{error}</p>}

        {data && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
              <p className="font-semibold text-slate-900">{data.transaction.description || 'Untitled transaction'}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.transaction.date} · {data.transaction.money_in > 0 ? `${gbp(data.transaction.money_in)} received` : `${gbp(data.transaction.money_out)} paid out`}
                {data.transaction.reference ? ` · ref "${data.transaction.reference}"` : ''}
              </p>
            </div>

            <div className={`rounded-lg border p-3 ${s.chip}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${s.text} flex items-center gap-1.5`}>
                <s.icon className="w-3.5 h-3.5" /> {s.label} · {Math.round(data.verdict.confidence)}% confidence
              </p>
              <p className="text-xs text-slate-700 mt-1.5">{data.verdict.summary}</p>
              {data.verdict.recommendation && (
                <p className="text-xs text-slate-600 mt-1.5"><span className="font-semibold">Next step: </span>{data.verdict.recommendation}</p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Matching factors</p>
              <ul className="space-y-1.5">
                {data.factors.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${WEIGHT[f.weight] || WEIGHT.weak}`} />
                    <span><span className="font-semibold text-slate-800">{f.label}:</span> <span className="text-slate-600">{f.value}</span></span>
                  </li>
                ))}
              </ul>
            </div>

            {data.matched_records?.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Matched documents</p>
                <ul className="space-y-1 text-xs text-slate-700">
                  {data.matched_records.map((r, i) => (
                    <li key={i} className="flex justify-between border border-slate-100 rounded px-2.5 py-1.5 bg-white">
                      <span>{r.record_number || r.record_type} {r.party_name ? `· ${r.party_name}` : ''}</span>
                      <span className="font-semibold tabular-nums">{r.match_amount != null ? gbp(r.match_amount) : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Data points considered</p>
              <ul className="text-xs text-slate-500 list-disc pl-4 space-y-0.5">
                {data.data_points_considered.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
