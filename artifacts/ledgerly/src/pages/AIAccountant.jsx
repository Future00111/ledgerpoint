import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import {
  Sparkles, RefreshCw, AlertTriangle, Lightbulb, ClipboardCheck,
  CheckCircle2, Gavel
} from 'lucide-react';
import { aiApi, gbp } from '@/components/ai-accountant/api';
import AITaskCard from '@/components/ai-accountant/AITaskCard';

function TaskSection({ title, icon: Icon, tasks, onDecide, decidingId, emptyText }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
          <Icon className="w-4 h-4 text-slate-500" /> {title}
          <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px] ml-auto">0</span>
        </h3>
        <div className="text-xs text-slate-400 py-6 px-4 border border-dashed border-slate-200 bg-slate-50/50 rounded-lg text-center">
          {emptyText || 'No tasks in this category.'}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
        <Icon className="w-4 h-4 text-slate-500" /> {title}
        <span className="bg-indigo-100 text-indigo-700 font-bold py-0.5 px-2 rounded-full text-[10px] ml-auto">{tasks.length}</span>
      </h3>
      <div className="flex flex-col gap-1.5">
        {tasks.map(t => <AITaskCard key={t.id} task={t} onDecide={onDecide} deciding={decidingId === t.id} />)}
      </div>
    </div>
  );
}

