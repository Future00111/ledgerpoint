import { MAX_CAPTURE_BYTES } from '../../api/documentIntake.mjs';
import { docPath } from '../../api/accountingDocuments.mjs';

export { MAX_CAPTURE_BYTES };
export const MAX_QUEUE_FILES = 10;
export const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const types = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const extensionType = name => /\.pdf$/i.test(name) ? 'application/pdf' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.png$/i.test(name) ? 'image/png' : '';
export function fileMediaType(file) { return file.type || extensionType(file.name); }
export function validateCaptureFile(file) {
  if (!file || !types.has(fileMediaType(file))) return 'Choose a PDF, JPG or PNG file.';
  if (!Number.isSafeInteger(file.size) || file.size < 1) return 'The file is empty or its size is unavailable.';
  if (file.size > MAX_CAPTURE_BYTES) return 'This file is larger than 5 MiB. Choose a smaller file.';
  if (!file.name || file.name.length > 255) return 'Use a filename between 1 and 255 characters.';
  return null;
}
export function validateBatch(files, existingCount = 0) {
  return files.length + existingCount > MAX_QUEUE_FILES ? 'Keep at most 10 files in the queue. Clear finished files before adding more.' : null;
}
export function capturePath(source) {
  return source?.document_id && docPath(source.document_kind, source.document_id) || `/documents?capture=${encodeURIComponent(source.id)}`;
}
export function prepareCapturePath(kind, sourceId) {
  if (!['purchase_bill', 'supplier_credit_note'].includes(kind)) return null;
  return `${kind === 'purchase_bill' ? '/bills' : '/supplier-credit-notes'}/new?capture=${encodeURIComponent(sourceId)}`;
}
export const envelopeKey = envelope => JSON.stringify(envelope);
/** A capture review has authoritative money before an accounting document exists. */
export function displayedDocumentMoney(captureMode, captureReview, document, dirty) {
  return captureMode ? captureReview?.money ?? null : !dirty ? document?.money ?? null : null;
}
export const reviewMatches = (review, key, envelope) => Boolean(review && review.key === key && review.envelopeKey === envelopeKey(envelope));
export const emptyAcknowledgements = () => ({ source_reviewed: false, supplier_confirmed: false, tax_treatment_confirmed: false });
export const allAcknowledged = acknowledgements => Object.keys(emptyAcknowledgements()).every(key => acknowledgements?.[key] === true);
export function buildReviewedDraft(review, key, envelope, acknowledgements) {
  if (!reviewMatches(review, key, envelope)) throw new Error('Details changed. Review the current details and totals before saving.');
  if (!allAcknowledged(acknowledgements)) throw new Error('Check the source, supplier and VAT treatment before saving.');
  return { envelope, review_fingerprint: review.review_fingerprint, ...emptyAcknowledgements(), ...acknowledgements };
}
/** Scope tickets make late responses inert after a route/company change or unmount. */
export function createScopeGate() {
  let sequence = 0;
  return { begin: key => ({ key, sequence: ++sequence }), current: (ticket, key) => ticket.key === key && ticket.sequence === sequence, invalidate: () => { sequence++; } };
}

/** Read only a validated bounded file. The payload can be reused unchanged after uncertain upload failure. */
export function readCaptureFile(file, { signal, onProgress = () => {}, Reader = globalThis.FileReader } = {}) {
  const invalid = validateCaptureFile(file);
  if (invalid) return Promise.reject(new Error(invalid));
  return new Promise((resolve, reject) => {
    const reader = new Reader();
    const abort = () => { reader.abort(); reject(new DOMException('File reading cancelled.', 'AbortError')); };
    const finish = () => signal?.removeEventListener('abort', abort);
    reader.onprogress = event => { if (event.lengthComputable) onProgress(Math.min(100, Math.floor(event.loaded * 100 / event.total))); };
    reader.onerror = () => { finish(); reject(new Error('The file could not be read. Retry or choose it again.')); };
    reader.onabort = () => { finish(); reject(new DOMException('File reading cancelled.', 'AbortError')); };
    reader.onload = () => {
      finish();
      if (signal?.aborted) return reject(new DOMException('File reading cancelled.', 'AbortError'));
      const content = String(reader.result ?? '').split(',')[1];
      if (!content || content.length > Math.ceil(MAX_CAPTURE_BYTES / 3) * 4) return reject(new Error('The file content could not be verified.'));
      resolve({ filename: file.name, media_type: fileMediaType(file), content_base64: content });
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    reader.readAsDataURL(file);
  });
}
