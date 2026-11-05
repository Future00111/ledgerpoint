import { decimal, MAX_PENCE } from '../financialDrafts/contract';
import { freeze, plainRecord, referenceMatches, requireTranscript, type EvidenceDescriptor,
  type EvidenceReference, type SourceTranscript } from './evidence';

export interface ExtractedField { value: string; evidence: EvidenceReference[] }
export type CandidateKind = 'purchase_bill' | 'supplier_credit_note';
export interface ReviewIssue { code: string; path: string; severity: 'error' | 'review'; message: string }
export interface ExtractionCandidate {
  kind: CandidateKind;
  fields: Partial<Record<'supplier_name' | 'document_number' | 'document_date' | 'due_date' | 'currency' |
    'net_total' | 'vat_total' | 'gross_total' | 'original_document_number', ExtractedField>>;
  lines: Array<Partial<Record<'description' | 'quantity' | 'unit_price' | 'tax_rate' |
    'line_net' | 'line_vat' | 'line_gross' | 'part_number', ExtractedField>>>;
}
const fields = ['supplier_name', 'document_number', 'document_date', 'due_date', 'currency', 'net_total', 'vat_total', 'gross_total', 'original_document_number'];
const lineFields = ['description', 'quantity', 'unit_price', 'tax_rate', 'line_net', 'line_vat', 'line_gross', 'part_number'];
const limits: Record<string, number> = { supplier_name: 200, document_number: 64, document_date: 10,
  due_date: 10, currency: 3, original_document_number: 64, description: 500, part_number: 100 };

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2199-12-31' &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function minor(value: string): bigint | null {
  if (!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  return result <= MAX_PENCE ? result : null;
}

