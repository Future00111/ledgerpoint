import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useAsk } from './AskProvider';

// The dashboard Ask bar — the single entry point into the Ask workspace.
// No suggestion chips or rotating example prompts are shown on the dashboard;
// suggestions live inside the Ask interface once it is opened.
export default function AskTrigger() {
  const { openAsk } = useAsk();

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
        <span className="flex-1 min-w-0 truncate text-muted-foreground font-medium">
          💬 Ask Ledgerly…
        </span>
        <kbd className="text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden sm:inline-flex">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}