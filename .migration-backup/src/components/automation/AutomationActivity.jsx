import React from 'react';
import { CheckCircle2, AlertCircle, Clock, Flag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { relativeTime } from '@/lib/format';

const STATUS_META = {
  success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  pending_approval: { icon: Flag, color: 'text-amber-600', bg: 'bg-amber-50' },
  skipped: { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50' },
  test: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
};

export default function AutomationActivity({ activities, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">No automation activity yet. Activity will appear here when automations run.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {activities.map((act) => {
        const meta = STATUS_META[act.status] || STATUS_META.skipped;
        return (
          <Card key={act.id} className="p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
              <meta.icon className={`w-4 h-4 ${meta.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{act.automation_name || 'Automation'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {act.trigger_summary || act.status}
                {act.actions_taken?.length > 0 && ` · ${act.actions_taken.join(', ')}`}
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(act.run_date)}</span>
          </Card>
        );
      })}
    </div>
  );
}