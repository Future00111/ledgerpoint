import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWidgetData } from '../useWidgetData';
import { Skeleton } from '../WidgetPrimitives';
import { Sparkles, ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';

const gbp = (n) => `£${Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export default function AiAccountantWidget({ company }) {
  const nav = useNavigate();
  const [analysing, setAnalysing] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    return api(`/api/ai/review-summary?company_id=${encodeURIComponent(cid)}`);
  }, [refreshKey]);

  const runAnalysis = async () => {
    setAnalysing(true);
    try {
      await api('/api/ai/reconciliation/analyse', {
        method: 'POST',
        body: JSON.stringify({ company_id: company.id }),
      });
      setRefreshKey((k) => k + 1);
    } catch { /* summary simply stays as-is */ }
    finally { setAnalysing(false); }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await api('/api/ai/insights', {
        method: 'POST',
        body: JSON.stringify({ company_id: company.id }),
      });
      setInsights(res.insights || []);
    } catch { setInsights([]); }
    finally { setInsightsLoading(false); }
  };

  if (loading) return <Skeleton className="h-40 w-full" />;
  const s = data || {};

  const SEVERITY = {
    warning: 'text-amber-600',
    positive: 'text-emerald-600',
    info: 'text-slate-600',
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Ready</p>
          <p className="text-sm font-semibold text-emerald-600">{s.ready_to_approve ?? 0}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Review</p>
          <p className="text-sm font-semibold text-amber-600">{s.needs_review ?? 0}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> No match</p>
          <p className="text-sm font-semibold text-red-600">{s.no_match ?? 0}</p>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        {s.missing_amount_total > 0 && (
          <p className="flex justify-between"><span className="text-muted-foreground">Unexplained amounts</span><span className="font-semibold text-amber-600">{gbp(s.missing_amount_total)}</span></p>
        )}
        <p className="flex justify-between"><span className="text-muted-foreground">Awaiting reconciliation</span><span className="font-semibold">{s.awaiting_review ?? 0}</span></p>
        {s.possible_duplicates > 0 && (
          <p className="flex justify-between"><span className="text-muted-foreground">Possible duplicates</span><span className="font-semibold text-amber-600">{s.possible_duplicates}</span></p>
        )}
        {s.overdue_invoices > 0 && (
          <p className="flex justify-between"><span className="text-muted-foreground">Overdue invoices</span><span className="font-semibold text-red-600">{s.overdue_invoices}</span></p>
        )}
      </div>

      {!s.analysed && (
        <p className="text-[11px] text-muted-foreground">No analysis yet — run the AI Accountant to review your bank activity.</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={runAnalysis}
          disabled={analysing}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-input hover:bg-muted/50 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analysing ? 'animate-spin' : ''}`} />
          {analysing ? 'Analysing…' : s.analysed ? 'Re-run analysis' : 'Run analysis'}
        </button>
        <button
          onClick={() => nav('/reconciliation')}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Review <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="pt-1 border-t border-border/60">
        {insights === null ? (
          <button
            onClick={loadInsights}
            disabled={insightsLoading}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors disabled:opacity-60"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {insightsLoading ? 'Thinking…' : 'Generate accountant insights'}
          </button>
        ) : insights.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-1.5">Insights unavailable right now.</p>
        ) : (
          <div className="space-y-2 pt-1.5">
            {insights.map((i, idx) => (
              <div key={idx} className="text-xs">
                <p className={`font-semibold flex items-center gap-1.5 ${SEVERITY[i.severity] || SEVERITY.info}`}>
                  <Sparkles className="w-3 h-3 flex-shrink-0" /> {i.title}
                </p>
                <p className="text-muted-foreground mt-0.5 pl-[18px]">{i.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
