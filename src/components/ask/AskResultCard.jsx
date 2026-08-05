import React from 'react';
import { Pin, PinOff, CreditCard, Sparkles } from 'lucide-react';

// Contextual secondary actions shown on a record card. The entire card is the
// primary click target (opens the record), so "View"/"Open" are intentionally
// omitted — only task-oriented actions remain.
function quickActions(group) {
  switch (group) {
    case 'Invoices':
      return ['pay', 'ask'];
    default:
      return ['ask'];
  }
}

// A grouped result row: the whole surface opens the record (primary action).
// Secondary actions (Record Payment, Ask, Pin) sit on top and stop propagation.
export default function AskResultCard({
  group, item, icon: Icon, isPinned,
  onOpen, onAsk, onRecordPayment, onTogglePin,
}) {
  const actions = quickActions(group);
  const btn = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-accent transition-colors';
  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onOpen}
      aria-label={`Open ${item.label}`}
      className="group flex items-center gap-3 px-4 sm:px-6 py-2.5 cursor-pointer hover:bg-muted transition-colors"
    >
      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground truncate">{item.label}</span>
          {item.soon && (
            <span className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">Soon</span>
          )}
          {isPinned && <Pin className="w-3 h-3 text-primary flex-shrink-0 fill-primary" />}
        </div>
        {item.sublabel && (
          <span className="block text-xs text-muted-foreground truncate">{item.sublabel}</span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {actions.includes('pay') && (
          <button onClick={(e) => { e.stopPropagation(); onRecordPayment(); }} className={btn} title="Record payment">
            <CreditCard className="w-3 h-3" /> <span className="hidden md:inline">Record Payment</span>
          </button>
        )}
        {actions.includes('ask') && (
          <button onClick={(e) => { e.stopPropagation(); onAsk(); }} className={`${btn} text-primary`} title="Ask about this record">
            <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">Ask</span>
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground"
          title={isPinned ? 'Unpin' : 'Pin to top'}
          aria-label={isPinned ? 'Unpin' : 'Pin to top'}
        >
          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}