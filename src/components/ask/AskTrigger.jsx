import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAsk } from './AskProvider';

const EXAMPLES = [
  'Why has profit changed?',
  'Create an invoice.',
  'Show unpaid customers.',
  'Prepare my VAT return.',
  'Find British Gas.',
  'Compare this month with last month.',
];

// The dashboard Ask bar. Rotating placeholder + example suggestion chips below.
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
        className="w-full max-w-xl min-w-0 flex items-center gap-2.5 h-10 px-3.5 rounded-lg bg-muted/70 hover:bg-muted border border-transparent hover:border-border transition-colors text-sm text-left"
        aria-label="Ask Ledgerly"
      >
        <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="flex-1 truncate text-muted-foreground">
          <span className="text-foreground/80">💬 Ask Ledgerly…</span> <span className="text-muted-foreground/70">{ph}</span>
        </span>
        <kbd className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden sm:inline-flex">
          ⌘K
        </kbd>
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5 max-w-xl">
        {EXAMPLES.slice(0, 3).map((e) => (
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