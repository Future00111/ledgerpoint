import { reviewPaidCredit, commitPaidCredit } from '../services/accountingDocuments/paidCredit';
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
import { correctionContext, reviewCorrection, commitCorrection, correctionHistory } from "../services/accountingDocuments/corrections";

import { paymentContext, savePaymentConfiguration, listPayments, previewPayment, postPayment, recoverPayment } from '../services/accountingDocuments/payments';
import { createClaims, listClaims, confirmReceipt, cancelClaim } from '../services/creditTracking/service';
import type { Queryable } from '../services/accountingDocuments/core';

export function createAccountingRouter(auth:RequestHandler=requireAuth,testPostHook?:(tx:DatabaseTransaction)=>Promise<void>,testCreditHook?:(q:Queryable)=>Promise<void>) {
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
  router.get('/credit-claims',async(req,res)=>{
    const {company,actor}=ids(req);
    if(req.query.bill_id!==undefined && typeof req.query.bill_id!=='string') fail(400,'INVALID_REQUEST_SHAPE');
    res.json({data:await listClaims(company,actor,req.query.bill_id as string|undefined)});
  });
  router.post('/credit-claims',async(req,res)=>{
    const {company,actor}=ids(req);res.status(201).json({data:await createClaims(company,actor,req.body,testCreditHook)});
  });
  router.post('/credit-claims/:id/receipts',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await confirmReceipt(company,actor,id,revision(req),req.body,testCreditHook)});
  });
  router.post('/credit-claims/:id/cancel',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await cancelClaim(company,actor,id,revision(req),req.body,testCreditHook)});
  });
  router.get('/accounting-payments/context',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await paymentContext(company,actor)});});
  router.put('/accounting-payments/configuration',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await savePaymentConfiguration(company,actor,req.body)});});
  router.get('/accounting-payments/operations/:requestId',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await recoverPayment(company,actor,String(req.params.requestId))});});
  router.get('/accounting-payments',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await listPayments(company,actor)});});
  router.post('/accounting-payments/review',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await previewPayment(company,actor,req.body)});});
  router.post('/accounting-payments',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await postPayment(company,actor,req.body,testPostHook)});});
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
  router.get('/accounting-documents/:id/correction-context',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await correctionContext(company,actor,id)});
  });
  router.get('/accounting-documents/:id/corrections',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await correctionHistory(company,actor,id)});
  });
  router.post('/accounting-documents/:id/corrections/review',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await reviewCorrection(company,actor,id,revision(req),req.body)});
  });
  router.post('/accounting-documents/:id/corrections',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await commitCorrection(company,actor,id,revision(req),req.body,testPostHook)});
  });
  router.post("/accounting-documents",async(req,res)=>{
    const {company,actor}=ids(req);
    res.status(201).json({data:await saveDocument(company,actor,req.body)});
  });
  router.patch("/accounting-documents/:id",async(req,res)=>{
    const {company,actor,id}=ids(req);
    res.json({data:await saveDocument(company,actor,req.body,id,revision(req))});
  });
  router.post('/accounting-documents/:id/paid-credit/review',async(req,res)=>{const {company,actor,id}=ids(req);res.json({data:await reviewPaidCredit(company,actor,id,revision(req),req.body)});});
  router.post('/accounting-documents/:id/paid-credit',async(req,res)=>{const {company,actor,id}=ids(req);res.json({data:await commitPaidCredit(company,actor,id,revision(req),req.body,testPostHook)});});
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
        "/due_date":"Due date","/issue_date":"Document date","/payment_terms":"Payment terms","/posting_account_id":"Document account",
        "/discount":"Discount","/discount_adjustment":"Discount adjustment"};
      const field=labels[error.path]??(error.path?.startsWith("/line_items/")?"Invoice or bill line":"Submitted field");
      const guidance:Record<string,string>={
        CORRECTION_REVIEW_STALE:"This document, its payments or accounting setup changed after review. Refresh and review the correction again.",
        CORRECTION_BELOW_PAID:"The corrected total cannot be less than payments already applied. Review the payment and refund history first.",
        CORRECTION_CHILD_CREDITS:"This document already has a linked credit. Corrections are not yet supported for this case.",
        CORRECTION_ACTIVE_CLAIMS:"This bill has items awaiting credit. Resolve those claims before reviewing a correction.",
        CORRECTED_DOCUMENT_DEPENDENCY_UNSUPPORTED:"New credits, later discount credits and return-credit tracking are not yet available for corrected invoices or bills.",
        CORRECTION_ZERO_CHANGE_UNSUPPORTED:"These edits do not change the financial totals. Metadata-only changes are not supported here yet.",
        CORRECTION_POSITIVE_TOTAL_REQUIRED:"The corrected total must be greater than zero. Use the appropriate credit workflow for a full cancellation.",
        CORRECTION_REASON_REQUIRED:"Enter a reason for the correction, up to 1,000 characters.",
        CORRECTION_LINE_SHAPE_CHANGED:"Keep the existing items and line order. This correction can change only quantities and unit prices.",
        DATE_PRECEDES_SETTLEMENT_ACTIVITY:"Choose a date on or after the document's latest payment or correction activity.",
        DISCOUNT_INVALID:"Enter a positive discount: a percentage up to 100%, or an amount with at most two decimal places.",
        DISCOUNT_CONFLICT:"Choose either a draft discount or a later discount adjustment, not both.",
        DISCOUNT_EXCEEDS_TOTAL:"The discount cannot exceed the document value. No changes were committed.",
        DISCOUNT_ROUNDS_TO_ZERO:"This discount rounds to £0.00. Enter a discount of at least one penny, or remove it.",
        DISCOUNT_REQUIRES_ORIGINAL_DOCUMENT:"Draft discounts apply to invoices and bills. Use the linked discount adjustment for a posted document.",
        DISCOUNT_ADJUSTMENT_REQUIRES_CREDIT:"A later discount must be recorded as a linked credit note.",
        DISCOUNT_ORIGINAL_CHANGED:"The original document changed. Reopen it and prepare the discount again.",
        DISCOUNT_ORIGINAL_LINES_REQUIRED:"A discount adjustment must retain the original items and quantities. Reopen the original document to prepare it again.",
        CREDIT_EXCEEDS_OUTSTANDING:"This credit exceeds the remaining balance or the amount still creditable on an original line. Review existing payments and credits; an excess needs a separate refund or credit-balance workflow. No changes were committed.",
      };
      const message=error instanceof AccountSelectionError?error.publicMessage:
        guidance[error.code]??(error.code==="FIELD_INVALID"?`${field} is invalid. Check the value and try again.`:error.code.replaceAll("_"," ").toLowerCase()+
        (["ACCOUNT_CONFIGURATION_REQUIRED","ACCOUNT_MAPPING_INVALID","ACCOUNT_MAPPING_REQUIRED","PERIOD_NOT_WRITABLE"].includes(error.code)
          ?". Open Posting Setup to check account mappings and the document's open period.":". No changes were committed."));
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
