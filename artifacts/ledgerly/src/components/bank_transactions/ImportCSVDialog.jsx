import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as nativeEntities from '@/api/entities';
import { invokeApiFunction } from '@/api/functions.mjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { buildBankPreview, checkFileSize, confirmedImportReceipt, createImportGate, FIELDS, markDuplicateCandidates, parseBankCSV } from '@/features/bankImport/model.mjs';
import BankImportReview from '@/features/bankImport/BankImportReview';

const LABELS = { date: 'Date', description: 'Description', reference: 'Reference', money_in: 'Money in', money_out: 'Money out', balance: 'Balance' };

function BankImportSession({ open, onOpenChange, companyId, onImported }) {
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [bankAccountId, setBankAccountId] = useState('');
  const [file, setFile] = useState(null);
  const [columnMap, setColumnMap] = useState({});
  const [dateFormat, setDateFormat] = useState('iso');
  const [preview, setPreview] = useState(null);
  const [excluded, setExcluded] = useState(new Set());
  const [duplicatesReviewed, setDuplicatesReviewed] = useState(false);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const gate = useRef(createImportGate());
  const importing = useRef(false);
  const active = useRef(true);
  const scope = `${companyId}:${open}`;

  useEffect(() => {
    active.current = true;
    if (!open || !companyId) { setAccountsLoading(false); return () => { active.current = false; gate.current.cancel(); }; }
    nativeEntities.BankAccount.filter({ company_id: companyId }).then(items => {
      if (!active.current) return;
      if (!Array.isArray(items) || items.some(item => !item?.id || item.company_id !== companyId)) throw new Error('Bank accounts could not be verified for this company.');
      setAccounts(items); setAccountsLoading(false);
    }).catch(() => {
      if (active.current) { setAccountsLoading(false); setErrors([{ message: 'Bank accounts could not be loaded. Close and reopen this dialog to retry.' }]); }
    });
    return () => { active.current = false; gate.current.cancel(); };
  }, [companyId, open]);

  function invalidateReview() {
    gate.current.cancel(); setPreview(null); setErrors([]); setExcluded(new Set()); setDuplicatesReviewed(false);
  }

  async function readFile(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected || importing.current) return;
    invalidateReview(); setFile(null); setColumnMap({});
    const ticket = gate.current.begin(scope);
    setBusy('Reading CSV');
    try {
      checkFileSize(selected.size);
      const parsed = parseBankCSV(await selected.text());
      if (!active.current || !gate.current.current(ticket, scope)) return;
      setFile({ ...parsed, name: selected.name }); setColumnMap(parsed.columnMap);
    } catch (error) {
      if (active.current && gate.current.current(ticket, scope)) setErrors([{ message: error.message }]);
    } finally {
      if (active.current && gate.current.current(ticket, scope)) setBusy('');
    }
  }

  async function review() {
    if (busy || importing.current || !file) return;
    const ticket = gate.current.begin(scope);
    setErrors([]); setPreview(null); setBusy('Checking statement');
    try {
      if (!accounts.some(account => account.id === bankAccountId)) throw new Error('Choose an authorised bank account.');
      const checked = buildBankPreview({ ...file, columnMap, dateFormat, companyId, bankAccountId });
      if (checked.errors.length) { setErrors(checked.errors); return; }
      const existing = await nativeEntities.BankTransaction.filter({ company_id: companyId, bank_account_id: bankAccountId });
      if (!active.current || !gate.current.current(ticket, scope)) return;
      if (!Array.isArray(existing) || existing.some(item => item.company_id !== companyId || item.bank_account_id !== bankAccountId)) throw new Error('Existing transactions could not be verified for this account.');
      setPreview(markDuplicateCandidates(checked.transactions, existing));
      setExcluded(new Set()); setDuplicatesReviewed(false);
    } catch (error) {
      if (active.current && gate.current.current(ticket, scope)) setErrors([{ message: error.message || 'Statement review could not be completed.' }]);
    } finally {
      if (active.current && gate.current.current(ticket, scope)) setBusy('');
    }
  }

  async function importSelected() {
    if (importing.current || busy || unknownOutcome || !preview || (preview.some(row => row.possibleDuplicate) && !duplicatesReviewed)) return;
    const selected = preview.filter(row => !excluded.has(row.sourceRow));
    if (!selected.length) return;
    importing.current = true; setBusy('Importing reviewed transactions'); setErrors([]);
    try {
      const receipt = await invokeApiFunction('recordBankTransactions', { company_id: companyId, transactions: selected.map(row => row.payload) });
      if (!active.current) return;
      setResult({ ...confirmedImportReceipt(receipt, selected, companyId, bankAccountId), excluded: excluded.size });
      // A workspace refresh failure must not invalidate a confirmed server receipt.
      try { Promise.resolve(onImported?.()).catch(() => {}); } catch { /* Reopening refreshes the workspace. */ }
    } catch {
      if (!active.current) return;
      // Even a 4xx cannot prove rollback: the current route has work after its transaction.
      setUnknownOutcome(true);
      setErrors([{ message: 'The import result could not be confirmed. Do not import this file again until you have checked the bank transactions. Automatic retry is disabled.' }]);
    } finally {
      importing.current = false;
      if (active.current) setBusy('');
    }
  }

  const close = next => { if (!importing.current) onOpenChange(next); };
  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Import bank transactions</DialogTitle></DialogHeader>
      {errors.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950"><p className="font-medium">Resolve these issues before importing.</p><ul className="mt-2 list-disc space-y-1 pl-5">{errors.slice(0, 30).map((error, index) => <li key={index}>{error.row ? `CSV row ${error.row}: ` : ''}{error.message}</li>)}</ul>{errors.length > 30 && <p className="mt-2">{errors.length - 30} more rows need correction. No rows will be imported until all are valid.</p>}</div>}
      {busy && <p role="status" className="text-sm text-muted-foreground">{busy}…</p>}
      {unknownOutcome && <p className="text-sm"><Link to="/transactions" onClick={() => close(false)} className="font-medium text-primary underline">Close and check bank transactions</Link></p>}
      {result ? <div role="status" className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-semibold">{result.count} transactions imported for review.</p><p>{result.excluded} rows excluded by you.</p><p>{result.analysisStatus === 'complete' ? 'Statement analysis is available in the bank workspace.' : 'Automatic analysis is unavailable; use the bank workspace to review the imported transactions.'}</p><p>Importing does not match, reconcile or post a payment.</p></div> : <>
        {!preview && <fieldset disabled={Boolean(busy) || accountsLoading || unknownOutcome} className="space-y-4 disabled:opacity-60">
          <label className="block space-y-1 text-sm font-medium">Bank account<select className="block w-full rounded-md border bg-background p-2" value={bankAccountId} onChange={event => { invalidateReview(); setBankAccountId(event.target.value); }}><option value="">{accountsLoading ? 'Loading accounts…' : 'Choose a bank account'}</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.account_name} ({account.bank_name})</option>)}</select></label>
          <label className="block space-y-1 text-sm font-medium">Statement CSV<input type="file" accept=".csv,text/csv" className="block w-full rounded-md border p-2" onChange={readFile} /></label>
          <p className="text-xs text-muted-foreground">Up to 1 MiB and 1,000 transactions. Amounts must have at most two decimal places. Supported thousands format: 1,234.56. No amount is rounded or guessed.</p>
          {file && <><p className="break-words text-sm">{file.name} · {file.rows.length} transaction rows</p>
            <label className="block space-y-1 text-sm font-medium">Date format<select className="block w-full rounded-md border bg-background p-2" value={dateFormat} onChange={event => { invalidateReview(); setDateFormat(event.target.value); }}><option value="iso">YYYY-MM-DD</option><option value="dmy">DD/MM/YYYY (day first)</option></select></label>
            <div className="space-y-2"><h3 className="text-sm font-semibold">Map columns</h3>{file.headers.map((header, index) => <label key={index} className="grid grid-cols-2 items-center gap-3 text-sm"><span className="break-words">{header}</span><select className="rounded-md border bg-background p-2" value={columnMap[index] || 'skip'} onChange={event => { invalidateReview(); setColumnMap(previous => ({ ...previous, [index]: event.target.value })); }}><option value="skip">Skip this column</option>{FIELDS.map(field => <option key={field} value={field}>{LABELS[field]}</option>)}</select></label>)}</div>
          </>}
        </fieldset>}
        {preview && <BankImportReview rows={preview} excluded={excluded} duplicatesReviewed={duplicatesReviewed} disabled={Boolean(busy) || unknownOutcome}
          onDuplicatesReviewed={setDuplicatesReviewed} onInclude={(row, included) => setExcluded(previous => { const next = new Set(previous); included ? next.delete(row) : next.add(row); return next; })} />}
      </>}
      <DialogFooter>
        <Button variant="outline" onClick={() => close(false)} disabled={importing.current}>{result || unknownOutcome ? 'Close' : 'Cancel'}</Button>
        {!result && !unknownOutcome && (preview ? <><Button variant="outline" disabled={Boolean(busy)} onClick={invalidateReview}>Back to mapping</Button><Button onClick={importSelected} disabled={Boolean(busy) || preview.length === excluded.size || (preview.some(row => row.possibleDuplicate) && !duplicatesReviewed)}>Import {preview.length - excluded.size} selected rows</Button></> : <Button onClick={review} disabled={Boolean(busy) || !file || !bankAccountId || accountsLoading}>Review statement</Button>)}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

// A new company/dialog session never inherits another company's file or late read.
export default function ImportCSVDialog(props) {
  return <BankImportSession key={JSON.stringify([props.companyId, props.open])} {...props} />;
}
