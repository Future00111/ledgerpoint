/** Native bank statements. The server is authoritative for access, duplicates, eligibility and posting. */
export function createBankStatementsClient(fetcher = (...a) => fetch(...a)) {
  const call = async (url, { method = 'GET', body, signal } = {}) => {
    const res = await fetcher(url, {
      method, credentials: 'include', signal,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const e = json?.error;
      throw Object.assign(new Error(e?.message || `Request failed (${res.status}).`), { status: res.status, code: e?.code });
    }
    if (!json || typeof json !== 'object' || !Object.hasOwn(json, 'data')) {
      // A 2xx we cannot read is not proof of failure; treat like an unknown outcome.
      throw Object.assign(new Error('The bank statement response could not be verified. Check the outcome before continuing.'), { status: undefined, code: 'UNVERIFIED_RESPONSE' });
    }
    return json.data;
  };
  const base = c => `/api/companies/${encodeURIComponent(c)}/bank-statements`;
  return {
    context: (c, signal) => call(`${base(c)}/context`, { signal }),
    importReview: (c, body, signal) => call(`${base(c)}/import-review`, { method: 'POST', body, signal }),
    importRows: (c, body, signal) => call(`${base(c)}/imports`, { method: 'POST', body, signal }),
    importStatus: (c, requestId, signal) => call(`${base(c)}/imports/${encodeURIComponent(requestId)}`, { signal }),
    matchReview: (c, body, signal) => call(`${base(c)}/match-review`, { method: 'POST', body, signal }),
    recordMatch: (c, body, signal) => call(`${base(c)}/matches`, { method: 'POST', body, signal }),
    matchStatus: (c, requestId, signal) => call(`${base(c)}/matches/${encodeURIComponent(requestId)}`, { signal }),
    correctionReview: (c, body, signal) => call(`${base(c)}/correction-review`, { method: 'POST', body, signal }),
    recordCorrection: (c, body, signal) => call(`${base(c)}/corrections`, { method: 'POST', body, signal }),
    correctionStatus: (c, requestId, signal) => call(`${base(c)}/corrections/${encodeURIComponent(requestId)}`, { signal }),
  };
}
export const bankStatements = createBankStatementsClient();

/** Network failure, unreadable 2xx or 5xx = outcome unknown; 4xx = definitive rejection, nothing written. */
export const isUnknownOutcome = e => e?.name !== 'AbortError' && (!e?.status || e.status >= 500);
