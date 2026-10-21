import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import AskModal from './AskModal';

const TOOLTIP_KEY = 'lp.ask.tooltipDismissed';

const AskCtx = createContext(null);
export const useAsk = () => useContext(AskCtx);

// Single source of truth for the Ask experience. Every entry point
// (top bar, Ctrl/Cmd+K, dashboard, widgets) opens the same modal.
// openAsk(query?) optionally prefills the input (used by "Ask Why" on insights).
export function AskProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');
  const [tooltipSeen, setTooltipSeen] = useState(
    () => localStorage.getItem(TOOLTIP_KEY) === '1'
  );

  const dismissTooltip = useCallback(() => {
    localStorage.setItem(TOOLTIP_KEY, '1');
    setTooltipSeen(true);
  }, []);

  const openAsk = useCallback(
    (q) => {
      if (!tooltipSeen) dismissTooltip();
      setPendingQuery(typeof q === 'string' ? q : '');
      setOpen(true);
    },
    [tooltipSeen, dismissTooltip]
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPendingQuery('');
        setOpen((o) => !o);
        return;
      }

    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <AskCtx.Provider value={{ openAsk }}>
      {children}
      <AskModal open={open} onClose={() => setOpen(false)} initialQuery={pendingQuery} />
    </AskCtx.Provider>
  );
}