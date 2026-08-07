import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Contextual Ask for any Workspace. Passes the active company + a context
// string describing the current record so Ask understands intent without
// the user naming the record every time.
export function useWorkspaceAsk() {
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async ({ companyId, question, context }) => {
    if (!question?.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await base44.functions.invoke('askAI', { company_id: companyId, question, context });
      setAnswer(res?.answer || res?.data?.answer || 'I could not generate an answer right now.');
    } catch (e) {
      setAnswer('Something went wrong while answering. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setAnswer(null), []);
  return { answer, loading, run, reset };
}