import { randomUUID } from "node:crypto";
import { fail, parseInvoice } from "../financialDrafts/contract";
import { scope, supportedCompany, transact, exactFields, type Queryable, type Kind, sales } from "./core";

import { roles, validateAccounts, companyChart } from "./accounts";
export { roles, validateAccounts } from "./accounts";
export async function configuration(q: Queryable, company: string, lock=false) {
  const result=await q.query(`SELECT * FROM accounting_company_configuration WHERE company_id=$1${lock?" FOR UPDATE":""}`,[company]);
  if(result.rowCount!==1) fail(422,"ACCOUNT_CONFIGURATION_REQUIRED");
  const row=result.rows[0];
  if(row.business_accounting_basis!=="accrual") fail(422,"ACCOUNTING_BASIS_UNSUPPORTED");
  return row;
}
export async function context(company: string,actor: string,kind: Kind) {
  return transact(async q=>{
    const c=await scope(q,company,actor);
    const config=await q.query("SELECT * FROM accounting_company_configuration WHERE company_id=$1",[company]);
    const accounts=await companyChart(q,company);
    const parties=await q.query(`SELECT id,name,status FROM ${sales(kind)?"customers":"suppliers"} WHERE company_id=$1 AND status='active' ORDER BY name,id`,[company]);
    const rules=await q.query("SELECT t.*,t.effective_from::text,t.effective_to::text FROM vat_tax_rules t WHERE t.company_id=$1 AND t.is_active=true ORDER BY t.code,t.effective_from",[company]);
    const periods=await q.query("SELECT p.*,p.start_date::text,p.end_date::text FROM accounting_document_periods p WHERE p.company_id=$1 ORDER BY p.start_date",[company]);
    const errors:string[]=[];
    if(!config.rowCount) errors.push("Choose accrual accounting and map the company's control, income and expense accounts.");
    else for(const role of c.vat_registered?roles:roles.slice(0,4)) {
      if(!accounts.some(a=>a.id===config.rows[0].mappings?.[role] && a.eligible_roles.includes(role)))
        errors.push(`The default ${role.replaceAll("_"," ")} account is unavailable or ineligible. Update Posting Setup.`);
    }
    if(!periods.rows.some(p=>p.status==="OPEN")) errors.push("Create an open accounting period for the document date.");
    try {supportedCompany(c);} catch {errors.push("Only UK GBP accrual, Standard invoice-accounting VAT or non-VAT businesses are supported.");}
    return {company:c,parties:parties.rows,tax_rules:rules.rows,accounts,
      mappings:config.rows[0]?.mappings??{},revision:config.rows[0]?.revision??null,
      business_accounting_basis:config.rows[0]?.business_accounting_basis??null,
      periods:periods.rows,configuration_errors:errors};
  });
}
export async function saveConfiguration(company:string,actor:string,input:unknown) {
  const body=exactFields(input,["revision","mappings","business_accounting_basis"]);
  if(body.business_accounting_basis!=="accrual") fail(422,"ACCOUNTING_BASIS_UNSUPPORTED");
  return transact(async q=>{
    const c=await scope(q,company,actor,true,true); supportedCompany(c);
    await validateAccounts(q,company,body.mappings,c.vat_registered);
    const old=await q.query("SELECT * FROM accounting_company_configuration WHERE company_id=$1 FOR UPDATE",[company]);
    if((old.rows[0]?.revision??null)!==(body.revision??null)) fail(409,"REVISION_CONFLICT");
    const revision=randomUUID();
    await q.query(`INSERT INTO accounting_company_configuration VALUES($1,$2,'accrual',$3)
      ON CONFLICT(company_id) DO UPDATE SET revision=$2,business_accounting_basis='accrual',mappings=$3`,
      [company,revision,body.mappings]);
    return {revision,mappings:body.mappings,business_accounting_basis:"accrual"};
  });
}
export async function addPeriod(company:string,actor:string,input:unknown) {
  const body=exactFields(input,["start_date","end_date","financial_year_id","financial_year_label"]);
  // Reuse strict calendar validation instead of accepting date rollover.
  const dateSource={contract:"w03.draft.v1",currency:"GBP",customer_id:company,invoice_number:"period",
    issue_date:body.start_date,due_date:body.end_date,payment_terms:0,
    line_items:[{description:"Date validation",quantity:"1",unit_price:"0",tax_code:"DATE"}]};
  parseInvoice(dateSource);
  const year=body.financial_year_label??body.financial_year_id??`Year ending ${String(body.end_date).slice(0,4)}`;
  if(typeof year!=="string" || !year.trim() || year.length>80) fail(422,"FIELD_INVALID");
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    const overlap=await q.query("SELECT id FROM accounting_document_periods WHERE company_id=$1 AND start_date<=$3::date AND end_date>=$2::date",[company,body.start_date,body.end_date]);
    if(overlap.rowCount) fail(409,"PERIOD_OVERLAP");
    const id=randomUUID();
    await q.query("INSERT INTO accounting_document_periods VALUES($1,$2,$3,$4,$5,'OPEN')",[id,company,year,body.start_date,body.end_date]);
    return {id,...body,financial_year_id:year,status:"OPEN"};
  });
}
