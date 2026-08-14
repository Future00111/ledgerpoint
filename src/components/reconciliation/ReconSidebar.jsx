import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Send, Loader2, AlertTriangle, Search, Copy, PoundSterling, Plug, AlertCircle } from 'lucide-react';

const ICONS = { feed: Plug, duplicate: Copy, large: PoundSterling, unmatched: Search, error: AlertCircle };
const PROMPTS = [
  'Find possible duplicates',
  'Show unreconciled over £1,000',
  'Explain low-confidence matches',
];

// One compact sidebar — progress, needs attention, ask Ledgerly.
export default function ReconSidebar({ metrics, attentionItems, onPickAttention, companyId, askSeed }) {
  const m = metrics || {};
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  useEffect(() => {
    if (askSeed) { setQ(askSeed); ask(askSeed); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askSeed]);

  const ask = async (query) => {
    const text = (query ?? q).trim();
    if (!text || !companyId) return;
    setLoading(true); setAnswer(null); setQ(text); setShowPrompts(false);
    try {
      const res = await base44.functions.invoke('askAI', { company_id: companyId, question: text });
      const body = res?.data ?? res;
      setAnswer(body?.answer || 'I could not answer that right now.');
    } catch (e) {
      setAnswer('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reconciliation</p>
        <p className="text-2xl font-semibold tracking-tight mt-1">
          {m.completionPct ?? 100}%<span className="text-sm font-normal text-muted-foreground ml-1.5">complete</span>
        </p>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2.5">
          <div
            className={`h-full rounded-full ${m.remaining === 0 ? 'bg-emerald-500' : 'bg-primary'}`}
            style={{ width: `${m.completionPct ?? 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{m.reconciled ?? 0} reconciled · {m.remaining ?? 0} remaining</p>
      </div>

      <div className="h-px bg-border" />

      {/* Needs attention */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">Needs attention</p>
        {attentionItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">All clear.</p>
        ) : (
          <div className="space-y-2">
            {attentionItems.map((it) => {
              const Icon = ICONS[it.type] || AlertTriangle;
              const clickable = it.transactionIds && it.transactionIds.length > 0;
              return (
                <button
                  key={it.key}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onPickAttention?.(it.transactionIds[0])}
                  className={`w-full flex items-center gap-2 text-left ${clickable ? 'hover:text-foreground' : 'cursor-default'}`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${it.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`} />
                  <span className="text-xs text-foreground/70 truncate">{it.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Ask */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Ask Ledgerly
        </p>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setShowPrompts(true)}
            onBlur={() => setTimeout(() => setShowPrompts(false), 150)}
            placeholder="Ask about reconciliation…"
            className="w-full h-8 rounded-md border border-input bg-card pl-7 pr-8 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Sparkles className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
        {showPrompts && !loading && (
          <div className="mt-2 space-y-1">
            {PROMPTS.map((p) => (
              <button key={p} type="button" onMouseDown={(e) => { e.preventDefault(); ask(p); }} className="block text-left text-xs text-primary/80 hover:text-primary px-1 py-0.5">
                {p}
              </button>
            ))}
          </div>
        )}
        {loading && <p className="text-xs text-muted-foreground mt-2">Thinking…</p>}
        {answer && !loading && (
          <p className="text-xs text-foreground/80 mt-2 leading-relaxed whitespace-pre-wrap">{answer}</p>
        )}
      </div>
    </div>
  );
}