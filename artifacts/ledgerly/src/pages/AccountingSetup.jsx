import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { accounting } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ConfigErrors, ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';

const ROLES = [
  ['receivables', 'Trade debtors (receivables)', 'Customer balances from sales invoices and credits'],
  ['payables', 'Trade creditors (payables)', 'Supplier balances from bills and credits'],
  ['revenue', 'Sales revenue', 'Net value of sales'],
  ['expense', 'Purchases expense', 'Net value of bills (plus unrecovered VAT)'],
  ['output_vat', 'Output VAT', 'VAT charged on sales'],
  ['input_vat', 'Input VAT', 'Recoverable VAT on eligible purchases'],
];
const sel = 'mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm';

export default function AccountingSetup() {
  const { activeCompany, roles } = useCompany();
  const { toast } = useToast();
  const [cfg, setCfg] = useState(null);
  const [map, setMap] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState({ start_date: '', end_date: '', financial_year_label: '' });
  const [tick, setTick] = useState(0);
  const canEdit = ['owner', 'admin', 'accountant'].includes(roles?.[activeCompany?.id]);

  useEffect(() => {
    if (!activeCompany) return;
    const c = new AbortController(); setCfg(null); setError(null);
    accounting.configuration(activeCompany.id, c.signal).then(d => {
      setCfg(d);
      const m = d.mappings || {};
      setMap(Object.fromEntries(ROLES.map(([k]) => [k, typeof m[k] === 'object' && m[k] ? (m[k].account_id ?? m[k].id ?? '') : (m[k] ?? '')])));
    }).catch(e => { if (!c.signal.aborted) setError(e); });
    return () => c.abort();
  }, [activeCompany?.id, tick]);

  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;
  const vatRegistered = cfg?.company?.vat_registered === true;
  const roles_ = ROLES.filter(([k]) => vatRegistered || (k !== 'output_vat' && k !== 'input_vat'));
  const complete = roles_.every(([k]) => map[k]);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await accounting.saveConfiguration(activeCompany.id, cfg.revision, Object.fromEntries(roles_.map(([k]) => [k, map[k]])));
      toast({ title: 'Account mapping saved' }); setTick(t => t + 1);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const addPeriod = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await accounting.createPeriod(activeCompany.id, { start_date: period.start_date, end_date: period.end_date, ...(period.financial_year_label ? { financial_year_label: period.financial_year_label } : {}) }); toast({ title: 'Open period created' }); setPeriod({ start_date: '', end_date: '', financial_year_label: '' }); setTick(t => t + 1); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  const suggestedYear = period.end_date ? `Financial year ending ${period.end_date.slice(0, 4)}` : '';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><p className="text-sm font-medium text-primary">Accounting · Setup</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Posting setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose which accounts from your chart receive each side of a posting. Nothing is guessed.</p></header>
      <ErrorBox error={error} onRetry={() => setTick(t => t + 1)} />
      {!cfg && !error && <SkeletonRows rows={6} />}
      {cfg && <>
        <ConfigErrors errors={(cfg.configuration_errors ?? []).length ? cfg.configuration_errors : null} />
        <section className="space-y-5 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Account mapping</h2>
            <label className="flex items-center gap-2 text-sm"><span className="font-medium">Business accounting</span>
              <select data-testid="select-business-basis" className="rounded-md border bg-background p-1.5 text-sm" value="accrual" onChange={() => {}}>
                <option value="accrual">Accrual</option>
              </select></label></div>
          {(cfg.accounts ?? []).length === 0 && <p className="text-sm">No accounts in the chart yet. <Link className="text-primary underline" to="/chart-of-accounts">Open Chart of Accounts</Link>.</p>}
          <fieldset disabled={!canEdit || busy} className="grid gap-4 sm:grid-cols-2">
            {roles_.map(([k, l, d]) => <div key={k}><Label htmlFor={`m-${k}`}>{l}</Label>
              <select id={`m-${k}`} data-testid={`select-map-${k}`} className={sel} value={map[k] || ''} onChange={e => setMap(m => ({ ...m, [k]: e.target.value }))}>
                <option value="">Not mapped</option>
                {(cfg.accounts ?? []).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
              </select><p className="mt-1 text-xs text-muted-foreground">{d}</p></div>)}
          </fieldset>
          <p className="text-xs text-muted-foreground">Business accounting basis is accrual: income and costs are recognised on the document date. This is separate from the company's VAT accounting basis{cfg.company?.vat_accounting_basis ? ` (currently ${cfg.company.vat_accounting_basis})` : ''}.</p>
          <div className="flex justify-end"><Button onClick={save} disabled={!canEdit || busy || !complete} data-testid="button-save-mapping">Save mapping</Button></div>
          {!canEdit && <p className="text-xs text-muted-foreground">Your role can view but not change the mapping.</p>}
        </section>
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Accounting periods</h2>
          {(cfg.periods ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No periods. Documents can only post into an open period.</p> :
            <ul className="divide-y rounded-lg border text-sm">{cfg.periods.map(p => <li key={p.id} className="flex justify-between px-4 py-2.5"><span className="tabular-nums">{p.start_date} → {p.end_date}{p.financial_year_label && <span className="ml-2 text-muted-foreground">{p.financial_year_label}</span>}</span><span className="capitalize text-muted-foreground">{p.status}</span></li>)}</ul>}
          <form onSubmit={addPeriod} className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div><Label htmlFor="ps">Start</Label><Input id="ps" type="date" required value={period.start_date} onChange={e => setPeriod(p => ({ ...p, start_date: e.target.value }))} /></div>
            <div><Label htmlFor="pe">End</Label><Input id="pe" type="date" required value={period.end_date} onChange={e => setPeriod(p => ({ ...p, end_date: e.target.value }))} /></div>
            <div><Label htmlFor="fy">Financial year <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="fy" data-testid="input-fy-label" maxLength={80} placeholder={suggestedYear || 'e.g. Financial year ending 2026'} value={period.financial_year_label} onChange={e => setPeriod(p => ({ ...p, financial_year_label: e.target.value }))} />
              <p className="mt-1 text-xs text-muted-foreground">Leave blank to derive from the dates.</p></div>
            <Button type="submit" disabled={!canEdit || busy} data-testid="button-add-period">Open period</Button>
          </form>
        </section>
      </>}
    </div>
  );
}
