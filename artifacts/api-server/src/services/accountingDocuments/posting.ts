import { randomUUID } from "node:crypto";
import { fail } from "../financialDrafts/contract";
import { postCanonicalJournal, type CanonicalPostingDependencies, type DatabaseTransaction,
  type CanonicalLineDraft, type LockedAuthority } from "../accounting/canonicalPosting";
import { calculateDocument, assertCreditAvailable, getDocument } from "./documents";
import { queryAdapter, scope, document, hash, sales, credit, tables, type Kind, type Queryable } from "./core";

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
export function journalLines(row:any):CanonicalLineDraft[] {
  const counterDebit=sales(row.kind)!==credit(row.kind);
  const result:CanonicalLineDraft[]=[];
  const add=(account:string,amount:string,debit:boolean,ref:string,taxCode?:string)=>{
    if(BigInt(amount)===0n) return;
    result.push({accountId:account,debitMinor:debit?amount:"0",creditMinor:debit?"0":amount,
      currencyCode:"GBP",sourceLineRef:ref,taxCode:taxCode??null});
  };
  add(row.posting_accounts[sales(row.kind)?"receivables":"payables"],row.money.gross_pence,counterDebit,"counterparty");
  row.money.lines.forEach((line:any,i:number)=>{
    const vatRecovered=sales(row.kind) || row.purchase_vat_eligible;
    const trade=(BigInt(line.net_pence)+(vatRecovered?0n:BigInt(line.vat_pence))).toString();
    const ref=credit(row.kind)?`original:${row.original_id}:${row.tax_context.original_line_refs[i]}`:String(i);
    add(row.posting_accounts[sales(row.kind)?"revenue":"expense"],trade,!counterDebit,ref,row.source.line_items[i].tax_code);
    if(vatRecovered) add(row.posting_accounts[sales(row.kind)?"output_vat":"input_vat"],line.vat_pence,!counterDebit,ref,row.source.line_items[i].tax_code);
  });
  return result;
}
export async function postDocument(company:string,actor:string,id:string,expected:string,
  testHook?: (tx:DatabaseTransaction)=>Promise<void>) {
  // Read admission is advisory; all authorities and capabilities are locked and
  // checked again inside postCanonicalJournal's one transaction.
  const initial=await getDocument(company,actor,id);
  if(initial.revision!==expected) fail(409,"REVISION_CONFLICT");
  let current:any, transaction:DatabaseTransaction;
  const dependencies:CanonicalPostingDependencies={
    sourceProvider:{async lockForPosting(command,tx) {
      transaction=tx;const q=queryAdapter(tx);
      await scope(q,company,actor,true,true);
      current=await document(q,company,id,true);
      if(current.revision!==expected) fail(409,"REVISION_CONFLICT");
      if(current.status==="posted") {
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
      await assertCreditAvailable(q,company,current);
      const snapshot={companyId:company,sourceType:current.kind,sourceId:id,status:"draft",isPostable:true,
        sourceRevision:expected,evidenceHash:hash({source:current.source,money:current.money,
          tax_context:current.tax_context,accounts:current.posting_accounts})};
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
      await q.query(`INSERT INTO accounting_document_audit(id,company_id,document_id,actor_id,action,before_source,after_source)
        VALUES($1,$2,$3,$4,'post',$5,$5)`,[randomUUID(),company,id,actor,current.source]);
    }},
  };
  try {
    const result=await postCanonicalJournal({
      principal:{kind:"user",userId:actor,requestedCompanyId:company},requestedCompanyId:company,
      sourceType:initial.kind,sourceId:id,sourceRevision:expected,sourceStatus:"draft",
      sourceEvidenceHash:hash({source:initial.source,money:initial.money,tax_context:initial.tax_context,accounts:initial.posting_accounts}),
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
