import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText, CreditCard, FileMinus, Paperclip, UserPlus, Bot, CalendarClock,
  Mail, StickyNote, Sparkles,
} from 'lucide-react';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const ICONS = {
  invoice: FileText,
  payment: CreditCard,
  credit_note: FileMinus,
  document: Paperclip,
  created: UserPlus,
  automation: Bot,
  email: Mail,
  note: StickyNote,
  ai: Sparkles,
};

// Reusable Timeline card — the complete chronological history of a business
// object. Each event has a date, text, optional amount and a kind (drives icon).
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
      <CardContent className="p-4">
        <ol className="relative border-l border-border ml-3 space-y-4 pl-6">
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
                className={e.onClick ? 'relative cursor-pointer hover:bg-muted/30 rounded-lg -mx-2 px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring' : 'relative'}
              >
                <span className="absolute -left-[1.65rem] flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary ring-4 ring-background">
                  <Icon className="w-3 h-3" />
                </span>
                <p className="text-sm font-medium">
                  {e.text}
                  {e.amount != null ? ` · ${gbp.format(Number(e.amount) || 0)}` : ''}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> {e.date}
                </p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}