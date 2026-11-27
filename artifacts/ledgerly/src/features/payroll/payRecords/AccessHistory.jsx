import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/useCompany';
import { AccessHistoryWorkspace } from './AccessHistoryWorkspace';

export default function AccessHistory() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { activeCompany, roles, loading, companyLoadFailed, loadCompanies } = useCompany();
  if (loading || isLoadingAuth) return <div className="workspace-page" aria-busy="true">Checking company access…</div>;
  return <AccessHistoryWorkspace companyId={activeCompany?.id} companyName={activeCompany?.name}
    actorId={isAuthenticated ? user?.id : null} role={roles[activeCompany?.id]} companyLoadFailed={companyLoadFailed} onRefreshAccess={loadCompanies} />;
}
