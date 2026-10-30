import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, FileText, Download, ArrowLeftRight } from 'lucide-react';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot, ledgerDates } from '@/lib/useLedgerSnapshot';
import { accounting } from '@/api/accountingDocuments.mjs';
import { statementRows, downloadCsv } from '@/lib/ledgerCsv.mjs';
import { ErrorBox, SkeletonRows, Money } from '@/components/accounting/AccountingUI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';
import StatementMovements from '@/features/paymentWorkspace/StatementMovements';
import { statementDateError, statementPeriod, loadStatementParties, selectedStatementParty, retryStatementReads, statementCsvRows } from '@/features/paymentWorkspace/model.mjs';

export default function Statements() {
  const { activeCompany, loading } = useCompany();
  if (loading && !activeCompany) return <div className="workspace-page" aria-label="Loading company"><SkeletonRows rows={3} /></div>;
  if (!activeCompany) return <div className="workspace-page"><PageHeader eyebrow="Account history" title="Statements" description="Invoices, credits and payments in one account view." /><section className="workspace-card"><EmptyState icon={Building2} title="Choose a company first" description="Select your business to view customer and supplier statements." action={<Button asChild><Link to="/companies">Open companies</Link></Button>} /></section></div>;
  return <CompanyStatements key={activeCompany.id} company={activeCompany} />;
}

function CompanyStatements({ company }) {
  const [params, setParams] = useSearchParams();
  const { from, to } = statementPeriod(params, ledgerDates());
  const [retry, setRetry] = useState(0);
  const [accounts, setAccounts] = useState({ companyId: company.id, loading: true, parties: [], error: null });
  const dateError = statementDateError(from, to);
  const s = useLedgerSnapshot(company.id, from, to, !dateError);
  const id = params.get('party_id') || '';
  useEffect(() => {
    setAccounts({ companyId: company.id, loading: true, parties: [], error: null });
    const request = loadStatementParties(company.id, accounting, {
      success: next => setAccounts({ ...next, loading: false, error: null }),
      failure: error => setAccounts({ companyId: company.id, loading: false, parties: [], error }),
    });
    return request.cancel;
  }, [company.id, retry]);
  const party = selectedStatementParty(accounts, company.id, id);
  // Cached or prior-period data is never exported when the current reads are invalid.
  const st = !dateError && !s.error && !s.loading && party && s.data ? statementRows(s.data, id) : null;
  const reload = () => retryStatementReads(() => setRetry(value => value + 1), () => dateError ? undefined : s.refresh());
  const chooseParty = value => {
    const next = new URLSearchParams(params);
    if (value) next.set('party_id', value); else next.delete('party_id');
    setParams(next, { replace: true });
  };
  const changeDate = (field, value) => {
    const next = new URLSearchParams(params); next.set(field, value);
    setParams(next, { replace: true });
  };
  const exportStatement = () => {
    if (!st || !party) return;
    downloadCsv(`statement-${id}-${to}.csv`, statementCsvRows({ companyName: company.name, party, from, to, statement: st }));
  };
  const loading = accounts.loading || (!dateError && s.loading);
  return <div className="workspace-page">
    <PageHeader eyebrow="Account history" title="Statements" description="Follow invoices, credits, payments and refunds from the posted ledger." context={company.name}
      actions={<><Button variant="outline" asChild><Link to="/payments"><ArrowLeftRight aria-hidden="true" />Payments</Link></Button>{st && <Button onClick={exportStatement}><Download aria-hidden="true" />Download CSV</Button>}</>} />
    <section className="workspace-card p-4 sm:p-5" aria-label="Statement account and period">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
        <div className="sm:col-span-2 lg:col-span-1"><Label htmlFor="statement-party">Customer or supplier</Label><select id="statement-party" className="mt-1.5 h-11 w-full rounded-lg border bg-background px-3 text-sm" value={party ? id : ''} disabled={accounts.loading || !!accounts.error} onChange={event => chooseParty(event.target.value)}>
          <option value="">{accounts.loading ? 'Loading accounts…' : 'Choose an account'}</option>
          {[['customer', 'Customers'], ['supplier', 'Suppliers']].map(([type, label]) => <optgroup key={type} label={label}>{accounts.parties.filter(item => item.type === type).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
        </select></div>
        <div><Label htmlFor="statement-from">From</Label><Input id="statement-from" className="mt-1.5 h-11" type="date" value={from} aria-invalid={!!dateError} aria-describedby={dateError ? 'statement-date-error' : undefined} onChange={event => changeDate('from', event.target.value)} /></div>
        <div><Label htmlFor="statement-to">To</Label><Input id="statement-to" className="mt-1.5 h-11" type="date" value={to} aria-invalid={!!dateError} aria-describedby={dateError ? 'statement-date-error' : undefined} onChange={event => changeDate('to', event.target.value)} /></div>
      </div>
      {dateError && <p id="statement-date-error" role="alert" className="mt-3 text-sm text-destructive">{dateError}</p>}
    </section>
    <ErrorBox error={accounts.error || (!dateError ? s.error : null)} onRetry={reload} />
    {loading && <div role="status" aria-label="Loading statement"><p className="mb-3 text-sm text-muted-foreground">Loading current account information…</p><SkeletonRows rows={3} /></div>}
    {!loading && !accounts.error && !party && <section className="workspace-card"><EmptyState icon={FileText} title={id ? 'Choose an account in this company' : 'Whose statement do you need?'} description={id ? 'The linked account is not available in the selected company. Choose a current customer or supplier above.' : accounts.parties.length ? 'Choose a customer or supplier and a date range to see balances and download a statement.' : 'No customer or supplier accounts are available for this company yet.'} /></section>}
    {st && <>
      <section aria-label="Statement balances" className="grid gap-4 sm:grid-cols-3">
        {[['Outstanding documents', st.closing], [party.type === 'customer' ? 'Unapplied customer credit' : 'Supplier prepayments', st.unapplied], ['Net account balance', st.net]].map(([name, value]) => <div className="workspace-card min-w-0 p-5" key={name}><p className="text-sm text-muted-foreground">{name}</p><p className="mt-3 break-all text-2xl font-semibold tracking-tight"><Money value={value} /></p></div>)}
      </section>
      <section className="workspace-card overflow-hidden" aria-label="Account movements">
        <div className="space-y-3 border-b p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="break-words text-lg font-semibold">{party.name}</h2><p className="text-xs text-muted-foreground">{from} to {to} · {party.type === 'customer' ? 'Customer' : 'Supplier'}</p></div><p className="text-sm text-muted-foreground">Opening document balance: <Money value={st.opening} /> · Opening unapplied balance: <Money value={st.openingUnapplied} /></p></div>
        <StatementMovements rows={st.rows} />
      </section>
      <p className="text-xs leading-5 text-muted-foreground">Drafts are excluded. Unapplied money remains separate until explicitly allocated or refunded. Downloading does not email this statement.</p>
    </>}
  </div>;
}
