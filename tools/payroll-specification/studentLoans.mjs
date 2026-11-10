/**
 * Executable review specification ONLY. Not imported by application services.
 * This oracle does not establish employment eligibility, notice validity,
 * protected earnings or statutory qualification. Never use for a payroll run.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const specification = Object.freeze({
  id:'student-loans-2026-27-review-v1',
  status:'unqualified_executable_specification',
  effectiveFrom:'2026-04-06',effectiveTo:'2027-04-05',
  sourceUrl:'https://www.gov.uk/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026',
  sourceSha256:'a9ae92e1586f836ce5aa77fbb295bd33bdb5d4d8c6cc6d07e2ec1816af586243',
  fixtureSha256:'eb1370c37654efa845e4ea82c1761381f29f1d6fdabfefa666c786f79c4413a5',
  archiveSha256:'e2f5bd68521c135faf7b5d43296127d378ecaa6a6b936b0c8253974dda1c7e83',
});
const annual=Object.freeze({plan_1:2690000n,plan_2:2938500n,plan_4:3379500n,plan_5:2500000n,postgraduate:2100000n});
const periods=Object.freeze({weekly:52n,fortnightly:26n,four_weekly:13n,monthly:12n});
const fields=['taxYear','plan','frequency','payMinor','paymentDate','earningsBasis','confirmedInstruction',
  'protectedEarnings','concurrentLoan','correction','offPayroll'];
const fail=code=>{throw new Error(code);};
export function reviewInput(input) {
  if(!input || typeof input!=='object' || Array.isArray(input) ||
    Object.keys(input).length!==fields.length || fields.some(k=>!Object.hasOwn(input,k))) fail('SPEC_INPUT_FIELDS');
  if(input.taxYear!=='2026-27') fail('SPEC_YEAR');
  if(typeof input.plan!=='string'||!Object.hasOwn(annual,input.plan)) fail('SPEC_PLAN');
  if(typeof input.frequency!=='string'||!Object.hasOwn(periods,input.frequency)) fail('SPEC_PERIOD');
  if(typeof input.payMinor!=='string'||!/^(0|[1-9][0-9]{0,15})$/.test(input.payMinor)) fail('SPEC_PAY');
  const date=input.paymentDate;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
    date<specification.effectiveFrom||date>specification.effectiveTo || !Number.isFinite(Date.parse(date+'T00:00:00Z')) ||
    new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date) fail('SPEC_DATE');
  if(input.earningsBasis!=='class1_ni_earnings'||input.confirmedInstruction!==true||
    ['protectedEarnings','concurrentLoan','correction','offPayroll'].some(k=>input[k]!==false)) fail('SPEC_EXCLUDED_CONTEXT');
  return input;
}

/** Integer trace of HMRC software specification sections 3 and 4, for review. */
export function specificationTrace(raw) {
  const i=reviewInput(raw),a=annual[i.plan],n=periods[i.frequency];
  const threshold=a/n; // annual pence / periods, discard fractional penny
  const pay=BigInt(i.payMinor),excess=pay>threshold?pay-threshold:0n;
  const rate=i.plan==='postgraduate'?6n:9n;
  // excess pence * integer percent / 10000 gives whole pounds. Truncate once,
  // then express the whole-pound deduction in pence. No floating point.
  const numerator=excess*rate,deduction=numerator/10000n*100n;
  return {specificationId:specification.id,qualified:false,notForPayroll:true,
    annualThresholdMinor:a.toString(),periodsPerYear:n.toString(),thresholdMinor:threshold.toString(),
    excessMinor:excess.toString(),ratePercent:rate.toString(),
    recoveryNumerator:numerator.toString(),wholePoundsDenominator:'10000',deductionMinor:deduction.toString()};
}

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function loadPinnedEvidence() {
  const root=new URL('../../',import.meta.url);
  const folder=new URL('artifacts/api-server/src/services/payroll/contracts/fixtures/',root);
  const source=readFileSync(new URL('./sources/student-loans-2026-27.md',import.meta.url));
  const json=readFileSync(new URL('hmrc-student-loans-2026-27-v1.0.json',folder));
  const archive=readFileSync(new URL('hmrc-student-loans-2026-27-v1.0.ods',folder));
  if(digest(source)!==specification.sourceSha256||digest(json)!==specification.fixtureSha256||
    digest(archive)!==specification.archiveSha256) fail('SPEC_EVIDENCE_DIGEST');
  return JSON.parse(json);
}

// These are explicit synthetic preconditions, NOT facts supplied by HMRC rows.
export const syntheticContext=Object.freeze({paymentDate:'2026-10-21',earningsBasis:'class1_ni_earnings',
  confirmedInstruction:true,protectedEarnings:false,concurrentLoan:false,correction:false,offPayroll:false});
export function compareOfficialExamples() {
  const corpus=loadPinnedEvidence();
  if(corpus.taxYear!=='2026-27'||corpus.status!=='reference_fixtures_only_not_engine_qualification'||
    corpus.cases.length!==130||new Set(corpus.cases.map(c=>c.id)).size!==130) fail('SPEC_CORPUS');
  const results=corpus.cases.map(c=>{
    const trace=specificationTrace({...c.input,...syntheticContext});
    return {id:c.id,sheet:c.sourceSheet,row:c.sourceRow,expected:c.expected.deductionMinor,
      observed:trace.deductionMinor,matched:trace.deductionMinor===c.expected.deductionMinor};
  });
  return {status:specification.status,qualified:false,count:results.length,
    discrepancies:results.filter(r=>!r.matched),results};
}
