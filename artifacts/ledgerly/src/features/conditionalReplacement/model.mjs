/** Pure helpers for replacement agreement history. No financial amounts are derived here:
 * the discount is the owner's explicit whole-penny entry, never scaled from earlier terms. */

export function poundsToPence(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) throw Error('Enter the agreed discount in pounds, with no more than two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const pence = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (pence <= 0n) throw Error('The agreed discount must be more than £0.00.');
  return pence.toString();
}

export function partyTypeFor(kind) {
  return kind === 'sales_invoice' ? 'customer' : kind === 'purchase_bill' ? 'supplier' : null;
}

/** Builds the exact append body. Predecessor comes from the history the owner reviewed. */
export function replacementInput({ kind, partyId, history, form, requestId }) {
  const party_type = partyTypeFor(kind);
  if (!party_type || !partyId) throw Error('Replacement agreements apply to posted invoices and bills only.');
  if (!history || history.consumed) throw Error('This agreement has been used by a credit and cannot be replaced.');
  if (!form.agreement_id) throw Error('A new agreement reference is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.agreement_date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(form.payment_deadline || '')) throw Error('Enter the agreement date and payment deadline.');
  if (form.payment_deadline < form.agreement_date) throw Error('The payment deadline must be on or after the agreement date.');
  const evidence = String(form.evidence_text ?? '');
  if (!evidence.trim()) throw Error('Record the agreement wording or a description of the evidence you hold.');
  if (form.attested !== true) throw Error('Confirm that you have checked these replacement terms.');
  return {
    request_id: requestId,
    predecessor_id: history.current_replacement_id ?? null,
    terms: { version: 1, party_type, party_id: partyId, currency: 'GBP', agreement_id: form.agreement_id,
      agreement_date: form.agreement_date, payment_deadline: form.payment_deadline, discount_gross_pence: poundsToPence(form.discount) },
    evidence_text: evidence,
    attested: true,
  };
}

/** True only when the outcome of a write is genuinely unknown (no trustworthy response). */
export function isUnknownOutcome(error) {
  if (!error) return false;
  // Cancelling the response does not roll back a request already sent.
  if (error.name === 'AbortError') return true;
  if (error.status === undefined || error.status === null) return true;
  if ([502, 503, 504].includes(error.status) && !error.code) return true;
  return error.status >= 500 && (!error.code || error.code === 'ACCOUNTING_OPERATION_FAILED');
}

export function pendingKey(companyId, documentId) {
  return `ledgerly.conditional-replacement.pending:${companyId}:${documentId}`;
}

export function readPending(storage, companyId, documentId) {
  try {
    const value = JSON.parse(storage?.getItem(pendingKey(companyId, documentId)) || 'null');
    return value && value.company_id === companyId && value.document_id === documentId && value.body?.request_id ? value : null;
  } catch { return null; }
}
export function writePending(storage, companyId, documentId, body) {
  const key = pendingKey(companyId, documentId);
  const value = JSON.stringify({ company_id: companyId, document_id: documentId, body });
  if (!storage) throw Error('Recovery storage is unavailable. Nothing was sent. Enable browser storage before recording terms.');
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) throw Error('The recovery reference could not be saved. Nothing was sent.');
}
export function clearPending(storage, companyId, documentId) {
  try { storage?.removeItem(pendingKey(companyId, documentId)); } catch { /* ignore */ }
}

/** Recovery from history only: a request is confirmed solely if history contains it. */
export function recoveredReceipt(history, requestId) {
  return history?.replacements?.find(r => r.request_id === requestId) ?? null;
}

export function versionLabel(row) {
  if (row.observation?.state === 'observed') return row.current ? 'Current · observed' : 'Superseded · observed';
  if (row.observation?.state === 'unavailable') return 'Observation unavailable';
  return row.current ? 'Current · not yet observed' : 'Superseded · never observed';
}
