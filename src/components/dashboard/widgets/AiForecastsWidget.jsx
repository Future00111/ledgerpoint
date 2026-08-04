import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAsk } from '@/components/ask/AskProvider';
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react';

export default function AiForecastsWidget({ company }) {
  const { openAsk } = useAsk();
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const load = (cid) => {
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('askAI', {
          company_id: cid,
          question:
            'Act as a financial forecaster. Based on my books, forecast revenue, cashflow and key risks for the next 3 months. Be concise (max 120 words), use bullet points.',
        });
        if (!cancelled) {
          setText(res?.data?.answer || res?.answer || '');
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Unable to generate forecast.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (!company?.id) {
      setLoading(false);
      return;
    }
    return load(company.id);
  }, [company?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium">AI Forecast</p>
        <button onClick={() => load(company.id)} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RotateCcw className="w-3 h-3" />
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating forecast…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
      )}
      <button onClick={() => openAsk('What are the biggest risks to my cashflow this quarter?')} className="mt-3 text-xs font-medium text-primary hover:underline flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        Ask a follow-up
      </button>
    </div>
  );
}