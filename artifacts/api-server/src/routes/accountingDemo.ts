import { createHash, randomUUID } from "node:crypto";
import { Router, type RequestHandler, type Request } from "express";
import { isInvoiceDemoModeEnabled, assertIsolatedInvoiceDemoDatabase } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { exactFields, transact, scope } from "../services/accountingDocuments/core";
import { saveDocument, listDocuments } from "../services/accountingDocuments/documents";
import { roles } from "../services/accountingDocuments/configuration";

function id(actor:string,name:string) {
  const h=createHash("sha256").update(`ledgerly-accounting-flow:${actor}:${name}`).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export async function bootstrapAccountingDemo(actor:string) {
  await assertIsolatedInvoiceDemoDatabase();
  if(!isInvoiceDemoModeEnabled || process.env.NODE_ENV!=="development") throw Error("Isolated demo only");
  const company=id(actor,"company"),customer=id(actor,"customer"),supplier=id(actor,"supplier");
  const name="Synthetic Accounting Flow — TEST DATA, not business records";
  const date=new Date().toISOString().slice(0,10),year=date.slice(0,4);
  await transact(async q=>{
    const existing=await q.query("SELECT id,name FROM companies WHERE id=$1 FOR UPDATE",[company]);
    if(existing.rowCount) {
      if(existing.rows[0].name!==name) throw Error("Synthetic company identity conflict");
      await scope(q,company,actor,true,true);
      return;
    }
    await q.query(`INSERT INTO companies(id,name,country,base_currency,vat_registered,vat_scheme,vat_accounting_basis,status)
      VALUES($1,$2,'GB','GBP',true,'standard','invoice','active')`,[company,name]);
    await q.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),company,actor]);
    await q.query("INSERT INTO customers(id,company_id,name,status) VALUES($1,$2,'Synthetic Accounting Customer','active')",[customer,company]);
    await q.query("INSERT INTO suppliers(id,company_id,name,status) VALUES($1,$2,'Synthetic Accounting Supplier','active')",[supplier,company]);
    const names=["Trade receivables","Trade payables","Sales revenue","Eligible purchase expense","Output VAT","Input VAT"];
    const types=["asset","liability","income","expense","liability","asset"];
    const codes=["1100","2100","4000","5000","2200","1200"];
    const mappings:Record<string,string>={};
    for(let i=0;i<roles.length;i++) {
      const account=id(actor,roles[i]!);mappings[roles[i]!]=account;
      await q.query(`INSERT INTO chart_of_accounts(id,company_id,code,name,account_type,is_active)
        VALUES($1,$2,$3,$4,$5,true)`,[account,company,codes[i],names[i],types[i]]);
    }
    await q.query("INSERT INTO accounting_company_configuration VALUES($1,$2,'accrual',$3)",[company,randomUUID(),mappings]);
    await q.query("INSERT INTO accounting_document_periods VALUES($1,$2,$3,$4,$5,'OPEN')",
      [randomUUID(),company,`Financial year ending ${year}`,`${year}-01-01`,`${year}-12-31`]);
    for(const [code,label,rate,treatment,start] of [
      ["FLOW_20","Standard VAT 20%","20","standard","2011-01-04"],
      ["FLOW_5","Reduced VAT 5%","5","reduced","1997-09-01"],
      ["FLOW_ZERO","Zero rated","0","zero",`${year}-01-01`],
      ["FLOW_EXEMPT","Exempt","0","exempt",`${year}-01-01`],
      ["FLOW_OUTSIDE","Outside scope","0","outside_scope",`${year}-01-01`],
    ]) await q.query(`INSERT INTO vat_tax_rules(id,company_id,code,label,rate,treatment,effective_from,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,true)`,[randomUUID(),company,code,label,rate,treatment,start]);
  });
  const source=(party:string,number:string,price:string,quantity="1")=>({
    contract:"w03.draft.v1",currency:"GBP",price_basis:"including_vat",customer_id:party,invoice_number:number,
    issue_date:date,due_date:date,payment_terms:0,reference:"Synthetic completed sale / eligible expense, no cash movement",notes:"TEST DATA",
    line_items:[{description:"Synthetic ordinary supply",quantity,unit_price:price,tax_code:"FLOW_20"}],
  });
  const ensure=async(kind:Parameters<typeof listDocuments>[2],body:Record<string,unknown>)=>{
    const found=await listDocuments(company,actor,kind);
    if(found.length) return found[0];
    return saveDocument(company,actor,{kind,...body});
  };
  const sale=await ensure("sales_invoice",{source:source(customer,"FLOW-SI-001","120"),purchase_vat_eligible:false});
  const saleCredit=await ensure("sales_credit_note",{source:source(customer,"FLOW-SC-001","120","0.2"),
    original_id:sale.id,reason:"Agreed partial price reduction for the completed supply, offset against the outstanding invoice.",
    adjustment_method:"offset_outstanding",effective_adjustment_date:date,purchase_vat_eligible:false,original_line_refs:[0]});
  const bill=await ensure("purchase_bill",{source:source(supplier,"FLOW-PB-001","60"),purchase_vat_eligible:true});
  const supplierCredit=await ensure("supplier_credit_note",{source:source(supplier,"FLOW-PC-001","60","0.2"),
    original_id:bill.id,reason:"Supplier agreed a partial price reduction for the eligible expense, offset against the outstanding bill.",
    adjustment_method:"offset_outstanding",effective_adjustment_date:date,purchase_vat_eligible:true,original_line_refs:[0]});
  return {company:{id:company,name},documents:[sale,saleCredit,bill,supplierCredit]};
}
export function createAccountingDemoRouter(auth:RequestHandler=requireAuth) {
  const router=Router();router.use(auth);
  router.post("/bootstrap",async(req,res)=>{
    exactFields(req.body,[]);
    const data=await bootstrapAccountingDemo((req as Request & {userId:string}).userId);
    res.status(201).json({data});
  });
  router.use(((error:any,_req:any,res:any,_next:any)=>{
    console.error("Synthetic accounting bootstrap failed",{code:error.cause?.code??error.code??"internal"});
    res.status(error.status??409)
      .json({error:{code:error.code??"DEMO_BOOTSTRAP_FAILED",message:error.code?.replaceAll("_"," ")??"Could not prepare the isolated synthetic accounting company. Existing records were not reset."}});
  }) as any);
  return router;
}
export default createAccountingDemoRouter();
