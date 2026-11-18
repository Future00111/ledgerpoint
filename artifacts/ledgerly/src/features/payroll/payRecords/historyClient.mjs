import { recordId } from './model.mjs';
import { validateAccessHistory } from './historyModel.mjs';

export class AccessHistoryError extends Error {
  constructor(status = 0) { super('Access history could not be loaded.'); this.status = status; }
}
export function createAccessHistoryClient(fetcher = (...args) => fetch(...args)) {
  return { async read(companyId, signal) {
    try {
      const company = recordId(companyId);
      const response = await fetcher(`/api/companies/${company}/specialist-access-history`,
        { method: 'GET', credentials: 'include', cache: 'no-store', signal });
      if (!response.ok) throw new AccessHistoryError(response.status);
      if (response.status !== 200) throw new AccessHistoryError();
      return validateAccessHistory(await response.json());
    } catch (error) {
      // Do not read or display arbitrary error bodies, actor data or provider diagnostics.
      if (error instanceof AccessHistoryError) throw error;
      throw new AccessHistoryError();
    }
  } };
}
export const accessHistoryClient = createAccessHistoryClient();
