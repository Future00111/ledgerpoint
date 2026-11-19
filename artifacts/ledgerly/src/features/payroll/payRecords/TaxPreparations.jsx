import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/useCompany';
import { TaxPreparationsWorkspace } from './TaxPreparationsWorkspace';

export default function TaxPreparations() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { activeCompany, roles, loading, loadCompanies } = useCompany();
  if (loading || isLoadingAuth) return <div className="workspace-page" aria-busy="true">Checking company access…</div>;
  return <TaxPreparationsWorkspace companyId={activeCompany?.id} companyName={activeCompany?.name}
    actorId={isAuthenticated ? user?.id : null} role={roles[activeCompany?.id]} onRefreshAccess={loadCompanies} />;
}
