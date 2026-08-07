import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText, CreditCard, FileMinus, Paperclip, UserPlus, Bot, CalendarClock,
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
              <li key={i} className="relative">
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