import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, ChevronRight } from 'lucide-react';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable Automation card — automations related to the current record.
// When none exist, it explains and links to the Automation module (no dead end).
export default function AutomationCard({ automations = [] }) {
  const nav = useNavigate();

  if (!automations.length) {
    return (
      <WorkspaceEmptyState
        icon={Zap}
        title="No automations"
        description="Automations triggered by or related to this record will appear here. Set one up to automate reminders and follow-ups."
        actionLabel="Open Automation"
        onAction={() => nav('/automation')}
      />
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {automations.map((a, i) => (
            <li
              key={i}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => nav('/automation')}
            >
              <Zap className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.name}</p>
                {a.status && <p className="text-xs text-muted-foreground capitalize">{a.status}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}