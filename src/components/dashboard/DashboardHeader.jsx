import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useBusinessHealth, healthStatus, healthStatusTone, OPEN_HEALTH_EVENT } from './useBusinessHealth';
import BusinessHealthDialog from './BusinessHealthDialog';
import { ChevronRight, ListChecks } from 'lucide-react';

// Compact single-row header: greeting + today's priority + Business Health
// (status label + score). Clicking health opens the detailed breakdown.
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHeader() {
  const { activeCompany } = useCompany();
  const [userName, setUserName] = useState('');
  const [open, setOpen] = useState(false);
  const health = useBusinessHealth(activeCompany?.id);

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => setUserName((u?.full_name || '').split(' ')[0]))
      .catch(() => setUserName(''));
  }, []);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(OPEN_HEALTH_EVENT, h);
    return () => window.removeEventListener(OPEN_HEALTH_EVENT, h);
  }, []);

  const firstName = userName || 'there';
  const score = health.score;
  const status = healthStatus(score);
  const tone = healthStatusTone(score);
  const dot =
    score == null
      ? 'bg-muted-foreground'
      : score >= 90
      ? 'bg-emerald-500'
      : score >= 70
      ? 'bg-amber-500'
      : score >= 50
      ? 'bg-orange-500'
      : 'bg-rose-500';

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">
          {greeting()}, {firstName} 👋
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {health.priority && !health.loading && (
          <Link
            to={health.priority.route}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm hover:shadow-sm transition-shadow"
          >
            <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <ListChecks className="w-3.5 h-3.5" />
            </span>
            <span className="min-w-0 hidden sm:block">
              <span className="block text-[10px] text-muted-foreground leading-tight">Today’s priority</span>
              <span className="block text-xs font-medium text-foreground leading-tight truncate max-w-[180px]">
                {health.priority.label}
              </span>
            </span>
            <span className="sm:hidden text-xs font-medium truncate max-w-[140px]">{health.priority.label}</span>
          </Link>
        )}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm hover:shadow-sm transition-shadow"
        >
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="text-[11px] text-muted-foreground">Business Health</span>
          <span className={`text-xs font-semibold ${tone}`}>{health.loading ? '…' : status}</span>
          <span className="text-[11px] text-muted-foreground">{health.loading ? '' : `${score}/100`}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <BusinessHealthDialog open={open} onClose={() => setOpen(false)} health={health} userName={firstName} />
    </div>
  );
}