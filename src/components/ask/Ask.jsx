import React, { useState, useEffect } from 'react';
import AskButton from './AskButton';
import AskModal from './AskModal';
import AskTooltip from './AskTooltip';

const TOOLTIP_KEY = 'lp.ask.tooltipDismissed';

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function Ask() {
  const [open, setOpen] = useState(false);
  const [tooltipSeen, setTooltipSeen] = useState(
    () => localStorage.getItem(TOOLTIP_KEY) === '1'
  );

  const dismissTooltip = () => {
    localStorage.setItem(TOOLTIP_KEY, '1');
    setTooltipSeen(true);
  };

  useEffect(() => {
    const onKey = (e) => {
      // Ctrl/Cmd + K toggles Ask
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Space opens Ask when not typing in a text field
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

  const openAsk = () => {
    if (!tooltipSeen) dismissTooltip();
    setOpen(true);
  };

  return (
    <>
      {!tooltipSeen && !open && (
        <AskTooltip onTry={openAsk} onDismiss={dismissTooltip} />
      )}
      <AskButton onClick={openAsk} hidden={open} />
      <AskModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}