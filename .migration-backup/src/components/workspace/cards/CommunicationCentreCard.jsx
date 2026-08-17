import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Send, Bell, Phone, Headphones } from 'lucide-react';

const FIELD_ICONS = { email: Mail, statement: Send, reminder: Bell, call: Phone };

// Communication Centre — preferred contact method, last-contact signals and
// one-tap actions to email, send a statement, send a reminder or call.
export default function CommunicationCentreCard({
  preferredMethod = '—',
  lastEmail, lastStatement, lastReminder, lastCall,
  onEmail, onStatement, onReminder, onCall,
}) {
  const fields = [
    { key: 'email', label: 'Last email', value: lastEmail },
    { key: 'statement', label: 'Last statement', value: lastStatement },
    { key: 'reminder', label: 'Last reminder', value: lastReminder },
    { key: 'call', label: 'Last phone call', value: lastCall },
  ];

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <Headphones className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Communication Centre</p>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2.5 py-2 mb-2.5">
          <span className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Preferred Method</span>
          <span className="text-sm font-semibold">{preferredMethod}</span>
        </div>

        <ul className="space-y-1 mb-3">
          {fields.map((f) => {
            const Icon = FIELD_ICONS[f.key];
            return (
              <li key={f.key} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" /> {f.label}
                </span>
                <span className="text-xs font-medium">{f.value || 'Not tracked'}</span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={onEmail}><Mail className="w-3.5 h-3.5" /> Email</Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={onStatement}><Send className="w-3.5 h-3.5" /> Statement</Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={onReminder}><Bell className="w-3.5 h-3.5" /> Reminder</Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={onCall}><Phone className="w-3.5 h-3.5" /> Call</Button>
        </div>
      </CardContent>
    </Card>
  );
}