import { hasConditionalCreditAuthority } from './paidCredit';
import { compensationSchema } from './conditionalCompensation';
import { withCanonicalPostingTransaction } from '../accounting/canonicalPosting';
import { assertNoConditionalCredit, prepareConditionalOriginal, bindConditionalOriginal, conditionalOriginalSchema, conditionalConsumptionSchema } from './conditionalDiscount';
import { journalLines } from './documentJournal';
export { journalLines } from './documentJournal';
import { randomUUID } from "node:crypto";
import { syncSettlementProjection } from './settlement';
import { fail } from "../financialDrafts/contract";
import { postCanonicalJournal, postCanonicalJournalInTransaction, type CanonicalPostingDependencies, type DatabaseTransaction,
  type CanonicalLineDraft, type LockedAuthority } from "../accounting/canonicalPosting";
import { calculateDocument, assertCreditAvailable } from "./documents";
import { queryAdapter, scope, document, transact, hash, sales, credit, tables, type Kind, type Queryable } from "./core";

const conditionalOriginalTransactions=new WeakMap<DatabaseTransaction,{company:string,actor:string,id:string,expected:string}>();
export async function postConditionalOriginal(company:string,actor:string,id:string,expected:string,testHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  return withCanonicalPostingTransaction(async tx=>{
    const q=queryAdapter(tx);await scope(q,company,actor,true,true);
    await conditionalOriginalSchema(q);await conditionalConsumptionSchema(q);
    if(!await compensationSchema(q)) fail(503,'CONDITIONAL_COMPENSATION_SCHEMA_INCOMPLETE');
    const row=await document(q,company,id,true);
    if(!row.source?.conditional_discount || !['sales_invoice','purchase_bill'].includes(row.kind)) fail(422,'CONDITIONAL_BINDING_INVALID');
    if(row.status==='posted' && (await q.query('SELECT 1 FROM conditional_discount_original_bindings WHERE company_id=$1 AND document_id=$2',[company,id])).rowCount!==1) fail(503,'CONDITIONAL_BINDING_INVALID');
    conditionalOriginalTransactions.set(tx,{company,actor,id,expected});
    try {const result=await postDocument(company,actor,id,expected,testHook,tx);await bindConditionalOriginal(q,company,actor,id);return result;}
    finally {conditionalOriginalTransactions.delete(tx);}
  });
}
class AlreadyPosted extends Error {
  constructor(public journalId:string) {super("Already posted");}
}
function locked<T>(value:T,keys:string[],token:string):LockedAuthority<T> {
  const captured=hash(value);
  return {authority:value,recordKeys:keys,capturedToken:{revision:token},lockMode:"FOR UPDATE",transactionBound:true,
    validateCurrent:({command,source,context,companyId})=>{
      if(hash(value)!==captured || command.requestedCompanyId!==companyId ||
        (keys[0]?.startsWith("accounting_document_sources:") &&
          (source?.sourceRevision!==token || command.sourceRevision!==token || source?.sourceId!==command.sourceId)) ||
        (keys[0]?.startsWith("accounting_document_periods:") &&
          (context?.configurationVersionId!==token || context?.periodStatus!=="OPEN" || context?.companyId!==companyId)))
        return {ok:false,code:"transaction_contract_invalid",message:"The locked source/context token no longer matches the posting command."};
      return {ok:true};
    }};
}
async function assertProjection(q:Queryable,company:string,row:any) {
  const actual=await q.query(`SELECT * FROM ${tables[row.kind as Kind]} WHERE company_id=$1 AND id=$2 FOR UPDATE`,[company,row.id]);
  const p=actual.rows[0];
  const fixed=(v:unknown)=>typeof v==="string" && /^\d+\.\d{2}$/.test(v)?BigInt(v.replace(".","")).toString():null;
  if(actual.rowCount!==1 || p.status!=="draft" ||
    fixed(p.subtotal)!==row.money.net_pence || fixed(p.vat_total)!==row.money.vat_pence ||
    fixed(p.total)!==row.money.gross_pence ||
    p[sales(row.kind)?"customer_id":"supplier_id"]!==row.party_id ||
    p.line_items.length!==row.source.line_items.length ||
    p.line_items.some((line:any,i:number)=>line.entered_unit_price!==row.source.line_items[i].unit_price ||
      line.quantity!==row.source.line_items[i].quantity || line.tax_code!==row.source.line_items[i].tax_code ||
      fixed(line.amount)!==row.money.lines[i].net_pence || fixed(line.vat_amount)!==row.money.lines[i].vat_pence ||
      fixed(line.line_total)!==row.money.lines[i].gross_pence)) fail(409,"SOURCE_PROJECTION_MISMATCH");
}
export async function postDocument(company:string,actor:string,id:string,expected:string,
  testHook?: (tx:DatabaseTransaction)=>Promise<void>, existingTransaction?:DatabaseTransaction) {
  // Read admission is advisory; all authorities and capabilities are locked and
  // checked again inside postCanonicalJournal's one transaction.
  const admission=async(q:Queryable)=>{
    await scope(q,company,actor);const row=await document(q,company,id);
    if(credit(row.kind) && !hasConditionalCreditAuthority(existingTransaction,company,actor,row))
      await assertNoConditionalCredit(q,company,await document(q,company,row.original_id));
    return row;
  };
  const initial=existingTransaction?await admission(queryAdapter(existingTransaction)):await transact(admission,true);
  const held=existingTransaction?conditionalOriginalTransactions.get(existingTransaction):undefined;
  const conditionalOriginal=!!held && held.company===company && held.actor===actor && held.id===id && held.expected===expected;
  const prepared=conditionalOriginal?await prepareConditionalOriginal(queryAdapter(existingTransaction!),company,initial):null;
  const evidenceHash=prepared?.bindingHash??hash({source:initial.source,money:initial.money,tax_context:initial.tax_context,accounts:initial.posting_accounts});
  if(initial.source?.conditional_discount && !conditionalOriginal) fail(422,'CONDITIONAL_POSTING_NOT_AVAILABLE');
  if(initial.revision!==expected) fail(409,"REVISION_CONFLICT");
  let current:any, transaction:DatabaseTransaction;
  const dependencies:CanonicalPostingDependencies={
    sourceProvider:{async lockForPosting(command,tx) {
      transaction=tx;const q=queryAdapter(tx);
      await scope(q,company,actor,true,true);
      current=await document(q,company,id,true);
      if(current.source?.conditional_discount && !conditionalOriginal) fail(422,'CONDITIONAL_POSTING_NOT_AVAILABLE');
      if(current.revision!==expected) fail(409,"REVISION_CONFLICT");
      if(conditionalOriginal) {
        const freshBinding=await prepareConditionalOriginal(q,company,current);
        if(freshBinding.bindingHash!==evidenceHash) fail(409,'SOURCE_CONTEXT_CHANGED');
      }
      if(current.status==="posted") {
        if(conditionalOriginal) await bindConditionalOriginal(q,company,actor,id);
        const linked=await q.query(`SELECT id FROM canonical_journal_entries
          WHERE id=$1 AND company_id=$2 AND source_type=$3 AND source_id=$4 AND status='posted'`,
          [current.journal_id,company,current.kind,id]);
        if(linked.rowCount!==1) fail(409,"POSTING_LINK_INVALID");
        throw new AlreadyPosted(current.journal_id);
      }
      await assertProjection(q,company,current);
      const others=await q.query("SELECT id FROM canonical_journal_entries WHERE company_id=$1 AND source_id=$2",[company,id]);
      if(others.rowCount) fail(409,"SOURCE_ALREADY_HAS_LEDGER");
      const fresh=await calculateDocument(q,company,current.kind,{},current);
      if(fresh.mapping_revision!==current.mapping_revision) fail(409,"CONFIGURATION_CHANGED");
      for(const field of ["source","money","tax_context","posting_accounts"]) {
        if(hash(fresh[field as keyof typeof fresh])!==hash(current[field])) fail(409,"SOURCE_CONTEXT_CHANGED");
      }
      await assertCreditAvailable(q,company,current,tx,actor);
      const snapshot={companyId:company,sourceType:current.kind,sourceId:id,status:"draft",isPostable:true,
        sourceRevision:expected,evidenceHash:conditionalOriginal?evidenceHash:hash({source:current.source,money:current.money,tax_context:current.tax_context,accounts:current.posting_accounts})};
      return locked(snapshot,[`accounting_document_sources:${id}`],expected);
    }},
    contextProvider:{async lockForPosting(input,tx) {
      const q=queryAdapter(tx);
      const period=await q.query(`SELECT *,start_date::text,end_date::text FROM accounting_document_periods
        WHERE company_id=$1 AND start_date<=$2::date AND end_date>=$2::date ORDER BY id FOR UPDATE`,[company,input.postingDate]);
      if(period.rowCount!==1 || period.rows[0].status!=="OPEN") fail(409,"PERIOD_NOT_WRITABLE");
      const p=period.rows[0];
      const accounts=await q.query("SELECT * FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",[company,input.accountIds]);
      const ctx={companyId:company,financialYearId:p.financial_year_id,accountingPeriodId:p.id,
        periodStatus:"OPEN" as const,configurationVersionId:current.mapping_revision,currencyCode:"GBP",
        accounts:Object.fromEntries(accounts.rows.map(a=>[a.id,{id:a.id,companyId:company,isActive:a.is_active===true,isEligible:true,currencyCode:"GBP"}])),
        metadata:{source_revision:expected,source_evidence_hash:input.command.sourceEvidenceHash,
          business_accounting_basis:"accrual",tax_context:current.tax_context,
          original_id:current.original_id,adjustment_method:current.adjustment_method}};
      return locked(ctx,[`accounting_document_periods:${p.id}`,`accounting_company_configuration:${company}`],current.mapping_revision);
    }},
    lineBuilder:{async build(){return journalLines(current);}},
    hooks:{afterJournalInsert:async ({journal})=>{
      const q=queryAdapter(transaction!);
      await testHook?.(transaction!);
      await q.query("UPDATE accounting_document_sources SET status='posted',journal_id=$3,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2 AND status='draft'",[company,id,journal.id]);
      await q.query(`UPDATE ${tables[current.kind as Kind]} SET status='posted',updated_at=clock_timestamp()${credit(current.kind)?",is_applied=true":""} WHERE company_id=$1 AND id=$2 AND status='draft'`,[company,id]);
      if(conditionalOriginal) await bindConditionalOriginal(q,company,actor,id);
      await syncSettlementProjection(q,company,credit(current.kind)?current.original_id:id);
      await q.query(`INSERT INTO accounting_document_audit(id,company_id,document_id,actor_id,action,before_source,after_source)
        VALUES($1,$2,$3,$4,'post',$5,$5)`,[randomUUID(),company,id,actor,current.source]);
    }},
  };
  try {
    const post=existingTransaction?(command:any,deps:CanonicalPostingDependencies)=>postCanonicalJournalInTransaction(existingTransaction,command,deps):postCanonicalJournal;
    const result=await post({
      principal:{kind:"user",userId:actor,requestedCompanyId:company},requestedCompanyId:company,
      sourceType:initial.kind,sourceId:id,sourceRevision:expected,sourceStatus:"draft",
      sourceEvidenceHash:evidenceHash,
      postingKind:"ordinary_document",economicEffectId:`document:${id}`,idempotencyKey:`document:${id}`,
      accountIds:[...new Set(Object.values(initial.posting_accounts).filter((v):v is string=>typeof v==="string" && v.length>0))],
      postingDate:initial.source.issue_date,configurationVersionId:initial.mapping_revision,
      currencyCode:"GBP",description:initial.source.invoice_number,reference:initial.source.reference,
    },dependencies);
    return {status:result.status,journal_id:result.journalId};
  } catch(error) {
    if(error instanceof AlreadyPosted) return {status:"duplicate",journal_id:error.journalId};
    throw error;
  }
}
