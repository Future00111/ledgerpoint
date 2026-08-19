import React, { useCallback, useEffect, useState } from 'react';
import { useCompany } from '@/lib/useCompany';
import { Lightbulb } from 'lucide-react';
import RecommendationCard from '@/components/ai-accountant/RecommendationCard';
import { aiApi } from '@/components/ai-accountant/api';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'approved', label: 'Accepted' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'resolved', label: 'Resolved' },
];

/** AI Accountant Recommendations — every suggestion, filterable by status. */
export default function AIAccountantRecommendations() {
  const { activeCompany } = useCompany();
  const [recs, setRecs] = useState(null);
  const [filter, setFilter] = useState('all');
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await aiApi.recommendations(activeCompany.id);
      setRecs(res.recommendations || []);
    } catch (e) { setError(e.message); }
  }, [activeCompany?.id]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    setDeciding(true);
    try { await aiApi.decide(id, decision); await load(); }
    catch (e) { setError(e.message); }
    finally { setDeciding(false); }
  };

  const filtered = (recs || []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[#007bff]" /> AI Recommendations
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Everything the AI Accountant has suggested. Nothing is applied without your approval.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.key ? 'bg-[#007bff] border-[#007bff] text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
            data-testid={`filter-${f.key}`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {recs === null ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">No recommendations {filter !== 'all' ? `with status "${filter}"` : 'yet — run "Check my books" from the AI Accountant overview'}.</p>
        </div>
      ) : (
        <section className="space-y-3">
          {filtered.map((r) => <RecommendationCard key={r.id} rec={r} onDecide={decide} deciding={deciding} />)}
        </section>
      )}
    </div>
  );
}
