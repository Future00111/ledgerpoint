import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Loader2, Search, X } from 'lucide-react';
import WorkspaceHeader from './WorkspaceHeader';
import SummaryStat from './SummaryStat';
import WorkspaceSkeleton from './WorkspaceSkeleton';
import { useWorkspaceAsk } from './useWorkspaceAsk';

// The shared Workspace shell.
// Sticky header → scrollable body. When a `contextPanel` is supplied the body
// becomes a permanent two-column layout: a 70/30 (desktop) / 60/40 (tablet)
// split with the left working area (primary actions · executive summary · KPIs
// · tabs) and a sticky right context panel (cards + Ask). On mobile it
// collapses to a single column in DOM order. Without a context panel the
// shell renders a single column with Ask at the bottom (legacy mode).
const HIGHLIGHT_TAB = { overdue: 'invoices', invoices: 'invoices', payments: 'payments', credit: 'overview', revenue: 'ai-insights', documents: 'documents', activity: 'activity', notes: 'notes' };
const HIGHLIGHT_LABEL = { overdue: 'showing overdue invoices', invoices: 'showing invoices', payments: 'showing payments', credit: 'showing credit information', revenue: 'showing revenue analysis', documents: 'showing documents', activity: 'showing activity' };

export default function WorkspaceShell({ open, onOpenChange, header, summaryStats = [], tabs = [], ask, loading, contextPanel, executiveSummary, primaryActions, arrival, layout = 'tabs', leftCards, rightCards }) {
  const askRef = useRef(null);
  const { answer, loading: askLoading, run } = useWorkspaceAsk();
  const [q, setQ] = useState('');
  const [activeTab, setActiveTab] = useState(arrival?.highlight ? (HIGHLIGHT_TAB[arrival.highlight] || tabs[0]?.value) : tabs[0]?.value);
  const [arrivalDismissed, setArrivalDismissed] = useState(false);
  useEffect(() => { setArrivalDismissed(false); }, [arrival]);

  const focusAsk = () => {
    const el = document.getElementById('workspace-ask-input');
    if (el) el.focus(); else askRef.current?.focus();
  };
  const submitAsk = (question) => {
    const query = (question ?? q).trim();
    if (!query || askLoading) return;
    if (question) setQ(question);
    run({ companyId: ask?.companyId, question: query, context: ask?.context });
  };

  const tabsEl = tabs.length > 0 ? (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto h-auto gap-1 bg-transparent p-0 flex-nowrap">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="shrink-0 gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm hover:bg-muted">
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-3">{t.content}</TabsContent>
      ))}
    </Tabs>
  ) : null;

  const askEl = ask && (
    <div className="rounded-xl border border-border p-3 bg-muted/30">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 inline-flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" /> Ask Ledgerly
      </p>
      {answer && (
        <div className="mb-2 text-sm whitespace-pre-wrap">
          <p>{answer}</p>
        </div>
      )}
      {askLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
        </div>
      )}
      {ask.suggestions?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ask.suggestions.map((sug, i) => (
            <button key={i} type="button" onClick={() => submitAsk(sug)} className="text-xs rounded-full border border-border bg-card px-2.5 py-1 hover:border-primary/40 hover:bg-primary/5 transition-colors">{sug}</button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input id="workspace-ask-input" ref={askRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitAsk(); }} placeholder={ask.placeholder} className="bg-card" />
        <Button size="icon" disabled={!q.trim() || askLoading} onClick={() => submitAsk()} aria-label="Ask"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );

  const leftCol = (
    <>
      {primaryActions && <div>{primaryActions}</div>}
      {executiveSummary && <div>{executiveSummary}</div>}
      {summaryStats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryStats.map((s, i) => (
            <SummaryStat key={i} label={s.label} value={s.value} tone={s.tone} helper={s.helper} loading={loading} onClick={s.tab ? () => setActiveTab(s.tab) : s.onClick} />
          ))}
        </div>
      )}
      {tabsEl}
    </>
  );

  const columnsBody = (
    <div className="grid md:grid-cols-[3fr_2fr] lg:grid-cols-[7fr_3fr] gap-4 items-start">
      <div className="min-w-0 space-y-4">{leftCards}</div>
      <aside className="space-y-4 lg:sticky lg:top-1 self-start min-w-0 lg:max-h-[calc(92vh-4rem)] lg:overflow-y-auto pr-0.5">
        {rightCards}
        {askEl}
      </aside>
    </div>
  );

  const bodyEl = layout === 'columns' ? columnsBody : contextPanel ? (
    <div className="grid md:grid-cols-[3fr_2fr] lg:grid-cols-[7fr_3fr] gap-3 items-start">
      <div className="min-w-0 space-y-3">{leftCol}</div>
      <aside className="space-y-3 lg:sticky lg:top-1 self-start min-w-0 lg:max-h-[calc(92vh-4rem)] lg:overflow-y-auto pr-0.5">
        {contextPanel}
        {askEl}
      </aside>
    </div>
  ) : (
    <div className="space-y-3">
      {leftCol}
      {askEl}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden p-0">
        <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm border-b border-border px-5 pt-5 pb-3">
          <WorkspaceHeader {...(header || {})} onAskClick={focusAsk} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {arrival && !arrivalDismissed && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 mb-3">
              <span className="text-xs text-primary inline-flex items-center gap-1.5 min-w-0">
                <Search className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {arrival.source === 'ask' ? 'Arrived via Ask' : 'Search result'}{arrival.query ? ` — "${arrival.query}"` : ''}{arrival.highlight ? ` · ${HIGHLIGHT_LABEL[arrival.highlight] || arrival.highlight}` : ''}
                </span>
              </span>
              <button onClick={() => setArrivalDismissed(true)} className="text-muted-foreground hover:text-foreground flex-shrink-0" aria-label="Dismiss highlight">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {loading ? (
            <div className="space-y-3">
              <div className="h-20 rounded-xl border border-border bg-muted/30 animate-pulse" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl border border-border bg-muted animate-pulse" />
                ))}
              </div>
              <WorkspaceSkeleton lines={6} />
            </div>
          ) : (
            bodyEl
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}