import React, { useState } from 'react';
import { Sparkles, X, Bot } from 'lucide-react';

/**
 * AICopilot — placeholder until Task 2 (AI integration) is implemented.
 *
 * The original component used base44.agents.* (real-time agent conversations)
 * which has no replacement yet. This renders the panel with a clear "coming soon"
 * message rather than crashing on undefined API calls.
 */

const SUGGESTED_QUESTIONS = [
  'How much VAT do I owe?',
  'Which customers owe me money?',
  'What was my profit last month?',
  'Show me overdue invoices',
  'Summarise my business performance',
];

export default function AICopilot() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all px-4 py-3 group"
          aria-label="Open AI Copilot"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[140px] transition-all duration-300">Ask AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[420px] h-[80vh] sm:h-[600px] sm:bottom-5 sm:right-5 sm:rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden sm:rounded-br-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Accounting Copilot</p>
                <p className="text-[11px] text-primary-foreground/70 leading-tight">Coming soon</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-primary-foreground/15 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Coming soon body */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-background">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-2">AI Copilot coming soon</p>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed max-w-xs">
              The AI accounting assistant is being wired up. Once enabled you'll be able to ask
              questions like these in plain English:
            </p>
            <div className="grid grid-cols-1 gap-1.5 w-full text-left">
              {SUGGESTED_QUESTIONS.map((q) => (
                <div
                  key={q}
                  className="text-xs px-3 py-2 rounded-lg border border-border bg-muted/40 text-muted-foreground cursor-default"
                >
                  {q}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
