import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, AlertCircle, ArrowRight, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { healthStatus } from './useBusinessHealth';

// Friendly, customer-safe Business Health explanation. Opens from the header
// pill, the KPI Health card and the Business Snapshot hero.
export default function BusinessHealthDialog({ open, onClose, health }) {
  const loading = !health || health.loading;
  const score = health?.score;
  const color =
    score == null
      ? 'text-muted-foreground'
      : score >= 90
      ? 'text-emerald-600'
      : score >= 70
      ? 'text-amber-600'
      : 'text-rose-600';
  const trend = health?.trend || 0;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-muted-foreground';
  const trendText =
    trend > 0
      ? `Up ${trend} points since your last visit`
      : trend < 0
      ? `Down ${Math.abs(trend)} points since your last visit`
      : 'No change since your last visit';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Business Health</DialogTitle>
          <DialogDescription>How your bookkeeping is looking right now, and what to do next.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className={`text-4xl font-bold ${color}`}>
                  {score}
                  <span className="text-base font-normal text-muted-foreground">/100</span>
                </span>
                <Progress value={score || 0} className="h-1.5 mt-2 w-40" />
              </div>
              <div className={`flex items-center gap-1.5 text-xs ${trendColor}`}>
                <TrendIcon className="w-4 h-4" />
                {trendText}
              </div>
            </div>

            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                <span className={`text-sm font-semibold ${color}`}>{healthStatus(score)}</span>
              </div>
              <p className="text-sm text-foreground leading-snug">{health.summary || 'Your business is performing well.'}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Positive</p>
              <div className="space-y-1.5">
                {(health.positives || []).length ? (
                  health.positives.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-foreground">{p}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No positive factors yet — connect a bank account to get started.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Needs attention</p>
              <div className="space-y-1.5">
                {(health.attention || []).length ? (
                  health.attention.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span className="text-foreground">{a}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Everything’s under control — nothing needs your attention.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Suggested actions</p>
              <div className="space-y-1.5">
                {(health.suggestions || []).map((s, i) => (
                  <Link
                    key={i}
                    to={s.route}
                    onClick={onClose}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <span className="text-foreground">{s.label}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}