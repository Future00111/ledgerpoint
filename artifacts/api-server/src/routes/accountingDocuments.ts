import { captureConditionalEvidence, getConditionalEvidence } from '../services/accountingDocuments/conditionalDiscount';
import { reviewPaidCredit, commitPaidCredit, reviewPublicConditionalCredit } from '../services/accountingDocuments/paidCredit';
import { conditionalCompensationContext,reviewConditionalCompensation,recoverConditionalCompensation } from '../services/accountingDocuments/conditionalCompensation';
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
import { correctionContext, reviewCorrection, commitCorrection, correctionHistory, recoverCorrection } from "../services/accountingDocuments/corrections";

import { paymentContext, savePaymentConfiguration, listPayments, previewPayment, postPayment, recoverPayment } from '../services/accountingDocuments/payments';
import { createClaims, listClaims, confirmReceipt, cancelClaim } from '../services/creditTracking/service';
import type { Queryable } from '../services/accountingDocuments/core';
import { appendConditionalReplacement } from '../services/accountingDocuments/conditionalReplacements';
import { observeConditionalReplacement } from '../services/accountingDocuments/replacementBindings';
import { conditionalReplacementOverview } from '../services/accountingDocuments/conditionalReplacementOverview';
import {recoverBankImport} from '../services/accountingDocuments/bankImports';
import {reviewBankCorrection,confirmBankCorrection,recoverBankCorrection} from '../services/accountingDocuments/bankCorrections';
import {bankOpeningContext,recoverBankOpening,reviewBankOpening,postBankOpening} from '../services/accountingDocuments/bankOpenings';
import {bankStatementContext,reviewStatementImport,importStatement,reviewBankMatch,confirmBankMatch,recoverBankMatch} from '../services/accountingDocuments/bankStatements';

/** Public projections: never return internal canonical payloads, frozen vectors or capacity authority. */
const replacementReceipt=(r:any)=>({id:r.id,request_id:r.request_id,predecessor_id:r.predecessor_id??null,recorded_at:r.recorded_at,
  evidence:r.evidence?{id:r.evidence.id,terms:r.evidence.terms,evidence_hash:r.evidence.evidence_hash}:null,observation:{state:'unobserved'},posting_available:false});
