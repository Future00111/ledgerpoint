import React, { useRef, useEffect } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Large, bottom-anchored message input (ChatGPT/Raycast style).
// Auto-growing textarea with a circular send button.
export default function AskInput({ value, onChange, onKeyDown, onSubmit, placeholder, disabled, inputRef }) {
  const taRef = useRef(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex-shrink-0 border-t border-border bg-card px-3 sm:px-6 py-3">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition">
          <textarea
            ref={(el) => {
              taRef.current = el;
              if (inputRef) inputRef.current = el;
            }}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            aria-label="Ask anything"
            className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground max-h-[200px]"
          />
          <button
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send"
            className={cn(
              'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
              canSend ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'
            )}
          >
            {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          Ask anything, search records, or run a command · <kbd className="border border-border rounded px-1">Enter</kbd> to select · <kbd className="border border-border rounded px-1">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}