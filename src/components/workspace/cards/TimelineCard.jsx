import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, CreditCard, FileMinus, Paperclip, UserPlus, Bot, CalendarClock,
  Mail, StickyNote, Sparkles, ArrowRight, CheckCircle2, Send, Bell, MailOpen, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const ICONS = {
  invoice: FileText,
  invoice_approved: CheckCircle2,
  invoice_sent: Send,
  payment: CreditCard,
  credit_note: FileMinus,
  document: Paperclip,
  created: UserPlus,
  automation: Bot,
  email: Mail,
  email_opened: MailOpen,
  note: StickyNote,
  note_added: StickyNote,
  reminder_sent: Bell,
  statement_sent: FileText,
  ai: Sparkles,
};

const FILTERS = [
  { key: 'all', label: 'All activity', kinds: null },
  { key: 'invoices', label: 'Invoices', kinds: ['invoice', 'invoice_approved', 'invoice_sent', 'credit_note'] },
  { key: 'payments', label: 'Payments', kinds: ['payment'] },
  { key: 'statements', label: 'Statements', kinds: ['statement_sent'] },
  { key: 'emails', label: 'Emails', kinds: ['email', 'email_opened'] },
  { key: 'calls', label: 'Calls', kinds: ['call'] },
  { key: 'documents', label: 'Documents', kinds: ['document'] },
  { key: 'notes', label: 'Notes', kinds: ['note', 'note_added'] },
  { key: 'collections', label: 'Collections', kinds: ['reminder_sent', 'collections'] },
  { key: 'ai', label: 'AI activity', kinds: ['ai'] },
];

// Reusable Timeline widget. Each event shows an icon, event type, reference,
// status, date and amount; every event is clickable. `maxHeight` wraps the
// list in a contained scroll area. `filterable` shows category chips that
// filter the visible events.
export default function TimelineCard({ events = [], maxHeight, filterable = false }) {
  const [activeFilter, setActiveFilter] = useState('all');
  if (!events.length) {
    return (
      <WorkspaceEmptyState
        icon={CalendarClock}
        title="No activity yet"
        description="Events will appear here as this relationship develops — invoices, payments, documents and more."
      />
    );
  }

  const filter = FILTERS.find((f) => f.key === activeFilter);
  const visible = filter && filter.kinds ? events.filter((e) => filter.kinds.includes(e.kind)) : events;

  const list = (
    <ol className="relative border-l border-border ml-3 space-y-2.5 pl-6">
      {visible.map((e, i) => {
        const Icon = ICONS[e.kind] || CalendarClock;
        const type = e.type || e.text;
        return (
          <li
            key={i}
            role={e.onClick ? 'button' : undefined}
            tabIndex={e.onClick ? 0 : undefined}
            onClick={e.onClick}
            onKeyDown={(ev) => {
              if (e.onClick && (ev.key === 'Enter' || ev.key === ' ')) {
                ev.preventDefault();
                e.onClick();
              }
            }}
            className={cn(
              'relative flex items-start gap-3 -mx-2 px-2 py-2 rounded-lg',
              e.onClick && 'cursor-pointer hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <span className="absolute -left-[1.65rem] flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary ring-4 ring-background">
              <Icon className="w-3 h-3" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">{type}</p>
              {e.reference && <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">{e.reference}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {e.status && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-none">{e.status}</Badge>}
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> {e.date}
                </span>
              </div>
            </div>
            {e.amount != null && (
              <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
                {e.amount < 0 ? '-' : ''}{gbp.format(Math.abs(Number(e.amount) || 0))}
              </p>
            )}
            {e.onClick && <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />}
          </li>
        );
      })}
      {visible.length === 0 && (
        <li className="text-xs text-muted-foreground pl-1 py-2">No {filter?.label.toLowerCase()} recorded.</li>
      )}
    </ol>
  );

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        {filterable && (
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
            <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                  activeFilter === f.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {maxHeight ? (
          <div className="overflow-y-auto pr-1 -mr-1" style={{ maxHeight }}>{list}</div>
        ) : list}
      </CardContent>
    </Card>
  );
}