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

function discoveryReceipts(result, companyId, documentId) {
  const fields = ['request_id', 'document_id', 'revision', 'journal_id', 'effective_date', 'reason'];
  if (result?.company_id !== companyId || result.document_id !== documentId || typeof result.has_more !== 'boolean' ||
      !Array.isArray(result.receipts) || result.receipts.length > 100 || Object.keys(result).some(key => !['company_id','document_id','has_more','receipts'].includes(key))) throw Error('Recorded corrections could not be verified.');
  const ids = new Set(), journals = new Set(), revisions = new Set();
  for (const item of result.receipts) {
    if (!item || Object.keys(item).length !== fields.length || Object.keys(item).some(key => !fields.includes(key)) ||
        !uuid(item.request_id) || !uuid(item.journal_id) || !uuid(item.revision) || item.document_id !== documentId ||
        typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 1000 ||
        typeof item.effective_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.effective_date) ||
        !Number.isFinite(Date.parse(item.effective_date+'T00:00:00Z')) || new Date(item.effective_date+'T00:00:00Z').toISOString().slice(0,10) !== item.effective_date ||
        ids.has(item.request_id) || journals.has(item.journal_id) || revisions.has(item.revision)) throw Error('Recorded corrections could not be verified.');
    ids.add(item.request_id); journals.add(item.journal_id); revisions.add(item.revision);
  }
  return frozen(copy(result.receipts));
}

/** Persist only a request locator before sending. The server remains the
 * authority; a reload never reconstructs financial intent or reposts it. */
export function createCorrectionController({ client, companyId, documentId, onState = () => {}, makeRequestId = () => crypto.randomUUID(), onSaved = () => {}, rememberRequest = () => {}, forgetRequest = () => {}, recoveryRequestId = null, discoveryMode = false }) {
  let active = true, generation = 0, abort;
  let state = { status: 'idle', context: null, review: null, pending: null, error: null, receipt: null, requestId: recoveryRequestId,
    discovery: discoveryMode, candidates: null, hasMore: false, selectedReceipt: null };
  const current = g => active && generation === g;
  const emit = patch => { state = { ...state, ...patch }; if (active) onState(state); };
  return {
    get state() { return state; },
    async discover() {
      if (!active || !state.discovery || state.requestId || ['posting','checking','discovering'].includes(state.status)) return;
      const g = ++generation; abort?.abort(); abort = new AbortController();
      emit({ status: 'discovering', candidates: null, error: null });
      try {
        const result = await client.discoverCorrections(companyId, documentId, abort.signal);
        if (!current(g)) return;
        emit({ status: 'discovery', candidates: discoveryReceipts(result, companyId, documentId), hasMore: result.has_more });
      } catch (error) { if (current(g)) emit({ status: 'discovery', candidates: null, error }); }
    },
    async selectReceipt(requestId) {
      if (!active || !state.discovery || !['discovery','unknown'].includes(state.status) || (state.requestId && state.requestId !== requestId)) return;
      const selected = state.candidates?.find(item => item.request_id === requestId);
      if (!selected) return;
      try { rememberRequest(requestId); }
      catch (error) { emit({ error: Error('Could not save the recovery link. No correction was selected.') }); return; }
      emit({ requestId, selectedReceipt: selected, receipt: null });
      return this.recover();
    },
    async recover() {
      if(!active || ['posting','checking'].includes(state.status)) return;
      const requestId=state.requestId??state.pending?.body.request_id;
      const g=++generation; abort?.abort();abort=new AbortController();
      emit({status:'checking',error:null});
      try {
        if(!uuid(requestId)) throw Error('The correction recovery link is invalid. Check correction history before taking further action.');
        const result=await client.recoverCorrection(companyId,documentId,requestId,abort.signal);
        if(!current(g)) return;
        if(result?.request_id!==requestId || result.document_id!==documentId || !['known','unknown'].includes(result.state))
          throw Error('The correction outcome could not be verified.');
        if(result.state==='unknown') {emit({status:'unknown',requestId});return;}
        const receipt=result.receipt;
        if(receipt?.id!==requestId || receipt.document_id!==documentId || receipt.status!=='posted' || !uuid(receipt.journal_id)||!uuid(receipt.revision))
          throw Error('The correction receipt could not be verified.');
        if(state.selectedReceipt && (receipt.revision!==state.selectedReceipt.revision || receipt.journal_id!==state.selectedReceipt.journal_id))
          throw Error('The correction receipt changed. Keep checking the original request before continuing.');
        emit({status:'posted',receipt,pending:null,requestId});
        // Do not refetch/unmount automatically while the recovery locator is in
        // the URL: remounting would recover and refetch indefinitely.
      } catch(error) {if(current(g)) emit({status:'unknown',error,requestId});}
    },
    async load() {
      if(state.requestId) return this.recover();
      if(state.discovery) return this.discover();
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
            JSON.stringify(result.intent.line_items) !== JSON.stringify(intent.line_items) ||
            typeof result.review_token !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(result.review_token) || !result.after?.money || !result.settlement)
          throw Error('The correction review could not be verified. Refresh before continuing.');
        const pending = frozen(copy({ body: { ...result.intent, review_token: result.review_token }, revision: result.expected_revision }));
        emit({ status: 'reviewed', review: result, pending });
      } catch (error) { if (current(g)) emit({ status: 'ready', error }); }
    },
    async post() {
      if (!active || !['reviewed', 'unknown'].includes(state.status) || !state.pending || state.context?.capabilities?.correct_documents !== true) return;
      const g = ++generation, pending = state.pending, unresolved = state.status === 'unknown';
      try { rememberRequest(pending.body.request_id); }
      catch(error) {emit({status:unresolved?'unknown':'reviewed',error:Error(unresolved
        ? 'Could not save the recovery link. The earlier correction is still unverified; check that request before continuing.'
        : 'Could not save the recovery link. No correction was sent.')});return;}
      emit({requestId:pending.body.request_id});
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
        // Rejection of this retry says nothing about the earlier ambiguous
        // attempt: it may still commit. Keep its locator and frozen request
        // until the canonical receipt is verified.
        if (definitive && !unresolved) {
          try { forgetRequest(); }
          catch { emit({ status: 'unknown', error: Error('Could not clear the recovery link. Check this request before continuing.') }); return; }
          emit({ status: 'error', error, context: null, review: null, pending: null, requestId: null });
        } else emit({ status: 'unknown', error });
      }
    },
    dispose() { active = false; generation++; abort?.abort(); },
  };
}
