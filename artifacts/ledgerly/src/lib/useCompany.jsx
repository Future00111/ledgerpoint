import { useState, useEffect, createContext, useContext } from 'react';
import { useUser } from '@clerk/react';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user, isSignedIn, isLoaded } = useUser();
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState({});
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadCompanies();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user?.id]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/companies', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCompanies(data.companies || []);
      setRoles(data.roles || {});
      setActiveCompany((prev) => prev ?? data.companies?.[0] ?? null);
    } catch (e) {
      console.error('Failed to load companies:', e);
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = (company) => setActiveCompany(company);

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, switchCompany, loadCompanies, loading, roles }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
