import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/useCompany';
import { PayRecordsWorkspace } from './PayRecordsWorkspace';
export { PayRecordsWorkspace, PayRecordDetails } from './PayRecordsWorkspace';

export default function PayRecords() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { activeCompany, roles, loading, loadCompanies } = useCompany();
  if (loading || isLoadingAuth) return <div className="workspace-page" aria-busy="true">Checking company access…</div>;
  return <PayRecordsWorkspace companyId={activeCompany?.id} companyName={activeCompany?.name}
    actorId={isAuthenticated ? user?.id : null} role={roles[activeCompany?.id]} onRefreshAccess={loadCompanies} />;
}
