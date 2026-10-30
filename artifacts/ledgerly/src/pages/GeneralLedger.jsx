import { LedgerNotice, Money } from '@/components/accounting/AccountingUI';
import { Link } from 'react-router-dom';
import { docPath } from '@/api/accountingDocuments.mjs';
import { legacyMinor, displayedLegacyTotals, legacyLineAccounts } from '@/lib/legacyJournalHistory.mjs';
import React, { useState, useEffect } from 'react';
import * as nativeEntities from '@/api/entities';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye } from 'lucide-react';
import moment from 'moment';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const typeLabels = {
  sales_invoice: 'Sales Invoice',
  purchase_bill: 'Purchase Bill',
  sales_credit_note: 'Sales Credit Note',
  supplier_credit_note: 'Supplier Credit Note',
  bank_transaction: 'Bank Transaction',
  manual_journal: 'Manual Journal',
};

export default function GeneralLedger() {
  const { activeCompany } = useCompany();
  return activeCompany
    ? <CompanyGeneralLedger key={activeCompany.id} companyId={activeCompany.id} />
    : <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;
}

function CompanyGeneralLedger({ companyId }) {
  const [history, setHistory] = useState({ status: 'loading', rows: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setHistory({ status: 'loading', rows: [] });
    nativeEntities.JournalEntry.filter({ company_id: companyId }, 'date')
      .then(rows => {
        if (!Array.isArray(rows)) throw new Error('Invalid journal response');
        if (current) setHistory({ status: 'ready', rows });
      })
      .catch(() => {
        // Backend diagnostics can contain SQL and identifiers. Keep the public
        // failure neutral and never turn a failed read into a zero-balance claim.
        if (current) setHistory({ status: 'error', rows: [] });
      });
    return () => { current = false; };
  }, [companyId, attempt]);
  return <GeneralLedgerView history={history} onRetry={() => setAttempt(value => value + 1)} />;
}

