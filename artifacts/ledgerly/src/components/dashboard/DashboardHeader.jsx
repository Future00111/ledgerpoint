import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
import PageHeader from '@/components/workspace/PageHeader';
export default function DashboardHeader() {
  const { activeCompany } = useCompany();
  const snapshot = useLedgerSnapshot(activeCompany?.id);
  return <PageHeader eyebrow="Your workspace" title="My dashboard" description={`${activeCompany?.name ?? 'Your company'} · Your saved widgets and templates`}
    actions={<Link to="/reports" className="inline-flex min-h-11 items-center rounded-lg border bg-card px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{snapshot.error ? 'Ledger unavailable — open reports' : !snapshot.data ? 'Loading ledger…' : snapshot.data.balance_sheet.balanced ? 'Ledger balanced · Open reports' : 'Ledger needs attention · Open reports'}</Link>} />;
}