const observationReceipt=(b:any)=>({replacement_id:b?.replacement?.id??null,
  observation:b?.observation?{state:'observed',observed_at:b.observation.observed_at??null,binding_hash:b.observation.binding_hash??null}:{state:'unobserved'},
  posting_available:false});

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
  router.post('/conditional-discount-evidence',async(req,res)=>{const {company,actor}=ids(req);res.status(201).json({data:await captureConditionalEvidence(company,actor,req.body)});});
  router.get('/conditional-discount-evidence/:id',async(req,res)=>{const {company,actor,id}=ids(req);res.json({data:await getConditionalEvidence(company,actor,id)});});
  router.get('/accounting-conditional-compensations/context',async(req,res)=>{
    const {company,actor}=ids(req);res.json({data:await conditionalCompensationContext(company,actor)});
  });
  router.post('/accounting-conditional-compensations/review',async(req,res)=>{
    const {company,actor}=ids(req);res.json({data:{...await reviewConditionalCompensation(company,actor,req.body),readonly:true,posting_available:false}});
  });
  router.get('/accounting-conditional-compensations/operations/:id',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await recoverConditionalCompensation(company,actor,id)});
  });
  // No compensation commit route: independent integration acceptance is pending.
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
  router.get('/bank-statements/context',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await bankStatementContext(company,actor)});});
  router.post('/bank-statements/correction-review',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await reviewBankCorrection(company,actor,req.body)});});
  router.post('/bank-statements/corrections',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await confirmBankCorrection(company,actor,req.body,testCreditHook)});});
  router.get('/bank-statements/corrections/:id',async(req,res)=>{const {company,actor,id}=ids(req);res.json({data:await recoverBankCorrection(company,actor,id)});});
  router.post('/bank-statements/import-review',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await reviewStatementImport(company,actor,req.body)});});
  router.post('/bank-statements/imports',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await importStatement(company,actor,req.body)});});
  router.get('/bank-statements/imports/:id',async(req,res)=>{const {company,actor,id}=ids(req);res.json({data:await recoverBankImport(company,actor,id)});});
  router.post('/bank-statements/match-review',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await reviewBankMatch(company,actor,req.body)});});
  router.post('/bank-statements/matches',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await confirmBankMatch(company,actor,req.body,testCreditHook)});});
  router.get('/bank-statements/matches/:id',async(req,res)=>{const {company,actor,id}=ids(req);res.json({data:await recoverBankMatch(company,actor,id)});});
  router.get('/opening-balances/context',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await bankOpeningContext(company,actor)});});
  router.get('/opening-balances/:id',async(req,res)=>{const {company,actor,id}=ids(req);res.json({data:await recoverBankOpening(company,actor,id)});});
  router.post('/opening-balances/review',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await reviewBankOpening(company,actor,req.body)});});
  router.post('/opening-balances',async(req,res)=>{const {company,actor}=ids(req);res.json({data:await postBankOpening(company,actor,req.body,testPostHook)});});
  router.post('/bank-imports',async(req,res)=>{
    const {company,actor}=ids(req);
    res.status(201).json({data:await importStatement(company,actor,req.body)});
  });
  router.get('/bank-imports/:requestId',async(req,res)=>{
    const {company,actor}=ids(req);
    res.json({data:await recoverBankImport(company,actor,String(req.params.requestId))});
  });
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
  router.get('/accounting-documents/:id/corrections/operations/:requestId',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await recoverCorrection(company,actor,id,String(req.params.requestId))});
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
  router.post('/accounting-documents/:id/conditional-credit/review',async(req,res)=>{
    const {company,actor,id}=ids(req);
    const review=await reviewPublicConditionalCredit(company,actor,id,revision(req),req.body);
    const {document_id,revision:reviewedRevision,original_id,original_kind,original_number,date,
      credit_minor,offset_minor,released_minor,remaining_minor,releases,conditional_admission}=review;
    res.json({data:{document_id,revision:reviewedRevision,original_id,original_kind,original_number,date,
      credit_minor,offset_minor,released_minor,remaining_minor,releases,
      conditional_admission:conditional_admission && {threshold_minor:conditional_admission.threshold_minor,
        qualifying_minor:conditional_admission.qualifying_minor,deadline:conditional_admission.deadline},
      readonly:true,posting_available:false}});
  });
  // Replacement history, explicit-terms append and observation only. No redemption,
  // compensation commit, posting admission or caller override is reachable here.
  router.get('/accounting-documents/:id/conditional-replacements',async(req,res)=>{
    const {company,actor,id}=ids(req);res.json({data:await conditionalReplacementOverview(company,actor,id)});
  });
  router.post('/accounting-documents/:id/conditional-replacements',async(req,res)=>{
    const {company,actor,id}=ids(req);res.status(201).json({data:replacementReceipt(await appendConditionalReplacement(company,actor,id,req.body))});
  });
  router.post('/accounting-documents/:id/conditional-replacements/:replacementId/observe',async(req,res)=>{
    const {company,actor,id}=ids(req);exactFields(req.body,[]);
    const replacement=String(req.params.replacementId);
    // The replacement must belong to this document's history in this company before any write.
    const known=await conditionalReplacementOverview(company,actor,id);
    if(!known.replacements.some((r:any)=>r.id===replacement)) fail(404,'RESOURCE_NOT_FOUND');
    res.json({data:observationReceipt(await observeConditionalReplacement(company,actor,replacement))});
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
        BANK_IMPORT_LEGACY_HISTORY_UNKEYABLE:"This bank has incomplete legacy statement rows. Import is held because duplicate detection cannot safely compare them. Review the legacy history; no rows were changed.",
        PAYMENT_HISTORICAL_ACCOUNT_CONFLICT:"This account has a different historical payment role. Choose a separate bank or unapplied-cash account so past cash reports remain unchanged.",
        PAYMENT_BANK_MATCHED_REVERSAL_UNSUPPORTED:"This payment still has active statement matches. Correct those matches in Banking before reviewing a reversal. Allocation, refund and period checks still apply. Nothing was reversed.",
        BANK_IMPORT_DUPLICATE:"This batch repeats existing statement rows. Remove the duplicate rows before importing.",
        BANK_IMPORT_REVIEW_REQUIRED:"Preview and review this statement batch before importing.",
        BANK_IMPORT_REVIEW_STALE:"Statement history changed. Preview the import again before confirming.",
        BANK_IMPORT_FIELDS_INVALID:"Check each date, description and reference. Dates must be valid ISO dates.",
        BANK_IMPORT_MONEY_INVALID:"Use whole pennies and exactly one positive money-in or money-out amount per row.",
        BANK_MATCH_EXCEEDS_REMAINING:"The selected amount exceeds the unmatched statement or payment amount. Refresh and review again.",
        BANK_MATCH_REVIEW_STALE:"The unmatched amounts or bank setup changed. Review the match again.",
        BANK_MATCH_REVIEW_REQUIRED:"Review the existing payment match before confirming.",
        BANK_MATCH_REQUEST_CONFLICT:"This request already recorded a different match. Check its saved outcome.",
        BANK_PAYMENT_ACCOUNT_MISMATCH:"The payment uses a different bank ledger. Review the bank setup and the original payment.",
        BANK_PAYMENT_DIRECTION_MISMATCH:"Money in matches a customer receipt; money out matches a supplier payment.",
        BANK_REVERSED_PAYMENT_UNSUPPORTED:"This payment was reversed. Reversal statement matching is not supported here.",
        BANK_PAYMENT_HISTORY_INVALID:"The payment journal could not be verified. No match was recorded.",
        BANK_MATCH_HISTORY_INVALID:"Matching history could not be verified. Do not repeat the operation.",
        BANK_LEDGER_ALREADY_ASSIGNED:"This ledger belongs to another bank's evidence. A separate reviewed bank-ledger setup is required; do not match across bank accounts.",
        OPENING_PAYMENT_BANK_SETUP_REQUIRED:"Choose the configured bank ledger account. Set it in Payments setup first, then review again.",
        OPENING_ACCOUNT_INVALID:"Choose an active bank asset account and an active equity balancing account from this company.",
        OPENING_SUBLEDGER_UNSUPPORTED:"Receivable, payable, VAT and unapplied-payment control openings need a separate subledger migration and cannot be posted here.",
        OPENING_BANK_HAS_ACTIVITY:"This bank ledger already has activity. An initial opening cannot be added here; review its existing history.",
        OPENING_ALREADY_POSTED:"This bank opening has already been posted. Check its recorded outcome instead of creating another opening.",
        OPENING_REQUEST_CONFLICT:"A different opening request has already been recorded. Check the bank's recorded outcome.",
        OPENING_REVIEW_STALE:"The accounts, period or setup changed after review. Review the opening again before confirming.",
        OPENING_REVIEW_REQUIRED:"Review the opening journal before confirming it.",
        OPENING_HISTORY_INVALID:"Opening history could not be verified. Do not repost; ask your administrator to investigate.",
        CONDITIONAL_POSTING_NOT_AVAILABLE:"Conditional agreement drafts can be prepared, but posting is not available yet. Your draft remains unchanged.",
        CONDITIONAL_PAYMENT_THRESHOLD_NOT_MET:"Qualifying payments have not reached the agreement threshold. Check the original document's payment history. This preview makes no changes.",
        CONDITIONAL_AGREEMENT_REQUIRED:"A verified conditional agreement is required on the original document. Check its agreement evidence before reviewing again.",
        CONDITIONAL_CREDIT_VECTOR_MISMATCH:"This saved credit does not match the original agreement discount. Reopen the original and check the credit amounts before reviewing again.",
        REVISION_CONFLICT:"The saved draft changed. Reload it and review again. No changes were committed.",
        CONDITIONAL_ATTESTATION_REQUIRED:"Confirm that you have checked the replacement agreement before recording it. Nothing was recorded.",
        CONDITIONAL_REPLACEMENT_STALE:"Another replacement was recorded first. Reload the history and review the current agreement before trying again. Nothing was recorded.",
        CONDITIONAL_REPLACEMENT_REQUEST_CONFLICT:"This request reference was already used with different details. Reload the history; nothing new was recorded.",
        CONDITIONAL_AGREEMENT_CONSUMED:"This agreement has already been used by a credit. It cannot be replaced, and its history is preserved.",
        CONDITIONAL_NEW_AGREEMENT_REQUIRED:"A replacement needs a new agreement reference, different from every earlier version.",
        CONDITIONAL_REPLACEMENT_PARTY_MISMATCH:"The replacement terms must be with the same customer or supplier as the original document.",
        CONDITIONAL_OBSERVED_ORIGINAL_REQUIRED:"The original agreement must be recorded at posting before it can be replaced.",
        CONDITIONAL_REPLACEMENT_SCHEMA_UNAVAILABLE:"Replacement agreement history is not installed for this company yet. Nothing was recorded.",
        CONDITIONAL_REPLACEMENT_SCHEMA_INCOMPLETE:"Replacement agreement history is unavailable until the database operator completes installation. Nothing was recorded.",
        CONDITIONAL_REPLACEMENT_HISTORY_INVALID:"Replacement history failed its integrity check. It is shown as unavailable rather than guessed.",
        CONDITIONAL_REPLACEMENT_IDENTITY_INVALID:"A replacement record failed its integrity check. Nothing was changed.",
        CONDITIONAL_TERMS_INVALID:"Check the replacement terms: a whole-penny discount above zero, and a payment deadline on or after the agreement date.",
        CONDITIONAL_EVIDENCE_TERMS_MISMATCH:"The receipt belongs to different agreement terms. Capture or select matching evidence before saving.",
        CORRECTION_REVIEW_STALE:"This document, its payments or accounting setup changed after review. Refresh and review the correction again.",
        CORRECTION_BELOW_PAID:"The corrected total cannot be less than payments already applied. Review the payment and refund history first.",
        CORRECTION_CHILD_CREDITS:"This document already has a linked credit. Corrections are not yet supported for this case.",
        CORRECTION_ACTIVE_CLAIMS:"This bill has items awaiting credit. Resolve those claims before reviewing a correction.",
        CORRECTED_DOCUMENT_DEPENDENCY_UNSUPPORTED:"This conditional agreement or return-credit tracking operation is not yet available for corrected invoices or bills.",
        CREDIT_EXCEEDS_COMMERCIAL_CAPACITY:"This credit exceeds the remaining net, VAT or gross amount on an original item. Review previous credits and reduce that item's amount.",
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
