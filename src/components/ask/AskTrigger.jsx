import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAsk } from './AskProvider';

const EXAMPLES = [
  'Ask anything...',
  'Create an invoice',
  'Find British Gas',
  'Show unpaid customers',
  'Why has profit dropped?',
  'Prepare my VAT return',
];

// Replaces the old global search bar. Clicking (or ⌘K) opens Ask.
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
    <button
      onClick={openAsk}
      className="w-full max-w-xl min-w-0 flex items-center gap-2.5 h-9 px-3 rounded-lg bg-muted/70 hover:bg-muted border border-transparent hover:border-border transition-colors text-sm text-left"
      aria-label="Ask anything"
    >
      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 truncate text-muted-foreground">{ph}</span>
      <kbd className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden sm:inline-flex">
        ⌘K
      </kbd>
    </button>
  );
}