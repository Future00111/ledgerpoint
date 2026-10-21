import { Router, type RequestHandler, type Request } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { DraftError, fail } from "../services/financialDrafts/contract";
import { kindOf, exactFields } from "../services/accountingDocuments/core";
import { context, saveConfiguration, addPeriod } from "../services/accountingDocuments/configuration";
import { getDocument, listDocuments, saveDocument } from "../services/accountingDocuments/documents";
import { postDocument } from "../services/accountingDocuments/posting";
import { journal, reports } from "../services/accountingDocuments/reports";
import { CanonicalPostingError, type DatabaseTransaction } from "../services/accounting/canonicalPosting";
import { chart, AccountSelectionError } from "../services/accountingDocuments/accounts";
import { saveAccount } from "../services/accountingDocuments/chart";

export function createAccountingRouter(auth:RequestHandler=requireAuth,testPostHook?:(tx:DatabaseTransaction)=>Promise<void>) {
  const router=Router({mergeParams:true});
  router.use(auth);
  router.use((req,res,next)=>{
    res.set("Cache-Control","no-store");
    if(req.headers["x-company-id"]) {res.status(400).json({error:{code:"CONTEXT_CONFLICT",message:"Use the selected company URL."}});return;}
    if(["POST","PUT","PATCH"].includes(req.method) && !req.is("application/json")) {
      res.status(415).json({error:{code:"UNSUPPORTED_MEDIA_TYPE",message:"Use JSON."}});return;
    }
    next();
  });
  const ids=(req:Request)=>({company:String(req.params.companyId),actor:(req as Request & {userId:string}).userId,id:String(req.params.id)});
  const revision=(req:Request)=>{
    const value=req.get("If-Match");
    if(!value || !/^"[0-9a-f-]{36}"$/.test(value)) fail(428,"REVISION_REQUIRED");
    return value.slice(1,-1);
  };
  router.get("/accounting-accounts",async(req,res)=>{
    const {company,actor}=ids(req);res.json({data:await chart(company,actor)});
  });
  router.post("/accounting-accounts",async(req,res)=>{
    const {company,actor}=ids(req);res.status(201).json({data:await saveAccount(company,actor,req.body)});
  });
  router.patch("/accounting-accounts/:id",async(req,res)=>{
    const {company,actor,id}=ids(req);
    const tag=req.get("If-Match");
    if(!tag || !/^"sha256:[0-9a-f]{64}"$/.test(tag)) fail(428,"REVISION_REQUIRED");
    res.json({data:await saveAccount(company,actor,req.body,id,tag.slice(1,-1))});
  });
  router.get("/accounting-documents/context",async(req,res)=>{
    const {company,actor}=ids(req);
    res.json({data:await context(company,actor,kindOf(req.query.kind??"sales_invoice"))});
  });
  router.get("/accounting-documents",async(req,res)=>{
    const {company,actor}=ids(req);
    res.json({data:await listDocuments(company,actor,kindOf(req.query.kind))});
  });
  router.get("/accounting-documents/:id",async(req,res)=>{
    const {company,actor,id}=ids(req);
    res.json({data:await getDocument(company,actor,id)});
  });
  router.post("/accounting-documents",async(req,res)=>{
    const {company,actor}=ids(req);
    res.status(201).json({data:await saveDocument(company,actor,req.body)});
  });
  router.patch("/accounting-documents/:id",async(req,res)=>{
    const {company,actor,id}=ids(req);
    res.json({data:await saveDocument(company,actor,req.body,id,revision(req))});
  });
  router.post("/accounting-documents/:id/post",async(req,res)=>{
    const {company,actor,id}=ids(req);exactFields(req.body,[]);
    res.json({data:await postDocument(company,actor,id,revision(req),testPostHook)});
  });
  router.get("/accounting-configuration",async(req,res)=>{
    const {company,actor}=ids(req);const data=await context(company,actor,"sales_invoice");
    res.json({data:{...data,financial_years:[...new Set(data.periods.map((p:any)=>p.financial_year_id))].map(id=>({id,name:id}))}});
  });
  router.put("/accounting-configuration",async(req,res)=>{
    const {company,actor}=ids(req);res.json({data:await saveConfiguration(company,actor,req.body)});
  });
  router.post("/accounting-periods",async(req,res)=>{
    const {company,actor}=ids(req);res.status(201).json({data:await addPeriod(company,actor,req.body)});
  });
  router.get("/accounting-journals/:id",async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await journal(company,actor,id)});
  });
  router.get("/accounting-reports",async(req,res)=>{
    const {company,actor}=ids(req);
    res.json({data:await reports(company,actor,String(req.query.from??""),String(req.query.to??""))});
  });
  router.use(((error:any,_req:any,res:any,_next:any)=>{
    const databaseCode=error.cause?.code??error.code;
    if(error instanceof DraftError) {
      const labels:Record<string,string>={"/invoice_number":"Document number","/customer_id":"Customer or supplier",
        "/due_date":"Due date","/issue_date":"Document date","/payment_terms":"Payment terms","/posting_account_id":"Document account"};
      const field=labels[error.path]??(error.path?.startsWith("/line_items/")?"Invoice or bill line":"Submitted field");
      const message=error instanceof AccountSelectionError?error.publicMessage:
        error.code==="FIELD_INVALID"?`${field} is invalid. Check the value and try again.`:error.code.replaceAll("_"," ").toLowerCase()+
        (["ACCOUNT_CONFIGURATION_REQUIRED","ACCOUNT_MAPPING_INVALID","ACCOUNT_MAPPING_REQUIRED","PERIOD_NOT_WRITABLE"].includes(error.code)
          ?". Open Posting Setup to check account mappings and the document's open period.":". No changes were committed.");
      res.status(error.status).json({error:{code:error.code,issues:[{path:error.path,code:error.code,message}],message}});return;
    }
    if(error instanceof CanonicalPostingError) {
      res.status(error.code.startsWith("authorization")?403:409).json({error:{code:error.code,message:error.message}});return;
    }
    if(databaseCode==="23505") {res.status(409).json({error:{code:"NUMBER_CONFLICT",message:"This document number already exists."}});return;}
    if(databaseCode==="42P01") {res.status(503).json({error:{code:"ACCOUNTING_SCHEMA_UNAVAILABLE",message:"The reviewed accounting schema must be installed by the database operator. No changes were committed."}});return;}
    console.error("Accounting operation failed",{code:databaseCode??"internal"});
    res.status(500).json({error:{code:"ACCOUNTING_OPERATION_FAILED",message:"The accounting operation failed. No changes were committed."}});
  }) as any);
  return router;
}
export default createAccountingRouter();
