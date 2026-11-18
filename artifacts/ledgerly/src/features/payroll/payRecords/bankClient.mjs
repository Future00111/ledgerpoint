import { recordId } from './model.mjs';
import { bankEmployeeId, bankProjection, validateBankDetails } from './bankModel.mjs';

export class BankDetailsError extends Error {
  constructor(status = 0) { super('Bank details could not be loaded.'); this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 0; }
}
export function createBankDetailsClient(fetcher = (...args) => fetch(...args)) {
  return {
    async read(companyId, employeeId, role, signal) {
      if (!bankProjection(role)) throw new BankDetailsError(403);
      try {
        const response = await fetcher(`/api/companies/${recordId(companyId)}/payroll-bank-details/${bankEmployeeId(employeeId)}`, {
          method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error', signal,
        });
        if (response.status !== 200) throw new BankDetailsError(response.status);
        return validateBankDetails(await response.json(), role);
      } catch (error) {
        // Never retain or display response bodies, account values or transport diagnostics in errors.
        if (error instanceof BankDetailsError) throw error;
        throw new BankDetailsError();
      }
    },
  };
}
export const bankDetailsClient = createBankDetailsClient();
