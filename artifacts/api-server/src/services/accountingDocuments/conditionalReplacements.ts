import { parseConditionalTerms, uuid, fail } from '../financialDrafts/contract';
import { exactFields, scope, transact, type Queryable } from './core';
import { conditionalOriginalSchema, evidenceBytes, readConditionalEvidence } from './conditionalDiscount';

/** History prerequisite only. No payment observation or posting admission. */
export async function replacementSchema(q:Queryable) {
  await conditionalOriginalSchema(q);
  const present=(await q.query("SELECT to_regclass('public.conditional_discount_replacements') present")).rows[0]?.present;
  if(!present) fail(503,'CONDITIONAL_REPLACEMENT_SCHEMA_UNAVAILABLE');
  const row=(await q.query(`SELECT pg_get_userbyid(relowner) owner,
    has_table_privilege('ledgerly_api',oid,'INSERT,UPDATE,DELETE,TRUNCATE') writable,
    (SELECT count(*)::int FROM pg_trigger WHERE tgrelid=c.oid AND tgenabled='A' AND NOT tgisinternal
      AND tgname IN ('conditional_replacement_immutable','conditional_replacement_no_truncate')) guards,
    (SELECT count(*)::int FROM pg_constraint WHERE conrelid=c.oid AND convalidated) constraints
    FROM pg_class c WHERE oid='public.conditional_discount_replacements'::regclass`)).rows[0];
  if(row?.owner!=='ledgerly_canonical_owner' || row.writable!==false || row.guards!==2 || row.constraints!==9)
    fail(503,'CONDITIONAL_REPLACEMENT_SCHEMA_INCOMPLETE');
  const protection=(await q.query(`SELECT
    (SELECT count(*)::int FROM pg_index WHERE indexrelid IN (
      to_regclass('public.conditional_replacement_one_root'),to_regclass('public.conditional_replacement_one_successor'))
      AND indisunique AND indisvalid) branches,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.accounting_paid_credit_operations'::regclass
      AND tgname='conditional_replacement_redemption_guard' AND tgenabled='A' AND NOT tgisinternal) fenced`)).rows[0];
  if(protection?.branches!==2 || protection.fenced!==true) fail(503,'CONDITIONAL_REPLACEMENT_SCHEMA_INCOMPLETE');
}

/** Shared native history read; callers must already hold company scope and schema checks. */
export async function history(q:Queryable,company:string,id:string) {
  const original=(await q.query(`SELECT binding_hash FROM conditional_discount_original_bindings
    WHERE company_id=$1 AND document_id=$2`,[company,id])).rows[0];
  if(!original) fail(404,'RESOURCE_NOT_FOUND');
  const rows=(await q.query(`WITH RECURSIVE chain AS (
    SELECT r.*,1 position FROM conditional_discount_replacements r
      WHERE company_id=$1 AND document_id=$2 AND predecessor_id IS NULL
    UNION ALL SELECT r.*,chain.position+1 FROM conditional_discount_replacements r
      JOIN chain ON r.company_id=chain.company_id AND r.predecessor_id=chain.id
  ) SELECT *,recorded_at::text FROM chain ORDER BY position`,[company,id])).rows;
  for(const row of rows) {
    if(row.original_binding_hash!==original.binding_hash) fail(503,'CONDITIONAL_REPLACEMENT_HISTORY_INVALID');
    row.evidence=await readConditionalEvidence(q,company,row.evidence_id);
  }
  return {original_binding_hash:original.binding_hash,replacements:rows};
}

export async function getConditionalReplacementHistory(company:string,actor:string,id:string) {
  uuid(id);
  return transact(async q=>{
    await scope(q,company,actor);
    await replacementSchema(q);
    return history(q,company,id);
  },true);
}

export async function appendConditionalReplacement(company:string,actor:string,id:string,input:unknown) {
  uuid(id);
  const body=exactFields(input,['request_id','predecessor_id','terms','evidence_text','attested']);
  const request=uuid(body.request_id);
  if(body.predecessor_id!==null) uuid(body.predecessor_id);
  const terms=parseConditionalTerms(body.terms);
  evidenceBytes(body.evidence_text);
  if(body.attested!==true) fail(422,'CONDITIONAL_ATTESTATION_REQUIRED');
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    await replacementSchema(q);
    // SQL independently rechecks membership, immutable consumption and the current
    // predecessor under the same company lock. No caller supplies financial money.
    let result:any;
    try {
      result=(await q.query(`SELECT public.append_conditional_discount_replacement(
        $1::uuid,$2::text,$3::uuid,$4::uuid,$5::uuid,$6::jsonb,$7::text,true) id`,
        [company,actor,id,request,body.predecessor_id,JSON.stringify(terms),body.evidence_text])).rows[0];
    } catch(error:any) {
      const cause=error?.cause??error;
      const known:Record<string,[number,string]>={
        'Evidence request conflict':[409,'CONDITIONAL_REPLACEMENT_REQUEST_CONFLICT'],
        'Replacement request conflict':[409,'CONDITIONAL_REPLACEMENT_REQUEST_CONFLICT'],
        'Replacement predecessor changed':[409,'CONDITIONAL_REPLACEMENT_STALE'],
        'Consumed agreement cannot be replaced':[409,'CONDITIONAL_AGREEMENT_CONSUMED'],
        'Replacement requires a new agreement identity':[422,'CONDITIONAL_NEW_AGREEMENT_REQUIRED'],
        'Evidence party unavailable':[404,'RESOURCE_NOT_FOUND'],
        'Replacement party mismatch':[422,'CONDITIONAL_REPLACEMENT_PARTY_MISMATCH'],
        'Observed original required':[409,'CONDITIONAL_OBSERVED_ORIGINAL_REQUIRED'],
      };
      const mapped=cause?.code==='P0001'?known[cause.message]:undefined;
      if(mapped) fail(mapped[0],mapped[1]);
      throw error;
    }
    return (await history(q,company,id)).replacements.find((r:any)=>r.id===result.id);
  });
}
