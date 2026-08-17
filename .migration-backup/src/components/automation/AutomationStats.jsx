import React from 'react';
import { Zap, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function AutomationStats({ automations, activities, loading }) {
  const active = automations.filter((a) => a.status === 'active').length;
  const totalRuns = automations.reduce((s, a) => s + (a.run_count || 0), 0);
  const totalSuccess = automations.reduce((s, a) => s + (a.success_count || 0), 0);
  const successRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 100;
  const pending = activities.filter((a) => a.status === 'pending_approval').length;

  const stats = [
    { label: 'Active Automations', value: active, icon: Zap, color: 'text-primary' },
    { label: 'Total Runs', value: totalRuns, icon: Activity, color: 'text-blue-600' },
    { label: 'Success Rate', value: `${successRate}%`, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Pending Approvals', value: pending, icon: AlertCircle, color: 'text-amber-600' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              <p className="text-lg font-semibold">{loading ? '—' : s.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}