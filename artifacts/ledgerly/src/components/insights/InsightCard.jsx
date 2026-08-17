import React from 'react';
import { TrendingUp, AlertTriangle, CalendarClock, Flame, Receipt, Copy, Landmark, PoundSterling } from 'lucide-react';

const CATEGORY_CONFIG = {
  revenue: { Icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
  overdue: { Icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  bills_due: { Icon: CalendarClock, color: 'text-amber-600', bg: 'bg-amber-50' },
  costs: { Icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50' },
  vat: { Icon: Receipt, color: 'text-purple-600', bg: 'bg-purple-50' },
  duplicate: { Icon: Copy, color: 'text-rose-600', bg: 'bg-rose-50' },
  reconciliation: { Icon: Landmark, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cashflow: { Icon: PoundSterling, color: 'text-teal-600', bg: 'bg-teal-50' },
  general: { Icon: TrendingUp, color: 'text-slate-600', bg: 'bg-slate-100' },
};

const SEVERITY_RING = {
  positive: 'border-l-emerald-500',
  info: 'border-l-blue-500',
  warning: 'border-l-amber-500',
  critical: 'border-l-red-500',
};

export default function InsightCard({ insight, onOpen, onDismiss }) {
  const cfg = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.general;
  const { Icon, color, bg } = cfg;

  return (
    <div className={`bg-card border border-border border-l-4 ${SEVERITY_RING[insight.severity] || SEVERITY_RING.info} rounded-lg shadow-sm hover:shadow transition-shadow`}>
      <div className="p-4 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{insight.title}</p>
          {insight.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpen(insight)}
          className="text-xs font-medium text-primary hover:underline"
        >
          View underlying data →
        </button>
        {onDismiss && (
          <button
            onClick={() => onDismiss(insight)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}