import { useCallback, useEffect, useRef, useState } from 'react';
import { browserPreferenceStorage, guidancePreferenceKey, readGuidancePreference, saveGuidancePreference } from './preferences.mjs';

export function useGuidancePreference(accountId, companyId, getStorage = browserPreferenceStorage) {
  const key = guidancePreferenceKey(accountId, companyId);
  const latest = useRef(key);
  latest.current = key;
  const [state, setState] = useState(() => readGuidancePreference(accountId, companyId, getStorage));

  useEffect(() => {
    latest.current = key;
    setState(readGuidancePreference(accountId, companyId, getStorage));
    return () => { latest.current = null; };
  }, [accountId, companyId, getStorage, key]);

  const changeGuidance = useCallback(guided => {
    // An event retained from a previous account/company must not write or update
    // the newly selected business. No effect writes the current state to storage.
    if (!key || latest.current !== key) return;
    setState(saveGuidancePreference(accountId, companyId, guided, getStorage));
  }, [accountId, companyId, getStorage, key]);

  const current = state.key === key ? state : { guided: false, warning: '' };
  return { guided: current.guided, guidanceWarning: current.warning, changeGuidance };
}
