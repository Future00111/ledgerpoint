import React, { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import WorkspaceHeader from './WorkspaceHeader';
import SummaryStat from './SummaryStat';
import { useWorkspaceAsk } from './useWorkspaceAsk';

// The reusable Workspace container. Every Workspace is assembled from:
//   1. A header (name · status · key info · quick actions · Ask · favourite · more)
//   2. A row of summary stat tiles
//   3. Tabbed content (each tab composes reusable Workspace cards)
//   4. A persistent contextual Ask bar that inherits the record's context
//
// Props:
//   open, onOpenChange        – dialog visibility
//   header                    – object passed straight to <WorkspaceHeader/>
//   summaryStats[]            – { label, value, tone, hint }
//   tabs[]                    – { value, label, content }
//   loading                   – drives stat skeleton values
//   ask                       – { placeholder, context, companyId }
export default function WorkspaceShell({ open, onOpenChange, header, summaryStats = [], tabs = [], ask, loading }) {
  const askRef = useRef(null);
  const { answer, loading: askLoading, run } = useWorkspaceAsk();
  const [q, setQ] = useState('');

  const focusAsk = () => askRef.current?.focus();
  const submitAsk = () => {
    if (!q.trim() || askLoading) return;
    run({ companyId: ask?.companyId, question: q.trim(), context: ask?.context });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        <WorkspaceHeader {...(header || {})} onAskClick={focusAsk} />

        {summaryStats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryStats.map((s, i) => (
              <SummaryStat key={i} {...s} loading={loading} />
            ))}
          </div>
        )}

        {tabs.length > 0 && (
          <Tabs defaultValue={tabs[0].value} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-4">{t.content}</TabsContent>
            ))}
          </Tabs>
        )}

        {ask && (
          <div className="mt-2 rounded-xl border border-border p-3 bg-muted/30">
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
            <div className="flex items-center gap-2">
              <Input
                ref={askRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitAsk(); }}
                placeholder={ask.placeholder}
                className="bg-card"
              />
              <Button size="icon" disabled={!q.trim() || askLoading} onClick={submitAsk} aria-label="Ask">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}