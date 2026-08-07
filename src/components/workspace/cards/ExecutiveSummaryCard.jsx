import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useWorkspaceAsk } from '../useWorkspaceAsk';

// Reusable Executive Summary widget — auto-generates a concise AI briefing on
// mount using the workspace context. Kept compact on purpose: it explains the
// financial position in a few sentences; it never replaces the financial info.
export default function ExecutiveSummaryCard({ companyId, context, prompt }) {
  const { answer, loading, run } = useWorkspaceAsk();

  useEffect(() => {
    if (companyId && context && prompt) {
      run({ companyId, context, question: prompt });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, context, prompt]);

  return (
    <Card className="border border-border border-l-2 border-l-primary bg-muted/30">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Executive Summary</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing your briefing…
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{answer}</p>
        )}
      </CardContent>
    </Card>
  );
}