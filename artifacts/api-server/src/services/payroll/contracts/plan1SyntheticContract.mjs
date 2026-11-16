/** Offline synthetic development boundary; never a production payroll adapter. */
import {createHash} from 'node:crypto';
import {reviewPlan1NoticeTiming} from './plan1NoticeFixtures.mjs';
import {specification, specificationTrace} from '../../../../../../tools/payroll-specification/studentLoans.mjs';

export const plan1SyntheticContract = Object.freeze({
  version:'plan1-synthetic-input-v1', ruleVersion:specification.id,
  purpose:'synthetic_development', status:'unqualified_synthetic_reference_contract',
  taxYear:'2026-27', plan:'plan_1', frequency:'weekly',
  sourceUrl:specification.sourceUrl, sourceSha256:specification.sourceSha256,
  fixtureSha256:specification.fixtureSha256,
});
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => plain(x) && Object.keys(x).length === keys.length && keys.every(k=>Object.hasOwn(x,k));
const fail = code => { throw new Error(code); };
const noticeFields=['id','type','plan','employmentId','effectiveDate','receivedDate','firstAvailablePayday','availabilityEvidence'];
// Canonical object keys bind content rather than the incidental insertion order.
const canonical = x => Array.isArray(x) ? x.map(canonical) : plain(x)
  ? Object.fromEntries(Object.keys(x).sort().map(key=>[key,canonical(x[key])])) : x;
const digest = x => createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');

/** Binds a supplied verification assertion to notice content, not proof of authenticity. */
export function syntheticNoticeDigest(notice) {
  if (!exact(notice,noticeFields) || noticeFields.some(k=>typeof notice[k]!=='string' || !notice[k].trim())) fail('SYNTHETIC_NOTICE_FIELDS');
  return digest(notice);
}

/**
 * Input = exact versioned envelope, existing bounded notice input, and one explicit
 * synthetic verification per notice. The caller supplies identity/availability
 * assertions; this function does not verify a real HMRC notice or determine a cutoff.
 * Output includes the precise input digest, timing and the existing statutory review
 * trace. No persistence, posting, filing, qualification or real employee authority.
 */
export function calculateSyntheticPlan1(envelope) {
  if (!exact(envelope,['contractVersion','ruleVersion','purpose','input','verifiedNotices'])) fail('SYNTHETIC_CONTRACT_FIELDS');
  if (envelope.contractVersion!==plan1SyntheticContract.version || envelope.ruleVersion!==plan1SyntheticContract.ruleVersion) fail('SYNTHETIC_RULE_VERSION');
  if (envelope.purpose!==plan1SyntheticContract.purpose) fail('SYNTHETIC_PURPOSE');
  const input=envelope.input;
  // Existing timing validation rejects unsupported years/plans/contexts and conflicts,
  // including inactive cases: a stopped notice cannot conceal invalid monetary input.
  const timing=reviewPlan1NoticeTiming(input);
  if (!Array.isArray(envelope.verifiedNotices) || envelope.verifiedNotices.length!==input.notices.length) fail('SYNTHETIC_NOTICE_VERIFICATION');
  const seen=new Set();
  for (const assertion of envelope.verifiedNotices) {
    if (!exact(assertion,['noticeId','noticeDigest','identityVerified','firstPracticalPayday','availabilityVerified'])
      || typeof assertion.noticeId!=='string' || seen.has(assertion.noticeId)
      || assertion.identityVerified!==true || assertion.availabilityVerified!==true) fail('SYNTHETIC_NOTICE_VERIFICATION');
    const notice=input.notices.find(n=>n.id===assertion.noticeId);
    if (!notice || assertion.noticeDigest!==syntheticNoticeDigest(notice)
      || assertion.firstPracticalPayday!==notice.firstAvailablePayday) fail('SYNTHETIC_NOTICE_VERIFICATION');
    seen.add(assertion.noticeId);
  }
  const calculation=timing.instructionActive ? specificationTrace({
    taxYear:input.taxYear,plan:input.plan,frequency:input.frequency,payMinor:input.payMinor,
    paymentDate:input.paymentDate,earningsBasis:input.earningsBasis,confirmedInstruction:true,
    protectedEarnings:false,concurrentLoan:false,correction:false,offPayroll:false,
  }) : null;
  return {
    contractVersion:plan1SyntheticContract.version,ruleVersion:plan1SyntheticContract.ruleVersion,
    purpose:plan1SyntheticContract.purpose,status:plan1SyntheticContract.status,
    qualified:false,notForPayroll:true,inputDigest:digest(envelope),
    instructionActive:timing.instructionActive,reason:timing.reason,
    deductionMinor:calculation?.deductionMinor??'0',calculation,
  };
}
