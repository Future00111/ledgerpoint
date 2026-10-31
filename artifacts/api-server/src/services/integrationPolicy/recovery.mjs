/** Executable P14-04 recovery acceptance contract, not wired into adapters.
 * Never authorizes calls. A caller must preserve its saved operation and perform
 * current authorization plus authoritative status recovery before any retry.
 */
export function recoveryPlan({ service, destination, operationId, intentFingerprint, failure }, inventory) {
  const preserve = { operationId, intentFingerprint };
  const deny = reason => Object.freeze({ ...preserve, externalCallAllowed: false, discardSavedWork: false,
    broadenScopes: false, reason, next: 'review_configuration' });
  if (typeof operationId !== 'string' || !operationId.trim() || typeof intentFingerprint !== 'string' || !intentFingerprint.trim())
    return deny('OPERATION_IDENTITY_REQUIRED');
  const entry = inventory?.services?.find(item => item.id === service);
  if (!entry) return deny('UNKNOWN_SERVICE');
  if (!Array.isArray(entry.destination_allowlist) || !entry.destination_allowlist.includes(destination))
    return deny('UNQUALIFIED_DESTINATION');
  // No real-data service is qualified by the current inventory. This guard must
  // remain even if somebody fills in a destination before finishing its review.
  if (entry.qualification !== 'qualified') return deny('SERVICE_NOT_QUALIFIED');
  // Recognition of failure never implies retry authority, even for a future
  // qualified service. Unknown errors are conservatively unknown outcomes.
  return Object.freeze({ ...preserve, externalCallAllowed: false, discardSavedWork: false, broadenScopes: false,
    reason: failure === 'credential_expired' || failure === 'revoked' ? 'REAUTHORISATION_REQUIRED' : 'OUTCOME_UNKNOWN',
    next: failure === 'credential_expired' || failure === 'revoked' ? 'reauthorise_then_recover_original' : 'recover_original_or_manual_review' });
}
