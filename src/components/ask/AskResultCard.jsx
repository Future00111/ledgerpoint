import React from 'react';
import { Pin, PinOff, Eye, ExternalLink, CreditCard, Sparkles } from 'lucide-react';

// Decides which quick actions a record card offers, based on its group.
function quickActions(group) {
  switch (group) {
    case 'Customers':
    case 'Suppliers':
    case 'Companies':
      return ['view', 'open', 'ask'];
    case 'Invoices':
      return ['open', 'pay', 'ask'];
    default:
      return ['open', 'ask'];
  }
}

// A grouped result row: icon + title + secondary info + quick actions + pin.
export default function AskResultCard({
  group, item, icon: Icon, isPinned,
  onOpen, onView, onAsk, onRecordPayment, onTogglePin,
}) {
  const actions = quickActions(group);
  const btn = 'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-accent transition-colors';
  return (
    <div className="group flex items-center gap-3 px-4 sm:px-6 py-2.5 hover:bg-muted transition-colors">
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
      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        {actions.includes('view') && (
          <button onClick={onView} className={btn} title="View list">
            <Eye className="w-3 h-3" /> <span className="hidden sm:inline">View</span>
          </button>
        )}
        {actions.includes('open') && (
          <button onClick={onOpen} className={btn} title="Open">
            <ExternalLink className="w-3 h-3" /> <span className="hidden sm:inline">Open</span>
          </button>
        )}
        {actions.includes('pay') && (
          <button onClick={onRecordPayment} className={btn} title="Record payment">
            <CreditCard className="w-3 h-3" /> <span className="hidden md:inline">Record Payment</span>
          </button>
        )}
        {actions.includes('ask') && (
          <button onClick={onAsk} className={`${btn} text-primary`} title="Ask about this record">
            <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">Ask</span>
          </button>
        )}
        <button
          onClick={onTogglePin}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground"
          title={isPinned ? 'Unpin' : 'Pin to top'}
        >
          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}