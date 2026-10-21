import { DraftError, uuid } from "../financialDrafts/contract";
import { scope, transact, hash, type Queryable } from "./core";

export const roles = ["receivables","payables","revenue","expense","output_vat","input_vat"] as const;
type Role = typeof roles[number];
const types: Record<Role,string[]> = {
  receivables:["asset","assets"],payables:["liability","liabilities"],
  revenue:["income","revenue"],expense:["expense","expenses","cost_of_sales"],
  output_vat:["liability","liabilities"],input_vat:["asset","assets"],
};
const labels:Record<Role,string> = {
  receivables:"Customer balance account",payables:"Supplier balance account",
  revenue:"Sales account",expense:"Purchase account",output_vat:"Output VAT account",input_vat:"Input VAT account",
};
export class AccountSelectionError extends DraftError {
  constructor(path:string,public readonly publicMessage:string) { super(422,"ACCOUNT_SELECTION_INVALID",path); }
}
export function accountId(value:unknown,path="/posting_account_id") {
  try { return uuid(value).toLowerCase(); }
  catch { throw new AccountSelectionError(path,"Choose a valid account from the selected company's chart."); }
}
export function describeAccount(row:any) {
  const supported=roles.filter(role=>types[role].includes(String(row.account_type).toLowerCase()));
  return {...row,eligible_roles:row.is_active===true?supported:[],
    eligibility_reason:row.is_active!==true?"Inactive — unavailable for new document postings."
      :supported.length===0?"This account type is not supported by the current document posting workflow.":null};
}
export async function companyChart(q:Queryable,company:string) {
  const rows=await q.query(`SELECT a.*,p.report_group,coalesce(p.display_order,0) display_order,
    EXISTS(SELECT 1 FROM canonical_journal_lines l WHERE l.company_id=a.company_id AND l.account_id=a.id) used,
    EXISTS(SELECT 1 FROM accounting_company_configuration c, jsonb_each_text(c.mappings) m
      WHERE c.company_id=a.company_id AND lower(m.value)=a.id::text) control_mapped,
    coalesce((SELECT jsonb_agg(m.key ORDER BY m.key) FROM accounting_company_configuration c, jsonb_each_text(c.mappings) m
      WHERE c.company_id=a.company_id AND lower(m.value)=a.id::text),'[]'::jsonb) mapped_roles
    FROM chart_of_accounts a LEFT JOIN accounting_account_presentation p
      ON p.account_id=a.id AND p.company_id=a.company_id WHERE a.company_id=$1 ORDER BY a.code,a.id`,[company]);
  if((await q.query("SELECT to_regclass('public.journal_entries') present")).rows[0].present) {
    const legacy=await q.query(`SELECT e->>'account_id' account_id,e->>'account_code' account_code
      FROM journal_entries j CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(j.lines)='array' THEN j.lines ELSE '[]'::jsonb END) e
      WHERE j.company_id=$1 AND j.status='posted'`,[company]);
    for(const a of rows.rows) if(legacy.rows.some(l=>l.account_id===a.id || (!l.account_id && l.account_code===a.code))) a.used=true;
  }
  return rows.rows.map(a=>({...describeAccount(a),classification_locked:a.used||a.control_mapped,
    revision:hash({id:a.id,code:a.code,name:a.name,account_type:a.account_type,is_active:a.is_active,
      report_group:a.report_group,display_order:a.display_order})}));
}
export async function chart(company:string,actor:string) {
  return transact(async q=>{await scope(q,company,actor);return companyChart(q,company);});
}
export async function validateAccounts(q:Queryable,company:string,mappings:Record<string,string>,vat:boolean,
  paths:Partial<Record<Role,string>>={}) {
  const needed=vat?roles:roles.slice(0,4);
  if(!mappings || typeof mappings!=="object" || Array.isArray(mappings) ||
    Object.keys(mappings).some(r=>!roles.includes(r as Role)))
    throw new AccountSelectionError("/mappings","Choose the company's posting accounts in Posting Setup.");
  const ids=needed.map(role=>accountId(mappings[role],paths[role]??`/mappings/${role}`));
  const rows=await q.query("SELECT * FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",[company,ids]);
  for(const [i,role] of needed.entries()) {
    const path=paths[role]??`/mappings/${role}`, account=rows.rows.find(r=>r.id===ids[i]);
    if(!account) throw new AccountSelectionError(path,`${labels[role]} is not available in the selected company. Choose one from its chart.`);
    if(account.is_active!==true) throw new AccountSelectionError(path,`${labels[role]} is inactive. Choose an active account or update Posting Setup.`);
    if(!describeAccount(account).eligible_roles.includes(role))
      throw new AccountSelectionError(path,`${labels[role]} must be ${types[role].join(" or ")}. Choose an eligible account.`);
  }
  if(new Set(ids).size!==ids.length)
    throw new AccountSelectionError("/mappings","Use distinct accounts for separate posting roles.");
  return rows.rows;
}
