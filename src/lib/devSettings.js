import { useState, useEffect, useCallback } from 'react';

const KEY = 'lp.dev.settings';
const DEFAULTS = {
  debugMode: false,
  showIds: false,
  apiLogs: false,
  performance: false,
  testEmails: false,
  testBanking: false,
};

export function loadDevSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function useDevSettings() {
  const [settings, setSettings] = useState(loadDevSettings);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);
  const toggle = useCallback((k) => setSettings((s) => ({ ...s, [k]: !s[k] })), []);
  const reset = useCallback(() => setSettings(DEFAULTS), []);
  return [settings, toggle, reset];
}

export const DEV_SETTING_META = [
  { key: 'debugMode', label: 'Debug Mode', description: 'Surface extra diagnostics throughout the app.' },
  { key: 'showIds', label: 'Show Database IDs', description: 'Display internal record IDs on lists and detail views.' },
  { key: 'apiLogs', label: 'Show API Logs', description: 'Log SDK calls to the browser console.' },
  { key: 'performance', label: 'Show Performance Metrics', description: 'Overlay load timings for widgets and pages.' },
  { key: 'testEmails', label: 'Enable Test Emails', description: 'Route email capture scans to a mock inbox.' },
  { key: 'testBanking', label: 'Enable Test Banking', description: 'Use a simulated bank feed instead of Open Banking.' },
];