export default function AIAccountant() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany } = useCompany();
  const [summary, setSummary] = useState(null);
  const [collections, setCollections] = useState(null);
  const [transactionReview, setTransactionReview] = useState(null);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [decidingId, setDecidingId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const [sumRes, tasksRes, collectionsRes, reviewRes] = await Promise.all([
        aiApi.taskSummary(activeCompany.id),
        aiApi.tasks(activeCompany.id, ['open', 'reviewing']),
        aiApi.collectionsOverview(activeCompany.id),
        aiApi.transactionReview(activeCompany.id),
      ]);
      setSummary(sumRes);
      setTasks(tasksRes.tasks || []);
      setCollections(collectionsRes);
      setTransactionReview(reviewRes);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [activeCompany?.id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const runCheck = async () => {
    if (!activeCompany?.id) return;
    setRunning(true); setError(null);
    try {
      await aiApi.refreshTasks(activeCompany.id);
      await load();
    } catch (e) { setError(e.message); }
    finally { setRunning(false); }
  };

  const handleDecide = async (id, decision) => {
    setDecidingId(id);
    try {
      await aiApi.decideTask(id, decision);
      setTasks(current => current.filter(t => t.id !== id));
      const refreshedSummary = await aiApi.taskSummary(activeCompany.id);
      setSummary(refreshedSummary);
    } catch (err) {
      setError(err.message || 'The task decision could not be recorded.');
      await load();
    } finally {
      setDecidingId(null);
    }
  };

  const taskTypeFilter = searchParams.get('task_type');
  const visibleTasks = taskTypeFilter ? tasks.filter(task => task.task_type === taskTypeFilter) : tasks;

  // Group tasks
  const grouped = {
    ready_to_approve: [],
    needs_review: [],
    warnings: [],
    insights: []
  };

  visibleTasks.forEach(task => {
    const type = task.task_type || '';
    if (type === 'reconciliation' && task.confidence_score >= 90) {
      grouped.ready_to_approve.push(task);
    } else if (['vat_warning', 'cash_flow_warning', 'overdue_invoice'].includes(type) || task.priority === 'critical') {
      grouped.warnings.push(task);
    } else if (['supplier_review', 'customer_follow_up'].includes(type) && !['high', 'critical'].includes(task.priority)) {
      grouped.insights.push(task);
    } else {
      grouped.needs_review.push(task);
    }
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Hero Banner */}
      <div className="bg-[#0c1328] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
           <Sparkles className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tight mb-3 flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-indigo-400" /> AI Accountant
            </h1>
            <p className="text-slate-300 max-w-2xl text-sm leading-relaxed mb-4">
              Your books are continuously monitored for anomalies, missing records, and reconciliation opportunities.
              <strong className="text-indigo-200 block mt-1.5 font-medium">Decisions record your review but do not automatically alter the books.</strong>
            </p>
            {summary?.last_run_at && (
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-4">
                Last Analysis: {new Date(summary.last_run_at).toLocaleString('en-GB')}
              </p>
            )}
          </div>
          <Button onClick={runCheck} disabled={running || !activeCompany?.id} data-testid="button-run-task-analysis" className="bg-indigo-600 hover:bg-indigo-500 text-white border-none shadow-lg shrink-0">
            <RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Analysing books...' : 'Run Full Analysis'}
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-8 relative z-10">
           <div className="bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10">
             <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
               <CheckCircle2 className="w-3 h-3" /> Ready to Approve
             </div>
             <div className="text-3xl font-black text-white">{summary?.ready_to_approve ?? grouped.ready_to_approve.length}</div>
           </div>
           <div className="bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10">
             <div className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
               <ClipboardCheck className="w-3 h-3" /> Needs Review
             </div>
             <div className="text-3xl font-black text-white">{summary?.needs_review ?? grouped.needs_review.length}</div>
           </div>
           <div className="bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10">
             <div className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
               <AlertTriangle className="w-3 h-3" /> Warnings
             </div>
             <div className="text-3xl font-black text-white">{summary?.warnings ?? grouped.warnings.length}</div>
           </div>
            <button type="button" onClick={() => setSearchParams({ task_type: 'missing_invoice' })} className="text-left bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-rose-300">
              <div className="text-rose-300 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Potential Missing Revenue
              </div>
              <div className="text-3xl font-black text-white">{gbp(summary?.potential_missing_revenue || 0)}</div>
              <div className="text-[9px] text-slate-400 mt-1">Review {summary?.invoice_review_count || 0} receipt{summary?.invoice_review_count === 1 ? '' : 's'}</div>
            </button>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10">
             <div className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
               <Lightbulb className="w-3 h-3" /> Amount at Risk
             </div>
             <div className="text-3xl font-black text-white">{gbp(summary?.total_amount_at_risk || 0)}</div>
           </div>
            <button type="button" onClick={() => nav('/collections')} className="text-left bg-white/5 border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300">
              <div className="text-amber-300 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Gavel className="w-3 h-3" /> Customer Collections
              </div>
              <div className="text-3xl font-black text-white">{collections?.summary?.high_priority_customer_count || 0}</div>
              <div className="text-[9px] text-slate-400 mt-1">{gbp(collections?.summary?.total_overdue || 0)} overdue · review priorities</div>
            </button>
        </div>
      </div>

       {/* Transaction decision queue — analysis is advisory until the user
           opens Reconciliation and explicitly approves a change. */}
       <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
           <div>
             <h2 className="text-sm font-black text-slate-900">Transaction review queue</h2>
             <p className="text-xs text-slate-500 mt-0.5">Prioritised deterministic decisions from your bank feed.</p>
           </div>
           <div className="flex gap-1.5 flex-wrap">
             {[['all', 'All'], ['READY', 'Ready'], ['POSSIBLE_DUPLICATE', 'Duplicates'], ['VAT_REVIEW', 'VAT'], ['NO_MATCH', 'No match']].map(([value, label]) => (
               <button key={value} type="button" onClick={() => setReviewFilter(value)}
                 className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${reviewFilter === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                 {label}
               </button>
             ))}
           </div>
         </div>
         <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-slate-100 border-b border-slate-100">
           {[
             ['Ready', transactionReview?.summary?.ready ?? 0],
             ['Needs review', transactionReview?.summary?.review ?? 0],
             ['High priority', transactionReview?.summary?.high_priority ?? 0],
             ['Duplicates', transactionReview?.summary?.duplicates ?? 0],
             ['VAT review', transactionReview?.summary?.vat_review ?? 0],
           ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div>)}
         </div>
         <div className="divide-y divide-slate-100">
           {(transactionReview?.items || []).filter(({ analysis }) => reviewFilter === 'all' || analysis.decision_state === reviewFilter).slice(0, 8).map(({ analysis, transaction }) => (
             <button key={analysis.id} type="button" onClick={() => nav(`/reconciliation?transaction_id=${encodeURIComponent(transaction.id)}`)}
               className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors">
               <span className={`h-2 w-2 shrink-0 rounded-full ${analysis.priority_band === 'high' ? 'bg-rose-500' : analysis.decision_state === 'READY' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
               <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{transaction.description || 'Untitled transaction'}</span><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{analysis.decision_state.replace(/_/g, ' ')}</span></span>
               <span className="shrink-0 text-xs font-bold tabular-nums text-slate-700">{gbp(Number(transaction.money_in || transaction.money_out || 0))}</span>
             </button>
           ))}
           {transactionReview && !(transactionReview.items || []).some(({ analysis }) => reviewFilter === 'all' || analysis.decision_state === reviewFilter) && (
             <p className="px-5 py-6 text-center text-xs text-slate-400">No transactions match this filter.</p>
           )}
         </div>
       </section>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Task Registers */}
      {loading ? (
        <div className="space-y-4 pt-4">
          <div className="h-10 w-48 bg-slate-100 rounded animate-pulse" />
          <div className="h-20 bg-slate-50 rounded-lg border border-slate-100 animate-pulse" />
          <div className="h-20 bg-slate-50 rounded-lg border border-slate-100 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-12">
          {taskTypeFilter && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
              <span>Showing tasks for <strong>{taskTypeFilter.replace(/_/g, ' ')}</strong>.</span>
              <button type="button" onClick={() => setSearchParams({})} className="text-xs font-bold text-indigo-700 hover:text-indigo-900">Clear filter</button>
            </div>
          )}
          <TaskSection
            title="Ready to Approve"
            icon={CheckCircle2}
            tasks={grouped.ready_to_approve}
            onDecide={handleDecide}
            decidingId={decidingId}
            emptyText="No high-confidence tasks waiting for approval."
          />
          <TaskSection
            title="Needs Review"
            icon={ClipboardCheck}
            tasks={grouped.needs_review}
            onDecide={handleDecide}
            decidingId={decidingId}
            emptyText="No tasks requiring manual review."
          />
          <TaskSection
            title="Warnings"
            icon={AlertTriangle}
            tasks={grouped.warnings}
            onDecide={handleDecide}
            decidingId={decidingId}
            emptyText="No active warnings or alerts."
          />
          <TaskSection
            title="Insights"
            icon={Lightbulb}
            tasks={grouped.insights}
            onDecide={handleDecide}
            decidingId={decidingId}
            emptyText="No new insights generated."
          />
        </div>
      )}

      {/* Legacy Links */}
      <div className="pt-12 pb-8 mt-12 flex flex-wrap gap-4 text-xs font-medium border-t border-slate-200">
        <span className="text-slate-400 uppercase tracking-wider font-bold mr-2 flex items-center">Legacy Views</span>
        <button onClick={() => nav('/ai-accountant/inbox')} className="text-slate-500 hover:text-indigo-600 transition-colors">Inbox</button>
        <span className="text-slate-300">•</span>
        <button onClick={() => nav('/ai-accountant/tasks')} className="text-slate-500 hover:text-indigo-600 transition-colors">All Tasks</button>
        <span className="text-slate-300">•</span>
        <button onClick={() => nav('/ai-accountant/reviews')} className="text-slate-500 hover:text-indigo-600 transition-colors">Review History</button>
        <span className="text-slate-300">•</span>
        <button onClick={() => nav('/ai-accountant/recommendations')} className="text-slate-500 hover:text-indigo-600 transition-colors">Recommendations</button>
      </div>
    </div>
  );
}
