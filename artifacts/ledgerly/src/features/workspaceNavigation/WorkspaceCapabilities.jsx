import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { accounting } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { availableShortcuts, workspacePermissions, currentWorkspaceState, loadWorkspaceCapabilities } from './model.mjs';

const Context = createContext(null);
const empty = { key: null, companyId: null, loading: false, documents: null, payments: null, error: null };

export function WorkspaceCapabilities({ children }) {
  const { activeCompany, roles } = useCompany();
  const companyId = activeCompany?.id;
  const role = roles?.[companyId];
  const [state, setState] = useState(empty);
  const [version, setVersion] = useState(0);
  const latest = useRef(null);
  const key = JSON.stringify([companyId, role, version]); latest.current = key;
  const refresh = useCallback(() => { setState(empty); setVersion(value => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ ...empty, key, companyId, loading: Boolean(companyId) });
    if (companyId) loadWorkspaceCapabilities(accounting, companyId, controller.signal, () => latest.current === key)
      .then(result => { if (result) setState({ ...result, key }); });
    return () => controller.abort();
  }, [key, companyId, role, version]);
  // A role/company change must close permissions before the new effect runs.
  const current = currentWorkspaceState(state, companyId, key) ?? empty;
  const permissions = workspacePermissions(companyId, current);
  return <Context.Provider value={{ ...current, permissions, actions: availableShortcuts(companyId, current), refresh }}>{children}</Context.Provider>;
}
export function useWorkspaceCapabilities() {
  return useContext(Context) ?? { ...empty, permissions: { drafts: false, payments: false }, actions: [], refresh: () => {} };
}
