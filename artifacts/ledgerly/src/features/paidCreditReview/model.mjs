/** Fallback is allowed only for a pre-mutation review's explicitly absent schema. */
export async function prepareCreditReview(client, companyId, doc, requestId, originalDoc) {
  if (doc.original_id && (!originalDoc?.source || originalDoc.id !== doc.original_id)) {
    throw new Error('Reload the linked original document before reviewing this credit.');
  }
  if (originalDoc?.source?.conditional_discount) {
    const conditionalCredit = await client.reviewConditionalCredit(companyId,doc.id,{request_id:requestId,reason:doc.reason},doc.revision);
    if (conditionalCredit?.readonly !== true || conditionalCredit.posting_available !== false || !conditionalCredit.conditional_admission ||
      conditionalCredit.document_id !== doc.id || conditionalCredit.revision !== doc.revision || conditionalCredit.original_id !== originalDoc.id) {
      throw new Error('The conditional eligibility preview could not be verified. Reload and review again.');
    }
    return {paidCredit:null,paidCreditUnavailable:false,conditionalCredit};
  }
  try {
    return {paidCredit:await client.reviewPaidCredit(companyId,doc.id,{request_id:requestId,reason:doc.reason},doc.revision),paidCreditUnavailable:false};
  } catch(error) {
    if(error.code!=='PAID_CREDIT_SCHEMA_UNAVAILABLE')throw error;
    return {paidCredit:null,paidCreditUnavailable:true};
  }
}

export async function prepareCurrentDiscountReview(client,companyId,doc,requestId,originalDoc) {
  if(!originalDoc?.source?.conditional_discount || originalDoc.id!==doc.original_id) throw new Error('Reload the linked conditional original.');
  const r=await client.reviewConditionalDiscount(companyId,doc.id,{request_id:requestId,reason:doc.reason},doc.revision);
  if(r?.posting_available!==true || !/^sha256:[a-f0-9]{64}$/.test(r.review_token) || r.intent?.request_id!==requestId ||
    r.document_id!==doc.id || r.revision!==doc.revision || r.original_id!==originalDoc.id || !r.conditional_admission || r.released_minor!=='0' || !Array.isArray(r.releases) || r.releases.length)
    throw new Error('The conditional discount review could not be verified.');
  return r;
}
export const discountRecoveryKey=(company,id)=>`ledgerpoint:conditional-discount:${company}:${id}`;
export function saveDiscountRecovery(storage,company,id,revision,request_id) {
  const existing=readDiscountRecovery(storage,company,id);
  if(existing && (existing.request_id!==request_id || existing.revision!==revision)) throw new Error('Recover the existing discount operation before submitting another.');
  const pending={company,id,revision,request_id};
  storage.setItem(discountRecoveryKey(company,id),JSON.stringify(pending));return pending;
}
export function readDiscountRecovery(storage,company,id) {
  const raw=storage.getItem(discountRecoveryKey(company,id));if(!raw)return null;
  try {const r=JSON.parse(raw);if(r.company===company&&r.id===id&&typeof r.revision==='string'&&typeof r.request_id==='string')return r;}catch{}
  throw new Error('The saved discount operation must be recovered before posting.');
}
export function verifyDiscountRecovery(receipt,pending) {
  return ['posted','duplicate','recorded'].includes(receipt?.status) && receipt.request_id===pending.request_id && receipt.document_id===pending.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.journal_id);
}

export function clearDiscountRecovery(storage,pending) {
  const current=readDiscountRecovery(storage,pending.company,pending.id);
  if(current?.request_id===pending.request_id && current.revision===pending.revision)storage.removeItem(discountRecoveryKey(pending.company,pending.id));
}
