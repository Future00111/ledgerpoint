import { document, hash, type Queryable } from './core';
import { amendmentHistory } from './amendments';
import { assertCreditCapacity, remainingCreditMoney } from './creditCapacity';
import { canonicalConditionalPayload, conditionalOriginalSchema, frozenConditionalVector } from './conditionalDiscount';
import { fail, type ConditionalTerms } from '../financialDrafts/contract';

/** Caller holds the native company lock. Original binding identity stays separate
 * from capacity; the observer and redemption independently bind/check this
 * snapshot. This helper itself never admits or posts a financial effect. */
export async function prepareReplacementCapacity(q: Queryable, company: string, documentId: string, terms: ConditionalTerms) {
  const context=await replacementCapacityContext(q,company,documentId);
  if(terms.agreement_date<context.latest) fail(409,'CONDITIONAL_REPLACEMENT_PRECEDES_ACTIVITY');
  return {...replacementCapacityVector(context.current,context.credits,terms),snapshot:context.snapshot,snapshot_hash:hash(context.snapshot)};
}

/** Verified ledger context only: ordinary credits do not invent discount terms. */
export async function replacementCapacityContext(q: Queryable, company: string, documentId: string) {
  const original = await document(q, company, documentId, true);
  if (original.company_id !== company || !['sales_invoice', 'purchase_bill'].includes(original.kind) ||
    original.status !== 'posted') fail(409, 'CONDITIONAL_BINDING_INVALID');
  const history = await amendmentHistory(q, company, original);
  const current = history.current;
  const credits = await assertCreditCapacity(q, company, current);
  const latest = credits.reduce((date, credit) => credit.posting_date > date ? credit.posting_date : date, history.latest_date);
  const money=remainingCreditMoney(current,credits);
  await conditionalOriginalSchema(q);
  const installed=(await q.query(`SELECT pg_get_userbyid(proowner) owner,prosecdef
    FROM pg_proc WHERE oid=to_regprocedure('public.conditional_capacity_origins(uuid,uuid[])')`)).rows[0];
  if(installed?.owner!=='ledgerly_canonical_owner'||installed.prosecdef!==true)
    fail(503,'CONDITIONAL_CAPACITY_ORIGIN_SCHEMA_UNAVAILABLE');
  const creditAmendments=credits.length && history.available ? (await q.query(`SELECT journal_id FROM accounting_document_amendments
    WHERE company_id=$1 AND document_id=ANY($2::uuid[])`,[company,credits.map(c=>c.id)])).rows : [];
  const journals=[...new Set([original.journal_id,...history.rows.map(r=>r.journal_id),
    ...credits.map(c=>c.journal_id),...creditAmendments.map(r=>r.journal_id)])];
  // DB-owned top transaction receipts reject own-transaction/savepoint writes
  // and foreign-cluster restored origins; no caller clock can certify freshness.
  const origins=(await q.query('SELECT public.conditional_capacity_origins($1::uuid,$2::uuid[]) origins',
    [company,journals])).rows[0].origins;
  const snapshot = {
    financial: { source: current.source, money: current.money, tax_context: current.tax_context, accounts: current.posting_accounts },
    financial_payload: canonicalConditionalPayload({source:current.source,money:current.money,tax_context:current.tax_context,accounts:current.posting_accounts}),
    journal_origins: origins,
    revision: history.head_revision,
    financial_hash: hash({ source: current.source, money: current.money, tax_context: current.tax_context, accounts: current.posting_accounts }),
    credits: credits.map(credit => ({ id: credit.id, revision: credit.revision, journal_id: credit.journal_id,
      financial:{source:credit.source,money:credit.money,tax_context:credit.tax_context,accounts:credit.posting_accounts},
      financial_payload:canonicalConditionalPayload({source:credit.source,money:credit.money,tax_context:credit.tax_context,accounts:credit.posting_accounts}),
      evidence_hash: hash({ source: credit.source, money: credit.money, tax_context: credit.tax_context, accounts: credit.posting_accounts }) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    remaining_money: money,
  };
  return {current,credits,latest,snapshot};
}

/** Reuse native gross allocation and VAT/capacity math; never scale old terms.
 * Zero-capacity lines keep their original indexes in the frozen vector. */
export function replacementCapacityVector(current: any, credits: any[], terms: any) {
  const money = remainingCreditMoney(current, credits);
  const row = { ...current, money, source: { ...current.source, conditional_discount: terms } };
  const vector = frozenConditionalVector(row);
  return { money, vector };
}
