import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Customer Tags — predefined toggleable tags plus free-text custom tags.
// Persistence is handled by the parent via onToggle / onAdd / onRemove.
export default function CustomerTagsCard({ tags = [], predefined = [], onToggle, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');
  const tagSet = new Set(tags);
  const custom = tags.filter((t) => !predefined.includes(t));

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd?.(v);
    setDraft('');
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <Tag className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Customer Tags</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {predefined.map((t) => {
            const active = tagSet.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggle?.(t)}
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
        {custom.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {custom.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium">
                {t}
                <button type="button" onClick={() => onRemove?.(t)} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${t}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            placeholder="Add custom tag…"
            className="flex-1 h-8 rounded-md border border-input bg-transparent px-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button type="button" onClick={submit} className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input hover:bg-muted/50" aria-label="Add tag">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}