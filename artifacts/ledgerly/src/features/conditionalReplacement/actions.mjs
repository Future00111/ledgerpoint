import { isUnknownOutcome, writePending, readPending, clearPending, recoveredReceipt } from './model.mjs';

/** Write/recovery steps used by the panel, kept DOM-free so interaction paths are testable.
 * Storage is always keyed by the company/document captured when the request started, so a
 * company switch mid-request neither leaks nor clears another company's pending request.
 * `isCurrent()` reports whether the screen still shows that company/document; results for a
 * stale scope are returned as 'stale' and must not be rendered. */
export async function recordReplacement({ client, storage, companyId, documentId, body, isCurrent = () => true }) {
  const previous = readPending(storage, companyId, documentId);
  if (previous && JSON.stringify(previous.body) !== JSON.stringify(body)) {
    return { kind: 'failed', pending: previous, error: Error('Resolve the existing request before recording different terms.') };
  }
  try { writePending(storage, companyId, documentId, body); }
  catch (error) { return { kind: 'failed', pending: previous, error }; }
  try {
    const receipt = await client.appendReplacement(companyId, documentId, body);
    if (!receipt?.id || receipt.request_id !== body.request_id) {
      // A reply we cannot match is not proof of success: keep the request recoverable.
      return isCurrent() ? { kind: 'unknown', pending: { company_id: companyId, document_id: documentId, body } } : { kind: 'stale' };
    }
    clearPending(storage, companyId, documentId);
    return isCurrent() ? { kind: 'recorded', receipt } : { kind: 'stale' };
  } catch (error) {
    if (isUnknownOutcome(error)) return isCurrent() ? { kind: 'unknown', pending: { company_id: companyId, document_id: documentId, body } } : { kind: 'stale' };
    // A rejection of a replay cannot disprove an earlier in-flight commit.
    if (previous) return isCurrent() ? { kind: 'failed', pending: previous, error, reload: error.status === 409 } : { kind: 'stale' };
    // Only the first attempt's definite rejection can clear its new reference.
    clearPending(storage, companyId, documentId);
    return isCurrent() ? { kind: 'failed', error, reload: error.status === 409 } : { kind: 'stale' };
  }
}

/** Confirms from history only. Resends the identical body (same request ID) only when
 * explicitly allowed and the caller still has write permission. */
export async function checkPendingReplacement({ client, storage, companyId, documentId, pending, resend = false, canWrite = false, isCurrent = () => true }) {
  if (!pending || pending.company_id !== companyId || pending.document_id !== documentId) return { kind: 'stale' };
  let history;
  try { history = await client.replacementHistory(companyId, documentId); }
  catch (error) { return isCurrent() ? { kind: 'failed', error, reload: false } : { kind: 'stale' }; }
  if (!isCurrent()) return { kind: 'stale' };
  const found = recoveredReceipt(history, pending.body.request_id);
  if (found) { clearPending(storage, companyId, documentId); return { kind: 'recorded', receipt: found, history }; }
  if (!resend || !canWrite) return { kind: 'absent', history };
  return recordReplacement({ client, storage, companyId, documentId, body: pending.body, isCurrent });
}

export async function observeReplacementVersion({ client, companyId, documentId, replacementId, isCurrent = () => true }) {
  try {
    const r = await client.observeReplacement(companyId, documentId, replacementId);
    if (!isCurrent()) return { kind: 'stale' };
    if (r?.replacement_id !== replacementId || r.observation?.state !== 'observed') return { kind: 'unknown' };
    return { kind: 'observed', observation: r.observation };
  } catch (error) {
    if (!isCurrent()) return { kind: 'stale' };
    return isUnknownOutcome(error) ? { kind: 'unknown' } : { kind: 'failed', error };
  }
}
