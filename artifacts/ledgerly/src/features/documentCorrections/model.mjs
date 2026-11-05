const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const copy = value => JSON.parse(JSON.stringify(value));
const frozen = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
};
export function correctionForm(document, today) {
  return { reason: '', effective_date: today, line_items: document.source.line_items.map(({ quantity, unit_price }) => ({ quantity, unit_price })) };
}
export function correctionIntent(form, requestId) {
  if (!uuid(requestId) || typeof form.reason !== 'string' || !form.reason.trim() || form.reason.trim().length > 1000) throw Error('Enter a reason for this correction.');
  const date = form.effective_date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '1900-01-01' || date > '2199-12-31' ||
      !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw Error('Choose a valid correction date.');
  if (!Array.isArray(form.line_items) || !form.line_items.length || form.line_items.length > 200) throw Error('The original document lines are required.');
  const lines = form.line_items.map(line => {
    if (['quantity', 'unit_price'].some(key => typeof line[key] !== 'string' || !line[key].trim() || line[key].length > 64)) throw Error('Enter a quantity and unit price for every line.');
    return { quantity: line.quantity.trim(), unit_price: line.unit_price.trim() };
  });
  return { request_id: requestId, reason: form.reason.trim(), effective_date: date, line_items: lines };
}
export const canReviewCorrection = context => context?.capabilities?.review_corrections === true && Array.isArray(context.blockers) && context.blockers.length === 0;

/** Page-memory recovery only. A scope disposal fences late UI results, never cancels a server commit. */
export function createCorrectionController({ client, companyId, documentId, onState = () => {}, makeRequestId = () => crypto.randomUUID(), onSaved = () => {} }) {
  let active = true, generation = 0, abort;
  let state = { status: 'idle', context: null, review: null, pending: null, error: null, receipt: null };
  const current = g => active && generation === g;
  const emit = patch => { state = { ...state, ...patch }; if (active) onState(state); };
  return {
    get state() { return state; },
    async load() {
      if (!active || state.status === 'posting' || state.status === 'unknown') return;
      const g = ++generation; abort?.abort(); abort = new AbortController();
      emit({ status: 'loading', context: null, review: null, pending: null, error: null, receipt: null });
      try {
        const context = await client.correctionContext(companyId, documentId, abort.signal);
        if (!current(g)) return;
        if (context?.document?.id !== documentId || context.document.company_id !== companyId || !uuid(context.document.revision)) throw Error('Correction context did not match this document. Refresh to try again.');
        emit({ status: 'ready', context });
      } catch (error) { if (current(g)) emit({ status: 'error', error }); }
    },
    discardReview() {
      if (!active || !['ready', 'reviewed'].includes(state.status)) return;
      emit({ status: 'ready', review: null, pending: null, error: null });
    },
    async review(form) {
      if (!active || !['ready', 'reviewed'].includes(state.status) || !canReviewCorrection(state.context)) return;
      const g = ++generation, context = state.context;
      emit({ status: 'reviewing', review: null, pending: null, error: null });
      try {
        const intent = correctionIntent(form, makeRequestId());
        const result = await client.reviewCorrection(companyId, documentId, intent, context.document.revision);
        if (!current(g)) return;
        if (result?.expected_revision !== context.document.revision || result.before?.revision !== context.document.revision ||
            result.intent?.request_id !== intent.request_id || result.intent.reason !== intent.reason || result.intent.effective_date !== intent.effective_date ||
            typeof result.review_token !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(result.review_token) || !result.after?.money || !result.settlement)
          throw Error('The correction review could not be verified. Refresh before continuing.');
        const pending = frozen(copy({ body: { ...result.intent, review_token: result.review_token }, revision: result.expected_revision }));
        emit({ status: 'reviewed', review: result, pending });
      } catch (error) { if (current(g)) emit({ status: 'ready', error }); }
    },
    async post() {
      if (!active || !['reviewed', 'unknown'].includes(state.status) || !state.pending || state.context?.capabilities?.correct_documents !== true) return;
      const g = ++generation, pending = state.pending;
      emit({ status: 'posting', error: null });
      try {
        const receipt = await client.commitCorrection(companyId, documentId, pending.body, pending.revision);
        if (!current(g)) return;
        if (receipt?.document_id !== documentId || receipt.id !== pending.body.request_id || !['posted', 'duplicate'].includes(receipt.status) || !uuid(receipt.revision) || !uuid(receipt.journal_id)) throw Error('The response was incomplete. Check this same correction again.');
        emit({ status: 'posted', receipt, pending: null });
        try { onSaved(receipt); } catch { emit({ error: Error('Correction posted successfully. Refresh the document to see the updated amounts.') }); }
      } catch (error) {
        if (!current(g)) return;
        const definitive = [400, 401, 403, 404, 409, 415, 422, 428].includes(error.status);
        emit(definitive ? { status: 'error', error, review: null, pending: null } : { status: 'unknown', error });
      }
    },
    dispose() { active = false; generation++; abort?.abort(); },
  };
}
