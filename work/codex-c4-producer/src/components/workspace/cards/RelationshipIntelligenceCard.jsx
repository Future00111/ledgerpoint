import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BrainCircuit, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEXT_TONE = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  primary: 'text-primary',
  muted: 'text-foreground',
};

const DOT_TONE = {
  positive: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
  primary: 'bg-primary',
  info: 'bg-muted-foreground',
};

// Relationship Intelligence — CRM-style signals derived from the customer's
// financial behaviour: value tier, relationship age, payment risk, buying
// trend, communication history and proactive opportunities.
export default function RelationshipIntelligenceCard({
  value, valueTone = 'primary',
  relationshipAge,
  risk, riskTone = 'muted',
  trend, trendTone = 'muted',
  comms,
  opportunities = [],
}) {
  const tiles = [
    { label: 'Customer Value', value, tone: valueTone },
    { label: 'Relationship Age', value: relationshipAge, tone: 'muted' },
    { label: 'Payment Risk', value: risk, tone: riskTone },
    { label: 'Buying Trend', value: trend, tone: trendTone },
  ];

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Relationship Intelligence</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((t, i) => (
            <div key={i} className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">{t.label}</p>
              <p className={cn('text-sm font-semibold mt-0.5', TEXT_TONE[t.tone] || 'text-foreground')}>{t.value || '—'}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{comms || 'No communication recorded.'}</p>
        </div>
        {opportunities.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5">Opportunities</p>
            <ul className="space-y-1.5">
              {opportunities.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', DOT_TONE[o.tone] || DOT_TONE.info)} />
                  <span className="text-xs text-foreground leading-relaxed">{o.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}