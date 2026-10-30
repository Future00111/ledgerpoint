/** Native source-file intake. Every request retains the active company boundary. */
export const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;

export function createDocumentIntakeClient(fetcher = (...args) => fetch(...args)) {
  const base = companyId => `/api/companies/${encodeURIComponent(companyId)}/document-intake`;
  const call = async (url, { method = 'GET', body, revision, signal, content = false } = {}) => {
    const response = await fetcher(url, {
      method, credentials: 'include', signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(revision != null ? { 'If-Match': `"${revision}"` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (content && response.ok) {
      const blob = await response.blob();
      if (blob.size > MAX_CAPTURE_BYTES) throw new Error('The source file exceeds the 5 MiB download limit.');
      return blob;
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(result?.error?.message || `Request failed (${response.status}).`), {
      status: response.status, code: result?.error?.code, issues: Array.isArray(result?.error?.issues) ? result.error.issues : [],
    });
    if (!result || !Object.hasOwn(result, 'data')) throw new Error('The source-file response could not be verified. Please retry.');
    return result.data;
  };
  return {
    list: (companyId, documentId, signal) => call(`${base(companyId)}${documentId ? `?document_id=${encodeURIComponent(documentId)}` : ''}`, { signal }),
    get: (companyId, sourceId, signal) => call(`${base(companyId)}/${encodeURIComponent(sourceId)}`, { signal }),
    upload: (companyId, body, signal) => call(`${base(companyId)}/upload`, { method: 'POST', body, signal }),
    content: (companyId, sourceId, signal) => call(`${base(companyId)}/${encodeURIComponent(sourceId)}/content`, { content: true, signal }),
    review: (companyId, sourceId, envelope, signal) => call(`${base(companyId)}/${encodeURIComponent(sourceId)}/review`, { method: 'POST', body: { envelope }, signal }),
    draft: (companyId, sourceId, body, revision, signal) => call(`${base(companyId)}/${encodeURIComponent(sourceId)}/draft`, { method: 'POST', body, revision, signal }),
  };
}

export const documentIntake = createDocumentIntakeClient();
