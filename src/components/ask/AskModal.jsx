import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import {
  getNavigationMatches, getCreateMatches, getActionMatches, isQuestion, recordIcon,
} from './askIntents';
import { getRecent, pushRecent } from '@/components/layout/recentItems';
import { getRecentSearches, pushRecentSearch } from './askRecent';
import {
  Search, X, CornerDownLeft, Sparkles, Clock, Loader2, ArrowUp, ArrowDown, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EXAMPLES = [
  "Who owes me money?",
  'Create an invoice',
  "Show this month's profit",
  'Find British Gas',
  'Connect my bank',
  'Prepare my VAT return',
  'Why has profit reduced?',
];

const KIND_TITLES = {
  navigate: 'Navigate',
  create: 'Create',
  action: 'Actions',
  record: 'Records',
  ai: 'Ask',
};

export default function AskModal({ open, onClose }) {
  const { activeCompany, roles } = useCompany();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentViewed, setRecentViewed] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const role = activeCompany ? roles?.[activeCompany.id] : null;
  const isOwner = role === 'owner' || role === 'admin';

  // Reset + focus on open; load AI-enabled flag + recent activity.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setRecords([]);
    setAiAnswer(null);
    setSelected(0);
    setRecentSearches(getRecentSearches());
    setRecentViewed(getRecent());
    setTimeout(() => inputRef.current?.focus(), 60);
    if (activeCompany) {
      base44.entities.SuggestionSettings.filter({ company_id: activeCompany.id })
        .then((list) => setAiEnabled(list[0]?.ai_enabled !== false))
        .catch(() => setAiEnabled(true));
    }
  }, [open, activeCompany]);

  // Rotating example prompts (only while input empty).
  useEffect(() => {
    if (!open) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % EXAMPLES.length;
      if (!query) setPlaceholder(EXAMPLES[i]);
    }, 3500);
    return () => clearInterval(t);
  }, [open, query]);

  // Debounced record search.
  useEffect(() => {
    const q = query.trim();
    if (!open || !activeCompany || q.length < 2) {
      setRecords([]);
      setRecordsLoading(false);
      return;
    }
    let cancelled = false;
    setRecordsLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('globalSearch', { company_id: activeCompany.id, query: q });
        if (!cancelled) setRecords(res?.data?.groups || res?.groups || []);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setRecordsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, activeCompany]);

  const navMatches = useMemo(() => getNavigationMatches(query), [query]);
  const createMatches = useMemo(() => getCreateMatches(query, isOwner), [query, isOwner]);
  const actionMatches = useMemo(() => getActionMatches(query), [query]);

  const recordItems = useMemo(
    () =>
      records.flatMap((g) =>
        g.items.map((it) => ({
          type: 'record',
          kind: 'record',
          label: it.label,
          sublabel: g.label + (it.sublabel ? ' · ' + it.sublabel : ''),
          path: it.route,
          icon: recordIcon(g.label),
        }))
      ),
    [records]
  );

  const emptyQuery = query.trim() === '';
  const showAI =
    !emptyQuery &&
    (isQuestion(query) ||
      (navMatches.length === 0 && createMatches.length === 0 && actionMatches.length === 0 && recordItems.length === 0));

  const aiItem = useMemo(() => {
    if (!showAI) return [];
    if (!aiEnabled) {
      return [{
        type: 'ai', kind: 'ai', disabled: true,
        label: 'AI has not been enabled for this company',
        sublabel: 'Ask', icon: Sparkles, query,
      }];
    }
    return [{
      type: 'ai', kind: 'ai',
      label: `Ask: ${query.trim()}`, sublabel: 'Ask', icon: Sparkles, query: query.trim(),
    }];
  }, [showAI, aiEnabled, query]);

  const flatItems = useMemo(() => {
    if (emptyQuery) {
      return recentViewed.map((r) => ({
        type: 'recent', kind: 'record', label: r.label, sublabel: 'Recently viewed', path: r.path, icon: Clock,
      }));
    }
    return [...navMatches, ...createMatches, ...actionMatches, ...recordItems, ...aiItem];
  }, [emptyQuery, recentViewed, navMatches, createMatches, actionMatches, recordItems, aiItem]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Keep selected row visible while navigating with keys.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const runAI = async (q) => {
    if (!aiEnabled || !activeCompany) return;
    pushRecentSearch(q);
    setRecentSearches(getRecentSearches());
    setAiAnswer({ loading: true });
    try {
      const res = await base44.functions.invoke('askAI', { company_id: activeCompany.id, question: q });
      setAiAnswer({ text: res?.data?.answer || res?.answer || 'No answer returned.' });
    } catch (e) {
      setAiAnswer({ error: e.message || 'Something went wrong.' });
    }
  };

  const activate = (item) => {
    if (!item || item.disabled) return;
    if (item.kind === 'ai') {
      runAI(item.query);
      return;
    }
    if (query.trim()) pushRecentSearch(query.trim());
    pushRecent({ label: item.label, path: item.path });
    onClose();
    navigate(item.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(flatItems.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(flatItems[selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (aiAnswer) setAiAnswer(null);
      else onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(flatItems.length - 1, 0)));
    }
  };

  if (!open) return null;

  // Build sections with headers, tracking global index across flatItems.
  const rendered = [];
  let lastKind = null;
  flatItems.forEach((item, idx) => {
    if (item.kind !== lastKind) {
      rendered.push(
        <div key={`h-${item.kind}-${idx}`} className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {KIND_TITLES[item.kind]}
        </div>
      );
      lastKind = item.kind;
    }
    rendered.push(
      <button
        key={`i-${idx}`}
        data-idx={idx}
        onClick={() => activate(item)}
        onMouseEnter={() => setSelected(idx)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors outline-none',
          idx === selected ? 'bg-primary/10' : 'hover:bg-muted',
          item.disabled && 'opacity-60'
        )}
      >
        <span className={cn('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', item.kind === 'ai' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
          {item.kind === 'ai' && aiAnswer?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <item.icon className="w-4 h-4" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-foreground truncate">{item.label}</span>
          {item.sublabel && <span className="block text-xs text-muted-foreground truncate">{item.sublabel}</span>}
        </span>
        {idx === selected && !item.disabled && (
          <CornerDownLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
    );
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-0 sm:p-[8vh] sm:px-6 bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Ask"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[80vh] sm:max-w-2xl bg-white sm:rounded-2xl rounded-none shadow-2xl flex flex-col overflow-hidden">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border flex-shrink-0">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAiAnswer(null); }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            aria-label="Ask anything"
          />
          <kbd className="hidden sm:inline-flex items-center text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
          <button onClick={onClose} className="sm:hidden p-1.5 hover:bg-muted rounded-md" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={listRef} className="flex-1 overflow-y-auto pb-2">
          {/* AI answer panel */}
          {aiAnswer ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
                <p className="text-sm font-medium">{aiAnswer.loading ? 'Thinking…' : 'Answer'}</p>
                <button
                  onClick={() => setAiAnswer(null)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Back
                </button>
              </div>
              {aiAnswer.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading your books…
                </div>
              ) : aiAnswer.error ? (
                <p className="text-sm text-destructive">{aiAnswer.error}</p>
              ) : (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiAnswer.text}</p>
              )}
            </div>
          ) : emptyQuery ? (
            <div className="p-3">
              {recentSearches.length > 0 && (
                <>
                  <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent searches</p>
                  <div className="flex flex-wrap gap-2 px-1 pb-3">
                    {recentSearches.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(s)}
                        className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {recentViewed.length > 0 ? (
                rendered
              ) : (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">Type to navigate, search, create, or ask.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try “open reports”, “create invoice”, or “why has profit dropped?”</p>
                </div>
              )}
            </div>
          ) : flatItems.length === 0 && !recordsLoading ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">No matches yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Press Enter to ask AI about “{query.trim()}”.</p>
            </div>
          ) : (
            <>
              {rendered}
              {recordsLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching records…
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex-shrink-0">
          <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> Navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> Select</span>
          <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1">Esc</kbd> Close</span>
          <span className="ml-auto">Ask</span>
        </div>
      </div>
    </div>
  );
}