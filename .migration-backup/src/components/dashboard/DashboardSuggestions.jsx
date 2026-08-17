import React, { useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { WIDGETS } from './widgetRegistry';

// Dismissible, never-auto-applied widget recommendations driven by current
// business activity. Each suggestion maps to a real widget; accepting adds
// the widget to the dashboard, dismissing remembers the choice locally.
export default function DashboardSuggestions({ activity, layout, onAddWidget }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lp.sugg.dismissed') || '{}') || {};
    } catch {
      return {};
    }
  });

  const isHidden = (id) => !!layout.find((x) => x.id === id)?.hidden;

  const SUGGESTIONS = [
    {
      id: 'transactionsReview',
      value: activity.transactionsReview || 0,
      active: (activity.transactionsReview || 0) > 0,
      text: (n) => `You have ${n} bank transaction${n > 1 ? 's' : ''} awaiting review. Pin this widget?`,
    },
    {
      id: 'vat',
      value: activity.vat || 0,
      active: (activity.vat || 0) > 0,
      text: () => `VAT deadline approaching. Add VAT to your dashboard?`,
    },
    {
      id: 'invoices',
      value: activity.invoices || 0,
      active: (activity.invoices || 0) > 0,
      text: (n) => `${n} invoice${n > 1 ? 's' : ''} overdue. Add Outstanding Invoices?`,
    },
    {
      id: 'billsApproval',
      value: activity.billsApproval || 0,
      active: (activity.billsApproval || 0) > 0,
      text: (n) => `${n} bill${n > 1 ? 's' : ''} awaiting approval. Add this widget?`,
    },
    {
      id: 'docsReview',
      value: activity.docsReview || 0,
      active: (activity.docsReview || 0) > 0,
      text: (n) => `${n} document${n > 1 ? 's' : ''} awaiting review. Add this widget?`,
    },
  ];

  const items = SUGGESTIONS.filter((s) => s.active && isHidden(s.id) && !dismissed[s.id]);
  if (!items.length) return null;

  const dismiss = (id) => {
    const next = { ...dismissed, [id]: true };
    setDismissed(next);
    try {
      localStorage.setItem('lp.sugg.dismissed', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => {
        const meta = WIDGETS[s.id];
        const Icon = meta?.icon;
        return (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs max-w-full"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
            <span className="text-foreground/80 truncate">{s.text(s.value)}</span>
            <button
              onClick={() => {
                onAddWidget(s.id);
                dismiss(s.id);
              }}
              className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 flex-shrink-0"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
            <button
              onClick={() => dismiss(s.id)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground flex-shrink-0"
              aria-label="Dismiss suggestion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}