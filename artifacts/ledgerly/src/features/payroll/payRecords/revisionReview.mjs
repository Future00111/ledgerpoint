import {recordId,effectiveDate} from './model.mjs';

export const deductionNames = {paye:'PAYE',employee_ni:'Employee NI',student_loan:'Student loan',postgraduate_loan:'Postgraduate loan'};
export const adjustmentNames = {rounding:'Rounding',correction:'Correction'};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const amount = value => typeof value === 'string' && /^(0|-?[1-9]\d*)$/.test(value);
const components = (values,names) => object(values) && Object.entries(values).every(([key,value]) => Object.hasOwn(names,key) && amount(value));
const money = row => amount(row.gross) && amount(row.net) && components(row.deductions,deductionNames) && components(row.adjustments,adjustmentNames);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

export function validatedReview(row,requested) {
  const fields = ['run_id','revision_id','revision_number','period_start','period_end','payday','currency','rules_version','is_current_revision','current_revision_id','review_breakdown'];
  if (!exact(row,fields) || row.revision_id !== recordId(requested) || recordId(row.current_revision_id) !== row.current_revision_id ||
    row.is_current_revision !== (row.revision_id === row.current_revision_id) || !uuid(row.run_id) ||
    !Number.isSafeInteger(row.revision_number) || row.revision_number < 1 || typeof row.is_current_revision !== 'boolean' ||
    row.currency !== 'GBP' || typeof row.rules_version !== 'string' || !row.rules_version.trim() ||
    ![row.period_start,row.period_end,row.payday].every(date => effectiveDate(date) === date) || row.period_end < row.period_start)
    throw Error('Invalid draft revision');
  const data = row.review_breakdown;
  if (!exact(data,['lines','totals']) || !Array.isArray(data.lines) || !exact(data.totals,['line_count','gross','net','deductions','adjustments']) ||
    data.totals.line_count !== data.lines.length || !money(data.totals) || data.lines.some(line =>
      !exact(line,['line_id','gross','net','deductions','adjustments']) || !uuid(line.line_id) || !money(line)))
    throw Error('Invalid draft breakdown');
  const ids = new Set(), sums = {gross:0n,net:0n,deductions:new Map(),adjustments:new Map()};
  for (const line of data.lines) {
    if (ids.has(line.line_id)) throw Error('Duplicate review line');
    ids.add(line.line_id);
    let expectedNet = BigInt(line.gross);
    for (const kind of ['deductions','adjustments']) {
      for (const [key,value] of Object.entries(line[kind])) {
        const pence = BigInt(value);
        sums[kind].set(key,(sums[kind].get(key) ?? 0n) + pence);
        expectedNet += kind === 'deductions' ? -pence : pence;
      }
    }
    if (expectedNet !== BigInt(line.net)) throw Error('Invalid line net');
    sums.gross += BigInt(line.gross);
    sums.net += expectedNet;
  }
  for (const kind of ['deductions','adjustments']) {
    const totals = data.totals[kind];
    if (Object.keys(totals).length !== sums[kind].size ||
      [...sums[kind]].some(([key,sum]) => totals[key] !== String(sum))) throw Error('Invalid component total');
  }
  if (data.totals.gross !== String(sums.gross) || data.totals.net !== String(sums.net)) throw Error('Invalid revision totals');
  return row;
}

export function formatDraftPence(value) {
  const p = BigInt(value), magnitude = p < 0n ? -p : p;
  return (p < 0n ? '-£' : '£') + (magnitude / 100n).toLocaleString('en-GB') + '.' + String(magnitude % 100n).padStart(2,'0');
}
