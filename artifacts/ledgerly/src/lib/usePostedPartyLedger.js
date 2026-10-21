import { useEffect, useState } from 'react';
import { accounting, penceToDisplay } from '@/api/accountingDocuments.mjs';

/**
 * Authoritative posted party balances and ageing as at today, from the native ledger.
 * status: 'loading' | 'ready' | 'error'. Values remain minor-unit strings; never silently 0.
 */
export function usePostedPartyLedger(companyId, partyType) {
  const [state, setState] = useState({ status: 'loading', balances: new Map(), ageing: new Map(), error: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setState({ status: 'loading', balances: new Map(), ageing: new Map(), error: '' });
    if (!companyId) return;
    const c = new AbortController();
    const to = new Date().toISOString().slice(0, 10);
    const from = `${new Date().getFullYear()}-01-01`;
    accounting.reports(companyId, from, to, c.signal).then(d => {
      if (c.signal.aborted) return;
      const keep = r => !partyType || r.party_type === partyType;
      setState({
        status: 'ready', error: '',
        balances: new Map((d.party_balances ?? []).filter(keep).map(r => [r.party_id, r.balance_minor])),
        ageing: new Map((d.ageing ?? []).filter(keep).map(r => [r.party_id, r])),
      });
    }).catch(e => { if (!c.signal.aborted) setState({ status: 'error', balances: new Map(), ageing: new Map(), error: e.message || 'Posted balances unavailable.' }); });
    return () => c.abort();
  }, [companyId, partyType, tick]);
  const sumMinor = (values) => values.reduce((s, v) => s + BigInt(v ?? '0'), 0n).toString();
  const total = state.status === 'ready' ? sumMinor([...state.balances.values()]) : null;
  const ageingTotals = state.status === 'ready' ? ['current_minor', 'days_1_30_minor', 'days_31_60_minor', 'days_61_90_minor', 'days_90_plus_minor']
    .reduce((o, k) => ({ ...o, [k]: sumMinor([...state.ageing.values()].map(r => r[k])) }), {}) : null;
  const display = (partyId) => state.status === 'ready' ? penceToDisplay(state.balances.get(partyId) ?? '0') : state.status === 'loading' ? 'Loading…' : 'Unavailable';
  return { ...state, total, ageingTotals, display, retry: () => setTick(t => t + 1) };
}

export const minorToNumber = (m) => (m == null ? null : Number(BigInt(m)) / 100);
