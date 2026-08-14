import React from 'react';
import { AlertTriangle, Copy, Search, PoundSterling, Plug, AlertCircle } from 'lucide-react';

const ICONS = { feed: Plug, duplicate: Copy, large: PoundSterling, unmatched: Search, error: AlertCircle };
const TONES = {
  critical: { ring: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' },
  warning: { ring: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  info: { ring: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
};

// "What Needs Attention" — prioritised, clickable list. Clicking an item with
// transaction ids scrolls to / highlights the first relevant transaction card.
export default function ReconAttentionCard({ items, onPick }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <p className="text-sm font-semibold mb-3">What Needs Attention</p>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-emerald-600" />
          <p className="text-xs text-emerald-700">Nothing needs attention — all clear.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const Icon = ICONS[it.type] || AlertCircle;
            const tone = TONES[it.severity] || TONES.info;
            const clickable = it.transactionIds && it.transactionIds.length > 0;
            return (
              <button
                key={it.key}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onPick?.(it.transactionIds[0])}
                className={`w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${clickable ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default'}`}
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${tone.ring}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{it.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>
                </div>
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${tone.ring} flex-shrink-0`}>{it.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}