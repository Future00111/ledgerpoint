import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { accounting } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { downloadCsv } from '@/lib/ledgerCsv.mjs';
import VatWorkingsReview from '@/features/vatPreparation/VatWorkingsReview';
import { periodFromParams, periodError, MIN_DATE, MAX_DATE, scopeKey, visibleState, requestWorkings, workingsRows } from '@/features/vatPreparation/model.mjs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { periodPreset } from '@/features/reporting/model.mjs';

function CompanyVatWorkings({ company }) {
  const [params, setParams] = useSearchParams();
  const period = periodFromParams(params);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ key: null, data: null, loading: true, error: null });
  const { from, to } = period;
  const validation = periodError(from, to);
  const key = scopeKey(company.id, from, to, refresh);
  const current = visibleState(state, key);
  const changePeriod = values => { const next = new URLSearchParams(params); for (const [field, value] of Object.entries(values)) next.set(field, value); setParams(next, { replace: true }); };
  useEffect(() => {
    setState({ key, data: null, loading: !validation, error: null });
    if (validation) return;
    const request = requestWorkings({ companyId: company.id, from, to, key, load: accounting.reports, publish: setState });
    return request.cancel;
  }, [company.id, from, to, key, validation]);

  return <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 sm:p-5" data-testid="panel-vat-workings">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Posted VAT workings</p><h2 className="mt-1 text-lg font-semibold">Review your VAT period</h2><p className="mt-1 text-sm text-muted-foreground">{company.name} · from posted invoices, bills and credits</p></div>
      <div className="flex flex-wrap gap-3 text-sm">{[['from', 'From'], ['to', 'To']].map(([field, label]) => <label key={field} className="flex flex-col gap-1 text-xs font-medium">{label}<Input type="date" min={MIN_DATE} max={MAX_DATE} data-testid={`input-vat-${field}`} aria-invalid={Boolean(validation)} aria-describedby={validation ? 'vat-period-error' : 'vat-scope-note'} value={period[field]} onChange={e => changePeriod({ [field]: e.target.value })} /></label>)}</div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2" aria-label="VAT period shortcuts"><Button size="sm" variant="outline" onClick={() => changePeriod(periodPreset('quarter'))}>This quarter to date</Button><Button size="sm" variant="outline" onClick={() => changePeriod(periodPreset('last-month'))}>Last month</Button></div>
    <p id="vat-scope-note" className="mt-4 rounded-lg border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">Read-only preparation for the standard VAT scheme on an invoice basis. This review covers boxes 1, 4, 5, 6 and 7 only; it is not a complete nine-box VAT return or an HMRC submission. Changing dates does not create or file a return.</p>
    {validation ? <p role="alert" id="vat-period-error" className="mt-4 text-sm text-red-800">{validation}</p> : <>
      <VatWorkingsReview key={key} companyId={company.id} companyName={company.name} reviewScope={key} data={current.data} loading={current.loading} error={current.error} onRetry={() => setRefresh(value => value + 1)} onExport={() => { if (current.data?.vat.applicable) downloadCsv(`vat-workings-${from}-${to}.csv`, workingsRows(current.data, company.name)); }} />
      <Link to={`/accounting/reports?tab=vat&from=${from}&to=${to}`} data-testid="link-vat-report" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Open VAT and ledger reports</Link>
    </>}
  </section>;
}

/** A company switch unmounts its complete review and cancels outstanding reads. */
export default function VatWorkingsPanel() {
  const { activeCompany } = useCompany();
  return activeCompany ? <CompanyVatWorkings key={activeCompany.id} company={activeCompany} /> : null;
}
