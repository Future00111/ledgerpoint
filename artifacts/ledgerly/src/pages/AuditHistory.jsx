import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { SkeletonRows } from '@/components/accounting/AccountingUI';
import EmptyState from '@/components/workspace/EmptyState';
import PageHeader from '@/components/workspace/PageHeader';
import { auditReview } from '@/api/auditReview.mjs';
import { requestRead, visibleRead } from '@/features/reporting/model.mjs';
import { initialFilters, filtersError, validateAudit, guardedExport } from '@/features/auditReview/model.mjs';
import AuditWorkspace from '@/features/auditReview/AuditWorkspace';

function CompanyAuditHistory({ companyId }) {
  const [filters, setFilters] = useState(initialFilters), [applied, setApplied] = useState(initialFilters);
  const [cursors, setCursors] = useState([null]), [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ key: null, data: null, loading: true, error: null });
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(null);
  const exportController = useRef(null), alive = useRef(true), currentKey = useRef(null);
  const key = useMemo(() => Symbol('audit request'), [companyId, applied, cursors, refresh]);
  currentKey.current = key;
  useEffect(() => { alive.current = true; return () => { alive.current = false; exportController.current?.abort(); }; }, []);
  useEffect(() => {
    exportController.current?.abort(); setExporting(false); setExportError(null);
    const request = requestRead({ key, load: signal => auditReview.list(companyId, { ...applied, cursor: cursors.at(-1), limit: 50 }, signal),
      validate: data => validateAudit(data, companyId, applied), publish: setState });
    return request.cancel;
  }, [companyId, applied, cursors, refresh, key]);
  const shown = visibleRead(state, key), validation = filtersError(filters);
  const dirty = JSON.stringify({ ...filters, q: filters.q.trim() }) !== JSON.stringify(applied);
  const apply = event => { event.preventDefault(); if (validation) return; setApplied({ ...filters, q: filters.q.trim() }); setCursors([null]); };
  const doRefresh = () => { setCursors([null]); setRefresh(value => value + 1); };
  const doExport = async () => {
    if (!shown.data || shown.loading || validation || exporting || dirty) return;
    const controller = new AbortController(); exportController.current = controller; const token = key;
    const current = () => alive.current && currentKey.current === token && exportController.current === controller;
    setExporting(true); setExportError(null);
    try {
      await guardedExport({ client: auditReview, company: companyId, filters: applied, signal: controller.signal, isCurrent: current,
        deliver: csv => { const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a');
          anchor.href = url; anchor.download = 'ledgerpoint-audit-history.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } });
    } catch (error) { if (current() && !controller.signal.aborted) setExportError(error); }
    finally { if (current()) setExporting(false); }
  };
  return <AuditWorkspace filters={filters} onFilter={(key, value) => { exportController.current?.abort(); setExporting(false); setExportError(null); setFilters(old => ({ ...old, [key]: value })); }} onApply={apply}
    {...shown} dirty={dirty} validation={validation} onRefresh={doRefresh} onExport={doExport} exporting={exporting} exportError={exportError}
    page={cursors.length - 1} onPrevious={() => setCursors(old => old.slice(0, -1))} onNext={cursor => setCursors(old => [...old, cursor])} />;
}
export default function AuditHistory() {
  const { activeCompany, loading } = useCompany();
  if (loading) return <div className="workspace-page"><SkeletonRows rows={6} /></div>;
  if (!activeCompany) return <div className="workspace-page"><PageHeader title="Audit history" /><EmptyState icon={History} title="Choose your business" description="Select a company to review its recorded history." action={<Button asChild><Link to="/companies">Open companies</Link></Button>} /></div>;
  return <CompanyAuditHistory key={activeCompany.id} companyId={activeCompany.id} />;
}
