import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useAsk } from './AskProvider';

// The dashboard Ask bar — the single entry point into the Ask workspace.
// No suggestion chips or rotating example prompts are shown on the dashboard;
// suggestions live inside the Ask interface once it is opened.
export default function AskTrigger({ compact = false }) {
  const { openAsk } = useAsk();

  return (
    <div className={compact ? "shrink-0" : "w-full"}>
      <button
        onClick={() => openAsk()}
        className={compact ? "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary/5" : "w-full flex items-center gap-3 h-12 px-3.5 rounded-xl border bg-white text-sm text-left hover:border-primary/45"}
        aria-label="Ask Ledgerly"
      >
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4" />
        </span>
        <span className={compact ? "hidden sm:inline" : "flex-1 min-w-0 truncate text-muted-foreground font-medium"}>
          {compact ? 'Ask Ledgerly' : 'Ask Ledgerly about your business'}
        </span>
        {!compact && <kbd className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden sm:inline-flex">
          Ctrl K
        </kbd>}
      </button>
    </div>
  );
}