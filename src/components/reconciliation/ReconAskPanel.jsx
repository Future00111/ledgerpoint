import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PROMPTS = [
  'Why wasn\u2019t this transaction matched?',
  'Show unreconciled transactions over \u00a31,000.',
  'Find possible duplicates.',
  'Explain this transaction.',
  'Show transactions requiring review.',
];

// Ask Ledgerly — suggested prompts + free input, answered over the books.
export default function ReconAskPanel({ companyId, seed }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seed) { setQuestion(seed); ask(seed); }
  }, [seed]);

  const ask = async (q) => {
    const query = (q ?? question).trim();
    if (!query || !companyId) return;
    setLoading(true);
    setAnswer(null);
    setQuestion(query);
    try {
      const res = await base44.functions.invoke('askAI', { company_id: companyId, question: query });
      const body = res?.data ?? res;
      setAnswer(body?.answer || 'I could not answer that right now.');
    } catch (e) {
      setAnswer('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary">
          <Sparkles className="w-4 h-4" />
        </div>
        <p className="text-sm font-semibold">Ask Ledgerly</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PROMPTS.map((p) => (
          <button key={p} type="button" onClick={() => ask(p)} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
            {p}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex items-center gap-1.5 mb-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your bank transactions…"
          className="flex-1 h-8 rounded-md border border-input bg-card px-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="sm" disabled={loading} className="h-8 w-8 p-0">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </form>
      {loading && <p className="text-xs text-muted-foreground">Thinking…</p>}
      {answer && !loading && (
        <div className="rounded-md border border-border bg-card px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{answer}</div>
      )}
    </div>
  );
}