import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useBusinessHealth, healthStatus, healthStatusTone, OPEN_HEALTH_EVENT } from './useBusinessHealth';
import BusinessHealthDialog from './BusinessHealthDialog';
import StatusCard from './StatusCard';
import { ListChecks, Activity } from 'lucide-react';

// Compact single-row header: greeting + standardised status cards (Today's
// Priority and Business Health). Both cards use the shared StatusCard
// component so they are visually identical. Clicking Business Health opens
// the detailed breakdown.
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function healthTone(score) {
  if (score == null) return 'muted';
  if (score >= 90) return 'emerald';
  if (score >= 70) return 'amber';
  if (score >= 50) return 'orange';
  return 'rose';
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
  const status = health.loading ? '…' : healthStatus(score);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">
          {greeting()}, {firstName} 👋
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {health.priority && !health.loading && (
          <StatusCard
            as={Link}
            to={health.priority.route}
            icon={ListChecks}
            kicker="Today's priority"
            title={health.priority.label}
          />
        )}
        <StatusCard
          icon={Activity}
          kicker="Business health"
          title={status}
          meta={health.loading ? '' : `${score}/100`}
          tone={healthTone(score)}
          onClick={() => setOpen(true)}
        />
      </div>

      <BusinessHealthDialog open={open} onClose={() => setOpen(false)} health={health} userName={firstName} />
    </div>
  );
}