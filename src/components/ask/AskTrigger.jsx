import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAsk } from './AskProvider';

const EXAMPLES = [
  'Create an invoice',
  'Show unpaid customers',
  'Why has profit changed?',
  'Prepare my VAT return',
  'Find British Gas',
  'Compare this month with last month',
];

// The dashboard Ask bar — the centrepiece interaction point. A prominent
// trigger with a gently crossfading rotating placeholder, plus example
// suggestion chips below.
export default function AskTrigger() {
  const { openAsk } = useAsk();
  const [ph, setPh] = useState(EXAMPLES[0]);

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % EXAMPLES.length;
      setPh(EXAMPLES[i]);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full">
      <button
        onClick={() => openAsk()}
        className="w-full max-w-2xl min-w-0 flex items-center gap-3 h-11 px-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all text-sm text-left"
        aria-label="Ask Ledgerly"
      >
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0 truncate text-muted-foreground">
          <span className="text-foreground/80 font-medium">💬 Ask Ledgerly…</span>{' '}
          <span key={ph} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
            {ph}
          </span>
        </span>
        <kbd className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden sm:inline-flex">
          ⌘K
        </kbd>
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5 max-w-2xl">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => openAsk(e)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}