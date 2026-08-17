import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useAsk } from '@/components/ask/AskProvider';
import { getWidgetInsight } from './widgetInsights';
import { Lightbulb, Loader2, BarChart3, Sparkles } from 'lucide-react';

// The Dashboard Intelligence Layer — explains any widget in plain English
// with Why, a Suggested action, a Related report link, and an Ask shortcut.
export default function WidgetInsightDialog({ open, onClose, widgetId, title, company }) {
  const { openAsk } = useAsk();
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !widgetId) return;
    setLoading(true);
    setInsight(null);
    getWidgetInsight(widgetId, company).then((r) => {
      setInsight(r);
      setLoading(false);
    });
  }, [open, widgetId, company]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>What this widget means and what to do next.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Reading your books…
          </div>
        ) : insight ? (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Why</p>
              <p className="text-sm text-foreground leading-relaxed">{insight.why}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Suggested action</p>
              <p className="text-sm text-foreground leading-relaxed">{insight.action}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {insight.report && (
                <Link
                  to={insight.report.route}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  {insight.report.label}
                </Link>
              )}
              <button
                onClick={() => {
                  onClose();
                  openAsk(insight.ask);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask about this
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}