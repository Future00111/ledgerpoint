import { fail } from '../financialDrafts/contract';

/**
 * Reconciles already-authoritative, signed source movements. This is not a VAT
 * calculator, eligibility decision, complete return or filing readiness check.
 * Call only after the report has verified each movement against its journal.
 * Corrections must be separate dated differences, never replacement totals.
 */
export interface VatSourceMovement {
  id: string;
  journal_id: string;
  kind: 'sales_invoice' | 'sales_credit_note' | 'purchase_bill' | 'supplier_credit_note';
  date: string;
  net_minor: string;
  vat_minor: string;
  vat_box: '1' | '4';
  movement_kind?: 'original' | 'financial_correction';
}
export interface VatAmounts {
  applicable: boolean;
  box1_pence: string; box4_pence: string; box5_pence: string;
  box6_pence: string; box7_pence: string;
  net_payable_pence: string;
  repayment: boolean;
}
const boxes = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const covered = new Set(['1', '4', '5', '6', '7']);
const bases = { '1': 'sales_vat', '4': 'recoverable_purchase_vat', '5': 'absolute_net_vat',
  '6': 'sales_net', '7': 'purchase_net' } as const;
export const VAT_COVERAGE_CASES = Object.freeze(([
  { id: 'standard_invoice_basis', label: 'UK, GBP, standard scheme on an invoice basis', status: 'supported' },
  { id: 'explicit_tax_treatments', label: 'Explicit date-effective standard, reduced, zero, exempt and outside-scope tax codes', status: 'supported' },
  { id: 'inclusive_exclusive', label: 'VAT-inclusive and VAT-exclusive prices with saved line rounding', status: 'supported' },
  { id: 'linked_credits', label: 'Posted linked credits using their original tax evidence', status: 'supported' },
  { id: 'recoverability', label: 'Explicitly recoverable or nonrecoverable purchase VAT', status: 'supported' },
  { id: 'payments', label: 'Partial payments do not change invoice-basis VAT movements', status: 'supported' },
  { id: 'other_schemes', label: 'Cash accounting, flat-rate and other VAT schemes', status: 'unsupported' },
  { id: 'special_transactions', label: 'Special-case tax, cross-border and import workflows', status: 'unsupported' },
  { id: 'filing_adjustments', label: 'Complete return adjustments, submission and HMRC receipt recovery', status: 'unsupported' },
] as const).map(item => Object.freeze(item)));
const blockers = Object.freeze([
  Object.freeze({ code: 'INCOMPLETE_RETURN', message: 'Boxes 2, 3, 8 and 9 are not implemented in these workings. They are not assumed to be zero.' }),
  Object.freeze({ code: 'SUPPORTED_CASE_REVIEW', message: 'Review your source documents and confirm that the supported accounting scope fits this period.' }),
  Object.freeze({ code: 'FILING_UNAVAILABLE', message: 'Submission, complete-return adjustments and verified HMRC receipts are not connected.' }),
]);
const kinds = new Set(['sales_invoice', 'sales_credit_note', 'purchase_bill', 'supplier_credit_note']);
const minor = (value: unknown): value is string => typeof value === 'string' && /^(?:0|-?[1-9]\d{0,29})$/.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && value >= '0001-01-01' && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function invalid(): never { fail(503, 'VAT_COVERAGE_MISMATCH'); }

