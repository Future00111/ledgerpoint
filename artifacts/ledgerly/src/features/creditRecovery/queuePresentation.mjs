import { canConfirmCandidate, filterClaims, isOpenClaim, isOverdue, remainingTotal } from './model.mjs';

/** View metadata only. Matching remains an explicit protected server command. */
export function reviewableCandidates(claim) {
  return (claim.candidates ?? []).filter(candidate => canConfirmCandidate(claim, candidate, true));
}

export function creditQueue(claims, filter, search, date) {
  const base = filterClaims(claims, ['matches', 'overdue'].includes(filter) ? 'all' : filter, search);
  return base.filter(claim => filter === 'matches' ? reviewableCandidates(claim).length > 0
    : filter === 'overdue' ? isOverdue(claim, date) : true);
}

export function queueSummary(claims, date) {
  const open = claims.filter(isOpenClaim);
  // An unavailable server figure must not become a reassuring zero.
  const amountsAvailable = open.every(claim => typeof claim.remaining?.gross_pence === 'string'
    && /^-?\d+$/.test(claim.remaining.gross_pence));
  return {
    remaining: amountsAvailable ? remainingTotal(claims) : undefined,
    waiting: open.length,
    overdue: claims.filter(claim => isOverdue(claim, date)).length,
    matches: claims.filter(claim => reviewableCandidates(claim).length > 0).length,
  };
}
