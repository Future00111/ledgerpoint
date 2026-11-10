// This browser preference is presentation only. It never records setup progress,
// financial data, membership, or permission to perform an accounting action.
export const GUIDANCE_STORAGE_WARNING = 'Your browser could not remember this explanation preference. You can still change it for this visit.';
export const GUIDANCE_INVALID_WARNING = 'The saved explanation preference could not be read. Choose Show or Hide explanations to save it again.';

export function guidancePreferenceKey(accountId, companyId) {
  const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value;
  return validId(accountId) && validId(companyId)
    ? `ledgerly.setup-explanations:v1:${JSON.stringify([accountId, companyId])}`
    : null;
}

export function browserPreferenceStorage() {
  return window.localStorage;
}

export function readGuidancePreference(accountId, companyId, getStorage = browserPreferenceStorage) {
  const key = guidancePreferenceKey(accountId, companyId);
  if (!key) return { key, guided: false, warning: '' };
  try {
    const saved = getStorage().getItem(key);
    if (saved === null || saved === 'false') return { key, guided: false, warning: '' };
    if (saved === 'true') return { key, guided: true, warning: '' };
    return { key, guided: false, warning: GUIDANCE_INVALID_WARNING };
  } catch {
    return { key, guided: false, warning: GUIDANCE_STORAGE_WARNING };
  }
}

export function saveGuidancePreference(accountId, companyId, guided, getStorage = browserPreferenceStorage) {
  if (typeof guided !== 'boolean') throw new TypeError('An explanation preference must be true or false.');
  const key = guidancePreferenceKey(accountId, companyId);
  if (!key) return { key, guided: false, warning: '' };
  try {
    getStorage().setItem(key, guided ? 'true' : 'false');
    return { key, guided, warning: '' };
  } catch {
    // The setting still works for this visit when browser storage is blocked.
    return { key, guided, warning: GUIDANCE_STORAGE_WARNING };
  }
}
