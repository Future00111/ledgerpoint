import { useState, useEffect, createContext, useContext } from 'react';
import { base44 } from '@/api/base44Client';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [roles, setRoles] = useState({});
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const res = await base44.functions.invoke('getUserCompanies', {});
      const data = res.data || {};
      setCompanies(data.companies || []);
      setRoles(data.roles || {});
      if ((data.companies || []).length > 0) {
        setActiveCompany(prev => prev || data.companies[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = (company) => {
    setActiveCompany(company);
  };

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