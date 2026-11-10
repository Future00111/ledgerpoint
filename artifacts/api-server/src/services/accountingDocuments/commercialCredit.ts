import {document,hash,type Queryable} from './core';
import {fail} from '../financialDrafts/contract';
import {canonicalConditionalPayload,prepareConditionalOriginal,verifiedOriginal} from './conditionalDiscount';
import {replacementCapacityContext} from './replacementCapacity';

/** Internal native admission, never accepted from a request body. The SQL
 * operation trigger independently checks source, capacity and same-top-xact
 * journal/effect provenance. It is not a discount consumption or a bypass flag. */
export async function commercialCreditAdmission(q:Queryable,company:string,original:any,credit:any) {
  const root=await document(q,company,original.id);
  const prepared=await prepareConditionalOriginal(q,company,root);
  if(!await verifiedOriginal(q,company,root.id,prepared.bindingHash)) fail(409,'CONDITIONAL_BINDING_INVALID');
  if((await q.query(`SELECT 1 FROM accounting_paid_credit_operations WHERE company_id=$1
    AND intent->>'original_id'=$2::text AND intent ? 'conditional_admission'`,[company,root.id])).rowCount)
    fail(409,'CONDITIONAL_AGREEMENT_CONSUMED');
  const installed=(await q.query("SELECT to_regprocedure('public.assert_commercial_credit(public.accounting_paid_credit_operations)') present")).rows[0]?.present;
  if(!installed) fail(503,'COMMERCIAL_CREDIT_SCHEMA_UNAVAILABLE');
  const {snapshot}=await replacementCapacityContext(q,company,root.id);
  return {version:1,original_binding_hash:prepared.bindingHash,capacity:snapshot,
    capacity_payload:canonicalConditionalPayload(snapshot),capacity_hash:hash(snapshot),
    credit_payload:canonicalConditionalPayload({source:credit.source,money:credit.money,tax_context:credit.tax_context,accounts:credit.posting_accounts})};
}
