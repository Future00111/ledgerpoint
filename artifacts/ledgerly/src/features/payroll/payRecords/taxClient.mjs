import { recordId } from './model.mjs';
import { taxPermissions, validateTaxIntent, validateTaxReceipt, validateTaxRecord } from './taxModel.mjs';

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
