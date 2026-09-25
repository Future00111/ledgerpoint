import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable AI Suggestions card — recent AI suggestions for a record.
// Until suggestions are generated, explains the section and points to Ask.
export default function AISuggestionsCard({ suggestions = [] }) {
  if (!suggestions.length) {
    return (
      <WorkspaceEmptyState
        icon={Lightbulb}
        title="No AI suggestions yet"
        description="Recent AI suggestions for this record will appear here. Generate insights from the AI Insights tab or ask a question below."
      />
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{s.text}</p>
                {s.when && <p className="text-xs text-muted-foreground">{s.when}</p>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}