/** Inspect untrusted provider output; never calculate approved VAT or create records. */
export function reviewCandidate(input: unknown, evidence: EvidenceDescriptor, transcript: SourceTranscript) {
  requireTranscript(evidence, transcript);
  const issues: ReviewIssue[] = [];
  const issue = (code: string, path: string, message: string, severity: 'error' | 'review' = 'error') => {
    issues.push({ code, path, message, severity });
  };
  const output: ExtractionCandidate = { kind: 'purchase_bill', fields: {}, lines: [] };
  const readField = (raw: unknown, key: string, path: string, required: boolean): ExtractedField | undefined => {
    if (raw === undefined) {
      if (required) issue('FIELD_MISSING', path, 'This value must be entered and checked against the source.');
      return;
    }
    if (!plainRecord(raw) || Object.keys(raw).some(k => k !== 'value' && k !== 'evidence') ||
        typeof raw.value !== 'string' || !raw.value.trim() || raw.value.length > (limits[key] ?? 20) ||
        /[\x00-\x1f\x7f]/.test(raw.value)) {
      issue('FIELD_INVALID', path, 'Use a bounded text value with its source evidence.'); return;
    }
    if (!Array.isArray(raw.evidence) || raw.evidence.length < 1 || raw.evidence.length > 5) {
      issue('EVIDENCE_REQUIRED', path, 'Each extracted value needs a source citation.'); return;
    }
    if (!Array.from(raw.evidence).every(ref => referenceMatches(ref, evidence, transcript))) {
      issue('EVIDENCE_INVALID', path, 'The citation does not match this source and page text.'); return;
    }
    const value = raw.value;
    if (['net_total', 'vat_total', 'gross_total', 'line_net', 'line_vat', 'line_gross'].includes(key) && minor(value) === null) {
      issue('AMOUNT_INVALID', path, 'Amounts must be non-negative decimal strings with at most two decimal places.');
    }
    if (key === 'quantity' || key === 'unit_price' || key === 'tax_rate') {
      try {
        const parsed = decimal(value, key === 'quantity');
        if (key === 'tax_rate' && parsed > 1000000n) throw new Error('range');
      } catch { issue(key === 'tax_rate' ? 'VAT_RATE_INVALID' : 'DECIMAL_INVALID', path, 'Check the exact decimal value against the document.'); }
    }
    if ((key === 'document_date' || key === 'due_date') && !validDate(value)) issue('DATE_INVALID', path, 'Use a valid ISO document date.');
    if (key === 'currency' && value !== 'GBP') issue('CURRENCY_UNSUPPORTED', path, 'Only GBP native drafts are currently supported.');
    return { value, evidence: raw.evidence.map(ref => ({ ...ref })) as EvidenceReference[] };
  };
  const checkTotals = (values: Record<string, ExtractedField | undefined>, names: string[], path: string) => {
    const amounts = names.map(k => values[k] ? minor(values[k]!.value) : null);
    if (amounts.every((n): n is bigint => n !== null) && amounts[0]! + amounts[1]! !== amounts[2]!) {
      issue('TOTALS_MISMATCH', path, 'The source net plus VAT does not equal its gross amount.');
    }
  };
  if (!plainRecord(input) || Object.keys(input).some(k => !['kind', 'fields', 'lines'].includes(k))) {
    issue('CANDIDATE_INVALID', '', 'The extraction response has an unsupported shape.');
  } else {
    if (input.kind !== 'purchase_bill' && input.kind !== 'supplier_credit_note') issue('DOCUMENT_KIND_INVALID', '/kind', 'Choose a supplier invoice or supplier credit note.');
    else output.kind = input.kind;
    if (!plainRecord(input.fields) || Object.keys(input.fields).some(k => !fields.includes(k))) {
      issue('FIELDS_INVALID', '/fields', 'The extraction contains unsupported document fields.');
    } else {
      for (const key of fields) {
        const required = !['due_date', 'original_document_number'].includes(key) || (key === 'original_document_number' && input.kind === 'supplier_credit_note');
        const result = readField(input.fields[key], key, `/fields/${key}`, required);
        if (result) (output.fields as Record<string, ExtractedField>)[key] = result;
      }
      checkTotals(output.fields, ['net_total', 'vat_total', 'gross_total'], '/fields');
      const date = output.fields.document_date?.value, due = output.fields.due_date?.value;
      if (date && due && validDate(date) && validDate(due) && due < date) issue('DUE_DATE_BEFORE_DOCUMENT', '/fields/due_date', 'Check the due date.');
    }
    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 200) {
      issue('LINES_INVALID', '/lines', 'Capture between 1 and 200 line items.');
    } else {
      output.lines = Array.from(input.lines).map((line, index) => {
        const result: Record<string, ExtractedField> = {};
        if (!plainRecord(line) || Object.keys(line).some(k => !lineFields.includes(k))) {
          issue('LINE_INVALID', `/lines/${index}`, 'The line contains unsupported fields.'); return result;
        }
        for (const key of lineFields) {
          const value = readField(line[key], key, `/lines/${index}/${key}`, ['description', 'quantity', 'unit_price'].includes(key));
          if (value) result[key] = value;
        }
        checkTotals(result, ['line_net', 'line_vat', 'line_gross'], `/lines/${index}`);
        return result;
      });
      for (const [lineKey, totalKey] of [['line_net', 'net_total'], ['line_vat', 'vat_total'], ['line_gross', 'gross_total']] as const) {
        const values = output.lines.map(line => line[lineKey] ? minor(line[lineKey]!.value) : null);
        const documentTotal = output.fields[totalKey] ? minor(output.fields[totalKey]!.value) : null;
        if (documentTotal !== null && values.every((value): value is bigint => value !== null) && values.reduce((sum, value) => sum + value, 0n) !== documentTotal) {
          issue('LINE_TOTALS_MISMATCH', `/fields/${totalKey}`, 'The captured line totals do not match the source document total.');
        }
      }
    }
  }
  issue('SOURCE_REVIEW_REQUIRED', '', 'Check the source and document type. Matching citations do not prove extraction accuracy.', 'review');
  issue('SUPPLIER_REVIEW_REQUIRED', '/fields/supplier_name', 'Select the existing supplier explicitly.', 'review');
  issue('TAX_REVIEW_REQUIRED', '/lines', 'Select approved tax codes. Extracted VAT is evidence, not tax authority.', 'review');
  if (output.kind === 'supplier_credit_note') issue('ORIGINAL_REVIEW_REQUIRED', '/fields/original_document_number', 'Select the original bill and matching original lines.', 'review');
  return freeze({ candidate: output, issues, has_errors: issues.some(i => i.severity === 'error'),
    requires_review: true as const, can_post: false as const, source_id: evidence.source_id, sha256: evidence.sha256 });
}
