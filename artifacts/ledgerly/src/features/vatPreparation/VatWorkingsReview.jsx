import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw, Search } from 'lucide-react';
import { KINDS, docPath, penceToDisplay } from '@/api/accountingDocuments.mjs';
import { JournalLink } from '@/components/accounting/AccountingUI';
import { downloadCsv } from '@/lib/ledgerCsv.mjs';
import { BOXES, sourceDocuments, selectedSourceDocuments, filteredSourceRows, scopeKey, visibleSourceFilter, workingsError } from './model.mjs';
import VatCoverageReview from './VatCoverageReview';

export default function VatWorkingsReview({ data, loading, error, onRetry, onExport, companyId, companyName, reviewScope = 0 }) {
  const key = scopeKey(companyId, data?.from, data?.to, reviewScope);
  const [filter, setFilter] = useState({ key, selected: 'all', search: '' });
  const [exportError, setExportError] = useState(null);
  const { selected, search } = visibleSourceFilter(filter, key);
  useEffect(() => { setFilter({ key, selected: 'all', search: '' }); setExportError(null); }, [key]);
  const setSelected = value => { setFilter({ key, selected: value, search }); setExportError(null); };
  const setSearch = value => { setFilter({ key, selected, search: value }); setExportError(null); };
  if (error) return <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
    <p className="font-medium">{workingsError(error)}</p>
    <div className="mt-3 flex flex-wrap gap-4"><button type="button" onClick={onRetry} className="font-medium underline" data-testid="button-retry-vat">Retry workings</button><Link to="/accounting/setup" className="underline">Check accounting setup</Link></div>
  </div>;
  if (loading || !data) return <div role="status" aria-live="polite" className="mt-5 rounded-xl border bg-card p-5 text-sm text-muted-foreground" data-testid="status-vat-loading">Loading posted VAT workings…</div>;
  if (data.vat.applicable === false) return <p className="mt-5 rounded-xl border bg-card p-5 text-sm" data-testid="text-not-vat-registered">Not VAT registered. There are no VAT return workings for this company.</p>;
  const box = BOXES.find(b => b.box === selected);
  const allSources = sourceDocuments(data);
  const sources = selectedSourceDocuments(data, selected, search);
  const position = BigInt(data.vat.net_payable_pence) === 0n ? 'No net VAT for this period' : data.vat.repayment ? 'Net VAT to reclaim' : 'Net VAT to pay';
  const exportSources = () => {
    setExportError(null);
    try {
      downloadCsv(`vat-filtered-sources-${data.from}-${data.to}.csv`, filteredSourceRows(data, { companyId, companyName, selected, search }));
    } catch {
      setExportError({ key, message: 'The filtered source export could not be created. Refresh the workings and try again.' });
    }
  };

  return <div className="mt-5 space-y-5" data-testid="vat-workings-ready">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <p className="text-sm"><span className="font-medium">{position}</span><span className="ml-3 font-mono font-semibold tabular-nums">{penceToDisplay(data.vat.box5_pence)}</span></p>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><RefreshCw className="h-4 w-4" />Refresh</button><button type="button" onClick={onExport} data-testid="button-vat-csv" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Download className="h-4 w-4" />Export all workings CSV</button></div>
    </div>
    <div>
      <p className="mb-2 text-xs text-muted-foreground">Select a box to review its related source documents.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {BOXES.map(b => <button type="button" key={b.box} aria-pressed={selected === b.box} onClick={() => setSelected(selected === b.box ? 'all' : b.box)} data-testid={`button-vat-box-${b.box}`} className={`rounded-xl border p-3 text-left transition-colors ${selected === b.box ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-card hover:border-primary/50'}`}>
          <span className="block text-xs font-semibold text-primary">Box {b.box}</span><span className="mt-1 block min-h-8 text-xs text-muted-foreground">{b.label}</span><span className="mt-2 block break-all font-mono text-base font-semibold tabular-nums">{penceToDisplay(data.vat[b.key])}</span>
        </button>)}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Box 5 is the absolute difference between sales VAT and reclaimed purchase VAT; the direction is shown above. Credits reduce the relevant sales or purchase figures. Amounts come from the accounting report without recalculating VAT here.</p>
    </div>
    <VatCoverageReview coverage={data.vat_coverage} />
    <section aria-labelledby="vat-sources-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 id="vat-sources-title" className="font-semibold">{box ? `Box ${box.box} · related sources` : 'Posted source movements'}</h3><p className="mt-1 text-xs text-muted-foreground">{sources.length} shown of {allSources.length} movements in the period. Open a document or journal to check the evidence.</p></div>
        <div className="flex flex-wrap items-center gap-3"><label className="relative"><span className="sr-only">Search VAT source documents</span><Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input type="search" maxLength={250} value={search} onChange={e => setSearch(e.target.value)} placeholder="Document or customer / supplier" className="w-72 max-w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm" /></label>
          <button type="button" onClick={exportSources} disabled={!sources.length || !companyId || !companyName} data-testid="button-vat-filtered-csv" aria-describedby="vat-filtered-export-note" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" />Export filtered sources CSV</button></div>
      </div>
      <p id="vat-filtered-export-note" className="text-xs text-muted-foreground">The filtered export contains only the {sources.length} source movements shown below, with company, period and filter details. It is not a complete VAT return. Use Export all workings CSV for the full workings.</p>
      {exportError?.key === key && <p role="alert" className="text-sm text-destructive">{exportError.message}</p>}
      {box && <button type="button" onClick={() => setSelected('all')} className="text-sm font-medium text-primary underline">Show all source documents</button>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Source documents posted between {data.from} and {data.to}. Signed amounts in GBP.</caption>
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><tr>{['Posted', 'Document', 'Customer / supplier', 'Net', 'VAT in workings', 'Gross', 'Evidence'].map((h, i) => <th scope="col" key={h} className={`px-3 py-3 ${i >= 3 && i < 6 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>{sources.map(d => <tr key={d.journal_id} className="border-b last:border-0" data-testid={`vat-source-${d.id}`}>
            <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{d.date}</td>
            <td className="px-3 py-3"><Link to={docPath(d.kind, d.id)} className="font-medium text-primary underline-offset-4 hover:underline">{d.number || 'Open document'}</Link><p className="mt-1 text-xs text-muted-foreground">{KINDS[d.kind].label}{d.movement_kind === 'financial_correction' ? ' · Correction' : ''}</p></td>
            <td className="px-3 py-3">{d.party_name}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs">{penceToDisplay(d.net_minor)}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs">{penceToDisplay(d.vat_minor)}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs">{penceToDisplay(d.gross_minor)}</td>
            <td className="whitespace-nowrap px-3 py-3"><JournalLink id={d.journal_id} /></td>
          </tr>)}</tbody>
        </table>
        {!sources.length && <p className="p-5 text-sm text-muted-foreground">{allSources.length ? 'No source documents match these filters.' : 'No posted invoices, bills or credit notes in this period.'}</p>}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">Signed source amounts reconcile to boxes 1, 4, 6 and 7; box 5 checks the net direction and difference. Sources are selected by posting date, not payment date. Corrections appear as separate dated differences. Purchase VAT shown here is the amount included in the workings, which may differ from the VAT charged by the supplier. Drafts and historical VAT projections are excluded. The CSV includes every source movement in the period, regardless of these filters.</p>
    </section>
  </div>;
}