export interface VatCoverage {
  readonly contract: 'vat-workings.coverage.v1';
  readonly status: 'not_applicable' | 'workings_reconciled';
  readonly filing_ready: false;
  readonly scope: Readonly<{ from: string; to: string; basis: 'posted_source_movements'; currency: 'GBP'; scheme: 'standard' | null; accounting_basis: 'invoice' | null }>;
  readonly movement_count: number;
  readonly source_document_count: number;
  readonly journal_count: number;
  readonly boxes: readonly Readonly<{ box: typeof boxes[number]; status: 'reconciled' | 'unsupported';
    amount_pence: string | null; source_total_pence: string | null; basis: string }>[];
  readonly cases: readonly Readonly<{ id: string; label: string; status: 'supported' | 'unsupported' }>[];
  readonly blockers: readonly Readonly<{ code: string; message: string }>[];
}
export function buildVatCoverage(input: { from: string; to: string; vat: VatAmounts; movements: readonly VatSourceMovement[] }): VatCoverage {
  if (!date(input.from) || !date(input.to) || input.from > input.to || typeof input.vat?.applicable !== 'boolean'
      || !Array.isArray(input.movements)) invalid();
  const scope = Object.freeze({ from: input.from, to: input.to, basis: 'posted_source_movements' as const,
    currency: 'GBP' as const, scheme: input.vat.applicable ? 'standard' as const : null,
    accounting_basis: input.vat.applicable ? 'invoice' as const : null });
  if (!input.vat.applicable) return Object.freeze({ contract: 'vat-workings.coverage.v1' as const,
    status: 'not_applicable' as const, filing_ready: false as const, scope, movement_count: 0,
    source_document_count: 0, journal_count: 0, boxes: Object.freeze([]), cases: Object.freeze([]), blockers: Object.freeze([]) });
  const fields = ['box1_pence', 'box4_pence', 'box5_pence', 'box6_pence', 'box7_pence', 'net_payable_pence'] as const;
  if (fields.some(field => !minor(input.vat[field])) || typeof input.vat.repayment !== 'boolean') invalid();
  const journals = new Set<string>(), documents = new Set<string>();
  let output = 0n, reclaimed = 0n, salesNet = 0n, purchaseNet = 0n, movementCount = 0;
  for (const movement of input.movements) {
    if (!movement || typeof movement.id !== 'string' || !movement.id || typeof movement.journal_id !== 'string'
        || !movement.journal_id || journals.has(movement.journal_id) || !kinds.has(movement.kind) || !date(movement.date)
        || !minor(movement.net_minor) || !minor(movement.vat_minor)
        || (movement.movement_kind !== undefined && !['original', 'financial_correction'].includes(movement.movement_kind))) invalid();
    journals.add(movement.journal_id);
    const sale = movement.kind === 'sales_invoice' || movement.kind === 'sales_credit_note';
    if (movement.vat_box !== (sale ? '1' : '4')) invalid();
    // Original credit signs are authoritative; difference movements may have either sign.
    if (movement.movement_kind !== 'financial_correction') {
      const credit = movement.kind === 'sales_credit_note' || movement.kind === 'supplier_credit_note';
      if ((credit && (BigInt(movement.net_minor) > 0n || BigInt(movement.vat_minor) > 0n))
          || (!credit && (BigInt(movement.net_minor) < 0n || BigInt(movement.vat_minor) < 0n))) invalid();
    }
    if (movement.date < input.from || movement.date > input.to) continue;
    documents.add(movement.id); movementCount++;
    if (sale) { output += BigInt(movement.vat_minor); salesNet += BigInt(movement.net_minor); }
    else { reclaimed += BigInt(movement.vat_minor); purchaseNet += BigInt(movement.net_minor); }
  }
  const net = output - reclaimed;
  const sourceTotals = { '1': output, '4': reclaimed, '5': net < 0n ? -net : net, '6': salesNet, '7': purchaseNet };
  for (const box of Object.keys(sourceTotals) as (keyof typeof sourceTotals)[]) {
    if (sourceTotals[box] !== BigInt(input.vat[`box${box}_pence`])) invalid();
  }
  if (net !== BigInt(input.vat.net_payable_pence) || input.vat.repayment !== (net < 0n)) invalid();
  return Object.freeze({ contract: 'vat-workings.coverage.v1' as const, status: 'workings_reconciled' as const,
    filing_ready: false as const, scope, movement_count: movementCount, source_document_count: documents.size,
    journal_count: movementCount,
    boxes: Object.freeze(boxes.map(box => covered.has(box)
      ? Object.freeze({ box, status: 'reconciled' as const, amount_pence: input.vat[`box${box as keyof typeof bases}_pence`],
        source_total_pence: sourceTotals[box as keyof typeof sourceTotals].toString(), basis: bases[box as keyof typeof bases] })
      : Object.freeze({ box, status: 'unsupported' as const, amount_pence: null, source_total_pence: null, basis: 'not_implemented' as const }))),
    cases: VAT_COVERAGE_CASES, blockers });
}
