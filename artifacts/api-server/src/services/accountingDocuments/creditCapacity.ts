import { fail } from '../financialDrafts/contract';
import { document, hash, sales, type Queryable } from './core';
import { amendmentHistory } from './amendments';
import { linkedCreditDocuments } from './settlement';
import { readReplacementBinding } from './replacementBindings';

/** Caller holds the native company lock. Never rewrite the posted original. */
export async function creditOriginal(q: Queryable, company: string, id: string, effective: string) {
  const original = await document(q, company, id, true);
  // Frozen conditional terms cannot be reinterpreted against a corrected base.
  const history = await amendmentHistory(q, company, original);
  if(original.source?.conditional_discount && history.rows.length) {
    const replacement=await readReplacementBinding(q,company,id);
    if(!replacement?.observation || replacement.frozen?.capacity?.revision!==history.head_revision)
      fail(409,'CONDITIONAL_REPLACEMENT_REQUIRED');
  }
  if (effective < history.latest_date || effective < original.source.issue_date)
    fail(409, 'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  return history.current;
}

/** Independent net/VAT/gross caps; no borrowing between original line refs.
 * Prior credits retain their frozen values, not recalculated current tax rates.
 * Drafts reserve nothing. Company serialization is shared by every writer.
 */
export async function assertCreditCapacity(q: Queryable, company: string, original: any, row?: any) {
  const evidence = (d: any) => hash({ source: d.source, money: d.money, tax_context: d.tax_context, accounts: d.posting_accounts });
  if (row && (row.original_id !== original.id || row.party_id !== original.party_id ||
    row.kind !== (sales(original.kind) ? 'sales_credit_note' : 'supplier_credit_note') ||
    row.source.currency !== original.source.currency ||
    row.tax_context.original_revision !== original.revision ||
    row.tax_context.original_evidence_hash !== evidence(original)))
    fail(409, 'CREDIT_ORIGINAL_NOT_CURRENT_POSTED');
  const prior = await linkedCreditDocuments(q, company, original);
  if (row && prior.some(c => c.source.issue_date > row.source.issue_date))
    fail(409, 'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  remainingCreditMoney(original, prior, row);
  return prior;
}

/** Shared line-local capacity arithmetic. Inputs must come from verified native
 * document/history reads, not request bodies. Does not reserve or post anything. */
export function remainingCreditMoney(original: any, prior: any[], row?: any) {
  const used = original.money.lines.map(() => ({ net_pence: 0n, vat_pence: 0n, gross_pence: 0n }));
  const fields = ['net_pence', 'vat_pence', 'gross_pence'] as const;
  for (const credit of row ? [...prior, row] : prior) {
    const refs = credit.tax_context.original_line_refs;
    if (!Array.isArray(refs) || refs.length !== credit.money.lines.length || new Set(refs).size !== refs.length ||
      refs.some((ref: any) => !Number.isInteger(ref) || ref < 0 || ref >= used.length))
      fail(503, 'CREDIT_HISTORY_INVALID');
    for (const [i, ref] of refs.entries()) {
      const line = credit.money.lines[i];
      if (fields.some(field => typeof line[field] !== 'string' || !/^\d+$/.test(line[field])) ||
        BigInt(line.net_pence) + BigInt(line.vat_pence) !== BigInt(line.gross_pence))
        fail(503, 'CREDIT_HISTORY_INVALID');
      for (const field of fields) {
        used[ref][field] += BigInt(line[field]);
        if (used[ref][field] > BigInt(original.money.lines[ref][field]))
          fail(!row || credit === row ? 409 : 503, !row ? 'CORRECTION_BELOW_CREDIT_CAPACITY' : credit === row ? 'CREDIT_EXCEEDS_COMMERCIAL_CAPACITY' : 'CREDIT_HISTORY_INVALID');
      }
    }
  }
  const lines = original.money.lines.map((line: any, i: number) => ({
    ...line,
    ...Object.fromEntries(fields.map(field => [field, (BigInt(line[field]) - used[i][field]).toString()])),
  }));
  return {
    ...original.money, lines,
    ...Object.fromEntries(fields.map(field => [field, lines.reduce((n: bigint, line: any) => n + BigInt(line[field]), 0n).toString()])),
  };
}
