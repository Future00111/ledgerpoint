import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { accounting } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import SetupWorkspace from '@/features/onboarding/SetupWorkspace';
import { deriveReadiness, loadReadiness, validDate } from '@/features/onboarding/model.mjs';
import { useGuidancePreference } from '@/features/onboarding/useGuidancePreference';

function CompanySetup({ company, accountId }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { guided, guidanceWarning, changeGuidance } = useGuidancePreference(accountId, company.id);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ loading: true, contexts: null, error: null });
  const version = useRef(0);
  useEffect(() => {
    const controller = new AbortController(), request = ++version.current;
    setState({ loading: true, contexts: null, error: null });
    loadReadiness(accounting, company.id, controller.signal, () => version.current === request)
      .then(contexts => { if (contexts && !controller.signal.aborted && version.current === request) setState({ loading: false, contexts, error: null }); })
      .catch(error => { if (!controller.signal.aborted && version.current === request) setState({ loading: false, contexts: null, error }); });
    return () => { controller.abort(); version.current++; };
  }, [company.id, tick]);
  let readiness = null, error = state.error;
  if (!validDate(date)) error = new Error('Choose a valid document date to review date-effective setup.');
  else if (state.contexts && !state.loading) {
    try { readiness = deriveReadiness(company.id, state.contexts, date); }
    catch (failure) { error = failure; }
  }
  return <SetupWorkspace company={company} date={date} onDateChange={setDate} readiness={readiness} error={error} loading={state.loading}
    onRefresh={() => setTick(value => value + 1)} guided={guided} onGuidedChange={changeGuidance} guidanceWarning={guidanceWarning} />;
}

export default function SetupWizard() {
  const { activeCompany, loading } = useCompany();
  const { user, isLoaded, isSignedIn } = useUser();
  if (loading || !isLoaded) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading your companies…</p>;
  if (!isSignedIn || !user?.id) return <p role="status" className="p-6 text-sm text-muted-foreground">Sign in to review business setup.</p>;
  if (!activeCompany) return <div className="workspace-panel mx-auto max-w-xl space-y-3 p-6"><h1 className="text-xl font-semibold">Start with your business</h1><p className="text-sm text-muted-foreground">Create a company or select one you already have access to. Setup checks use that company’s saved records.</p><Button asChild><Link to="/companies">Open Companies</Link></Button></div>;
  return <CompanySetup key={JSON.stringify([user.id, activeCompany.id])} company={activeCompany} accountId={user.id} />;
}
