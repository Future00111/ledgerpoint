import React, { useCallback, useEffect, useState } from 'react';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Inbox, RefreshCw, CheckCircle2 } from 'lucide-react';
import RecommendationCard from '@/components/ai-accountant/RecommendationCard';
import { aiApi, PRIORITY_STYLES } from '@/components/ai-accountant/api';

/** AI Accountant Inbox — open findings grouped by priority. */
export default function AIAccountantInbox() {
  const { activeCompany } = useCompany();
  const [recs, setRecs] = useState(null);
  const [running, setRunning] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await aiApi.recommendations(activeCompany.id, ['open', 'snoozed']);
      setRecs(res.recommendations || []);
    } catch (e) { setError(e.message); }
  }, [activeCompany?.id]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRunning(true); setError(null);
    try { await aiApi.refresh(activeCompany.id); await load(); }
    catch (e) { setError(e.message); }
    finally { setRunning(false); }
  };

  const decide = async (id, decision) => {
    setDeciding(true);
    try { await aiApi.decide(id, decision); await load(); }
    catch (e) { setError(e.message); }
    finally { setDeciding(false); }
  };

  const groups = ['high', 'medium', 'low'].map((p) => ({
    priority: p,
    items: (recs || []).filter((r) => r.priority === p && r.status === 'open'),
  }));
  const snoozed = (recs || []).filter((r) => r.status === 'snoozed');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#007bff]" /> AI Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">Findings that need your attention, most urgent first.</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={running} data-testid="button-refresh-inbox">
          <RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} /> Re-check
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {recs === null ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : recs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-slate-900">All clear</p>
          <p className="text-sm text-slate-500 mt-1">No open findings. Run a re-check any time.</p>
        </div>
      ) : (
        <>
          {groups.map((g) => g.items.length > 0 && (
            <section key={g.priority} className="space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${PRIORITY_STYLES[g.priority].dot}`} />
                {PRIORITY_STYLES[g.priority].label} priority ({g.items.length})
              </h2>
              {g.items.map((r) => <RecommendationCard key={r.id} rec={r} onDecide={decide} deciding={deciding} />)}
            </section>
          ))}
          {snoozed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Snoozed ({snoozed.length})</h2>
              {snoozed.map((r) => <RecommendationCard key={r.id} rec={r} onDecide={decide} deciding={deciding} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
