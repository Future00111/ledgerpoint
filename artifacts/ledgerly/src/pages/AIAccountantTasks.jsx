import React, { useCallback, useEffect, useState } from 'react';
import { useCompany } from '@/lib/useCompany';
import { ListChecks, CheckCircle2 } from 'lucide-react';
import RecommendationCard from '@/components/ai-accountant/RecommendationCard';
import { aiApi, DOMAIN_LABELS } from '@/components/ai-accountant/api';

const DOMAIN_ORDER = ['revenue', 'expense', 'vat', 'debtor', 'creditor', 'cashflow'];

/** AI Accountant Tasks — open findings grouped by accounting area. */
export default function AIAccountantTasks() {
  const { activeCompany } = useCompany();
  const [recs, setRecs] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const res = await aiApi.recommendations(activeCompany.id, ['open']);
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

  const domains = DOMAIN_ORDER
    .map((d) => ({ domain: d, items: (recs || []).filter((r) => r.domain === d) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-[#007bff]" /> AI Tasks
        </h1>
        <p className="text-sm text-slate-500 mt-1">Suggested work, organised by accounting area.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {recs === null ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : domains.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-slate-900">Nothing outstanding</p>
          <p className="text-sm text-slate-500 mt-1">No open tasks across any accounting area.</p>
        </div>
      ) : (
        domains.map((g) => (
          <section key={g.domain} className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {DOMAIN_LABELS[g.domain]} ({g.items.length})
            </h2>
            {g.items.map((r) => <RecommendationCard key={r.id} rec={r} onDecide={decide} deciding={deciding} />)}
          </section>
        ))
      )}
    </div>
  );
}
