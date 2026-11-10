import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDownRight, ArrowUpRight, FileUp, History, Landmark, Link2, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { bankStatements as defaultClient, isUnknownOutcome } from '@/api/bankStatements.mjs';
import { checkFileSize, FIELDS, parseBankCSV } from '@/features/bankImport/model.mjs';
import {
  blankManualRow, buildImportBody, importBlocked, buildMatchBody, createGate, defaultMatchAmount, formatMinor,
  newRequestId, pendingStore, rowsFromCsv, statusExplanation, verifyImportReceipt, verifyImportReview, verifyMatchReceipt, verifyMatchReview, unresolvedRecovery, retainPendingOnFailure, refreshRecoveredMatch,
} from './model.mjs';
import { directionalPayments } from './correctionModel.mjs';
import { CorrectionPanel, CorrectionRecovery, MatchReceiptRow } from './BankMatchCorrection';

const LABELS = { date: 'Date', description: 'Description', reference: 'Reference', money_in: 'Money in', money_out: 'Money out', balance: 'Balance' };
const STATUS_STYLE = { matched: 'bg-emerald-50 text-emerald-800 border-emerald-200', partial: 'bg-amber-50 text-amber-900 border-amber-200', unmatched: 'bg-slate-50 text-slate-700 border-slate-200' };
const inputCls = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';

function Notice({ tone = 'info', children, testId }) {
  const cls = tone === 'error' ? 'border-red-200 bg-red-50 text-red-950' : tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-950' : tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-slate-50 text-slate-800';
  return <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId} className={`rounded-lg border p-3 text-sm space-y-1 ${cls}`}>{children}</div>;
}

