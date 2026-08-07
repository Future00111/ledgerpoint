import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useWorkspaceAsk } from '../useWorkspaceAsk';

// Reusable Executive Summary widget — auto-generates an AI executive briefing
// on mount using the workspace's context. The most important Workspace widget:
// tells the story of the record in a few sentences so the user understands it
// within seconds, without interpreting the numbers themselves.
export default function ExecutiveSummaryCard({ companyId, context, prompt }) {
  const { answer, loading, run } = useWorkspaceAsk();

  useEffect(() => {
    if (companyId && context && prompt) {
      run({ companyId, context, question: prompt });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, context, prompt]);

  return (
    <Card className="border border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Executive Summary</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Preparing your briefing…
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
        )}
      </CardContent>
    </Card>
  );
}