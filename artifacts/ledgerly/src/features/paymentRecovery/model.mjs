import { paymentPostBody } from '../../lib/paymentRequestScope.mjs';

export const canConfigurePayments = capabilities => capabilities?.configure_payments === true;
export const canPostPayments = capabilities => capabilities?.post_payments === true;
export const recoveryBusy = state => ['posting', 'checking'].includes(state?.phase);
export const recoveryUnresolved = state => Boolean(state && state.phase !== 'recorded');

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** Page-memory recovery only. The same immutable intent and token survive every retry. */
export function createPaymentRecovery(companyId, api) {
  let state = null, generation = 0;
  const listeners = new Set();
  const publish = next => {
    state = next ? Object.freeze(next) : null;
    listeners.forEach(listener => listener());
  };
  const recorded = (result, id) => result?.id === id &&
    typeof result.journal_id === 'string' && result.journal_id.length > 0 &&
    ['posted', 'duplicate', 'recorded'].includes(result.status);

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
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async record(review, capabilities) {
      if (state || !canPostPayments(capabilities)) return false;
      const body = freeze(paymentPostBody(companyId, review));
      await send({ companyId, body, check: 'not_checked', result: null });
      return true;
    },
    async retry(capabilities) {
      if (state?.phase !== 'unknown' || !canPostPayments(capabilities)) return false;
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
        } else if (result?.status === 'unknown' && result.id === attempt.body.id) {
          // Absence at one read is not proof of failure: the first request may still commit.
          publish({ ...attempt, phase: 'unknown', check: 'not_found', error: null });
        } else throw new Error('Payment outcome could not be verified.');
      } catch (error) {
        if (current === generation) publish({ ...attempt, phase: 'unknown', error });
      }
      return true;
    },
    clearRecorded() {
      if (state?.phase === 'recorded') { generation++; publish(null); }
    },
    abandon() {
      if (state?.phase !== 'unknown') return false;
      generation++; publish(null); return true;
    },
    // Called on company change/unmount. No prior-company response may update a new view.
    reset() { generation++; publish(null); },
  };
}
