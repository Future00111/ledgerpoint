import { createHash } from 'node:crypto';
import { parseInvoice, uuid, type InvoiceSource } from '../financialDrafts/contract';
import { IntakeError, freeze, plainRecord, requireEvidence, type EvidenceDescriptor } from './evidence';
import type { CandidateKind } from './candidate';

export interface NativeDraftEnvelope {
  kind: CandidateKind;
  source: InvoiceSource;
  purchase_vat_eligible: boolean;
  posting_account_id?: string | null;
  original_id?: string;
  original_line_refs?: number[];
  reason?: string;
  adjustment_method?: 'offset_outstanding';
  effective_adjustment_date?: string;
}

function normaliseEnvelope(input: unknown): NativeDraftEnvelope {
  if (!plainRecord(input) || typeof input.kind !== 'string' || !['purchase_bill', 'supplier_credit_note'].includes(input.kind) ||
      typeof input.purchase_vat_eligible !== 'boolean') throw new IntakeError('DRAFT_ENVELOPE_INVALID');
  const isCredit = input.kind === 'supplier_credit_note';
  const allowed = ['kind', 'source', 'purchase_vat_eligible', ...(isCredit
    ? ['original_id', 'original_line_refs', 'reason', 'adjustment_method', 'effective_adjustment_date']
    : ['posting_account_id'])];
  if (Object.keys(input).some(k => !allowed.includes(k))) throw new IntakeError('DRAFT_ENVELOPE_INVALID');
  if (!plainRecord(input.source) || !Array.isArray(input.source.line_items) ||
      !Array.from(input.source.line_items).every(plainRecord)) throw new IntakeError('DRAFT_ENVELOPE_INVALID');
  const source = parseInvoice(input.source);
  const envelope: NativeDraftEnvelope = { kind: input.kind as CandidateKind, source, purchase_vat_eligible: input.purchase_vat_eligible };
  if (isCredit) {
    const refs = input.original_line_refs;
    if (!Array.isArray(refs) || refs.length !== source.line_items.length || new Set(refs).size !== refs.length ||
        Array.from(refs).some(i => typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i > 199) ||
        typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000 || /[\x00-\x1f\x7f]/.test(input.reason) ||
        input.adjustment_method !== 'offset_outstanding' || input.effective_adjustment_date !== source.issue_date) {
      throw new IntakeError('CREDIT_REVIEW_INCOMPLETE');
    }
    envelope.original_id = uuid(input.original_id);
    envelope.original_line_refs = [...refs];
    envelope.reason = input.reason.trim();
    envelope.adjustment_method = 'offset_outstanding';
    envelope.effective_adjustment_date = source.issue_date;
  } else {
    envelope.posting_account_id = input.posting_account_id == null ? null : uuid(input.posting_account_id);
  }
  return envelope;
}

/** Build the precise native payload for user review. No supplied totals survive. */
export function reviewDraft(input: unknown, evidence: EvidenceDescriptor) {
  requireEvidence(evidence);
  const envelope = normaliseEnvelope(input);
  const review_fingerprint = createHash('sha256').update(JSON.stringify({
    contract: 'document-intake.review.v1', source_id: evidence.source_id, sha256: evidence.sha256, envelope,
  })).digest('hex');
  return freeze({ envelope, review_fingerprint, requires_native_validation: true as const });
}

/** A UX freshness check, not authentication, permission, accounting or posting authority. */
export function buildReviewedDraft(input: unknown, evidence: EvidenceDescriptor, acknowledgement: unknown) {
  const preview = reviewDraft(input, evidence);
  if (!plainRecord(acknowledgement) || Object.keys(acknowledgement).some(k =>
    !['review_fingerprint', 'source_reviewed', 'supplier_confirmed', 'tax_treatment_confirmed'].includes(k)) ||
      acknowledgement.review_fingerprint !== preview.review_fingerprint || acknowledgement.source_reviewed !== true ||
      acknowledgement.supplier_confirmed !== true || acknowledgement.tax_treatment_confirmed !== true) {
    throw new IntakeError('REVIEW_REQUIRED');
  }
  return freeze({
    envelope: preview.envelope,
    evidence: { source_id: evidence.source_id, sha256: evidence.sha256, review_fingerprint: preview.review_fingerprint },
    status: 'draft_candidate' as const, posted: false as const, requires_native_validation: true as const,
  });
}
