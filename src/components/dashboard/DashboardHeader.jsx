import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useBusinessHealth, healthOneLiner, OPEN_HEALTH_EVENT } from './useBusinessHealth';
import BusinessHealthDialog from './BusinessHealthDialog';
import { ChevronRight, ListChecks } from 'lucide-react';

// Compact command bar: greeting + natural-language health line + today's
// priority pill + clickable Business Health score (opens details).
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
    base44
      .auth
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
  const color =
    score == null
      ? 'text-muted-foreground'
      : score >= 90
      ? 'text-emerald-600'
      : score >= 70
      ? 'text-amber-600'
      : 'text-rose-600';
  const dot =
    score == null
      ? 'bg-muted-foreground'
      : score >= 90
      ? 'bg-emerald-500'
      : score >= 70
      ? 'bg-amber-500'
      : 'bg-rose-500';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{healthOneLiner(score)}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {health.priority && !health.loading && (
          <Link
            to={health.priority.route}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:shadow-sm transition-shadow"
          >
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <ListChecks className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground leading-tight">Today’s priority</span>
              <span className="block font-medium text-foreground leading-tight truncate max-w-[200px]">
                {health.priority.label}
              </span>
            </span>
          </Link>
        )}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:shadow-sm transition-shadow"
        >
          <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
          <span className="text-[11px] text-muted-foreground">Business Health</span>
          <span className={`font-semibold ${color}`}>{health.loading ? '…' : `${score}/100`}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <BusinessHealthDialog open={open} onClose={() => setOpen(false)} health={health} userName={firstName} />
    </div>
  );
}