import React from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { useAuth } from '@/lib/AuthContext';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
export default function DashboardHeader() {
  const { activeCompany } = useCompany(); const { user } = useAuth(); const s = useLedgerSnapshot(activeCompany?.id);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-primary">Your business at a glance</p><h1 className="mt-1 text-3xl font-semibold">{greeting}, {user?.first_name || 'there'}</h1><p className="mt-2 text-sm text-muted-foreground">{activeCompany?.name} · Figures from posted journals</p></div><Link to="/accounting/reports" className="rounded-xl border bg-card px-4 py-3 text-sm">{s.error ? 'Ledger unavailable — review' : !s.data ? 'Loading ledger…' : s.data.balance_sheet.balanced ? 'Ledger balanced · Open reports' : 'Ledger needs attention'}</Link></div>;
}
