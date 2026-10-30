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
        const payments = await api.payments(companyId);
        if (current !== generation) return false;
        if (!Array.isArray(payments)) throw new Error('Payment history could not be verified.');
        const payment = payments.find(row => row.events?.some(event => event.id === attempt.body.id));
        const event = payment?.events.find(row => row.id === attempt.body.id);
        if (event) {
          const result = { status: 'recorded', id: event.id, journal_id: event.journal_id };
          if (!recorded(result, attempt.body.id)) throw new Error('The recorded event has no available journal. Check its history again.');
          publish({ ...attempt, phase: 'recorded', result, payment, payments, error: null });
        } else {
          // Absence at one read is not proof of failure: the first request may still commit.
          publish({ ...attempt, phase: 'unknown', check: 'not_found', error: null });
        }
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
