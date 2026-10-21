import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { accounting, penceToDisplay } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';

const quarterStart = () => { const d = new Date(); const m = Math.floor(d.getMonth() / 3) * 3; return `${d.getFullYear()}-${String(m + 1).padStart(2, '0')}-01`; };
const iso = () => new Date().toISOString().slice(0, 10);
const BOXES = [['1', 'VAT due on sales', 'box1_pence'], ['4', 'VAT reclaimed', 'box4_pence'], ['5', 'Net VAT', 'box5_pence'], ['6', 'Sales ex VAT', 'box6_pence'], ['7', 'Purchases ex VAT', 'box7_pence']];

/** Authoritative VAT workings from posted journals, shown on the normal VAT Returns page. */
export default function VatWorkingsPanel() {
  const { activeCompany } = useCompany();
  const [from, setFrom] = useState(quarterStart());
  const [to, setTo] = useState(iso());
  const [vat, setVat] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!activeCompany) return;
    const c = new AbortController(); setVat(null); setError('');
    accounting.reports(activeCompany.id, from, to, c.signal).then(d => setVat(d.vat)).catch(e => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, [activeCompany?.id, from, to]);
  if (!activeCompany) return null;
  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5" data-testid="panel-vat-workings">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Authoritative VAT workings</p>
          <h2 className="mt-1 text-lg font-semibold">From posted journals only</h2>
          <p className="text-sm text-muted-foreground">Movements posted {from} to {to}. Legacy figures below may be incomplete.</p>
        </div>
        <div className="flex items-end gap-2 text-sm">
          <label>From<input type="date" data-testid="input-vat-from" className="ml-1 rounded-md border bg-background p-1.5" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label>To<input type="date" data-testid="input-vat-to" className="ml-1 rounded-md border bg-background p-1.5" value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error} <Link to="/accounting/setup" className="underline">Check posting setup</Link></p>}
      {vat?.applicable === false ? <p className="mt-4 rounded-xl border bg-card p-4 text-sm" data-testid="text-not-vat-registered">Not VAT registered. There are no VAT return workings for this company.</p> : <>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BOXES.map(([b, l, k]) => (
          <div key={b} className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">Box {b} · {l}</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums">{vat ? penceToDisplay(vat[k]) : <span className="inline-block h-5 w-16 animate-pulse rounded bg-muted" />}</p>
          </div>
        ))}
      </div>
      </>}
      <Link to={`/accounting/reports?tab=vat&from=${from}&to=${to}`} data-testid="link-vat-report" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Open full VAT and ledger report</Link>
    </section>
  );
}
