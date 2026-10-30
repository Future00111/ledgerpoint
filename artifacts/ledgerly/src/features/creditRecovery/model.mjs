export const CLAIM_STATUS = {
  awaiting: { label: 'Awaiting credit', style: 'bg-amber-50 text-amber-900 ring-amber-200' },
  partial: { label: 'Partially received', style: 'bg-blue-50 text-blue-900 ring-blue-200' },
  received: { label: 'Received', style: 'bg-emerald-50 text-emerald-900 ring-emerald-200' },
  needs_review: { label: 'Needs review', style: 'bg-orange-50 text-orange-900 ring-orange-200' },
};

export function claimStatus(claim) {
  return claim.cancelled
    ? { label: 'Cancelled', style: 'bg-muted text-muted-foreground ring-border' }
    : CLAIM_STATUS[claim.status] ?? { label: 'Status unavailable', style: 'bg-muted text-muted-foreground ring-border' };
}

export const isOpenClaim = claim => !claim.cancelled && claim.status !== 'received';
export const hasReceivedCredit = claim => (claim.receipts ?? []).some(receipt => receipt.active);
export const canConfirmCandidate = (claim, candidate, canManage) => canManage === true && !claim.cancelled
  && candidate.status === 'posted' && candidate.can_confirm === true;
export const canCancelClaim = (claim, canManage) => canManage === true && !claim.cancelled && (claim.receipts ?? []).length === 0;

export function isOverdue(claim, date) {
  return isOpenClaim(claim) && Boolean(claim.expected_by && claim.expected_by < date);
}

export function filterClaims(claims, filter, search = '') {
  const query = search.trim().toLocaleLowerCase('en-GB');
  return claims.filter(claim => {
    const statusMatch = filter === 'all' || (filter === 'open' ? isOpenClaim(claim)
      : filter === 'cancelled' ? claim.cancelled : !claim.cancelled && claim.status === filter);
    const text = [claim.party_name, claim.bill_number, claim.description, claim.return_reference,
      claim.part_reference, claim.job_reference].filter(Boolean).join(' ').toLocaleLowerCase('en-GB');
    return statusMatch && (!query || text.includes(query));
  });
}

/** Aggregate already calculated server amounts, never recalculate VAT in the UI. */
export function remainingTotal(claims) {
  return claims.filter(isOpenClaim).reduce((total, claim) => total + BigInt(claim.remaining.gross_pence), 0n).toString();
}

/** Retain an idempotency key after an uncertain response, until the request changes. */
export function createRequestBook(makeId = () => crypto.randomUUID()) {
  const requests = new Map();
  return {
    forRequest(action, payload, revision) {
      const fingerprint = JSON.stringify([payload, revision ?? null]);
      const previous = requests.get(action);
      if (previous?.fingerprint === fingerprint) return previous.body;
      const body = { ...payload, request_id: makeId() };
      requests.set(action, { fingerprint, body });
      return body;
    },
    complete(action) { requests.delete(action); },
  };
}

/** A response from an old company or refresh must not replace the current view. */
export function createRequestGate() {
  let current = 0;
  return {
    begin() { return ++current; },
    isCurrent(ticket) { return ticket === current; },
    invalidate() { current++; },
  };
}

export function buildClaimRequest(doc, selected, values) {
  return {
    bill_id: doc.id, bill_revision: doc.revision,
    reason: values.reason.trim(), return_reference: values.return_reference.trim(),
    returned_on: values.returned_on || null, expected_by: values.expected_by || null,
    lines: selected.map(line => ({
      original_line_ref: line.original_line_ref, quantity: String(line.quantity),
      part_reference: line.part_reference.trim(), job_reference: line.job_reference.trim(),
    })),
  };
}
