import { effectiveDate, recordId } from './model.mjs';

const roles = Object.freeze({ owner: 'Owner', admin: 'Administrator', accountant: 'Accountant', staff: 'Staff', member: 'Member',
  read_only: 'Read only', payroll_reader: 'Payroll reader', payroll_preparer: 'Payroll preparer', payroll_approver: 'Payroll approver',
  personal_tax_preparer: 'Personal tax preparer', personal_tax_submitter: 'Personal tax submitter' });
const operations = Object.freeze({ member_add: 'Member added', member_invite: 'Member invited', role_change: 'Role or status changed',
  member_remove: 'Member removed', company_delete: 'Company deleted' });
const eventKeys = ['id', 'occurred_at', 'membership_id', 'operation', 'previous_role', 'next_role', 'previous_active', 'next_active'];
const own = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
const knownRole = value => value === null || own(roles, value);
const activeFlag = value => value === null || typeof value === 'boolean';
const specialized = value => own(roles, value) && (value.startsWith('payroll_') || value.startsWith('personal_tax_'));
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
function invalid() { throw Error('The access history response could not be verified.'); }
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)) invalid();
  effectiveDate(value.slice(0, 10));
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) invalid();
  return value;
}
export const historyRoleLabel = role => role === null ? 'Not present' : own(roles, role) ? roles[role] : 'Unknown role';
export const historyOperationLabel = operation => own(operations, operation) ? operations[operation] : 'Unknown change';
export const historyActiveLabel = (role, active) => role === null ? 'Not present' : active === true ? 'Active' : active === false ? 'Inactive' : 'Not recorded';
export function historyTimeLabel(value) {
  timestamp(value);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(value.slice(5, 7)) - 1];
  return `${Number(value.slice(8, 10))} ${month} ${value.slice(0, 4)}, ${value.slice(11, 19)} UTC`;
}

/** Exact display projection; no user identity, arbitrary audit context or recursive read events. */
export function validateAccessHistory(value) {
  if (!exact(value, ['events', 'limit', 'has_more']) || value.limit !== 50 || typeof value.has_more !== 'boolean' ||
      !Array.isArray(value.events) || value.events.length > 50 || (value.has_more && value.events.length !== 50)) invalid();
  const seen = new Set();
  const events = value.events.map(row => {
    if (!exact(row, eventKeys) || !own(operations, row.operation) || !knownRole(row.previous_role) || !knownRole(row.next_role) ||
        !activeFlag(row.previous_active) || !activeFlag(row.next_active) || (!specialized(row.previous_role) && !specialized(row.next_role))) invalid();
    if (row.operation === 'member_add' || row.operation === 'member_invite') {
      if (row.previous_role !== null || row.previous_active !== null || !specialized(row.next_role)) invalid();
    } else if (row.operation === 'member_remove' || row.operation === 'company_delete') {
      if (!specialized(row.previous_role) || row.next_role !== null || row.next_active !== null) invalid();
    } else if (row.previous_role === null || row.next_role === null ||
        (row.previous_role === row.next_role && row.previous_active === row.next_active)) invalid();
    const id = recordId(row.id);
    if (seen.has(id)) invalid();
    seen.add(id);
    return { id, occurred_at: timestamp(row.occurred_at), membership_id: recordId(row.membership_id), operation: row.operation,
      previous_role: row.previous_role, next_role: row.next_role, previous_active: row.previous_active, next_active: row.next_active };
  });
  for (let index = 1; index < events.length; index++) {
    const previous = events[index - 1], current = events[index];
    if (previous.occurred_at < current.occurred_at || (previous.occurred_at === current.occurred_at && previous.id <= current.id)) invalid();
  }
  return { events, limit: 50, has_more: value.has_more };
}
