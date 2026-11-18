import { recordId } from './model.mjs';
import { taxPermissions, validateTaxIntent, validateTaxReceipt, validateTaxRecord } from './taxModel.mjs';
import { canExportTax, TAX_CSV_FILENAME, validateTaxCsv } from './taxExport.mjs';

export class TaxPreparationsError extends Error {
  constructor(status = 0, code) { super('The tax input request could not be completed.'); this.status = status; this.code = code; }
}
export function createTaxPreparationsClient(fetcher = (...args) => fetch(...args)) {
  const base = company => `/api/companies/${recordId(company)}/personal-tax-preparations`;
  const call = async (url, options, validate) => {
    try {
      const response = await fetcher(url, { credentials: 'include', cache: 'no-store', ...options });
      if (!response.ok) {
        if (response.status === 409) {
          const value = await response.json().catch(() => null);
          if (value?.code === 'SENSITIVE_REQUEST_CONFLICT') throw new TaxPreparationsError(409, 'SENSITIVE_REQUEST_CONFLICT');
          throw new TaxPreparationsError();
        }
        throw new TaxPreparationsError(response.status);
      }
      return validate(await response.json(), response.status);
    } catch (error) {
      if (error instanceof TaxPreparationsError) throw error;
      throw new TaxPreparationsError();
    }
  };
  return {
    async exportCsv(company, record, role, signal) {
      if (!canExportTax(role)) throw new TaxPreparationsError(403);
      try {
        const canonicalCompany = recordId(company), canonical = recordId(record.id);
        const response = await fetcher(`${base(canonicalCompany)}/${canonical}/export.csv`, {
          method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal,
        });
        if (response.status !== 200) throw new TaxPreparationsError(response.status);
        if (response.headers.get('content-type')?.toLowerCase() !== 'text/csv; charset=utf-8' ||
            response.headers.get('content-disposition') !== `attachment; filename="${TAX_CSV_FILENAME}"` ||
            response.headers.get('cache-control') !== 'no-store' ||
            response.headers.get('x-personal-tax-company') !== canonicalCompany ||
            response.headers.get('x-personal-tax-record') !== canonical) throw new TaxPreparationsError();
        return validateTaxCsv(await response.text(), record);
      } catch (error) {
        if (error instanceof TaxPreparationsError) throw error;
        throw new TaxPreparationsError();
      }
    },
    create(company, intent, signal) {
      const body = validateTaxIntent(intent);
      return call(base(company), { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        (value, status) => validateTaxReceipt(value, body.id, status));
    },
    read(company, id, role, signal) {
      if (!taxPermissions(role).read) return Promise.reject(new TaxPreparationsError(403));
      const canonical = recordId(id);
      return call(`${base(company)}/${canonical}`, { method: 'GET', signal }, (value, status) => {
        if (status !== 200) throw new TaxPreparationsError();
        return validateTaxRecord(value, canonical, role);
      });
    },
  };
}
export const taxPreparationsClient = createTaxPreparationsClient();
