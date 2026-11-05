export function createAuditClient(fetcher = (...args) => fetch(...args)) {
  const queryString = query => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== null && value !== undefined)).toString();
  const call = async (company, query, signal, csv = false) => {
    const response = await fetcher(`/api/companies/${encodeURIComponent(company)}/audit-events${csv ? '/export.csv' : ''}?${queryString(query)}`, { credentials: 'include', signal });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw Object.assign(new Error(result?.error?.message ?? 'Audit history could not be loaded. Please retry.'), { status: response.status, code: result?.error?.code });
    }
    if (!csv) return (await response.json())?.data;
    if (!response.headers.get('content-type')?.startsWith('text/csv') || response.headers.get('x-audit-company') !== company) throw new Error('The audit export could not be verified for this company.');
    const text = await response.text();
    if (text.length > 5 * 1024 * 1024) throw new Error('The audit export is too large. Narrow the filters.');
    return { company_id: company, as_of: response.headers.get('x-audit-as-of'), csv: text };
  };
  return { list: (company, query, signal) => call(company, query, signal), export: (company, query, signal) => call(company, query, signal, true) };
}
export const auditReview = createAuditClient();
