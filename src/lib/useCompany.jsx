import { useState, useEffect, createContext, useContext } from 'react';
import { base44 } from '@/api/base44Client';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const list = await base44.entities.Company.list();
      setCompanies(list);
      if (list.length > 0 && !activeCompany) {
        setActiveCompany(list[0]);
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
    <CompanyContext.Provider value={{ companies, activeCompany, switchCompany, loadCompanies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}