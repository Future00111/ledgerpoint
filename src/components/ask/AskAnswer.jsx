import React from 'react';
import { Sparkles, Loader2, RotateCcw } from 'lucide-react';

// Render a structured summary table for a retrieved record section.
function RecordSection({ section }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {section.type}
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              {section.columns.map((c) => (
                <th key={c} className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {row.map((cell, j) => (
                  <td key={j} className="px-2.5 py-1.5 whitespace-nowrap text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Chat-style rendering of an AI answer inside the Ask workspace.
// Structured summaries (retrieved from the books) are shown before the
// narrative explanation, so the user sees the facts first.
export default function AskAnswer({ aiAnswer, onBack }) {
  const records = aiAnswer.records || [];
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-6">
      {aiAnswer.question && (
        <div className="flex justify-end mb-5">
          <span className="text-sm font-medium px-3.5 py-2 rounded-2xl rounded-br-sm bg-primary text-primary-foreground max-w-[80%]">
            {aiAnswer.question}
          </span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          {aiAnswer.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
            {aiAnswer.loading ? 'Thinking…' : 'Ledgerly'}
          </p>
          {aiAnswer.loading ? (
            <p className="text-sm text-muted-foreground">Reading your books…</p>
          ) : aiAnswer.error ? (
            <p className="text-sm text-destructive">{aiAnswer.error}</p>
          ) : (
            <div className="space-y-2">
              {records.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  {records.map((sec, i) => (
                    <RecordSection key={`${sec.type}-${i}`} section={sec} />
                  ))}
                </div>
              )}
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {aiAnswer.text}
              </p>
            </div>
          )}
        </div>
      </div>
      {!aiAnswer.loading && (
        <button
          onClick={onBack}
          className="mt-5 ml-11 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Ask something else
        </button>
      )}
    </div>
  );
}