/** Native evidence-backed statement workspace. Mount with key={company.id} so a company switch clears everything. */
export default function NativeBankStatements({ company, client = defaultClient, storage, onOpenLegacy }) {
  const companyId = company.id;
  const store = useMemo(() => pendingStore(storage), [storage]);
  const ctxGate = useRef(createGate());
  const aborter = useRef(new AbortController());
  const [ctx, setCtx] = useState(null);
  const [ctxError, setCtxError] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [panel, setPanel] = useState(null); // 'import' | null
  const [matchFor, setMatchFor] = useState(null);
  const [correctFor, setCorrectFor] = useState(null);

  useEffect(() => () => { aborter.current.abort(); ctxGate.current.cancel(); }, []);

  async function loadContext() {
    const t = ctxGate.current.begin();
    setCtxError('');
    try {
      const data = await client.context(companyId, aborter.current.signal);
      if (!ctxGate.current.current(t)) return;
      if (!data || !Array.isArray(data.banks) || !Array.isArray(data.statements) || !Array.isArray(data.payments)) throw new Error('Bank statement data could not be verified.');
      setCtx(data);
    } catch (e) {
      if (ctxGate.current.current(t) && e?.name !== 'AbortError') setCtxError(e.message || 'Bank statements could not be loaded.');
    }
  }
  useEffect(() => { loadContext(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statements = (ctx?.statements || []).filter(s => !bankFilter || s.bank_account_id === bankFilter);
  const bankName = id => ctx?.banks.find(b => b.id === id)?.account_name || 'Bank account';
  const counts = { unmatched: 0, partial: 0, matched: 0 };
  statements.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
  const canWrite = ctx?.can_write === true;

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="native-bank-statements">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Transactions</h1>
          <p className="text-sm font-medium">{company.name}</p>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">Import statement evidence, then explicitly match each line to a payment you have already recorded. Nothing is booked twice and nothing is matched automatically.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={onOpenLegacy} data-testid="button-open-legacy"><History className="w-4 h-4" />Legacy review/history</Button>
          <Button className="gap-2" disabled={!canWrite} onClick={() => { setMatchFor(null); setPanel('import'); }} data-testid="button-open-import"><FileUp className="w-4 h-4" />Import statement</Button>
        </div>
      </div>

      <PendingRecovery companyId={companyId} client={client} store={store} signal={aborter.current.signal} onResolved={() => refreshRecoveredMatch(setMatchFor, loadContext)} />
      <CorrectionRecovery companyId={companyId} client={client} store={store} signal={aborter.current.signal} onResolved={() => refreshRecoveredMatch(setCorrectFor, loadContext)} />

      {ctx && !canWrite && <Notice testId="text-read-only">You can view statements but your role cannot import or match.</Notice>}
      {ctx && !ctx.bank_ledger_account_id && !ctx.banks.some(b => b.bank_ledger_account_id) && <Notice tone="warn" testId="text-no-bank-ledger">No bank ledger account is configured for payments, so no payment can be matched yet. Configure it in Payments settings.</Notice>}

      {panel === 'import' && ctx && <ImportPanel key="import" companyId={companyId} banks={ctx.banks} client={client} store={store} signal={aborter.current.signal}
        onClose={() => setPanel(null)} onImported={loadContext} />}

      {ctxError ? <Notice tone="error" testId="text-context-error"><p>{ctxError}</p><Button size="sm" variant="outline" className="mt-2 gap-2" onClick={loadContext} data-testid="button-retry-context"><RefreshCw className="w-3.5 h-3.5" />Retry</Button></Notice>
        : !ctx ? <div className="space-y-2" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-muted/60 animate-pulse" />)}</div>
        : <>
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="Filter by bank account" className="rounded-md border bg-background p-2 text-sm" value={bankFilter} onChange={e => setBankFilter(e.target.value)} data-testid="select-bank-filter">
              <option value="">All bank accounts</option>
              {ctx.banks.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
            </select>
            <span className="text-xs text-muted-foreground" data-testid="text-status-counts">{counts.unmatched} unmatched · {counts.partial} partly matched · {counts.matched} matched</span>
            <Button variant="ghost" size="sm" className="gap-1 ml-auto" onClick={loadContext} data-testid="button-refresh"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
          </div>
          {statements.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="flex flex-col items-center py-16 text-center">
              <Landmark className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No statement lines yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Import a CSV or enter rows by hand. Only natively imported statement lines appear here. Older transactions remain in Legacy review/history.</p>
            </CardContent></Card>
          ) : <div className="grid gap-2">{statements.map(s => (
            <Card key={s.id} className={`border-0 shadow-sm ${matchFor?.id === s.id ? 'ring-2 ring-primary/40' : ''}`} data-testid={`card-statement-${s.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.direction === 'in' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      {s.direction === 'in' ? <ArrowDownRight className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{s.description}</p>
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLE[s.status] || ''}`} data-testid={`status-statement-${s.id}`}>{s.status === 'partial' ? 'Partly matched' : s.status === 'matched' ? 'Matched' : 'Unmatched'}</Badge>
                        {s.native && <Badge variant="outline" className="text-xs gap-1"><ShieldCheck className="w-3 h-3" />Imported evidence</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.date} · {bankName(s.bank_account_id)}{s.reference ? ` · ${s.reference}` : ''}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${s.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>{s.direction === 'in' ? '+' : '-'}{formatMinor(s.amount_minor)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">Matched {formatMinor(s.matched_minor)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p className="text-muted-foreground" data-testid={`text-explanation-${s.id}`}>{statusExplanation(s)}</p>
                  {s.native && s.status !== 'matched' && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!canWrite} onClick={() => { setPanel(null); setCorrectFor(null); setMatchFor(s); }} data-testid={`button-match-${s.id}`}><Link2 className="w-3.5 h-3.5" />Match to payment</Button>}
                </div>
                {s.native && <p className="text-[11px] text-muted-foreground">This imported line is immutable evidence. Legacy review actions cannot edit, delete or re-match it.</p>}
                {(ctx.matches || []).filter(m => m.bank_transaction_id === s.id).map(m => {
                  const label = ctx.payments.find(p => p.id === m.payment_id)?.reference || m.payment_id;
                  return <MatchReceiptRow key={m.request_id} match={m} paymentLabel={label} canWrite={canWrite} open={correctFor === m.request_id} onOpen={() => { setMatchFor(null); setCorrectFor(m.request_id); }}>
                    {correctFor === m.request_id && <CorrectionPanel key={m.request_id} companyId={companyId} match={m} paymentLabel={label} client={client} store={store} signal={aborter.current.signal}
                      onClose={() => setCorrectFor(null)} onRecorded={() => refreshRecoveredMatch(setCorrectFor, loadContext)} />}
                  </MatchReceiptRow>;
                })}
                {matchFor?.id === s.id && <MatchPanel key={s.id} companyId={companyId} statement={s} ctx={ctx} client={client} store={store} signal={aborter.current.signal}
                  onClose={() => setMatchFor(null)} onRecorded={loadContext} />}
              </CardContent>
            </Card>
          ))}</div>}
          <p className="text-xs text-muted-foreground">Only GBP payments can be matched. {ctx.supports_refund_matching === true ? 'Refund payments can be matched in their own direction. Reversals' : 'Refunds, reversals'} and bank fees need later matching support and are never posted automatically. To explain a line with no payment, <Link to="/payments" className="text-primary underline" data-testid="link-payments">record the payment in Payments</Link> first, then match it here.</p>
        </>}
    </div>
  );
}

/** Restores an unknown outcome after reload: GET first, exact-request retry only on explicit user action. */
function PendingRecovery({ companyId, client, store, signal, onResolved }) {
  const [items, setItems] = useState(() => ['import', 'match'].map(op => ({ op, pending: store.read(companyId, op) })).filter(x => x.pending));
  const [state, setState] = useState({});
  const run = async (op, body, how) => {
    setState(s => ({ ...s, [op]: { busy: true } }));
    try {
      const raw = how === 'check'
        ? await (op === 'import' ? client.importStatus(companyId, body.request_id, signal) : client.matchStatus(companyId, body.request_id, signal))
        : await (op === 'import' ? client.importRows(companyId, body, signal) : client.recordMatch(companyId, body, signal));
      const v = op === 'import' ? verifyImportReceipt(raw, body) : verifyMatchReceipt(raw, body);
      if (v.status === 'unknown') { setState(s => ({ ...s, [op]: { unknown: true } })); return; }
      store.clear(companyId, op);
      setState(s => ({ ...s, [op]: { done: op === 'import' ? `${v.count} statement rows were recorded.` : `Match of ${formatMinor(body.amount_minor)} was recorded.`, journal: v.receipt?.journal_id } }));
      onResolved();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setState(s => ({ ...s, [op]: { error: unresolvedRecovery(e) } }));
    }
  };
  useEffect(() => { items.forEach(({ op, pending }) => run(op, pending.body, 'check')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null;
  return <>{items.map(({ op, pending }) => {
    const st = state[op] || {};
    const label = op === 'import' ? 'statement import' : 'payment match';
    if (st.done) return <Notice key={op} tone="ok" testId={`text-recovered-${op}`}><p>Previous {label} confirmed. {st.done}</p>{st.journal && <Link to={`/accounting/journals/${st.journal}`} className="text-primary underline">View journal</Link>}<Button size="sm" variant="ghost" onClick={() => setItems(i => i.filter(x => x.op !== op))}>Dismiss</Button></Notice>;
    if (st.rejected) return <Notice key={op} tone="error" testId={`text-rejected-${op}`}><p>Previous {label} was rejected and wrote nothing: {st.rejected}</p><Button size="sm" variant="ghost" onClick={() => setItems(i => i.filter(x => x.op !== op))}>Dismiss</Button></Notice>;
    return <Notice key={op} tone="warn" testId={`text-pending-${op}`}>
      <p className="font-medium">A {label} was sent but its outcome is not yet confirmed (request {pending.body.request_id}).</p>
      <p>{st.busy ? 'Checking with the server…' : st.unknown ? 'The server has no record of it. You can resend the exact same request; it cannot create a second import or match.' : st.error ? `Could not check: ${st.error}` : ''}</p>
      <p>Do not start a new {label} for the same rows until this is resolved.</p>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" disabled={st.busy} onClick={() => run(op, pending.body, 'check')} data-testid={`button-check-${op}`}>Check outcome</Button>
        {st.unknown && <Button size="sm" disabled={st.busy} onClick={() => run(op, pending.body, 'retry')} data-testid={`button-retry-exact-${op}`}>Retry exact request</Button>}
      </div>
    </Notice>;
  })}</>;
}

function ImportPanel({ companyId, banks, client, store, signal, onClose, onImported }) {
  const gate = useRef(createGate());
  const manualSeq = useRef(0);
  const [bankId, setBankId] = useState('');
  const [file, setFile] = useState(null);
  const [columnMap, setColumnMap] = useState({});
  const [dateFormat, setDateFormat] = useState('iso');
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [review, setReview] = useState(null); // { body, data }
  const [busy, setBusy] = useState('');
  const [outcome, setOutcome] = useState(null); // { kind: 'done'|'unknown', ... }
  useEffect(() => () => gate.current.cancel(), []);

  const invalidate = () => { gate.current.cancel(); setReview(null); setErrors([]); setBusy(''); };
  const editRow = (key, field, value) => { invalidate(); setRows(rs => rs.map(r => r.key === key ? { ...r, [field]: value } : r)); };
  const removeRow = key => { invalidate(); setRows(rs => rs.filter(r => r.key !== key)); };
  const addManual = () => { invalidate(); manualSeq.current += 1; setRows(rs => [...rs, blankManualRow(manualSeq.current)]); };

  async function readFile(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    invalidate(); setFile(null);
    const t = gate.current.begin();
    try { checkFileSize(f.size); const parsed = parseBankCSV(await f.text()); if (!gate.current.current(t)) return; setFile({ ...parsed, name: f.name }); setColumnMap(parsed.columnMap); }
    catch (err) { if (gate.current.current(t)) setErrors([{ message: err.message }]); }
  }
  function loadCsvRows() {
    invalidate();
    try {
      const r = rowsFromCsv(file, { columnMap, dateFormat, companyId, bankAccountId: bankId || 'pending' });
      if (r.errors.length) { setErrors(r.errors.map(x => ({ message: `CSV row ${x.row}: ${x.message}` }))); return; }
      setRows(rs => [...rs.filter(x => !x.key.startsWith('csv-')), ...r.rows]);
    } catch (err) { setErrors([{ message: err.message }]); }
  }

  const pendingMsg = op => store.read(companyId, op) ? `An earlier ${op === 'import' ? 'import' : 'match'} for this company is still unconfirmed. Resolve it above (Check outcome) before starting a new one.` : '';
  async function runReview() {
    if (pendingMsg('import')) { setErrors([{ message: pendingMsg('import') }]); return; }
    const built = buildImportBody({ requestId: newRequestId(), bankAccountId: bankId, rows });
    if (built.errors) { setErrors(built.errors); return; }
    const t = gate.current.begin();
    setBusy('Checking rows with the server'); setErrors([]);
    try {
      const data = verifyImportReview(await client.importReview(companyId, built.body, signal), built.body);
      if (!gate.current.current(t)) return;
      setReview({ body: built.body, data });
    } catch (e) {
      if (gate.current.current(t) && e?.name !== 'AbortError') setErrors([{ message: e.message }]);
    } finally { if (gate.current.current(t)) setBusy(''); }
  }

  async function submit() {
    if (importBlocked(review?.data) || busy) return;
    if (pendingMsg('import')) { setErrors([{ message: pendingMsg('import') }]); return; }
    const body = { ...review.body, review_token: review.data.review_token };
    if (!store.write(companyId, 'import', body)) { setErrors([{ message: 'This browser could not save a recovery record, so the import was not sent. Enable session storage and try again.' }]); return; }
    setBusy('Importing reviewed rows');
    try {
      const v = verifyImportReceipt(await client.importRows(companyId, body, signal), body);
      if (v.status === 'unknown') throw Object.assign(new Error('Outcome unknown'), { status: undefined });
      store.clear(companyId, 'import');
      setOutcome({ kind: 'done', count: v.count }); onImported();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      if (isUnknownOutcome(e)) setOutcome({ kind: 'unknown', body });
      else { store.clear(companyId, 'import'); setReview(null); setErrors([{ message: `Nothing was imported: ${e.message}` }]); }
    } finally { setBusy(''); }
  }

  async function recover(how) {
    const body = outcome.body;
    setBusy(how === 'check' ? 'Checking outcome' : 'Resending the exact request');
    try {
      const raw = how === 'check' ? await client.importStatus(companyId, body.request_id, signal) : await client.importRows(companyId, body, signal);
      const v = verifyImportReceipt(raw, body);
      if (v.status === 'unknown') { setOutcome({ kind: 'unknown', body, notFound: true }); return; }
      store.clear(companyId, 'import'); setOutcome({ kind: 'done', count: v.count }); onImported();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setOutcome({ kind: 'unknown', body, checkError: unresolvedRecovery(e) });
    } finally { setBusy(''); }
  }

  const dupBy = new Map((review?.data.duplicates || []).map(d => [d.index, d.reason]));
  const locked = Boolean(busy) || outcome?.kind === 'unknown';

  return (
    <Card className="border shadow-sm" data-testid="panel-import">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Import statement evidence</h2>
          <Button variant="ghost" size="sm" disabled={busy === 'Importing reviewed rows'} onClick={onClose} data-testid="button-cancel-import">{outcome?.kind === 'done' ? 'Close' : 'Cancel'}</Button></div>
        {outcome?.kind === 'done' ? <Notice tone="ok" testId="text-import-done"><p className="font-medium">{outcome.count} statement rows recorded as immutable evidence.</p><p>Importing does not create payments or journals. Match each line to a recorded payment below.</p></Notice>
        : outcome?.kind === 'unknown' ? <Notice tone="warn" testId="text-import-unknown">
            <p className="font-medium">The import outcome could not be confirmed.</p>
            <p>{outcome.notFound ? 'The server has no record of this request yet. You may resend the exact same request.' : outcome.checkError ? `Check failed: ${outcome.checkError}` : 'Check the outcome before doing anything else. The rows will not be sent again automatically.'}</p>
            <div className="flex gap-2 pt-1"><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => recover('check')} data-testid="button-check-import">Check outcome</Button>
              {outcome.notFound && <Button size="sm" disabled={Boolean(busy)} onClick={() => recover('retry')} data-testid="button-retry-import">Retry exact request</Button>}</div>
          </Notice>
        : <>
          <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2 disabled:opacity-60">
            <label className="text-sm font-medium space-y-1">Bank account
              <select className="block w-full rounded-md border bg-background p-2" value={bankId} onChange={e => { invalidate(); setBankId(e.target.value); }} data-testid="select-import-bank">
                <option value="">Choose a bank account</option>{banks.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
              </select></label>
            <label className="text-sm font-medium space-y-1">Statement CSV (optional)
              <input type="file" accept=".csv,text/csv" className="block w-full rounded-md border p-2 text-sm" onChange={readFile} data-testid="input-import-file" /></label>
          </fieldset>
          <p className="text-xs text-muted-foreground">Up to 500 rows per import. References up to 500 characters. Amounts must be whole pence with at most two decimal places; nothing is rounded.</p>
          {file && !locked && <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">{file.name} · {file.rows.length} rows</p>
            <label className="text-sm font-medium block">Date format <select className="ml-2 rounded-md border bg-background p-1" value={dateFormat} onChange={e => setDateFormat(e.target.value)}><option value="iso">YYYY-MM-DD</option><option value="dmy">DD/MM/YYYY</option></select></label>
            {file.headers.map((h, i) => <label key={i} className="grid grid-cols-2 gap-3 text-sm items-center"><span className="break-words">{h}</span>
              <select className="rounded-md border bg-background p-1" value={columnMap[i] || 'skip'} onChange={e => setColumnMap(m => ({ ...m, [i]: e.target.value }))}><option value="skip">Skip</option>{FIELDS.map(f => <option key={f} value={f}>{LABELS[f]}</option>)}</select></label>)}
            <Button size="sm" variant="outline" onClick={loadCsvRows} data-testid="button-load-csv">Load rows into review</Button>
          </div>}
          {errors.length > 0 && <Notice tone="error" testId="text-import-errors"><ul className="list-disc pl-5 space-y-0.5">{errors.slice(0, 30).map((e, i) => <li key={i}>{e.message}</li>)}</ul>{errors.length > 30 && <p>{errors.length - 30} more problems.</p>}</Notice>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1">Source</th><th className="p-1">Date</th><th className="p-1">Description</th><th className="p-1">Reference</th><th className="p-1">Money in</th><th className="p-1">Money out</th><th /></tr></thead>
              <tbody>{rows.map((r, i) => <tr key={r.key} className={dupBy.has(i) ? 'bg-amber-50' : ''} data-testid={`row-import-${r.key}`}>
                <td className="p-1 text-xs whitespace-nowrap">{r.source}{dupBy.has(i) && <span className="block text-amber-900">Possible duplicate: {dupBy.get(i)}</span>}</td>
                {['date', 'description', 'reference', 'money_in', 'money_out'].map(f => <td key={f} className="p-1"><input aria-label={`${LABELS[f]} for ${r.source} ${i + 1}`} disabled={locked} placeholder={f === 'date' ? 'YYYY-MM-DD' : f.startsWith('money') ? '0.00' : ''} className={inputCls} value={r[f]} onChange={e => editRow(r.key, f, e.target.value)} /></td>)}
                <td className="p-1"><Button size="icon" variant="ghost" className="h-7 w-7" disabled={locked} aria-label={`Remove ${r.source}`} onClick={() => removeRow(r.key)} data-testid={`button-remove-${r.key}`}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></td>
              </tr>)}</tbody>
            </table>
            {!rows.length && <p className="py-4 text-center text-sm text-muted-foreground">No rows yet. Load a CSV or add a row by hand.</p>}
          </div>
          <Button size="sm" variant="outline" className="gap-1" disabled={locked} onClick={addManual} data-testid="button-add-manual-row"><Plus className="w-3.5 h-3.5" />Add row manually</Button>
          {busy && <p role="status" className="text-sm text-muted-foreground">{busy}…</p>}
          {review && (importBlocked(review.data)
            ? <Notice tone="warn" testId="text-import-blocked"><p className="font-medium">Import blocked.</p><p>{review.data.duplicates.length ? `${review.data.duplicates.length} row(s) look like statement lines already recorded. Remove or correct them, then review again. Nothing is skipped automatically.` : 'The server will not accept these rows. Correct them and review again.'}</p></Notice>
            : <Notice tone="ok" testId="text-import-ready"><p>{review.body.rows.length} rows checked. Once imported they become immutable evidence; they do not create payments or journals.</p></Notice>)}
          <div className="flex justify-end gap-2">
            {review ? <Button disabled={locked || importBlocked(review.data)} onClick={submit} data-testid="button-confirm-import">Import {review.body.rows.length} rows</Button>
              : <Button disabled={locked || !rows.length || !bankId} onClick={runReview} data-testid="button-review-import">Review rows</Button>}
          </div>
        </>}
      </CardContent>
    </Card>
  );
}

function MatchPanel({ companyId, statement, ctx, client, store, signal, onClose, onRecorded }) {
  const gate = useRef(createGate());
  const options = directionalPayments(ctx, statement);
  const [paymentId, setPaymentId] = useState('');
  const payment = options.find(p => p.id === paymentId) || null;
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [outcome, setOutcome] = useState(null);
  useEffect(() => () => gate.current.cancel(), []);
  const reset = () => { gate.current.cancel(); setReview(null); setError(''); setBusy(''); };

  async function runReview() {
    if (store.read(companyId, 'match')) { setError('An earlier match for this company is still unconfirmed. Resolve it above (Check outcome) before starting a new one.'); return; }
    const built = buildMatchBody({ requestId: newRequestId(), statement, payment, amount });
    if (built.error) { setError(built.error); return; }
    const t = gate.current.begin(); setBusy('Checking match'); setError('');
    try {
      const data = verifyMatchReview(await client.matchReview(companyId, built.body, signal), built.body);
      if (gate.current.current(t)) setReview({ body: built.body, data });
    } catch (e) { if (gate.current.current(t) && e?.name !== 'AbortError') setError(e.message); }
    finally { if (gate.current.current(t)) setBusy(''); }
  }
  async function send(body, how) {
    const phase = how === 'check' || outcome?.kind === 'unknown' ? 'recovery' : 'initial';
    setBusy(how === 'check' ? 'Checking outcome' : 'Recording match');
    try {
      const raw = how === 'check' ? await client.matchStatus(companyId, body.request_id, signal) : await client.recordMatch(companyId, body, signal);
      const v = verifyMatchReceipt(raw, body);
      if (v.status === 'unknown') { setOutcome({ kind: 'unknown', body, notFound: true }); return; }
      store.clear(companyId, 'match'); setOutcome({ kind: 'done', receipt: v.receipt }); onRecorded();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      if (retainPendingOnFailure(e, phase)) setOutcome({ kind: 'unknown', body, checkError: unresolvedRecovery(e) });
      else { store.clear(companyId, 'match'); setOutcome(null); setReview(null); setError(`Nothing was recorded: ${e.message}`); }
    } finally { setBusy(''); }
  }
  function confirm() {
    if (!review || busy) return;
    if (store.read(companyId, 'match')) { setError('An earlier match for this company is still unconfirmed. Resolve it before confirming another.'); return; }
    const body = { ...review.body, review_token: review.data.review_token };
    if (!store.write(companyId, 'match', body)) { setError('This browser could not save a recovery record, so the match was not sent.'); return; }
    send(body, 'record');
  }

  if (outcome?.kind === 'done') return <Notice tone="ok" testId="text-match-done">
    <p className="font-medium">Match recorded: {formatMinor(outcome.receipt.amount_minor)}.</p>
    <p>No new payment or journal was created; the existing payment now explains this amount.</p>
    <div className="flex gap-3">{outcome.receipt.journal_id && <Link to={`/accounting/journals/${outcome.receipt.journal_id}`} className="text-primary underline" data-testid="link-match-journal">View payment journal</Link>}<button className="underline" onClick={onClose}>Close</button></div>
  </Notice>;
  if (outcome?.kind === 'unknown') return <Notice tone="warn" testId="text-match-unknown">
    <p className="font-medium">The match outcome could not be confirmed.</p>
    <p>{outcome.notFound ? 'The server has no record of it. You may resend the exact same request.' : outcome.checkError ? `Check failed: ${outcome.checkError}` : 'Check the outcome first. It will not be sent again automatically.'}</p>
    <div className="flex gap-2"><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => send(outcome.body, 'check')} data-testid="button-check-match">Check outcome</Button>
      {outcome.notFound && <Button size="sm" disabled={Boolean(busy)} onClick={() => send(outcome.body, 'record')} data-testid="button-retry-match">Retry exact request</Button>}</div>
  </Notice>;

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/20" data-testid="panel-match">
      <p className="text-sm font-medium">Match {formatMinor(statement.remaining_minor)} remaining to a recorded {statement.direction === 'in' ? 'customer receipt' : 'supplier payment'}</p>
      {options.length === 0 ? <p className="text-sm text-muted-foreground">No eligible posted {statement.direction === 'in' ? 'customer receipts' : 'supplier payments'} on this bank ledger. <Link to="/payments" className="text-primary underline">Record the missing payment</Link> using the existing workflow, then refresh.</p>
        : <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
          <select disabled={Boolean(busy) || Boolean(review)} className="rounded-md border bg-background p-2 text-sm" value={paymentId} onChange={e => { reset(); setPaymentId(e.target.value); setAmount(defaultMatchAmount(statement, options.find(p => p.id === e.target.value))); }} data-testid="select-match-payment">
            <option value="">Choose a payment</option>
            {options.map(p => <option key={p.id} value={p.id}>{p.effective_date} · {p.reference || 'No reference'} · {formatMinor(p.remaining_minor)} remaining</option>)}
          </select>
          <input aria-label="Amount to match (GBP)" disabled={Boolean(busy) || Boolean(review)} className={inputCls} value={amount} onChange={e => { reset(); setAmount(e.target.value); }} placeholder="0.00" data-testid="input-match-amount" />
        </div>}
      {error && <Notice tone="error" testId="text-match-error">{error}</Notice>}
      {review && <Notice testId="text-match-review">
        <p className="font-medium">Confirm: match {formatMinor(review.body.amount_minor)} of this line to payment {review.data.payment?.reference || payment?.reference || review.body.payment_id}.</p>
        <p>Afterwards the statement line has {formatMinor(review.data.statement_remaining_minor)} unexplained and the payment has {formatMinor(review.data.payment_remaining_minor)} unmatched. No payment or journal is created.</p>
      </Notice>}
      {busy && <p role="status" className="text-xs text-muted-foreground">{busy}…</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy === 'Recording match'} onClick={() => { reset(); onClose(); }} data-testid="button-cancel-match">Cancel</Button>
        {review ? <><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={reset}>Change</Button><Button size="sm" disabled={Boolean(busy)} onClick={confirm} data-testid="button-confirm-match">Confirm match</Button></>
          : <Button size="sm" disabled={Boolean(busy) || !payment || !amount} onClick={runReview} data-testid="button-review-match">Review match</Button>}
      </div>
    </div>
  );
}
