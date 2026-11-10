import { docPath } from '../../api/accountingDocuments.mjs';
import { capturePath } from './model.mjs';

const sourceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Return navigation is constructed locally, never taken from an arbitrary URL. */
export function captureReturnPath(sourceId) {
  return typeof sourceId === 'string' && sourceIdPattern.test(sourceId) ? `/documents?capture=${encodeURIComponent(sourceId)}` : null;
}
export function savedCapturePath(kind, documentId, sourceId) {
  const documentPath = docPath(kind, documentId);
  return documentPath && captureReturnPath(sourceId) ? `${documentPath}?capture=${encodeURIComponent(sourceId)}` : documentPath;
}
export function sourceOpenPath(source) {
  return source.document_id ? savedCapturePath(source.document_kind, source.document_id, source.id) || capturePath(source) : capturePath(source);
}
export function filterSources(sources, search, status) {
  const query = search.trim().toLowerCase();
  return sources.filter(source => String(source.filename ?? '').toLowerCase().includes(query)
    && (status === 'prepare' ? !source.document_id : status === 'linked' ? Boolean(source.document_id) : true));
}
export function documentProgress(captureMode, reviewed, saved) {
  const labels = captureMode ? ['Enter details', 'Review source & totals', 'Save linked draft'] : ['Enter details', 'Save draft', 'Review & post'];
  const current = (captureMode ? reviewed : saved) ? 2 : 0;
  return labels.map((label, index) => ({ label, current: index === current }));
}
