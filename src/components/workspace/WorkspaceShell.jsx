import React, { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import WorkspaceHeader from './WorkspaceHeader';
import SummaryStat from './SummaryStat';
import WorkspaceSkeleton from './WorkspaceSkeleton';
import { useWorkspaceAsk } from './useWorkspaceAsk';

// The shared Workspace shell.
// Sticky header (stays visible while scrolling) → scrollable body. While data
// loads, a skeleton matching the final layout is shown (never blank). Body:
// executive summary → key metric cards → tabbed content (full-width, or with a
// right context panel when provided) → Ask bar. Summary cards that carry a
// `tab` value switch the active tab when clicked. Ask accepts suggested
// questions that run immediately when tapped.
export default function WorkspaceShell({ open, onOpenChange, header, summaryStats = [], tabs = [], ask, loading, contextPanel, executiveSummary }) {
  const askRef = useRef(null);
  const { answer, loading: askLoading, run } = useWorkspaceAsk();
  const [q, setQ] = useState('');
  const [activeTab, setActiveTab] = useState(tabs[0]?.value);

  const focusAsk = () => askRef.current?.focus();
  const submitAsk = (question) => {
    const query = (question ?? q).trim();
    if (!query || askLoading) return;
    if (question) setQ(question);
    run({ companyId: ask?.companyId, question: query, context: ask?.context });
  };

  const tabsEl = tabs.length > 0 ? (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">{t.content}</TabsContent>
      ))}
    </Tabs>
  ) : null;

  const bodyEl = contextPanel ? (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
      <div className="min-w-0">{tabsEl}</div>
      <aside className="space-y-4 lg:sticky lg:top-0 self-start min-w-0">{contextPanel}</aside>
    </div>
  ) : (
    <div>{tabsEl}</div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden p-0">
        <div className="flex-shrink-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 pt-6 pb-3">
          <WorkspaceHeader {...(header || {})} onAskClick={focusAsk} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="h-24 rounded-xl border border-border bg-muted/30 animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl border border-border bg-muted animate-pulse" />
                ))}
              </div>
              <WorkspaceSkeleton lines={6} />
            </div>
          ) : (
            <>
              {executiveSummary && <div>{executiveSummary}</div>}

              {summaryStats.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {summaryStats.map((s, i) => (
                    <SummaryStat
                      key={i}
                      label={s.label}
                      value={s.value}
                      tone={s.tone}
                      helper={s.helper}
                      loading={loading}
                      onClick={s.tab ? () => setActiveTab(s.tab) : s.onClick}
                    />
                  ))}
                </div>
              )}

              {bodyEl}
            </>
          )}

          {ask && (
            <div className="rounded-xl border border-border p-3 bg-muted/30">
              {answer && (
                <div className="mb-2 text-sm whitespace-pre-wrap">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mb-1">
                    <Sparkles className="w-3 h-3" /> Ask
                  </span>
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
                    <button
                      key={i}
                      type="button"
                      onClick={() => submitAsk(sug)}
                      className="text-xs rounded-full border border-border bg-card px-2.5 py-1 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  id="workspace-ask-input"
                  ref={askRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitAsk(); }}
                  placeholder={ask.placeholder}
                  className="bg-card"
                />
                <Button size="icon" disabled={!q.trim() || askLoading} onClick={() => submitAsk()} aria-label="Ask">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}