export function GeneralLedgerView({ history, onRetry }) {
  const loaded = history.status === 'ready';
  const journals = loaded ? history.rows : [];
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewing, setViewing] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = journals.filter(j => {
    const matchSearch = j.reference?.includes(search) || j.description?.toLowerCase().includes(search.toLowerCase()) || legacyLineAccounts(j).toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || j.source_type === typeFilter;
    const matchDateFrom = !dateFrom || j.date >= dateFrom;
    const matchDateTo = !dateTo || j.date <= dateTo;
    return matchSearch && matchType && matchDateFrom && matchDateTo;
  });

  const totals = displayedLegacyTotals(filtered);
  const matching = totals && totals.unbalancedEntries === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <LedgerNotice tab="gl" text="Posted sales, purchase and credit documents appear in the authoritative general ledger" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Legacy journal history</h1>
          <p className="text-muted-foreground text-sm mt-1">{loaded ? `${journals.length} journal ${journals.length === 1 ? 'entry' : 'entries'}` : 'Journal history'}</p>
        </div>
        <div className="flex gap-2">
          <Button disabled aria-describedby="manual-journal-availability">
            Manual Journal
          </Button>
        </div>
      </div>
      <p id="manual-journal-availability" className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Manual journal entry is not yet available. Existing journal history remains available below.
        Record invoices, bills, credits and payments through their dedicated accounting screens.
      </p>

      {/* This limited historical list is not the canonical general ledger. */}
      {loaded && <Card className="border-0 bg-muted/40 shadow-sm">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-medium">
            {filtered.length === 0 ? 'No displayed legacy entries to total' : !totals ? 'Totals unavailable for displayed legacy entries'
              : matching ? 'Displayed legacy entry totals match' : 'Some displayed legacy entries do not balance'}
          </p>
          {filtered.length > 0 && totals && <p className="text-xs text-muted-foreground">
            Entry debits: <Money value={totals.debit} /> | Entry credits: <Money value={totals.credit} /> | Difference: <Money value={totals.difference} />
          </p>}
          {!totals && <p className="text-xs text-muted-foreground">One or more entries have missing or invalid totals.</p>}
          <p className="text-xs text-muted-foreground">Totals cover displayed, filtered legacy entries only. This view loads up to 500 entries; use the posted general ledger above for current accounts.</p>
        </CardContent>
      </Card>}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(typeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" placeholder="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <Input type="date" placeholder="To" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>

      {/* Journal Table */}
      {history.status === 'error' ? (
        <div role="alert" className="rounded-lg border border-border bg-muted/40 p-5">
          <p className="font-medium">Journal history could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try again, or use the posted general ledger linked above.</p>
          <Button onClick={onRetry} variant="outline" className="mt-3">Try again</Button>
        </div>
      ) : !loaded ? (
        <div role="status" className="flex justify-center py-12">
          <span className="sr-only">Loading journal history</span>
          <div aria-hidden="true" className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <p className="text-muted-foreground">No journal entries found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Card className="border-0 shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-left font-medium">Description</th>
                  <th className="px-4 py-3 text-left font-medium">Lines</th>
                  <th className="px-4 py-3 text-right font-medium">Entry debit</th>
                  <th className="px-4 py-3 text-right font-medium">Entry credit</th>
                  <th className="px-4 py-3 text-left font-medium">Type / status</th>
                  <th className="px-4 py-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(journal => (
                  <tr
                    key={journal.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open legacy journal ${journal.reference || 'entry'}`}
                    onClick={() => { setViewing(journal); setDetailOpen(true); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewing(journal); setDetailOpen(true); } }}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">{journal.date ? moment(journal.date).format('DD MMM YYYY') : 'Unavailable'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{journal.reference}</td>
                    <td className="px-4 py-3 text-sm truncate max-w-xs">{journal.description}</td>
                    <td className="px-4 py-3">
                      {Array.isArray(journal.lines) ? journal.lines.length : 'Unavailable'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <LegacyAmount value={journal.total_debit} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <LegacyAmount value={journal.total_credit} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[journal.source_type] || journal.source_type || 'Unknown type'}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{journal.status || 'Status unavailable'}</p>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => { setViewing(journal); setDetailOpen(true); }} title="View journal details">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {loaded && <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Legacy journal details</DialogTitle><DialogDescription>Historical entry data; current posted accounts are shown in the canonical general ledger.</DialogDescription></DialogHeader>
        {viewing && <LegacyJournalDetails journal={viewing} />}
      </DialogContent></Dialog>}
    </div>
  );
}

function LegacyAmount({ value }) {
  const minor = legacyMinor(value);
  return minor === null ? <span className="text-muted-foreground">Unavailable</span> : <Money value={minor} />;
}

export function LegacyJournalDetails({ journal }) {
  const sourcePath = journal.source_record_id ? docPath(journal.source_type, journal.source_record_id) : null;
  const lines = Array.isArray(journal.lines) ? journal.lines : null;
  return <div className="space-y-4">
    <div><p className="font-medium">{journal.reference || 'Reference unavailable'}</p><p className="text-sm text-muted-foreground">{journal.description || 'Description unavailable'}</p></div>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div><dt>Entry debit</dt><dd><LegacyAmount value={journal.total_debit} /></dd></div>
      <div><dt>Entry credit</dt><dd><LegacyAmount value={journal.total_credit} /></dd></div>
    </dl>
    {lines?.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead>
      <tbody>{lines.map((line, index) => <tr key={index} className="border-t"><td className="p-2">{typeof line?.account_code === 'string' ? line.account_code : ''} {typeof line?.account_name === 'string' ? line.account_name : 'Account unavailable'}</td><td className="p-2 text-right"><LegacyAmount value={line?.debit} /></td><td className="p-2 text-right"><LegacyAmount value={line?.credit} /></td></tr>)}</tbody>
    </table></div> : <p className="text-sm text-muted-foreground">Line details unavailable.</p>}
    {sourcePath ? <Link to={sourcePath} className="text-sm text-primary underline">View source document{journal.source_record_number ? ` · ${journal.source_record_number}` : ''}</Link>
      : <p className="text-sm text-muted-foreground">{journal.source_record_number ? `Source reference: ${journal.source_record_number}. ` : ''}No supported source-document link is available for this historical entry.</p>}
  </div>;
}
