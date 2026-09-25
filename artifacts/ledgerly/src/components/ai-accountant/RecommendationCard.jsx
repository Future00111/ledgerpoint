import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, X, Clock, ArrowRight, ChevronDown, RotateCcw } from 'lucide-react';
import { gbp, DOMAIN_LABELS, PRIORITY_STYLES } from './api';

/**
 * A single AI recommendation with problem, recommended action, confidence,
 * explanation and explicit user decision buttons. Decisions never apply
 * accounting changes — they only record the user's verdict.
 */
export default function RecommendationCard({ rec, onDecide, deciding }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const p = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.low;
  const isOpen = rec.status === 'open';
  const isSnoozed = rec.status === 'snoozed';

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden" data-testid={`card-recommendation-${rec.id}`}>
      <div className="px-4 py-3 flex items-start gap-3">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-widest ${p.chip}`}>
              {p.label} priority
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {DOMAIN_LABELS[rec.domain] || rec.domain}
            </span>
            {rec.status !== 'open' && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {rec.status}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
          {rec.recommended_action && (
            <p className="text-xs text-slate-600 mt-1">
              <span className="font-semibold text-slate-700">Recommended: </span>
              {rec.recommended_action}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
            {rec.amount != null && Number(rec.amount) > 0 && (
              <span className="font-semibold text-slate-700 tabular-nums">{gbp(rec.amount)}</span>
            )}
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#007bff]" /> {rec.confidence}% confidence
            </span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-0.5 font-semibold text-[#007bff] hover:underline"
              data-testid={`button-explain-${rec.id}`}
            >
              Why was this flagged? <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-3 pl-9">
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <p>{rec.detail}</p>
            {rec.evidence && (
              <pre className="text-[10px] text-slate-500 bg-white border border-slate-100 rounded p-2 overflow-x-auto max-h-48">
                {JSON.stringify(rec.evidence, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {(isOpen || isSnoozed) && (
        <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap gap-2 items-center">
          <Button size="sm" className="h-8 text-xs" disabled={deciding}
            onClick={() => onDecide(rec.id, 'approved')} data-testid={`button-approve-${rec.id}`}>
            <Check className="w-3.5 h-3.5 mr-1" /> Accept
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={deciding}
            onClick={() => onDecide(rec.id, 'dismissed')} data-testid={`button-dismiss-${rec.id}`}>
            <X className="w-3.5 h-3.5 mr-1" /> Dismiss
          </Button>
          {isOpen && (
            <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-500" disabled={deciding}
              onClick={() => onDecide(rec.id, 'snoozed')} data-testid={`button-snooze-${rec.id}`}>
              <Clock className="w-3.5 h-3.5 mr-1" /> Snooze
            </Button>
          )}
          {rec.route && (
            <Button size="sm" variant="ghost" className="h-8 text-xs ml-auto text-[#007bff]"
              onClick={() => nav(rec.route)} data-testid={`button-goto-${rec.id}`}>
              Take me there <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      )}
      {!isOpen && !isSnoozed && rec.status !== 'resolved' && (
        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" disabled={deciding}
            onClick={() => onDecide(rec.id, 'reopened')} data-testid={`button-reopen-${rec.id}`}>
            <RotateCcw className="w-3 h-3 mr-1" /> Reopen
          </Button>
        </div>
      )}
    </div>
  );
}
