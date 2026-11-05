/** Company-scoped operational credit tracking. These requests never post journals. */
export function createCreditRecoveryClient(fetcher = (...args) => fetch(...args)) {
  const base = companyId => `/api/companies/${encodeURIComponent(companyId)}/credit-claims`;
  const call = async (url, { method = 'GET', body, revision, signal } = {}) => {
    const response = await fetcher(url, {
      method, credentials: 'include', signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(revision != null ? { 'If-Match': `"${revision}"` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = result?.error;
      throw Object.assign(new Error(error?.message || `Request failed (${response.status}).`), {
        status: response.status, code: error?.code,
        issues: Array.isArray(error?.issues) ? error.issues : [],
      });
    }
    if (!result || !Object.hasOwn(result, 'data')) throw new Error('The credit tracking response could not be verified. Refresh before continuing.');
    return result.data;
  };
  return {
    list: (companyId, billId, signal) => call(`${base(companyId)}${billId ? `?bill_id=${encodeURIComponent(billId)}` : ''}`, { signal }),
    create: (companyId, body, signal) => call(base(companyId), { method: 'POST', body, signal }),
    receive: (companyId, claimId, body, revision, signal) => call(`${base(companyId)}/${encodeURIComponent(claimId)}/receipts`, { method: 'POST', body, revision, signal }),
    cancel: (companyId, claimId, body, revision, signal) => call(`${base(companyId)}/${encodeURIComponent(claimId)}/cancel`, { method: 'POST', body, revision, signal }),
  };
}

export const creditRecovery = createCreditRecoveryClient();
