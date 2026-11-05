import { useEffect, useMemo, useState } from 'react';
import { accounting } from '@/api/accountingDocuments.mjs';
import { dateError, requestRead, validateReport, visibleRead } from './model.mjs';

export function useReportRead(companyId, from, to) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ key: null, data: null, loading: true, error: null });
  const validation = dateError(from, to), enabled = Boolean(companyId) && !validation;
  // A→B→A is a new read too; a prior A result must not regain export authority.
  const key = useMemo(() => Symbol('report request'), [companyId, from, to, refresh]);
  useEffect(() => {
    if (!enabled) return;
    const request = requestRead({ key, load: signal => accounting.reports(companyId, from, to, signal),
      validate: value => validateReport(value, from, to), publish: setState });
    return request.cancel;
  }, [companyId, from, to, enabled, key]);
  return { ...visibleRead(state, key, enabled), validation, refresh: () => setRefresh(value => value + 1) };
}
