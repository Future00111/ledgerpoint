import { useEffect, useRef, useState } from 'react';
import { recordId, requestScope } from './model.mjs';
const denied = error => error?.status === 401 || error?.status === 403;

/** Used only inside a component keyed by actor/company/role. No shared cache or browser storage. */
export function useSensitiveEntry({ companyId, role, client, canPrepare, blankForm, buildIntent, savedMessage }) {
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
      setMessage(receipt.status === 'created' ? savedMessage : 'This request was already saved. No second record was created.');
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
  const changeLookup = value => { if (!inFlight.current && !['uncertain', 'conflict'].includes(phase)) { setLookupId(value); setRecord(null); setValidation(''); } };
  return { id, form, attempt, phase, lookupId, record, message, validation, busy, locked, save, lookup, fresh, update, changeLookup };
}
