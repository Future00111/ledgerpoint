import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE_TEXT = { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', primary: 'text-primary', muted: 'text-muted-foreground', orange: 'text-orange-600', blue: 'text-blue-600', slate: 'text-slate-600' };

// WorkflowRecommendation — AI-style "next action" card shown beside every
// workflow: recommended next action, the reason, and a confidence score.
// When the recommendation comes from a configurable automation, a badge marks it.
export default function WorkflowRecommendation({ recommendation }) {
  if (!recommendation) return null;
  const { nextAction, reason, confidence, tone, automation } = recommendation;
  const conf = Math.max(0, Math.min(100, Math.round(confidence || 0)));
  const textTone = TONE_TEXT[tone] || 'text-primary';

  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">AI Recommendation</p>
          {automation && (
            <Badge variant="secondary" className="ml-auto gap-1 text-[10px]">
              <Zap className="w-3 h-3" /> Automated rule
            </Badge>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Recommended next action</p>
            <p className={cn('text-sm font-semibold', textTone)}>{nextAction}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Reason</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{reason}</p>
          </div>
          <div>
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="uppercase font-semibold tracking-wide text-muted-foreground">Confidence</span>
              <span className="font-semibold">{conf}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${conf}%` }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}