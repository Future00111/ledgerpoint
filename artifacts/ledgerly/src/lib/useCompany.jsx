import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { useUser } from '@clerk/react';
import { readCompanySelection, rememberCompanySelection, restoreAuthorizedCompany, requireAuthorizedCompany } from './companySelection.mjs';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user, isSignedIn, isLoaded } = useUser();
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState({});
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState(null);
  const [selectionWarning, setSelectionWarning] = useState('');
  const requestVersion = useRef(0);
  const account = useRef(null);
  const authorizedCompanies = useRef([]);
  const selectedId = useRef(null);
  const persistenceWarning = () => setSelectionWarning('Your browser could not remember the selected company. Select it again after reloading.');

  const loadCompanies = useCallback(async () => {
    const actor = user?.id;
    if (!isLoaded || !isSignedIn || !actor || account.current !== actor) return null;
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      const res = await fetch('/api/companies', { credentials: 'include' });
      if (!res.ok) throw new Error('Authorized companies could not be loaded.');
      const data = await res.json();
      if (version !== requestVersion.current || account.current !== actor) return null;
      if (!Array.isArray(data.companies) || data.companies.some(company => !company?.id) ||
          !data.roles || typeof data.roles !== 'object' || Array.isArray(data.roles) ||
          data.companies.some(company => typeof data.roles[company.id] !== 'string')) {
        throw new Error('The company membership response could not be verified.');
      }
      const nextCompanies = data.companies;
      let preference = selectedId.current;
      setSelectionWarning('');
      if (!preference) {
        try { preference = readCompanySelection(window.localStorage, actor); }
        catch { persistenceWarning(); }
      }
      const selected = restoreAuthorizedCompany(nextCompanies, preference);
      authorizedCompanies.current = nextCompanies;
      selectedId.current = selected?.id ?? null;
      setCompanies(nextCompanies);
      setRoles(data.roles);
      setActiveCompany(selected);
      setLoadedFor(actor);
      try { rememberCompanySelection(window.localStorage, actor, selected?.id); }
      catch { persistenceWarning(); }
      return nextCompanies;
    } catch (e) {
      if (version !== requestVersion.current || account.current !== actor) return null;
      console.error('Failed to load companies:', e);
      authorizedCompanies.current = [];
      setCompanies([]); setRoles({}); setActiveCompany(null); setLoadedFor(actor);
      return null;
    } finally {
      if (version === requestVersion.current && account.current === actor) setLoading(false);
    }
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    account.current = isLoaded && isSignedIn ? user?.id : null;
    authorizedCompanies.current = []; selectedId.current = null;
    setCompanies([]); setRoles({}); setActiveCompany(null); setLoadedFor(null); setSelectionWarning('');
    if (account.current) loadCompanies();
    else setLoading(!isLoaded);
    return () => { requestVersion.current++; };
  }, [isLoaded, isSignedIn, user?.id, loadCompanies]);

  const switchCompany = (company) => {
    if (!isSignedIn || account.current !== user?.id) throw new Error('Sign in before selecting a company.');
    const selected = requireAuthorizedCompany(authorizedCompanies.current, company?.id);
    selectedId.current = selected.id;
    setActiveCompany(selected);
    setSelectionWarning('');
    try { rememberCompanySelection(window.localStorage, user.id, selected.id); }
    catch { persistenceWarning(); }
  };
  const current = isSignedIn && loadedFor === user?.id;

  return (
    <CompanyContext.Provider value={{ companies: current ? companies : [], activeCompany: current ? activeCompany : null,
      switchCompany, loadCompanies, loading: loading || (isSignedIn && !current), roles: current ? roles : {}, selectionWarning }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
