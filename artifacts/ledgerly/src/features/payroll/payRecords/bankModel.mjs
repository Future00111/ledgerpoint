import { requestScope } from './model.mjs';

const EMPLOYEE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function bankProjection(role) {
  return role === 'owner' || role === 'payroll_preparer' ? 'full' : role === 'payroll_approver' ? 'last_four' : null;
}
export function bankEmployeeId(value) {
  if (typeof value !== 'string' || !EMPLOYEE_UUID.test(value)) throw Error('Enter the internal employee reference as a UUID.');
  return value.toLowerCase();
}
export function validateBankDetails(value, role) {
  const projection = bankProjection(role), field = projection === 'full' ? 'account_number' : 'last_four';
  if (!projection || !value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !Object.hasOwn(value, field) || typeof value[field] !== 'string' ||
      !(projection === 'full' ? /^[0-9]{8}$/ : /^[0-9]{4}$/).test(value[field])) throw Error('The bank details response could not be verified.');
  return Object.freeze({ [field]: value[field] });
}

/** One actor/company/role mount owns this controller. No storage, shared cache or automatic reads. */
export function createBankLookup({ companyId, role, client, onSessionExpired }) {
  const listeners = new Set(), scope = requestScope();
  const empty = () => Object.freeze({ employeeId: '', status: 'idle', result: null });
  let state = empty(), active = true;
  const publish = next => { state = Object.freeze(next); for (const listener of listeners) listener(); };
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    activate() { active = true; },
    dispose() { active = false; scope.cancel(); publish(empty()); },
    changeEmployee(value) {
      if (!active) return;
      scope.cancel();
      // Keep overlong input invalid; never turn a UUID prefix plus extra text into a valid lookup.
      publish({ employeeId: typeof value === 'string' ? value.slice(0, 128) : '', status: 'idle', result: null });
    },
    async lookup() {
      if (!active || !bankProjection(role) || state.status === 'loading') return;
      let employee;
      try { employee = bankEmployeeId(state.employeeId); }
      catch { publish({ ...state, status: 'invalid', result: null }); return; }
      const token = scope.begin();
      publish({ employeeId: employee, status: 'loading', result: null });
      try {
        const result = validateBankDetails(await client.read(companyId, employee, role, token.signal), role);
        if (active && token.isCurrent()) publish({ employeeId: employee, status: 'ready', result });
      } catch (error) {
        if (!active || !token.isCurrent()) return;
        if (error?.status === 401) onSessionExpired?.();
        const denied = [401, 403, 404].includes(error?.status);
        publish({ employeeId: denied ? '' : employee, status: denied ? 'unavailable' : 'failed', result: null });
      }
    },
  };
}
