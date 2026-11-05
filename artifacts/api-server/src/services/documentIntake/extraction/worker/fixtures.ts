import { randomUUID } from 'node:crypto';
import { createEvidence } from '../../evidence';
import type { ExtractionCandidate, ExtractedField } from '../../candidate';
import type { ResolvedSource } from './types';

/** Explicit test data only; this does not extract any text from the source bytes. */
export function syntheticSource(company_id = randomUUID()): ResolvedSource {
  return { company_id, source_id: randomUUID(), revision: randomUUID(), can_extract: true, document_id: null,
    channel: 'upload', media_type: 'application/pdf', filename: 'synthetic-only.pdf',
    bytes: Buffer.from('%PDF-1.7\nSynthetic test evidence. This is not a parsed invoice.') };
}
export function syntheticOutput(source: ResolvedSource) {
  const evidence = createEvidence({ source_id: source.source_id, channel: source.channel, media_type: source.media_type,
    bytes: source.bytes, filename: source.filename });
  let text = '';
  const field = (value: string): ExtractedField => {
    const start = text.length; text += value + '\n';
    return { value, evidence: [{ source_id: evidence.source_id, sha256: evidence.sha256, page: 1, start, end: start + value.length, quote: value }] };
  };
  const candidate: ExtractionCandidate = { kind: 'purchase_bill', fields: {
    supplier_name: field('Synthetic supplier'), document_number: field('FIXTURE-1'), document_date: field('2026-10-30'),
    due_date: field('2026-11-30'), currency: field('GBP'), net_total: field('100.00'), vat_total: field('20.00'), gross_total: field('120.00'),
  }, lines: [{ description: field('Synthetic part'), quantity: field('1'), unit_price: field('100.00'),
    tax_rate: field('20'), line_net: field('100.00'), line_vat: field('20.00'), line_gross: field('120.00') }] };
  return { pages: [{ page: 1, text }], candidate };
}
