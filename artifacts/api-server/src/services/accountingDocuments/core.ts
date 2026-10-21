import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import type pg from "pg";
import type { DatabaseTransaction } from "../accounting/canonicalPosting";
import { canWriteDraft, fail, uuid } from "../financialDrafts/contract";

export const kinds = ["sales_invoice","sales_credit_note","purchase_bill","supplier_credit_note"] as const;
export type Kind = typeof kinds[number];
export const sales = (kind: Kind) => kind === "sales_invoice" || kind === "sales_credit_note";
export const credit = (kind: Kind) => kind === "sales_credit_note" || kind === "supplier_credit_note";
export const tables: Record<Kind,string> = {
  sales_invoice:"sales_invoices",sales_credit_note:"sales_credit_notes",
  purchase_bill:"purchase_bills",supplier_credit_note:"supplier_credit_notes",
};
const canonical = (value: any): any => Array.isArray(value)?value.map(canonical):
  value && typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const hash = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
export const pounds = (minor: string | bigint) => {
  const n=BigInt(minor); return `${n/100n}.${(n%100n).toString().padStart(2,"0")}`;
};
export function kindOf(value: unknown): Kind {
  if (!kinds.includes(value as Kind)) fail(422,"DOCUMENT_KIND_INVALID");
  return value as Kind;
}
export type Queryable = Pick<pg.PoolClient,"query">;
// A parameterized pg-compatible adapter lets the SAME tax authority run inside
// the canonical Drizzle transaction, never a second connection/transaction.
export function queryAdapter(tx: DatabaseTransaction): Queryable {
  return {query: async (text: string, values: unknown[] = []) => {
    const parts = text.split(/(\$\d+)/g).map(part => /^\$\d+$/.test(part)
      ? sql`${sql.param(values[Number(part.slice(1))-1])}` : sql.raw(part));
    return tx.execute(sql.join(parts,sql.raw("")));
  }} as unknown as Queryable;
}
export async function transact<T>(fn: (q: Queryable) => Promise<T>, snapshot=false): Promise<T> {
  return db.transaction(tx => fn(queryAdapter(tx)),snapshot?{isolationLevel:"repeatable read",accessMode:"read only"}:undefined);
}
export async function scope(q: Queryable, company: string, actor: string, write=false, lock=false) {
  uuid(company);
  const c=await q.query(`SELECT * FROM companies WHERE id=$1${lock?" FOR UPDATE":""}`,[company]);
  if(c.rowCount!==1) fail(404,"RESOURCE_NOT_FOUND");
  const members=await q.query(`SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2 ORDER BY id${lock?" FOR UPDATE":""}`,[company,actor]);
  if(members.rowCount!==1 || members.rows[0].is_active!==true) fail(404,"RESOURCE_NOT_FOUND");
  if(write && !canWriteDraft(members.rows[0].role,true)) fail(403,"CAPABILITY_DENIED");
  return c.rows[0];
}
export function supportedCompany(c: Record<string,unknown>) {
  if(c.country!=="GB" || c.base_currency!=="GBP") fail(422,"COMPANY_SETUP_UNSUPPORTED");
  if(typeof c.vat_registered!=="boolean") fail(422,"VAT_SETUP_INCOMPLETE");
  if(c.vat_registered && (c.vat_scheme!=="standard" || c.vat_accounting_basis!=="invoice"))
    fail(422,"VAT_SETUP_UNSUPPORTED");
}
export function exactFields(body: unknown, fields: string[]): Record<string,any> {
  if(!body || typeof body!=="object" || Array.isArray(body) ||
    Object.keys(body).some(key=>!fields.includes(key))) fail(422,"FIELD_INVALID");
  return body as Record<string,any>;
}
export async function document(q: Queryable, company: string, id: string, lock=false) {
  uuid(id);
  const r=await q.query(`SELECT d.*,to_char(effective_adjustment_date,'YYYY-MM-DD') effective_adjustment_date
    FROM accounting_document_sources d WHERE company_id=$1 AND id=$2${lock?" FOR UPDATE":""}`,[company,id]);
  if(r.rowCount!==1) fail(404,"RESOURCE_NOT_FOUND");
  return r.rows[0];
}
