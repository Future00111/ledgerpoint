import { recordId, payrollPermissions, validateIntent, validateReceipt, validateRecord } from './model.mjs';

export class PayRecordsError extends Error {
  constructor(status = 0, code) { super('The pay record request could not be completed.'); this.status = status; this.code = code; }
}
export function createPayRecordsClient(fetcher = (...args) => fetch(...args)) {
  const base = company => `/api/companies/${recordId(company)}/payroll-pay-records`;
  const call = async (url, options, validate) => {
    try {
      const response = await fetcher(url, { credentials: 'include', cache: 'no-store', ...options });
      if (!response.ok) {
        if (response.status === 409) {
          const value = await response.json().catch(() => null);
          if (value?.code === 'SENSITIVE_REQUEST_CONFLICT') throw new PayRecordsError(409, 'SENSITIVE_REQUEST_CONFLICT');
          throw new PayRecordsError();
        }
        throw new PayRecordsError(response.status);
      }
      return validate(await response.json(), response.status);
    } catch (error) {
      // Never expose provider bodies, private diagnostics or request payloads in UI errors.
      if (error instanceof PayRecordsError) throw error;
      throw new PayRecordsError();
    }
  };
  return {
    create(company, intent, signal) {
      const body = validateIntent(intent);
      return call(base(company), { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        (value, status) => validateReceipt(value, body.id, status));
    },
    read(company, id, role, signal) {
      if (!payrollPermissions(role).read) return Promise.reject(new PayRecordsError(403));
      const canonical = recordId(id);
      return call(`${base(company)}/${canonical}`, { method: 'GET', signal }, (value, status) => {
        if (status !== 200) throw new PayRecordsError();
        return validateRecord(value, canonical, role);
      });
    },
  };
}
export const payRecordsClient = createPayRecordsClient();
