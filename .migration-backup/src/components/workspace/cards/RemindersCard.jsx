import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

// Reusable Reminders card — scheduled reminders/follow-ups for a record.
// Until reminders exist, explains the section and points to Automation.
export default function RemindersCard({ reminders = [] }) {
  if (!reminders.length) {
    return (
      <WorkspaceEmptyState
        icon={Bell}
        title="No reminders"
        description="Scheduled reminders and follow-ups for this record will appear here. Set one up from the Automation module."
      />
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {reminders.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{r.text}</p>
                {r.when && <p className="text-xs text-muted-foreground">{r.when}</p>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}