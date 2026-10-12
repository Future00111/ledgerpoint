import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Inline AI assistant for the invoice page. Uses the askAI backend function
// with the invoice context so questions are answered about this invoice.
export default function InvoiceAIAssistant({ companyId, context, suggestions = [] }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async (q) => {
    if (!q?.trim()) return;
    setLoading(true);
    setAnswer(null);
    setQuestion(q);
    try {
      const res = await base44.functions.invoke('askAI', { company_id: companyId, question: q, context });
      setAnswer(res?.answer || 'I could not generate an answer right now.');
    } catch (e) {
      setAnswer('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">AI Assistant</p>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex items-center gap-1.5 mb-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this invoice…"
            className="flex-1 h-8 rounded-md border border-input bg-card px-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" disabled={loading} className="h-8 w-8 p-0">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </form>

        {answer && (
          <div className="rounded-md border border-border bg-card px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{answer}</div>
        )}
      </CardContent>
    </Card>
  );
}