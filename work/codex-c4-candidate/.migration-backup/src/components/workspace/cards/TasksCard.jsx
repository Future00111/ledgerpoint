import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable Tasks card — outstanding tasks/reminders for a record.
// Whole row toggles completion (no separate button).
export default function TasksCard({ tasks = [], onToggle }) {
  if (!tasks.length) {
    return (
      <WorkspaceEmptyState
        icon={CheckSquare}
        title="No tasks"
        description="Outstanding tasks and reminders for this record will appear here. Create one from the Automation module."
      />
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {tasks.map((t, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => onToggle?.(t)}
            >
              {t.done ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', t.done && 'line-through text-muted-foreground')}>{t.title}</p>
                {t.due && <p className="text-xs text-muted-foreground">Due {t.due}</p>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}