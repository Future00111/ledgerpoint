import { randomUUID } from "node:crypto";
import type pg from "pg";
import { fail, parseInvoice, netPence, money, decimal, uuid, type InvoiceSource } from "../financialDrafts/contract";
import { calculateTaxLine, createProductionInvoiceDraftAuthority } from "../financialDrafts/productionAuthority";
import { configuration, validateAccounts } from "./configuration";
import { transact, scope, document, supportedCompany, kindOf, sales, credit, tables, hash, exactFields, pounds,
  type Queryable, type Kind } from "./core";

export async function calculateDocument(q:Queryable, company:string, kind:Kind, body:Record<string,any>, previous?:any) {
  const c=(await q.query("SELECT * FROM companies WHERE id=$1 FOR UPDATE",[company])).rows[0];
  supportedCompany(c);
  const config=await configuration(q,company,true);
  let source:InvoiceSource;
  if(previous && body.source!==undefined) {
    if(!body.source || typeof body.source!=="object" || Array.isArray(body.source)) fail(422,"FIELD_INVALID");
    const {currency,...patch}=body.source;
    if(currency!==undefined && currency!==previous.source.currency) fail(422,"FIELD_INVALID","/currency");
    source=parseInvoice(patch,previous.source);
  } else source=parseInvoice(body.source??previous?.source);
  const partyTable=sales(kind)?"customers":"suppliers";
  const party=await q.query(`SELECT id,name,status FROM ${partyTable} WHERE company_id=$1 AND id=$2 FOR SHARE`,[company,source.customer_id]);
  if(party.rowCount!==1 || party.rows[0].status!=="active") fail(422,"REFERENCE_INVALID");
  const originalId=body.original_id===undefined?previous?.original_id:body.original_id;
  const reason=body.reason===undefined?previous?.reason??"":body.reason;
  const method=body.adjustment_method===undefined?previous?.adjustment_method??null:body.adjustment_method;
  const effective=body.effective_adjustment_date===undefined?previous?.effective_adjustment_date??null:body.effective_adjustment_date;
  let eligible=body.purchase_vat_eligible===undefined?previous?.purchase_vat_eligible??false:body.purchase_vat_eligible;
  if(typeof eligible!=="boolean") fail(422,"PURCHASE_ELIGIBILITY_REQUIRED");
  let accounts={...config.mappings};
  let postingAccount=body.posting_account_id===undefined?previous?.posting_account_id??null:body.posting_account_id;
  let tax:any;
  if(credit(kind)) {
    if(!originalId || typeof reason!=="string" || !reason.trim() || reason.length>1000 ||
      method!=="offset_outstanding" || effective!==source.issue_date) fail(422,"CREDIT_EFFECTIVE_DECREASE_REQUIRED");
    const original=await document(q,company,uuid(originalId),true);
    if(original.kind!==(sales(kind)?"sales_invoice":"purchase_bill") ||
       original.party_id!==source.customer_id || source.issue_date<original.source.issue_date ||
       source.price_basis!==(original.source.price_basis??"excluding_vat")) fail(422,"CREDIT_ORIGINAL_MISMATCH");
    const references=body.original_line_refs??previous?.tax_context.original_line_refs??source.line_items.map((_,i)=>i);
    if(!Array.isArray(references) || references.length!==source.line_items.length ||
       new Set(references).size!==references.length ||
       references.some(i=>!Number.isInteger(i) || i<0 || i>=original.source.line_items.length)) fail(422,"CREDIT_ORIGINAL_MISMATCH");
    const entered=netPence(source.line_items);
    const net:string[]=[], vat:string[]=[], unit:string[]=[];
    const lines=source.line_items.map((line,i)=>{
      const originalLine=original.source.line_items[references[i]];
      const fact=original.tax_context.lines[references[i]];
      if(!fact || line.unit_price!==originalLine.unit_price || line.tax_code!==originalLine.tax_code ||
         decimal(line.quantity,true)>decimal(originalLine.quantity,true)) fail(422,"CREDIT_ORIGINAL_MISMATCH");
      const amount=calculateTaxLine(entered[i]!,decimal(String(fact.rate),false)/100n,source.price_basis!,line.unit_price);
      net.push(amount.net.toString());vat.push(amount.vat.toString());unit.push(amount.unitNetPrice);
      return {...fact,entered_unit_price:line.unit_price,unit_net_price:amount.unitNetPrice,
        net_pence:amount.net.toString(),vat_pence:amount.vat.toString(),original_line_ref:references[i]};
    });
    eligible=original.purchase_vat_eligible;
    accounts=original.posting_accounts;
    postingAccount=original.posting_account_id;
    tax={netPence:net,vatPence:vat,unitNetPrices:unit,context:{
      ...original.tax_context,lines,original_line_refs:references,
      original_document_id:original.id,original_revision:original.revision,
      original_tax_point_date:original.source.issue_date,issue_date:source.issue_date,
      effective_adjustment_date:effective,adjustment_method:method,adjustment_reason:reason.trim(),
      original_evidence_hash:hash({source:original.source,money:original.money,tax_context:original.tax_context,accounts:original.posting_accounts}),
      company:original.tax_context.company,
    }};
    if(original.tax_context.company.vat_registered!==c.vat_registered) fail(422,"TAX_CONTEXT_CHANGED");
  } else {
    if(originalId || method || effective || reason) fail(422,"FIELD_INVALID");
    tax=await createProductionInvoiceDraftAuthority().resolveTax(q as pg.PoolClient,company,source,netPence(source.line_items));
    if(!sales(kind) && postingAccount) accounts.expense=uuid(postingAccount);
    if(sales(kind) && postingAccount) fail(422,"FIELD_INVALID");
    if(eligible && (sales(kind) || c.vat_registered!==true)) fail(422,"PURCHASE_ELIGIBILITY_INVALID");
  }
  await validateAccounts(q,company,accounts,c.vat_registered);
  const totals=money(tax.netPence.map((v:string)=>BigInt(v)),tax.vatPence);
  return {source,party_name:party.rows[0].name,party_id:source.customer_id,
    original_id:originalId??null,reason:typeof reason==="string"?reason.trim():"",
    adjustment_method:method,effective_adjustment_date:effective,
    purchase_vat_eligible:eligible,posting_account_id:postingAccount,
    money:totals,tax_context:{...tax.context,source_fingerprint:hash(source),
      rounding:{...tax.context.rounding,decision_scope:"Owner-authorized synthetic development accounting; not production qualification."},
      purchase_vat_eligible:eligible,business_accounting_basis:"accrual"},
    posting_accounts:accounts,mapping_revision:config.revision,unit_net_prices:tax.unitNetPrices};
}
export async function assertCreditAvailable(q:Queryable, company:string, row:any) {
  if(!credit(row.kind)) return;
  const original=await document(q,company,row.original_id,true);
  if(original.status!=="posted" || !original.journal_id ||
    row.tax_context.original_revision!==original.revision ||
    row.tax_context.original_evidence_hash!==hash({source:original.source,money:original.money,tax_context:original.tax_context,accounts:original.posting_accounts}))
    fail(409,"CREDIT_ORIGINAL_NOT_CURRENT_POSTED");
  const entry=await q.query("SELECT id FROM canonical_journal_entries WHERE id=$1 AND company_id=$2 AND source_id=$3 AND status='posted'",[original.journal_id,company,original.id]);
  if(entry.rowCount!==1) fail(409,"CREDIT_ORIGINAL_NOT_CURRENT_POSTED");
  const table=tables[original.kind as Kind];
  const paid=await q.query(`SELECT amount_paid FROM ${table} WHERE id=$1 AND company_id=$2 FOR SHARE`,[original.id,company]);
  const links=await q.query(`SELECT id FROM bank_transactions WHERE company_id=$1 AND
    (linked_invoice_id=$2 OR matched_record_id=$2::text) FOR SHARE`,[company,original.id]);
  if(paid.rowCount!==1 || Number(paid.rows[0].amount_paid)!==0 || links.rowCount)
    fail(422,"CREDIT_OFFSET_REQUIRES_UNPAID_SOURCE");
  const other=await q.query("SELECT money,tax_context FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND status='posted' ORDER BY id FOR UPDATE",[company,original.id]);
  for(let i=0;i<row.money.lines.length;i++) {
    const ref=row.tax_context.original_line_refs[i], own=row.money.lines[i];
    for(const field of ["net_pence","vat_pence","gross_pence"]) {
      let total=BigInt(own[field]);
      for(const prior of other.rows) {
        const ix=prior.tax_context.original_line_refs.indexOf(ref);
        if(ix>=0) total+=BigInt(prior.money.lines[ix][field]);
      }
      if(total>BigInt(original.money.lines[ref][field])) fail(409,"CREDIT_EXCEEDS_OUTSTANDING");
    }
  }
}
export async function project(q:Queryable,company:string,id:string,kind:Kind,row:any,insert:boolean) {
  const s=row.source, isCredit=credit(kind);
  const party=sales(kind)?"customer":"supplier";
  const date=isCredit?"credit_note_date":sales(kind)?"issue_date":"bill_date";
  const number=isCredit?"credit_note_number":sales(kind)?"invoice_number":"bill_number";
  const lines=s.line_items.map((line:any,i:number)=>({...line,entered_unit_price:line.unit_price,
    unit_price:row.unit_net_prices?.[i]??row.tax_context.lines[i].unit_net_price,price_basis:s.price_basis,
    amount:pounds(row.money.lines[i].net_pence),vat_amount:pounds(row.money.lines[i].vat_pence),
    line_total:pounds(row.money.lines[i].gross_pence),vat_rate:row.tax_context.lines[i].rate,
    tax_treatment:row.tax_context.lines[i].treatment}));
  const fields=[`${party}_id`,`${party}_name`,number,date,"line_items","subtotal","vat_total","total","notes"];
  const values:any[]=[s.customer_id,row.party_name,s.invoice_number,s.issue_date,JSON.stringify(lines),
    pounds(row.money.net_pence),pounds(row.money.vat_pence),pounds(row.money.gross_pence),s.notes];
  if(isCredit) {
    fields.push(sales(kind)?"original_invoice_id":"original_bill_id","reason");
    values.push(row.original_id,row.reason);
  } else {
    fields.push("due_date","payment_terms","reference","balance_due"); values.push(s.due_date,s.payment_terms,s.reference,pounds(row.money.gross_pence));
  }
  if(insert) {
    fields.push("id","company_id","status");values.push(id,company,"draft");
    await q.query(`INSERT INTO ${tables[kind]}(${fields.join(",")}) VALUES(${values.map((_,i)=>`$${i+1}`).join(",")})`,values);
  } else {
    await q.query(`UPDATE ${tables[kind]} SET ${fields.map((f,i)=>`${f}=$${i+1}`).join(",")},updated_at=clock_timestamp()
      WHERE id=$${values.length+1} AND company_id=$${values.length+2} AND status='draft'`,[...values,id,company]);
  }
}
const editable=["kind","source","original_id","purchase_vat_eligible","posting_account_id","reason","adjustment_method","effective_adjustment_date","original_line_refs"];
export async function saveDocument(company:string,actor:string,input:unknown,id?:string,expected?:string) {
  const body=exactFields(input,editable);
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    const old=id?await document(q,company,id,true):undefined;
    if(old && old.status!=="draft") fail(409,"DOCUMENT_NOT_DRAFT");
    if(old && expected!==old.revision) fail(409,"REVISION_CONFLICT");
    if(old && body.kind!==undefined && body.kind!==old.kind) fail(422,"DOCUMENT_KIND_INVALID");
    const kind=old?.kind??kindOf(body.kind);
    if(old) {
      const linked=await q.query("SELECT id FROM canonical_journal_entries WHERE company_id=$1 AND source_id=$2",[company,id]);
      if(linked.rowCount) fail(409,"DOCUMENT_NOT_DRAFT");
    }
    const row=await calculateDocument(q,company,kind,body,old);
    const docId=id??randomUUID(),revision=randomUUID();
    await project(q,company,docId,kind,row,!old);
    const vals=[company,kind,row.source.invoice_number,revision,row.source,row.party_id,row.original_id,
      row.reason,row.adjustment_method,row.effective_adjustment_date,row.purchase_vat_eligible,row.posting_account_id,
      row.money,row.tax_context,row.posting_accounts,row.mapping_revision,docId];
    if(old) {
      await q.query(`UPDATE accounting_document_sources SET number=$3,revision=$4,source=$5,party_id=$6,original_id=$7,
        reason=$8,adjustment_method=$9,effective_adjustment_date=$10,purchase_vat_eligible=$11,posting_account_id=$12,
        money=$13,tax_context=$14,posting_accounts=$15,mapping_revision=$16,updated_at=clock_timestamp()
        WHERE company_id=$1 AND kind=$2 AND id=$17`,vals);
    } else {
      await q.query(`INSERT INTO accounting_document_sources(company_id,kind,number,revision,source,party_id,original_id,
        reason,adjustment_method,effective_adjustment_date,purchase_vat_eligible,posting_account_id,
        money,tax_context,posting_accounts,mapping_revision,id,status)
        VALUES(${vals.map((_,i)=>`$${i+1}`).join(",")},'draft')`,vals);
    }
    await q.query(`INSERT INTO accounting_document_audit(id,company_id,document_id,actor_id,action,before_source,after_source)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),company,docId,actor,old?"edit":"create",old?.source??null,row.source]);
    return {...row,id:docId,kind,status:"draft",revision,journal_id:null};
  });
}
export async function getDocument(company:string,actor:string,id:string) {
  return transact(async q=>{
    await scope(q,company,actor);
    const found=await q.query("SELECT id FROM accounting_document_sources WHERE company_id=$1 AND id=$2",[company,uuid(id)]);
    if(!found.rowCount) {
      const legacy=await q.query("SELECT id FROM sales_invoices WHERE company_id=$1 AND id=$2 AND status='draft'",[company,id]);
      if(legacy.rowCount) fail(409,"LEGACY_DRAFT");
      fail(404,"RESOURCE_NOT_FOUND");
    }
    const row=await document(q,company,id);
    const p=await q.query(`SELECT name FROM ${sales(row.kind)?"customers":"suppliers"} WHERE id=$1 AND company_id=$2`,[row.party_id,company]);
    return {...row,party_name:p.rows[0]?.name??""};
  });
}
export async function listDocuments(company:string,actor:string,kind:Kind) {
  return transact(async q=>{
    await scope(q,company,actor);
    return (await q.query(`SELECT d.*,p.name party_name FROM accounting_document_sources d
      JOIN ${sales(kind)?"customers":"suppliers"} p ON p.id=d.party_id AND p.company_id=d.company_id
      WHERE d.company_id=$1 AND d.kind=$2 ORDER BY d.created_at DESC,d.id`,[company,kind])).rows;
  });
}
