import {recordId,effectiveDate} from './model.mjs';

export const deductionNames = {paye:'PAYE',employee_ni:'Employee NI',student_loan:'Student loan',postgraduate_loan:'Postgraduate loan',priority_order:'Priority order'};
export const adjustmentNames = {rounding:'Rounding',correction:'Correction'};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const amount = value => typeof value === 'string' && /^(0|-?[1-9]\d*)$/.test(value);
const components = (values,names) => object(values) && Object.entries(values).every(([key,value]) => Object.hasOwn(names,key) && amount(value) && (key !== 'priority_order' || !value.startsWith('-')));
const money = row => amount(row.gross) && amount(row.net) && components(row.deductions,deductionNames) && components(row.adjustments,adjustmentNames);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

export function validatedReview(row,requested,history = false) {
  const fields = ['run_id','revision_id','revision_number','period_start','period_end','payday','currency','rules_version','is_current_revision','current_revision_id','prepared_by','prepared_at','review_breakdown'];
  if (history) fields.push('previous_revision_id','next_revision_id');
  if (!exact(row,fields) || row.revision_id !== recordId(requested) || recordId(row.current_revision_id) !== row.current_revision_id ||
    row.is_current_revision !== (row.revision_id === row.current_revision_id) || !uuid(row.run_id) ||
    typeof row.prepared_by !== 'string' || !row.prepared_by.trim() ||
    typeof row.prepared_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.prepared_at) ||
    !Number.isFinite(Date.parse(row.prepared_at)) || new Date(row.prepared_at).toISOString() !== row.prepared_at ||
    !Number.isSafeInteger(row.revision_number) || row.revision_number < 1 || typeof row.is_current_revision !== 'boolean' ||
    row.currency !== 'GBP' || typeof row.rules_version !== 'string' || !row.rules_version.trim() ||
    ![row.period_start,row.period_end,row.payday].every(date => effectiveDate(date) === date) || row.period_end < row.period_start)
    throw Error('Invalid draft revision');
  if (history) {
    const previous = row.previous_revision_id, next = row.next_revision_id;
    const links = [previous,next].filter(id => id !== null);
    if (links.some(id => recordId(id) !== id || id === row.revision_id) ||
        new Set(links).size !== links.length || previous === row.current_revision_id ||
        (previous === null) !== (row.revision_number === 1) || (next === null) !== row.is_current_revision)
      throw Error('Invalid revision history');
  }
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

// Signed contribution of each changed component to the newer revision's net pay.
export function netPayEffects(older, newer) {
  const effects = [];
  for (const [group, names] of [['deductions', deductionNames], ['adjustments', adjustmentNames]]) {
    for (const [key, label] of Object.entries(names)) {
      const difference = BigInt(newer[group][key] ?? '0') - BigInt(older[group][key] ?? '0');
      if (difference !== 0n) effects.push({ label, pence: group === 'deductions' ? -difference : difference });
    }
  }
  return effects;
}

export function formatDraftPence(value) {
  const p = BigInt(value), magnitude = p < 0n ? -p : p;
  return (p < 0n ? '-£' : '£') + (magnitude / 100n).toLocaleString('en-GB') + '.' + String(magnitude % 100n).padStart(2,'0');
}

export function approvalAvailability(draft) {
  if (!draft.is_current_revision) return 'Approval unavailable for superseded revisions.';
  if (!draft.review_breakdown.lines.length) return 'Approval requires at least one employee line.';
  return 'Approval unavailable until the payroll calculations are qualified.';
}
