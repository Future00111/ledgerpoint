import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { findActiveItem } from '@/components/layout/navConfig';
import {
  getNavigationMatches, getCreateMatches, getActionMatches, isQuestion, recordIcon,
} from './askIntents';
import { getRecent, pushRecent } from '@/components/layout/recentItems';
import { getRecentSearches, pushRecentSearch } from './askRecent';
import {
  Search, X, CornerDownLeft, Sparkles, Clock, Loader2, ArrowUp, ArrowDown, RotateCcw,
  FileText, Receipt, Users, Truck, FolderOpen, ArrowLeftRight, Percent, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const EXAMPLES = [
  'Ask anything...',
  'Create an invoice',
  'Find British Gas',
  'Show unpaid customers',
  'Why has profit dropped?',
  'Prepare my VAT return',
];

const KIND_TITLES = {
  suggestion: 'Suggested',
  navigate: 'Navigate',
  create: 'Create',
  action: 'Actions',
  record: 'Records',
  recent: 'Recently viewed',
  ai: 'Ask',
};

const QUICK_ACTIONS = [
  { label: 'New Invoice', path: '/invoices/new', icon: FileText },
  { label: 'New Bill', path: '/bills/new', icon: Receipt },
  { label: 'New Customer', path: '/customers', icon: Users },
  { label: 'New Supplier', path: '/suppliers', icon: Truck },
  { label: 'Upload Document', path: '/documents', icon: FolderOpen },
  { label: 'Import Bank CSV', path: '/transactions', icon: ArrowLeftRight },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function nextVatDeadlineDays(freq) {
  const now = new Date();
  const y = now.getFullYear();
  if (freq === 'monthly') {
    const d = new Date(y, now.getMonth() + 1, 7);
    if (d < now) d.setFullYear(y + 1);
    return Math.ceil((d - now) / 86400000);
  }
  // quarterly: 1 month + 7 days after quarter end (Mar/Jun/Sep/Dec)
  const candidates = [
    new Date(y, 1, 7), // 31 Dec period → 7 Feb
    new Date(y, 4, 7), // 31 Mar → 7 May
    new Date(y, 7, 7), // 30 Jun → 7 Aug
    new Date(y, 10, 7), // 30 Sep → 7 Nov
    new Date(y + 1, 1, 7), // 31 Dec → 7 Feb next year
  ].filter((d) => d >= now);
  if (!candidates.length) return null;
  return Math.ceil((candidates[0] - now) / 86400000);
}

const CONTEXT_ENTITIES = {
  '/invoices': { entity: 'SalesInvoice', label: 'sales invoice' },
  '/bills': { entity: 'PurchaseBill', label: 'purchase bill' },
  '/sales-credit-notes': { entity: 'SalesCreditNote', label: 'sales credit note' },
  '/supplier-credit-notes': { entity: 'SupplierCreditNote', label: 'supplier credit note' },
  '/vat': { entity: 'VATReturn', label: 'VAT return' },
};

export default function AskModal({ open, onClose }) {
  const { activeCompany, roles } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentViewed, setRecentViewed] = useState([]);
  const [userName, setUserName] = useState('');
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [pageContext, setPageContext] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const role = activeCompany ? roles?.[activeCompany.id] : null;
  const isOwner = role === 'owner' || role === 'admin';

  // Reset + focus + load welcome data on open.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setRecords([]);
    setAiAnswer(null);
    setSelected(0);
    setRecentSearches(getRecentSearches());
    setRecentViewed(getRecent());
    setPageContext(null);
    setTimeout(() => inputRef.current?.focus(), 60);

    base44.auth.me().then((u) => setUserName(u?.full_name || '')).catch(() => setUserName(''));

    if (activeCompany) {
      base44.entities.SuggestionSettings.filter({ company_id: activeCompany.id })
        .then((list) => setAiEnabled(list[0]?.ai_enabled !== false))
        .catch(() => setAiEnabled(true));

      (async () => {
        try {
          const [inv, bills, txns, docs] = await Promise.all([
            base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }, '-issue_date', 300),
            base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }, '-bill_date', 300),
            base44.entities.BankTransaction.filter({ company_id: activeCompany.id }, '-date', 300),
            base44.entities.Document.filter({ company_id: activeCompany.id }),
          ]);
          const overdue = inv.filter(
            (i) => i.status === 'overdue' || (Number(i.balance_due) > 0 && i.due_date && i.due_date < todayStr())
          ).length;
          const awaiting = bills.filter((b) => b.status === 'awaiting_review' || b.status === 'draft').length;
          const review = txns.filter((t) => t.status === 'review').length;
          const pendingDocs = docs.filter((d) => d.status === 'pending_review').length;
          const vatDays = nextVatDeadlineDays(activeCompany.vat_frequency);
          const s = [];
          if (review > 0) s.push({ label: `Review ${review} bank transaction${review > 1 ? 's' : ''}`, path: '/transactions', icon: ArrowLeftRight });
          if (awaiting > 0) s.push({ label: `Approve ${awaiting} supplier bill${awaiting > 1 ? 's' : ''}`, path: '/bills', icon: Receipt });
          if (vatDays != null && vatDays <= 60) s.push({ label: `VAT return due in ${vatDays} day${vatDays > 1 ? 's' : ''}`, path: '/vat', icon: Percent });
          if (overdue > 0) s.push({ label: `Chase ${overdue} overdue invoice${overdue > 1 ? 's' : ''}`, path: '/invoices', icon: FileText });
          if (pendingDocs > 0) s.push({ label: `Review ${pendingDocs} uploaded document${pendingDocs > 1 ? 's' : ''}`, path: '/documents', icon: FolderOpen });
          s.push({ label: "View this month's profit", path: '/reports', icon: BarChart3 });
          s.push({ label: 'Create an invoice', path: '/invoices/new', icon: FileText });
          setSmartSuggestions(s);
        } catch {
          setSmartSuggestions([
            { label: "View this month's profit", path: '/reports', icon: BarChart3 },
            { label: 'Create an invoice', path: '/invoices/new', icon: FileText },
          ]);
        }
      })();

      // Remember context: derive what the user is viewing.
      (async () => {
        const item = findActiveItem(location.pathname);
        if (!item) return;
        const rest = location.pathname.slice(item.path.length).replace(/^\//, '');
        const cfg = CONTEXT_ENTITIES[item.path];
        if (rest && cfg) {
          try {
            const r = await base44.entities[cfg.entity].get(rest);
            let desc = `The user is currently viewing ${cfg.label} ${r.invoice_number || r.bill_number || r.credit_note_number || r.reference || rest}`;
            if (r.customer_name) desc += ` for ${r.customer_name}`;
            if (r.supplier_name) desc += ` from ${r.supplier_name}`;
            if (r.total != null) desc += ` totalling £${Number(r.total).toFixed(2)}`;
            if (r.status) desc += ` (status: ${r.status})`;
            setPageContext(desc + '.');
            return;
          } catch {
            /* fall through */
          }
        }
        setPageContext(`The user is currently on the ${item.label} page (${item.sectionLabel}).`);
      })();
    }
  }, [open, activeCompany, location.pathname]);

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

  const suggestionItems = useMemo(
    () => smartSuggestions.map((s) => ({ type: 'suggestion', kind: 'suggestion', label: s.label, sublabel: 'Suggested', path: s.path, icon: s.icon })),
    [smartSuggestions]
  );
  const recentItems = useMemo(
    () => recentViewed.map((r) => ({ type: 'recent', kind: 'recent', label: r.label, sublabel: 'Recently viewed', path: r.path, icon: Clock })),
    [recentViewed]
  );

  const flatItems = useMemo(() => {
    if (emptyQuery) return [...suggestionItems, ...recentItems];
    return [...navMatches, ...createMatches, ...actionMatches, ...recordItems, ...aiItem];
  }, [emptyQuery, suggestionItems, recentItems, navMatches, createMatches, actionMatches, recordItems, aiItem]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

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
      const res = await base44.functions.invoke('askAI', {
        company_id: activeCompany.id,
        question: q,
        context: pageContext,
      });
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

  const goQuick = (path) => {
    onClose();
    navigate(path);
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

  // Build sections with headers across flatItems.
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
        {idx === selected && !item.disabled && <CornerDownLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
    );
  });

  const showWelcome = emptyQuery;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-0 sm:p-[8vh] sm:px-6 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Ask"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[80vh] sm:max-w-2xl bg-white sm:rounded-2xl rounded-none shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
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
          {aiAnswer ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </span>
                <p className="text-sm font-medium">{aiAnswer.loading ? 'Thinking…' : 'Answer'}</p>
                <button onClick={() => setAiAnswer(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
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
          ) : showWelcome ? (
            <div className="p-4">
              <p className="text-lg font-semibold">{greeting()}, {userName || 'there'}.</p>
              <p className="text-sm text-muted-foreground mb-4">What would you like to do today?</p>
              {recentSearches.length > 0 && (
                <div className="mb-3">
                  <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent searches</p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((s, i) => (
                      <button key={i} onClick={() => setQuery(s)} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {rendered}
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

        {/* Quick actions footer */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border overflow-x-auto flex-shrink-0">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => goQuick(a.path)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-xs font-medium whitespace-nowrap transition-colors"
            >
              <a.icon className="w-3.5 h-3.5 text-muted-foreground" />
              {a.label}
            </button>
          ))}
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