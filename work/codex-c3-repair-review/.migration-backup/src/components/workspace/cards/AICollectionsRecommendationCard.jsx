import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfirmActionButton from './ConfirmActionButton';

// AI Collections Recommendation — a confidence-scored, ordered collection
// plan with the reasoning behind it. Destructive steps (account hold, legal
// escalation) require confirmation. Recommendations are computed from live
// data by the workspace and passed in.
export default function AICollectionsRecommendationCard({ confidence = 0, actions = [], reasoning = [] }) {
  const conf = Math.max(0, Math.min(100, Math.round(confidence)));
  const confTone = conf >= 80
    ? 'text-emerald-700 bg-emerald-100'
    : conf >= 60 ? 'text-amber-700 bg-amber-100' : 'text-muted-foreground bg-muted';

  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold truncate">AI Collections Recommendation</p>
          </div>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold flex-shrink-0', confTone)}>
            Confidence: {conf}%
          </span>
        </div>

        <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5">Recommended next actions</p>
        <ol className="space-y-1.5 mb-3">
          {actions.map((a, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex-shrink-0">
                {i + 1}
              </span>
              <ConfirmActionButton
                label={a.label}
                onClick={a.onClick}
                destructive={a.destructive}
                description={a.description}
                size="sm"
                className={cn('flex-1 justify-start h-8', a.destructive ? '' : 'bg-card border border-input text-foreground hover:bg-muted/50')}
              />
            </li>
          ))}
        </ol>

        {reasoning.length > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Reasoning
            </p>
            <ul className="space-y-1">
              {reasoning.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <span className="text-muted-foreground/60 mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}