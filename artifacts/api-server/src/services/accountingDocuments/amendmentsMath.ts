import { decimal, fail, parseInvoice } from '../financialDrafts/contract';
import { exactFields, hash } from './core';
import { journalLines } from './documentJournal';
import type { CanonicalLineDraft } from '../accounting/canonicalPosting';

const fields = ['net_pence', 'vat_pence', 'gross_pence'] as const;
const derivedTaxFields = new Set(['entered_unit_price', 'unit_net_price', 'net_pence', 'vat_pence',
  'entered_before_discount_pence', 'discount_pence', 'entered_after_discount_pence']);

/** Frozen financial authority excludes only values re-derived by the native calculator. */
export function amendmentContextHash(row: any): string {
  const { source_fingerprint: _fingerprint, discount: _discount, lines, ...tax } = row.tax_context;
  return hash({ kind: row.kind, party_id: row.party_id, source: { ...row.source,
    line_items: row.source.line_items.map(({ quantity: _q, unit_price: _u, ...line }: any) => line) },
    tax: { ...tax, lines: lines.map((line: any) => Object.fromEntries(Object.entries(line)
      .filter(([key]) => !derivedTaxFields.has(key)))) },
    posting_accounts: row.posting_accounts, mapping_revision: row.mapping_revision,
    purchase_vat_eligible: row.purchase_vat_eligible, posting_account_id: row.posting_account_id });
}

export function amendmentMoney(money: any) {
  return { net_pence: money.net_pence, vat_pence: money.vat_pence, gross_pence: money.gross_pence,
    lines: money.lines.map((line: any, original_line_ref: number) => ({ original_line_ref,
      net_pence: line.net_pence, vat_pence: line.vat_pence, gross_pence: line.gross_pence })) };
}

export function amendmentDelta(before: any, after: any) {
  if (before.lines.length !== after.lines.length) fail(409, 'CORRECTION_LINE_SHAPE_CHANGED');
  const amounts = (a: any, b: any) => Object.fromEntries(fields.map(field =>
    [field, (BigInt(b[field]) - BigInt(a[field])).toString()])) as Record<typeof fields[number], string>;
  return { ...amounts(before, after), lines: before.lines.map((line: any, original_line_ref: number) =>
    ({ original_line_ref, ...amounts(line, after.lines[original_line_ref]) })) };
}

/** One signed delta per original account/source-line/tax identity; never replacement totals. */
export function amendmentJournalLines(before: any, after: any): CanonicalLineDraft[] {
  const combined = new Map<string, { line: CanonicalLineDraft; amount: bigint }>();
  for (const [row, sign] of [[before, -1n], [after, 1n]] as const) {
    for (const line of journalLines(row)) {
      const key = JSON.stringify([line.accountId, line.sourceLineRef ?? null, line.taxCode ?? null, line.currencyCode]);
      const prior = combined.get(key) ?? { line, amount: 0n };
      prior.amount += sign * (BigInt(line.debitMinor) - BigInt(line.creditMinor));
      combined.set(key, prior);
    }
  }
  return [...combined.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, { line, amount }]) => amount === 0n ? [] : [{
    ...line, debitMinor: amount > 0n ? amount.toString() : '0', creditMinor: amount < 0n ? (-amount).toString() : '0',
  }]);
}

export function correctionLineSource(current: any, input: unknown) {
  if (!Array.isArray(input) || input.length !== current.source.line_items.length) fail(422, 'CORRECTION_LINE_SHAPE_CHANGED');
  const lines = input.map((raw, i) => {
    const item = exactFields(raw, ['quantity', 'unit_price']);
    decimal(item.quantity, true); decimal(item.unit_price, false);
    return { ...current.source.line_items[i], quantity: item.quantity, unit_price: item.unit_price };
  });
  return parseInvoice({ ...current.source, line_items: lines });
}

export function sameJournalLines(actual: any[], expected: CanonicalLineDraft[]) {
  return actual.length === expected.length && actual.every((line, i) => {
    const target = expected[i]!;
    return line.account_id === target.accountId && String(line.debit_minor) === target.debitMinor &&
      String(line.credit_minor) === target.creditMinor && line.currency_code === target.currencyCode &&
      (line.source_line_ref ?? null) === (target.sourceLineRef ?? null) && (line.tax_code ?? null) === (target.taxCode ?? null);
  });
}
