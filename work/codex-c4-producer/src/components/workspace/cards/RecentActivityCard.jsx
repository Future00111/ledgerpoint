import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable Recent Activity card — a flat list of the most recent events for a
// record. Used in activity panels and overview tabs.
export default function RecentActivityCard({ activities = [] }) {
  if (!activities.length) {
    return (
      <WorkspaceEmptyState
        icon={Activity}
        title="No recent activity"
        description="Recent events for this record will appear here automatically."
      />
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {activities.map((a, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              {a.icon && <a.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm">{a.text}</p>
                {a.time && <p className="text-xs text-muted-foreground">{a.time}</p>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}