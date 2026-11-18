import { paymentPostBody } from '../../lib/paymentRequestScope.mjs';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const canConfigurePayments = capabilities => capabilities?.configure_payments === true;
export const canPostPayments = capabilities => capabilities?.post_payments === true;
export const recoveryBusy = state => ['posting', 'checking', 'resolving'].includes(state?.phase);
export const recoveryUnresolved = state => Boolean(state && state.phase !== 'recorded');

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** Exact intent retries stay in memory; restored locators permit status reads only. */
export function createPaymentRecovery(companyId, api, { recoveryRequestId = null, rememberRequest = () => {}, forgetRequest = () => {}, nextRecoveryRequest = () => null,
  discoverLostReference = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('recover') === 'lost' } = {}) {
  let state = recoveryRequestId ? Object.freeze({ companyId, body: Object.freeze({ id: recoveryRequestId }),
    phase: 'unknown', readOnly: true, check: 'not_checked', result: null, error: null }) : discoverLostReference ? Object.freeze({ companyId, phase: 'discovery', readOnly: true,
      body: Object.freeze({ id: null }), candidates: null, hasMore: false, error: null, discover, selectReceipt }) : null, generation = 0;
  const listeners = new Set(), retiredIds = new Set();
  let allowTerminalClear = false;
  const publish = next => {
    state = next ? Object.freeze({ ...next, selectTerminal, cancelTerminal, confirmTerminal, continueFresh }) : null;
    listeners.forEach(listener => listener());
  };
  const recorded = (result, id) => uuid(id) && result?.id === id &&
    uuid(result.journal_id) &&
    ['posted', 'duplicate', 'recorded'].includes(result.status);

  const binding = (result, id) => result?.id === id && ['pending', 'no_effect'].includes(result.status) &&
     /^sha256:[a-f0-9]{64}$/.test(result.request_hash) && /^sha256:[a-f0-9]{64}$/.test(result.review_hash) &&
    typeof result.reference === 'string' && /^\d{1,20}$/.test(result.amount_minor) &&
    ['payment', 'allocation', 'unallocation', 'refund', 'reversal'].includes(result.kind) && ['customer', 'supplier'].includes(result.party_type);
  const sameBinding = (a, b) => a?.id === b?.id && a?.request_hash === b?.request_hash && a?.review_hash === b?.review_hash;
  async function selectTerminal(capabilities) {
    if (state?.phase !== 'unknown' || !canPostPayments(capabilities)) return false;
    const attempt = state, current = ++generation;
    publish({ ...attempt, phase: 'checking', confirming: false, error: null });
    try {
      const result = await api.recoverPayment(companyId, attempt.body.id);
      if (current !== generation) return false;
      if (recorded(result, attempt.body.id)) publish({ ...attempt, phase: 'recorded', result, error: null });
      else if (binding(result, attempt.body.id) && (!attempt.binding || sameBinding(result, attempt.binding)))
        publish({ ...attempt, phase: 'unknown', check: result.status, binding: freeze(structuredClone(result)), confirming: result.status === 'pending', error: null });
      else throw new Error('The selected attempt could not be verified. Check its status again.');
    } catch (error) { if (current === generation) publish({ ...attempt, phase: 'unknown', confirming: false, error }); }
    return true;
  }
  function cancelTerminal() {
    if (state?.phase !== 'unknown') return false;
    publish({ ...state, confirming: false }); return true;
  }
  async function confirmTerminal(capabilities) {
    if (state?.phase !== 'unknown' || !state.confirming || !state.binding || !canPostPayments(capabilities)) return false;
    const attempt = state, current = ++generation;
    publish({ ...attempt, phase: 'resolving', confirming: false, error: null });
    try {
      const {request_hash, review_hash} = attempt.binding;
      const result = await api.terminatePaymentAttempt(companyId, attempt.body.id, {request_hash, review_hash});
      if (current !== generation) return false;
      if (recorded(result, attempt.body.id)) { publish({ ...attempt, phase: 'recorded', result, confirming: false, error: null }); return true; }
      // A write acknowledgement never unlocks a new payment. Read durable status afresh.
      const verified = await api.recoverPayment(companyId, attempt.body.id);
      if (current !== generation) return false;
      if (recorded(verified, attempt.body.id)) publish({ ...attempt, phase: 'recorded', result: verified, confirming: false, error: null });
      else if (binding(verified, attempt.body.id) && verified.status === 'no_effect' && sameBinding(verified, attempt.binding))
        publish({ ...attempt, phase: 'unknown', readOnly: true, check: 'no_effect', confirming: false, error: null });
      else throw new Error('The terminal outcome could not be verified.');
    } catch (error) { if (current === generation) publish({ ...attempt, phase: 'unknown', confirming: false, error }); }
    return true;
  }
  function clearTerminal() {
    if (!allowTerminalClear || state?.check !== 'no_effect') return false;
    const id = state.body.id;
    forgetRequest(id); retiredIds.add(id); generation++;
    const next = nextRecoveryRequest();
    publish(next ? { companyId, body: Object.freeze({id: next}), phase: 'unknown', readOnly: true, check: 'not_checked', result: null, error: null } : null);
    return true;
  }
  async function continueFresh(capabilities, onContinue) {
    if (state?.phase !== 'unknown' || state.check !== 'no_effect' || !state.binding || !canPostPayments(capabilities)) return false;
    const attempt = state, current = ++generation;
    publish({ ...attempt, phase: 'checking', error: null });
    try {
      const result = await api.recoverPayment(companyId, attempt.body.id);
      if (current !== generation) return false;
      if (recorded(result, attempt.body.id)) { publish({ ...attempt, phase: 'recorded', result, error: null }); return false; }
      if (!binding(result, attempt.body.id) || result.status !== 'no_effect' || !sameBinding(result, attempt.binding)) throw new Error('The terminal outcome could not be verified.');
      publish({ ...attempt, phase: 'unknown', confirming: false, error: null });
      allowTerminalClear = true;
      try { clearTerminal(); } finally { allowTerminalClear = false; }
      // Navigation may reset the old form only after all local locators are resolved.
      if (!state) onContinue?.();
      return state?.body.id !== attempt.body.id;
    } catch (error) { if (current === generation) publish({ ...attempt, phase: 'unknown', error }); }
    return false;
  }

  async function discover() {
    if (state?.phase !== 'discovery' || state.loading) return false;
    const attempt = state, current = ++generation;
    publish({ ...attempt, loading: true, candidates: null, error: null });
    try {
      const result = await api.discoverPayments(companyId);
      if (current !== generation) return false;
      const pending = result?.pending ?? [];
      const rows = Array.isArray(result?.receipts) && Array.isArray(pending) ? [...pending,...result.receipts] : null;
      if (!Array.isArray(rows) || result.receipts.length > 100 || typeof result.has_more !== 'boolean' ||
          new Set(rows.map(row => row?.id)).size !== rows.length || rows.some(row =>
            !(row.status === 'pending' ? uuid(row.id) && row.journal_id === undefined : recorded(row,row.id) && row.status === 'recorded') || !['payment', 'allocation', 'unallocation', 'refund', 'reversal'].includes(row.kind) ||
            !['customer', 'supplier'].includes(row.party_type) || typeof row.reference !== 'string' ||
            typeof row.amount_minor !== 'string' || !/^\d{1,20}$/.test(row.amount_minor) || !/^\d{4}-\d{2}-\d{2}$/.test(row.effective_date))) {
        throw new Error('Recorded payment history could not be verified.');
      }
      publish({ ...attempt, loading: false, candidates: freeze(structuredClone(rows)), hasMore: result.has_more, error: null });
    } catch (error) {
      if (current === generation) publish({ ...attempt, loading: false, candidates: null, error });
    }
    return true;
  }
  async function selectReceipt(id) {
    if (state?.phase !== 'discovery' || state.loading || !state.candidates?.some(row => row.id === id)) return false;
    const attempt = state, candidate = state.candidates.find(row => row.id === id), current = ++generation;
    publish({ ...attempt, loading: true, error: null });
    try {
      // Selection is explicit, and current authorization and outcome are checked again.
      const result = await api.recoverPayment(companyId, id);
      if (current !== generation) return false;
      if (candidate.status === 'pending' && result?.status === 'pending' && result.id === id) {
        rememberRequest(id);
        publish({companyId,body:Object.freeze({id}),readOnly:true,phase:'unknown',check:'pending',binding:binding(result,id)?freeze(structuredClone(result)):null,result:null,error:null});
        return true;
      }
      if (!recorded(result, id) || (candidate.status === 'recorded' && result.journal_id !== candidate.journal_id)) throw new Error('The selected payment outcome could not be verified.');
      publish({ companyId, body: Object.freeze({ id }), readOnly: true, phase: 'recorded', result, error: null });
    } catch (error) {
      if (current === generation) publish({ ...attempt, loading: false, error });
    }
    return true;
  }

  async function send(attempt) {
    const current = ++generation;
    publish({ ...attempt, phase: 'posting', error: null });
    try {
      // A fresh copy protects the retained request from transport-side mutation.
      const result = await api.postPayment(companyId, structuredClone(attempt.body));
      if (current !== generation) return;
      if (!recorded(result, attempt.body.id)) throw new Error('The recording response could not be verified.');
      publish({ ...attempt, phase: 'recorded', result, error: null });
    } catch (error) {
      if (current === generation) publish({ ...attempt, phase: 'unknown', error });
    }
  }

  return {
    getSnapshot: () => state,
    discover, selectReceipt,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async record(review, capabilities) {
      if (state || !canPostPayments(capabilities)) return false;
      const body = freeze(paymentPostBody(companyId, review));
      if (retiredIds.has(body.id)) throw new Error('This attempt is closed. Close this form and start a new payment review.');
      rememberRequest(body.id); // Must succeed before any financial request is sent.
      await send({ companyId, body, check: 'not_checked', result: null });
      return true;
    },
    async retry(capabilities) {
      if (state?.phase !== 'unknown' || state.readOnly || state.confirming || !canPostPayments(capabilities)) return false;
      await send(state);
      return true;
    },
    async check() {
      if (state?.phase !== 'unknown') return false;
      const attempt = state, current = ++generation;
      publish({ ...attempt, phase: 'checking', error: null });
      try {
        const result = await api.recoverPayment(companyId, attempt.body.id);
        if (current !== generation) return false;
        if (recorded(result, attempt.body.id)) {
          publish({ ...attempt, phase: 'recorded', result, error: null });
        } else if (['unknown','pending','no_effect'].includes(result?.status) && result.id === attempt.body.id) {
          if (attempt.binding && ['pending', 'no_effect'].includes(result.status) && (!binding(result, attempt.body.id) || !sameBinding(result, attempt.binding))) throw new Error('The attempt binding changed.');
          // Absence at one read is not proof of failure: the first request may still commit.
          publish({ ...attempt, readOnly: attempt.readOnly || result.status === 'no_effect', phase: 'unknown', binding: binding(result, attempt.body.id) ? freeze(structuredClone(result)) : null, confirming: false, check: result.status === 'pending' ? 'pending' : result.status === 'no_effect' ? 'no_effect' : 'not_found', error: null });
        } else throw new Error('Payment outcome could not be verified.');
      } catch (error) {
        if (current === generation) publish({ ...attempt, phase: 'unknown', error });
      }
      return true;
    },
    clearRecorded() {
      if (state?.phase === 'recorded') {
        forgetRequest(state.body.id); generation++;
        const next = nextRecoveryRequest();
        publish(next ? { companyId, body: Object.freeze({ id: next }), phase: 'unknown',
          readOnly: true, check: 'not_checked', result: null, error: null } : null);
      }
    },
    abandon() {
      return false; // Closing an unknown view cannot cancel or clear an attempt.
    },
    // Called on company change/unmount. No prior-company response may update a new view.
    reset() { generation++; publish(null); },
  };
}
