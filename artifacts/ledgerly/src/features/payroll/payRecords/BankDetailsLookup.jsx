import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { bankDetailsClient } from './bankClient.mjs';
import { bankProjection, createBankLookup, validateBankDetails } from './bankModel.mjs';

export function BankDetailsLookup(props) {
  const { actorId, companyId, role } = props;
  if (!actorId || !companyId || !bankProjection(role)) return null;
  return <ScopedBankDetails key={JSON.stringify([actorId, companyId, role])} {...props} />;
}

function ScopedBankDetails({ companyId, role, client = bankDetailsClient }) {
  const employeeInput = useRef(null);
  const controller = useRef(null);
  if (!controller.current) controller.current = createBankLookup({ companyId, role, client });
  const lookup = controller.current;
  const state = useSyncExternalStore(lookup.subscribe, lookup.getSnapshot, lookup.getSnapshot);
  useEffect(() => { lookup.activate(); return lookup.dispose; }, [lookup]);
  return <section className="workspace-card space-y-4 p-4 sm:p-6" aria-labelledby="bank-lookup-heading" aria-busy={state.status === 'loading'}>
    <h2 id="bank-lookup-heading" className="text-lg font-semibold">Employee bank details</h2>
    <p className="text-sm text-muted-foreground">Look up an employee using this company’s internal UUID. {bankProjection(role) === 'full' ? 'Your role can view the account number.' : 'Your role can view only the last four digits.'} Each successful lookup is recorded in the audit trail.</p>
    <form autoComplete="off" className="space-y-3" onSubmit={event => { event.preventDefault(); void lookup.lookup(); }}>
      <label className="block space-y-1 text-sm">Employee UUID for bank lookup<Input ref={employeeInput} value={state.employeeId} onChange={event => lookup.changeEmployee(event.target.value)} maxLength={36} spellCheck={false} autoComplete="off" /></label>
      <Button type="submit" variant="outline" disabled={state.status === 'loading'}>Look up bank details</Button>
      {state.employeeId && <Button type="button" variant="ghost" onClick={() => {
        lookup.changeEmployee('');
        employeeInput.current?.focus();
      }}>Clear bank lookup</Button>}
    </form>
    <BankLookupResult state={state} role={role} />
  </section>;
}

export function BankLookupResult({ state, role }) {
  if (!bankProjection(role)) return null;
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return <p role="status">Loading bank details…</p>;
  if (state.status === 'invalid') return <p role="alert">Enter the internal employee reference as a UUID.</p>;
  if (state.status === 'unavailable') return <p role="alert">Bank details could not be found or your access could not be confirmed. Previous values have been cleared.</p>;
  let result;
  if (state.status === 'ready') {
    try { result = validateBankDetails(state.result, role); } catch { /* Invalid projections must never reach the display. */ }
  }
  if (!result) return <p role="alert">Bank details could not be loaded. Previous values have been cleared. Try the lookup again.</p>;
  return <section className="rounded-xl border p-4" aria-label="Employee bank lookup result">
    <dl className="space-y-1 text-sm"><dt className="text-muted-foreground">{bankProjection(role) === 'full' ? 'Bank account number' : 'Account number ending'}</dt>
      <dd className="font-mono text-lg tabular-nums">{bankProjection(role) === 'full' ? result.account_number : `••••${result.last_four}`}</dd></dl>
  </section>;
}
