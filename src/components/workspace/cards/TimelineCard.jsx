import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, CreditCard, FileMinus, Paperclip, UserPlus, Bot, CalendarClock,
  Mail, StickyNote, Sparkles, ArrowRight, CheckCircle2, Send, Bell, MailOpen,
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

// Reusable Timeline widget — rich chronological activity. Each item carries an
// event-type icon, title, status badge, date and optional amount, and is
// clickable to open the related record (One Click Rule).
export default function TimelineCard({ events = [] }) {
  if (!events.length) {
    return (
      <WorkspaceEmptyState
        icon={CalendarClock}
        title="No activity yet"
        description="Events will appear here as this relationship develops — invoices, payments, documents and more."
      />
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <ol className="relative border-l border-border ml-3 space-y-2.5 pl-6">
          {events.map((e, i) => {
            const Icon = ICONS[e.kind] || CalendarClock;
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
                  <p className="text-sm font-medium">{e.text}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
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
        </ol>
      </CardContent>
    </Card>
  );
}