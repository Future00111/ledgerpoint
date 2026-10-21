import { randomUUID } from "node:crypto";
import { fail } from "../financialDrafts/contract";
import { scope, transact, exactFields } from "./core";
import { accountId, companyChart, AccountSelectionError } from "./accounts";

export const categories=["income","cost_of_sales","expense","asset","liability","equity"];
function text(value:unknown,path:string,max:number) {
  if(typeof value!=="string" || !value.trim() || value.trim().length>max || /[\u0000-\u001f\u007f]/.test(value))
    throw new AccountSelectionError(path,`${path==="/code"?"Account code":"Account name"} must be non-empty, at most ${max} characters, without control characters.`);
  return value.trim();
}
export async function saveAccount(company:string,actor:string,input:unknown,id?:string,expected?:string) {
  const body=exactFields(input,["code","name","account_type","report_group","display_order","is_active"]);
  if(id && Object.keys(body).length===0) fail(422,"FIELD_INVALID");
  return transact(async q=>{
    await scope(q,company,actor,true,true);
    const chart=await companyChart(q,company);
    const old=id?chart.find(a=>a.id===accountId(id,"/account_id")):null;
    if(id && !old) fail(404,"RESOURCE_NOT_FOUND");
    if(old && expected!==old.revision) fail(409,"CHART_REVISION_CONFLICT");
    const value={...old,...body};
    const code=text(value.code,"/code",32),name=text(value.name,"/name",120);
    if(typeof value.account_type!=="string" ||
      (!categories.includes(value.account_type) && value.account_type!==old?.account_type))
      throw new AccountSelectionError("/account_type","Choose an accounting category from the list.");
    if(old?.classification_locked && value.account_type!==old.account_type)
      throw new AccountSelectionError("/account_type","This account is used or mapped. Its accounting category cannot change. Create a new account and remap future documents; use a separately reviewed journal to reclassify existing balances.");
    const active=value.is_active??true;
    if(typeof active!=="boolean") throw new AccountSelectionError("/is_active","Choose Current or Archived.");
    if(!active && old?.control_mapped)
      throw new AccountSelectionError("/is_active","This account is mapped in Posting Setup. Remap it before archiving.");
    if((await q.query(`SELECT id FROM chart_of_accounts WHERE company_id=$1 AND lower(btrim(code))=lower($2)
      AND ($3::uuid IS NULL OR id<>$3::uuid)`,[company,code,old?.id??null])).rowCount)
      throw new AccountSelectionError("/code","This code is already used in this company (case-insensitive). Choose another code.");
    let group=value.report_group??null;
    if(group==="") group=null;
    if(group!==null && (typeof group!=="string" || !group.trim() || group.trim().length>80 || /[\u0000-\u001f\u007f]/.test(group)))
      throw new AccountSelectionError("/report_group","Report heading must be at most 80 characters without control characters.");
    group=group?.trim()??null;
    const order=value.display_order??0;
    if(!Number.isInteger(order) || order<0 || order>9999)
      throw new AccountSelectionError("/display_order","Display order must be a whole number from 0 to 9999.");
    const account=old?.id??randomUUID();
    if(old) await q.query(`UPDATE chart_of_accounts SET code=$3,name=$4,account_type=$5,is_active=$6,updated_at=now()
      WHERE company_id=$1 AND id=$2`,[company,account,code,name,value.account_type,active]);
    else await q.query(`INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active)
      VALUES($1,$2,$3,$4,$5,$6)`,[account,company,code,name,value.account_type,active]);
    await q.query(`INSERT INTO accounting_account_presentation(account_id,company_id,report_group,display_order)
      VALUES($1,$2,$3,$4) ON CONFLICT(account_id) DO UPDATE SET report_group=$3,display_order=$4
      WHERE accounting_account_presentation.company_id=$2`,[account,company,group,order]);
    const saved=(await companyChart(q,company)).find(a=>a.id===account)!;
    const action=!old?"create":old.is_active&&!active?"archive":!old.is_active&&active?"restore":"edit";
    await q.query(`INSERT INTO accounting_chart_audit(id,company_id,account_id,actor_id,action,before_data,after_data)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),company,account,actor,action,old,saved]);
    return saved;
  });
}
