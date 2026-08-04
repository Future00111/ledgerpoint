import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import AskButton from './AskButton';
import AskModal from './AskModal';
import AskTooltip from './AskTooltip';

const TOOLTIP_KEY = 'lp.ask.tooltipDismissed';

const AskCtx = createContext(null);
export const useAsk = () => useContext(AskCtx);

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

// Single source of truth for the Ask experience. Every entry point
// (top bar, floating button, Ctrl/Cmd+K, Space) opens the same modal.
export function AskProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [tooltipSeen, setTooltipSeen] = useState(
    () => localStorage.getItem(TOOLTIP_KEY) === '1'
  );

  const dismissTooltip = useCallback(() => {
    localStorage.setItem(TOOLTIP_KEY, '1');
    setTooltipSeen(true);
  }, []);

  const openAsk = useCallback(() => {
    if (!tooltipSeen) dismissTooltip();
    setOpen(true);
  }, [tooltipSeen, dismissTooltip]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.code === 'Space') {
        if (open) return;
        if (isTypingTarget(document.activeElement)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <AskCtx.Provider value={{ openAsk }}>
      {children}
      {!tooltipSeen && !open && <AskTooltip onTry={openAsk} onDismiss={dismissTooltip} />}
      <AskButton onClick={openAsk} hidden={open} />
      <AskModal open={open} onClose={() => setOpen(false)} />
    </AskCtx.Provider>
  );
}