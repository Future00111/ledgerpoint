/** Fallback is allowed only for a pre-mutation review's explicitly absent schema. */
export async function prepareCreditReview(client, companyId, doc, requestId) {
  try {
    return {paidCredit:await client.reviewPaidCredit(companyId,doc.id,{request_id:requestId,reason:doc.reason},doc.revision),paidCreditUnavailable:false};
  } catch(error) {
    if(error.code!=='PAID_CREDIT_SCHEMA_UNAVAILABLE')throw error;
    return {paidCredit:null,paidCreditUnavailable:true};
  }
}
