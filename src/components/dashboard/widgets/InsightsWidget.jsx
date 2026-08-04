import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAsk } from '@/components/ask/AskProvider';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { Sparkles, ExternalLink, X } from 'lucide-react';

const SEV_DOT = {
  positive: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
};

export default function InsightsWidget({ company }) {
  const nav = useNavigate();
  const { openAsk } = useAsk();
  const [hidden, setHidden] = useState(new Set());
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.Insight.filter({ company_id: cid, is_dismissed: false }, '-generated_date', 12)
  );

  if (loading) return <ListSkeleton />;
  const items = (data || []).filter((i) => !hidden.has(i.id));

  if (!items.length)
    return (
      <EmptyState
        icon={Sparkles}
        title="No insights right now"
        description="Ledgerly analyses your books daily and surfaces trends, risks and opportunities here."
        askLabel="Ask about your business"
        onAsk={() => openAsk('How is my business performing?')}
      />
    );

  const dismiss = async (id) => {
    setHidden((s) => new Set(s).add(id));
    try {
      await base44.entities.Insight.update(id, { is_dismissed: true });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-2">
      {items.slice(0, 6).map((it) => (
        <div key={it.id} className="rounded-lg border border-border p-3">
          <div className="flex items-start gap-2">
            <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEV_DOT[it.severity] || 'bg-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">{it.title}</p>
              {it.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.description}</p>}
              <div className="flex items-center gap-3 mt-2">
                {it.link_route && (
                  <button onClick={() => nav(it.link_route)} className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    View Details
                  </button>
                )}
                <button
                  onClick={() => openAsk(`Why ${it.title.replace(/[.!?]$/, '')}?`)}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Ask Why
                </button>
                <button onClick={() => dismiss(it.id)} className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto">
                  <X className="w-3 h-3" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}