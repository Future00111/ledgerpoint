import { Link } from 'react-router-dom';
import { AlertTriangle, Lock, BookOpen } from 'lucide-react';
import { penceToDisplay } from '@/api/accountingDocuments.mjs';

export function StatusPill({ status }) {
  const styles = {
    draft: 'bg-amber-50 text-amber-900 ring-amber-200',
    posted: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  };
  return (
    <span data-testid={`status-${status}`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status] || 'bg-muted text-muted-foreground ring-border'}`}>
      {status === 'posted' && <Lock className="h-3 w-3" />}
      {status === 'posted' ? 'Posted to accounts' : status === 'draft' ? 'Draft' : status}
    </span>
  );
}

export function Money({ value, className = '' }) {
  return <span className={`tabular-nums font-mono ${className}`}>{penceToDisplay(value)}</span>;
}

export function ConfigErrors({ errors }) {
  if (!errors?.length) return null;
  return (
    <div role="alert" data-testid="alert-config" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
      <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Accounting setup needs attention before posting</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      <Link to="/accounting/setup" data-testid="link-fix-config" className="mt-3 inline-block font-medium text-orange-900 underline underline-offset-4">Open accounting setup</Link>
    </div>
  );
}

export function JournalLink({ id }) {
  if (!id) return null;
  return (
    <Link to={`/accounting/journals/${encodeURIComponent(id)}`} data-testid="link-journal" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
      <BookOpen className="h-4 w-4" />View journal
    </Link>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-medium">{error.message}{error.code ? ` (${error.code})` : ''}</p>
      {onRetry && <button type="button" onClick={onRetry} data-testid="button-retry" className="mt-2 underline underline-offset-4">Retry</button>}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }) {
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted/70" />)}</div>;
}

export const today = () => new Date().toISOString().slice(0, 10);

export function PartyLedgerLink({ partyId }) {
  if (!partyId) return null;
  return <Link to={`/accounting/reports?tab=parties&party_id=${encodeURIComponent(partyId)}`} data-testid={`link-party-ledger-${partyId}`} className="inline-block px-1 text-xs font-medium text-primary hover:underline">Posted ledger history</Link>;
}

export function LedgerNotice({ tab = 'tb', party, text = 'Authoritative figures from posted journals' }) {
  return (
    <Link to={`/accounting/reports?tab=${tab}${party ? `&party_id=${encodeURIComponent(party)}` : ''}`} data-testid="link-ledger-reports" className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10">
      <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />{text}</span>
      <span className="font-medium text-primary">Open ledger reports</span>
    </Link>
  );
}
