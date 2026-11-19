import { canExportPay, PAY_CSV_FILENAME, validatePayCsv } from './payExport.mjs';
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
    async exportCsv(company, record, role, signal) {
      if (!canExportPay(role)) throw new PayRecordsError(403);
      try {
        const canonicalCompany = recordId(company), canonical = recordId(record.id);
        const response = await fetcher(`${base(canonicalCompany)}/${canonical}/export.csv`, {
          method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal,
        });
        if (response.status !== 200) throw new PayRecordsError(response.status);
        if (response.headers.get('content-type')?.toLowerCase() !== 'text/csv; charset=utf-8' ||
            response.headers.get('content-disposition') !== `attachment; filename="${PAY_CSV_FILENAME}"` ||
            response.headers.get('cache-control') !== 'no-store' ||
            response.headers.get('x-payroll-company') !== canonicalCompany ||
            response.headers.get('x-payroll-record') !== canonical) throw new PayRecordsError();
        return validatePayCsv(await response.text(), record);
      } catch (error) {
        if (error instanceof PayRecordsError) throw error;
        throw new PayRecordsError();
      }
    },
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
