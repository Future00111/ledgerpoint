import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/workspace/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { payRecordsClient } from './client.mjs';
import { buildIntent, formatSalary, payrollPermissions, recordId, requestScope } from './model.mjs';

const blankForm = () => ({ employee: '', date: '', salary: '' });
const denied = error => error?.status === 401 || error?.status === 403;

/** The same keyed boundary is used by the real route and disposable browser journey. */
export function PayRecordsWorkspace(props) {
  const { companyId, actorId, role } = props;
  if (!companyId) return <div className="workspace-page"><PageHeader title="Pay records" description="Choose a company to enter or look up annual pay." /></div>;
  if (!actorId || !payrollPermissions(role).read) return <div className="workspace-page"><PageHeader title="Pay records" />
    <p role="alert">Your current company role does not provide access to pay records.</p></div>;
  return <ScopedPayRecords key={JSON.stringify([actorId, companyId, role])} {...props} />;
}

function ScopedPayRecords({ companyId, companyName, role, client = payRecordsClient, onRefreshAccess }) {
  const canPrepare = payrollPermissions(role).prepare;
  const [id, setId] = useState(() => canPrepare ? globalThis.crypto.randomUUID() : '');
  const [form, setForm] = useState(blankForm);
  const [attempt, setAttempt] = useState(null);
  const [phase, setPhase] = useState('draft');
  const [lookupId, setLookupId] = useState('');
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState('');
  const [validation, setValidation] = useState('');
  const [busy, setBusy] = useState(false);
  const scope = useRef(null);
  const inFlight = useRef(false);
  if (!scope.current) scope.current = requestScope();
  useEffect(() => () => { scope.current.cancel(); }, []);
  const block = () => {
    setPhase('blocked'); setRecord(null); setAttempt(null); setForm(blankForm()); setLookupId(''); setId(''); setMessage(''); setValidation('');
  };
  const runRead = async (target, token) => {
    const result = await client.read(companyId, target, role, token.signal);
    if (token.isCurrent()) setRecord(result);
  };
  const save = async () => {
    if (inFlight.current || !canPrepare || !['draft', 'uncertain'].includes(phase)) return;
    let intent;
    try { intent = attempt ?? buildIntent(id, form); }
    catch (error) { setValidation(error.message); return; }
    inFlight.current = true;
    const token = scope.current.begin();
    setAttempt(intent); setPhase('saving'); setBusy(true); setRecord(null); setMessage(''); setValidation('');
    try {
      const receipt = await client.create(companyId, intent, token.signal);
      if (!token.isCurrent()) return;
      setPhase('saved'); setLookupId(receipt.id);
      setMessage(receipt.status === 'created' ? 'Pay record saved.' : 'This request was already saved. No second record was created.');
      try { await runRead(receipt.id, token); }
      catch (error) {
        if (!token.isCurrent()) return;
        if (denied(error)) block();
        else setMessage('The save is confirmed, but the saved values could not be loaded. Look up this record ID again.');
      }
    } catch (error) {
      if (!token.isCurrent()) return;
      if (denied(error)) block();
      else {
        const conflict = error?.status === 409 && error?.code === 'SENSITIVE_REQUEST_CONFLICT';
        setPhase(conflict ? 'conflict' : 'uncertain');
        setMessage(conflict
          ? 'This request was refused because it conflicts with an existing record. Check its record ID or start a new entry with corrected values.'
          : 'The save outcome is unconfirmed. It may already be saved. Keep these values and retry the same request or check its record ID.');
      }
    } finally { if (token.isCurrent()) { inFlight.current = false; setBusy(false); } }
  };
  const lookup = async (target = lookupId) => {
    if (inFlight.current) return;
    let canonical;
    try { canonical = recordId(target); }
    catch (error) { setValidation(error.message); return; }
    inFlight.current = true;
    const token = scope.current.begin();
    setBusy(true); setRecord(null); setValidation('');
    try {
      await runRead(canonical, token);
      if (token.isCurrent() && phase === 'uncertain') setMessage('A saved record was found. A lookup does not confirm this request’s creation receipt. The original request remains locked.');
    } catch (error) {
      if (!token.isCurrent()) return;
      if (denied(error)) block();
      else setMessage('The record could not be loaded. This does not prove that a save failed.');
    } finally { if (token.isCurrent()) { inFlight.current = false; setBusy(false); } }
  };
  const fresh = () => {
    if (inFlight.current || !['saved', 'conflict'].includes(phase)) return;
    scope.current.cancel(); setId(globalThis.crypto.randomUUID()); setForm(blankForm()); setAttempt(null);
    setPhase('draft'); setLookupId(''); setRecord(null); setMessage(''); setValidation('');
  };
  const update = (field, value) => { if (phase === 'draft' && !inFlight.current) { setForm(current => ({ ...current, [field]: value })); setValidation(''); } };
  const locked = phase !== 'draft' || busy;
  return <div className="workspace-page">
    <PageHeader eyebrow="Payroll preparation" title="Pay records" context={companyName}
      description="Dated annual salaries in GBP. Payroll calculations and payments are not available here." />
    {message && <p className="rounded-xl border p-4 text-sm" role="status">{message}</p>}
    {validation && <p className="text-sm text-destructive" role="alert">{validation}</p>}
    {phase === 'blocked' && <div className="space-y-3 rounded-xl border p-4">
      <p role="alert">The record or your access could not be confirmed. Previous values have been cleared. This does not prove that a save failed. Check another record ID or refresh company access before entering pay.</p>
      {onRefreshAccess && <Button onClick={onRefreshAccess}>Refresh company access</Button>}
    </div>}
    <div className={`grid gap-6${canPrepare && phase !== 'blocked' ? ' xl:grid-cols-2' : ''}`}>
      {canPrepare && phase !== 'blocked' && <section className="workspace-card space-y-4 p-4 sm:p-6" aria-labelledby="pay-entry-heading" aria-busy={busy}>
        <h2 id="pay-entry-heading" className="text-lg font-semibold">Enter annual pay</h2>
        <p className="text-sm text-muted-foreground">Use this company’s internal employee UUID. Each effective date creates a separate record.</p>
        <form autoComplete="off" onSubmit={event => { event.preventDefault(); save(); }} className="space-y-4">
          <label className="block space-y-1 text-sm">Employee reference<Input value={form.employee} onChange={event => update('employee', event.target.value)} disabled={locked} spellCheck={false} autoComplete="off" /></label>
          <label className="block space-y-1 text-sm">Effective from<Input type="date" min="0001-01-01" max="9999-12-31" value={form.date} onChange={event => update('date', event.target.value)} disabled={locked} /></label>
          <label className="block space-y-1 text-sm">Annual salary (GBP)<Input inputMode="decimal" placeholder="48000.00" value={form.salary} onChange={event => update('salary', event.target.value)} disabled={locked} autoComplete="off" /></label>
          <p className="text-xs text-muted-foreground">Enter pounds and pence without commas. Currency is fixed to GBP.</p>
          <label className="block space-y-1 text-sm">Record ID<Input value={id} readOnly spellCheck={false} /></label>
          <p className="text-xs text-muted-foreground">Keep this ID for later lookup. Pay details clear when you leave, reload or switch company.</p>
          {phase === 'draft' && <Button type="submit" disabled={busy}>Save pay record</Button>}
          {phase === 'saving' && <Button disabled>Saving pay record…</Button>}
          {phase === 'uncertain' && <Button type="button" disabled={busy} onClick={save}>Retry same request</Button>}
          {['uncertain', 'conflict'].includes(phase) && <Button type="button" variant="outline" disabled={busy} onClick={() => lookup(attempt.id)}>Check saved record</Button>}
          {phase === 'conflict' && <Button type="button" variant="outline" disabled={busy} onClick={fresh}>Start a new entry</Button>}
          {phase === 'saved' && <Button type="button" variant="outline" disabled={busy} onClick={fresh}>Start another record</Button>}
        </form>
      </section>}
      <section className="workspace-card space-y-4 p-4 sm:p-6" aria-labelledby="pay-lookup-heading" aria-busy={busy}>
        <h2 id="pay-lookup-heading" className="text-lg font-semibold">Look up annual pay</h2>
        <form autoComplete="off" onSubmit={event => { event.preventDefault(); lookup(); }} className="space-y-3">
          <label className="block space-y-1 text-sm">Pay record ID<Input value={lookupId} onChange={event => { setLookupId(event.target.value); setRecord(null); setValidation(''); }} disabled={busy || ['uncertain', 'conflict'].includes(phase)} spellCheck={false} autoComplete="off" /></label>
          <Button type="submit" variant="outline" disabled={busy || ['uncertain', 'conflict'].includes(phase)}>Look up pay record</Button>
        </form>
        {record && <PayRecordDetails record={record} role={role} />}
      </section>
    </div>
  </div>;
}

export function PayRecordDetails({ record, role }) {
  return <section className="space-y-3 rounded-xl border p-4" aria-label="Saved pay record">
    <h3 className="font-semibold">Saved pay record</h3>
    <dl className="space-y-3 text-sm">
      <div><dt className="text-muted-foreground">Record ID</dt><dd className="break-all">{record.id}</dd></div>
      <div><dt className="text-muted-foreground">Effective from</dt><dd>{record.effective_from}</dd></div>
      <div><dt className="text-muted-foreground">Annual salary (GBP)</dt><dd className="text-xl font-semibold tabular-nums">{formatSalary(record.annual_salary_pence)}</dd></div>
      {payrollPermissions(role).prepare && record.employee_id && <div><dt className="text-muted-foreground">Employee reference</dt><dd className="break-all">{record.employee_id}</dd></div>}
    </dl>
  </section>;
}
