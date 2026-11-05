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
