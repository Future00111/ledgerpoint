import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useWorkspaceAsk } from '../useWorkspaceAsk';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable AI Insights card — generates an intelligent summary about the
// current record using its workspace context. Shows a friendly empty state
// until the user asks for insights (trust before automation).
export default function AIInsightsCard({ companyId, context, prompt }) {
  const { answer, loading, run } = useWorkspaceAsk();
  const [started, setStarted] = useState(false);

  const generate = () => {
    setStarted(true);
    run({
      companyId,
      context,
      question: prompt ||
        'Summarise this relationship: payment behaviour, revenue trend, outstanding risk and recommended next actions. Be concise and structured.',
    });
  };

  if (!started && !answer) {
    return (
      <WorkspaceEmptyState
        icon={Sparkles}
        title="AI Insights"
        description="Generate intelligent summaries about payment trends, revenue and recommended actions for this record."
        actionLabel="Generate insights"
        onAction={generate}
      />
    );
  }

  return (
    <Card className="border border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" /> AI Insights
          </span>
          {answer && (
            <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="h-7 text-xs">
              Regenerate
            </Button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Analysing…
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{answer}</p>
        )}
      </CardContent>
    </Card>
  );
}