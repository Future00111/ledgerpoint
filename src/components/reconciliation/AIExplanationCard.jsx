import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Loader2 } from 'lucide-react';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function buildReasons(t, suggestion) {
  const reasons = [];
  if (suggestion) {
    if (Math.abs(txnAmount(t) - (suggestion.record_amount || 0)) > 0.01) reasons.push('Amount differs from invoice');
    if (suggestion.record_date) {
      const diff = Math.abs(new Date(t.date) - new Date(suggestion.record_date));
      if (diff > 2 * 86400000) reasons.push('Transaction date differs');
    }
  }
  reasons.push('Multiple matches found');
  return reasons;
}

// Only shown when AI confidence is low (< 50). Keeps AI out of high-confidence flow.
export default function AIExplanationCard({ transaction, suggestion, companyId }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const reasons = useMemo(() => buildReasons(transaction, suggestion), [transaction, suggestion]);

  const review = async () => {
    setOpen(true);
    if (answer) return;
    setLoading(true);
    try {
      const prompt = `Explain why the AI is uncertain about matching a bank transaction "${transaction.description}" of ${txnAmount(transaction)} on ${transaction.date} to ${suggestion?.record_type || 'a record'} ${suggestion?.record_number || ''}. Answer in 2-3 short sentences.`;
      const res = await base44.functions.invoke('askAI', { company_id: companyId, question: prompt });
      const body = res?.data ?? res;
      setAnswer(body?.answer || 'No explanation available.');
    } catch (e) {
      setAnswer('Could not load explanation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5" /> AI is uncertain
      </p>
      <p className="text-amber-700/70 mt-1">Possible reasons:</p>
      <ul className="mt-0.5 space-y-0.5 pl-4 list-disc text-amber-800/80">
        {reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <button type="button" onClick={review} className="text-primary font-medium mt-1.5 hover:underline">
        {loading ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</span> : 'Review explanation'}
      </button>
      {open && !loading && answer && (
        <p className="mt-2 text-foreground/80 leading-relaxed border-t border-amber-200/60 pt-2">{answer}</p>
      )}
    </div>
  );
}