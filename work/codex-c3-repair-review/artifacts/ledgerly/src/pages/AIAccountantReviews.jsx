import React, { useCallback, useEffect, useState } from 'react';
import { useCompany } from '@/lib/useCompany';
import { ClipboardCheck, Check, X, Clock, RotateCcw } from 'lucide-react';
import RecommendationCard from '@/components/ai-accountant/RecommendationCard';
import { aiApi } from '@/components/ai-accountant/api';

const DECISION_ICON = {
  approved: { icon: Check, cls: 'text-emerald-600 bg-emerald-50' },
  dismissed: { icon: X, cls: 'text-slate-500 bg-slate-100' },
  snoozed: { icon: Clock, cls: 'text-amber-600 bg-amber-50' },
  reopened: { icon: RotateCcw, cls: 'text-blue-600 bg-blue-50' },
};

const fmtWhen = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/** AI Accountant Reviews — decided recommendations plus the decision audit trail. */
export default function AIAccountantReviews() {
  const { activeCompany } = useCompany();
  const [recs, setRecs] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const [r, d] = await Promise.all([
        aiApi.recommendations(activeCompany.id, ['approved', 'dismissed', 'resolved']),
        aiApi.decisions(activeCompany.id),
      ]);
      setRecs(r.recommendations || []);
      setDecisions(d.decisions || []);
    } catch (e) { setError(e.message); }
  }, [activeCompany?.id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    setDeciding(true);
    try { await aiApi.decide(id, decision); await load(); }
    catch (e) { setError(e.message); }
    finally { setDeciding(false); }
  };

  const titleById = new Map((recs || []).map((r) => [r.id, r.title]));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#007bff]" /> AI Reviews
        </h1>
        <p className="text-sm text-slate-500 mt-1">Findings you have already reviewed, with a full decision trail.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {recs === null ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : (
        <>
          {recs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">Nothing reviewed yet — decisions you make in the Inbox appear here.</p>
            </div>
          ) : (
            <section className="space-y-3">
              {recs.map((r) => <RecommendationCard key={r.id} rec={r} onDecide={decide} deciding={deciding} />)}
            </section>
          )}

          <div className="rounded-xl border border-slate-200 bg-white">
            <p className="px-4 pt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Decision history</p>
            {decisions.length === 0 ? (
              <p className="px-4 py-5 text-sm text-slate-500">No decisions recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 mt-2">
                {decisions.map((d) => {
                  const cfg = DECISION_ICON[d.decision] || DECISION_ICON.dismissed;
                  const Icon = cfg.icon;
                  return (
                    <li key={d.id} className="px-4 py-2.5 flex items-start gap-2.5 text-xs">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>
                        <Icon className="w-3 h-3" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700">
                          <span className="font-semibold capitalize">{d.decision}</span>
                          {titleById.get(d.recommendation_id) ? ` — ${titleById.get(d.recommendation_id)}` : ''}
                          {d.note ? ` · "${d.note}"` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmtWhen(d.created_at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
