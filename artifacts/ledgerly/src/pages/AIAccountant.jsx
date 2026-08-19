import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import {
  Sparkles, RefreshCw, ArrowRight, Inbox, ListChecks, Lightbulb,
  ClipboardCheck, AlertTriangle, CheckCircle2, History, Scale,
} from 'lucide-react';
import { aiApi, gbp, DOMAIN_LABELS } from '@/components/ai-accountant/api';

const fmtWhen = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

function MetricCard({ icon: Icon, label, value, tone = 'text-slate-900', onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-[#007bff]/40 hover:shadow-sm transition-all"
      data-testid={testId}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className={`text-2xl font-black tabular-nums mt-1.5 ${tone}`}>{value}</p>
      <p className="text-[11px] text-[#007bff] font-semibold mt-1 flex items-center gap-1">
        View <ArrowRight className="w-3 h-3" />
      </p>
    </button>
  );
}

/** AI Accountant — proactive workspace overview. */
export default function AIAccountant() {
  const nav = useNavigate();
  const { activeCompany } = useCompany();
  const [summary, setSummary] = useState(null);
  const [review, setReview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      const [s, r, a] = await Promise.all([
        aiApi.summary(activeCompany.id),
        aiApi.reviewSummary(activeCompany.id),
        aiApi.activity(activeCompany.id),
      ]);
      setSummary(s); setReview(r); setActivity(a.activity || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [activeCompany?.id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const runCheck = async () => {
    if (!activeCompany?.id) return;
    setRunning(true); setError(null);
    try {
      await aiApi.analyse(activeCompany.id).catch(() => {}); // refresh reconciliation analysis first (best-effort)
      await aiApi.refresh(activeCompany.id);
      await load();
    } catch (e) { setError(e.message); }
    finally { setRunning(false); }
  };

  const s = summary || {};
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#007bff]" /> AI Accountant
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Proactively checks your books and flags issues — every change still needs your explicit approval.
          </p>
          {s.last_run_at && (
            <p className="text-[11px] text-slate-400 mt-1">Last check: {fmtWhen(s.last_run_at)}</p>
          )}
        </div>
        <Button onClick={runCheck} disabled={running || !activeCompany?.id} data-testid="button-run-check">
          <RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Checking the books…' : 'Check my books'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={Inbox} label="Open findings" value={s.open ?? 0}
              tone={s.open > 0 ? 'text-slate-900' : 'text-emerald-600'}
              onClick={() => nav('/ai-accountant/inbox')} testId="card-open-findings" />
            <MetricCard icon={AlertTriangle} label="High priority" value={s.high_priority ?? 0}
              tone={s.high_priority > 0 ? 'text-red-600' : 'text-emerald-600'}
              onClick={() => nav('/ai-accountant/inbox')} testId="card-high-priority" />
            <MetricCard icon={Scale} label="Awaiting reconciliation" value={review?.awaiting_review ?? 0}
              onClick={() => nav('/reconciliation')} testId="card-awaiting-recon" />
            <MetricCard icon={Sparkles} label="At-risk amount" value={gbp(s.total_amount_at_risk)}
              tone={s.total_amount_at_risk > 0 ? 'text-amber-600' : 'text-emerald-600'}
              onClick={() => nav('/ai-accountant/tasks')} testId="card-at-risk" />
          </div>

          {s.by_domain && Object.keys(s.by_domain).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Open findings by area</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(s.by_domain).map(([domain, count]) => (
                  <button key={domain} type="button" onClick={() => nav('/ai-accountant/tasks')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#007bff]/40">
                    {DOMAIN_LABELS[domain] || domain}
                    <span className="bg-slate-100 rounded-full px-1.5 text-[10px] font-black">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Inbox, label: 'Inbox', desc: 'Prioritised findings', path: '/ai-accountant/inbox' },
              { icon: ListChecks, label: 'Tasks', desc: 'By accounting area', path: '/ai-accountant/tasks' },
              { icon: ClipboardCheck, label: 'Reviews', desc: 'Decision history', path: '/ai-accountant/reviews' },
              { icon: Lightbulb, label: 'Recommendations', desc: 'All suggestions', path: '/ai-accountant/recommendations' },
            ].map((l) => (
              <button key={l.path} type="button" onClick={() => nav(l.path)}
                className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-[#007bff]/40 hover:shadow-sm transition-all"
                data-testid={`link-${l.label.toLowerCase()}`}>
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <l.icon className="w-4 h-4 text-[#007bff]" /> {l.label}
                </p>
                <p className="text-xs text-slate-500 mt-1">{l.desc}</p>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <p className="px-4 pt-4 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> AI activity
            </p>
            {activity.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">
                No AI activity yet — run "Check my books" to get started.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 mt-2">
                {activity.slice(0, 10).map((a) => (
                  <li key={a.id} className="px-4 py-2.5 flex items-start gap-2.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#007bff] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700">{a.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtWhen(a.event_date)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
