import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, Plus, X, Sparkles, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Colour mapping for known tags. Red is reserved for risk/hold tags.
const TAG_COLORS = {
  'VIP': 'violet',
  'Fleet': 'blue',
  'Trade': 'cyan',
  'Cash Account': 'emerald',
  'High Risk': 'rose',
  'Credit Hold': 'rose',
  'Monthly Account': 'indigo',
  'Key Account': 'amber',
  'Warranty Customer': 'fuchsia',
  'Repeat Customer': 'emerald',
};

const COLOR_CLASSES = {
  violet: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100',
  slate: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
};

const PALETTE = ['violet', 'blue', 'cyan', 'emerald', 'indigo', 'amber', 'fuchsia', 'slate'];

const colorFor = (tag) => {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

// Customer Tags — smart (auto) tags shown read-only, plus searchable,
// colour-coded predefined tags the user can toggle, and editable custom tags.
export default function CustomerTagsCard({ smartTags = [], tags = [], predefined = [], onToggle, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const tagSet = new Set(tags);
  const custom = tags.filter((t) => !predefined.includes(t) && !smartTags.includes(t));
  const filtered = predefined.filter((t) => t.toLowerCase().includes(query.toLowerCase()));

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

        {smartTags.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Smart Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {smartTags.map((t) => (
                <span key={t} className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', COLOR_CLASSES[colorFor(t)] || COLOR_CLASSES.slate)}>
                  <Sparkles className="w-2.5 h-2.5" /> {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="relative mb-2.5">
          <Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tags…"
            className="w-full h-7 rounded-md border border-input bg-transparent pl-7 pr-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((t) => {
            const active = tagSet.has(t);
            const c = COLOR_CLASSES[colorFor(t)] || COLOR_CLASSES.slate;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggle?.(t)}
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active ? c : 'border-border bg-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                {t}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground">No matching tags.</p>}
        </div>

        {custom.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {custom.map((t) => (
              <span key={t} className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', COLOR_CLASSES[colorFor(t)] || COLOR_CLASSES.slate)}>
                {t}
                <button type="button" onClick={() => onRemove?.(t)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${t}`}>
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