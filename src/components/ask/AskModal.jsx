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
import AskInput from './AskInput';
import AskWelcome from './AskWelcome';
import AskAnswer from './AskAnswer';
import AskRecordsEmpty from './AskRecordsEmpty';
import AskResultCard from './AskResultCard';
import { searchCatalog, rankGroups, shouldEscalateToAI } from './askEngine';
import { trackSelection, togglePin, isPinned } from './askLearning';
import {
  Search, X, CornerDownLeft, Sparkles, Clock, Loader2, FileText, Receipt, Users,
  Truck, FolderOpen, ArrowLeftRight, Percent, BarChart3,
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

const GROUP_LIST_ROUTES = {
  Customers: '/customers',
  Suppliers: '/suppliers',
  Companies: '/companies',
  Invoices: '/invoices',
  Bills: '/bills',
  'Credit Notes': '/sales-credit-notes',
  'Supplier Credit Notes': '/supplier-credit-notes',
  'Bank Transactions': '/transactions',
  Documents: '/documents',
  Reports: '/reports',
  'Ledger Accounts': '/chart-of-accounts',
  'VAT Returns': '/vat',
  'Journal Entries': '/general-ledger',
  'Dashboard Widgets': '/',
  Settings: '/settings',
  'Help Articles': '/settings',
  'Future Modules': '/settings',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function nextVatDeadlineDays(freq) {
  const now = new Date();
  const y = now.getFullYear();
  if (freq === 'monthly') {
    const d = new Date(y, now.getMonth() + 1, 7);
    if (d < now) d.setFullYear(y + 1);
    return Math.ceil((d - now) / 86400000);
  }
  const candidates = [
    new Date(y, 1, 7),
    new Date(y, 4, 7),
    new Date(y, 7, 7),
    new Date(y, 10, 7),
    new Date(y + 1, 1, 7),
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

export default function AskModal({ open, onClose, initialQuery }) {
  const { activeCompany, roles } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [records, setRecords] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [pinTick, setPinTick] = useState(0);
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

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery || '');
    setRecords([]);
    setSimilar([]);
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

  useEffect(() => {
    if (!open) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % EXAMPLES.length;
      if (!query) setPlaceholder(EXAMPLES[i]);
    }, 3500);
    return () => clearInterval(t);
  }, [open, query]);

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
        const res = await Promise.race([
          base44.functions.invoke('globalSearch', { company_id: activeCompany.id, query: q }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 7000)),
        ]);
        if (!cancelled) {
          const groups = res?.data?.groups || res?.groups || [];
          setRecords(groups);
          setSimilar(res?.data?.similar || res?.similar || []);
          if (import.meta.env?.DEV) {
            const total = groups.reduce((n, g) => n + (g.items?.length || 0), 0);
            console.debug('[Ask] globalSearch "%s" -> %d group(s), %d result(s)', q, groups.length, total);
            groups.forEach((g) => console.debug('[Ask]   %s: %d', g.label, g.items?.length || 0));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setRecords([]);
          setSimilar([]);
          if (import.meta.env?.DEV) console.debug('[Ask] globalSearch failed: %s', e?.message || e);
        }
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

  const catalogGroups = useMemo(() => searchCatalog(query), [query]);
  const rankedGroups = useMemo(
    () => rankGroups(records, catalogGroups),
    [records, catalogGroups, pinTick]
  );
  const recordItems = useMemo(
    () =>
      rankedGroups.flatMap((g) =>
        g.items.map((it) => ({
          type: 'record',
          kind: 'record',
          label: it.label,
          sublabel: g.label + (it.sublabel ? ' · ' + it.sublabel : ''),
          path: it.route,
          icon: recordIcon(g.label),
          group: g.label,
          raw: it,
        }))
      ),
    [rankedGroups]
  );

  const q = query.trim();
  const emptyQuery = q === '';
  const hasResults = !!(navMatches.length || createMatches.length || actionMatches.length || recordItems.length);
  const noResults = !hasResults && catalogGroups.length === 0;

  // Ask Engine stage 5: AI only when there are no results or the user asks a question.
  const showAI = !emptyQuery && shouldEscalateToAI({ hasResults, isQuestion: isQuestion(query) });

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
    return [...navMatches, ...createMatches, ...actionMatches, ...aiItem];
  }, [emptyQuery, suggestionItems, recentItems, navMatches, createMatches, actionMatches, recordItems, aiItem]);

  // Unified, keyboard-navigable list: commands first, then record results from
  // the Search Engine. Enter / the Ask button / arrow keys operate on this list
  // so the submission pipeline is connected to every result returned.
  const selectableItems = useMemo(() => [...flatItems, ...recordItems], [flatItems, recordItems]);

  // Precompute absolute selection index for each record row (continues after the
  // command items) so keyboard highlight + scroll-into-view work for records too.
  const recordRows = useMemo(() => {
    let idx = flatItems.length;
    return rankedGroups.map((g) => ({
      label: g.label,
      items: g.items.map((it) => ({ it, idx: idx++ })),
    }));
  }, [rankedGroups, flatItems.length]);

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
    setAiAnswer({ loading: true, question: q });
    try {
      const res = await base44.functions.invoke('askAI', {
        company_id: activeCompany.id,
        question: q,
        context: pageContext,
      });
      setAiAnswer({ question: q, text: res?.data?.answer || res?.answer || 'No answer returned.' });
    } catch (e) {
      setAiAnswer({ question: q, error: e.message || 'Something went wrong.' });
    }
  };

  const activate = (item) => {
    if (!item || item.disabled) return;
    if (item.kind === 'ai') {
      runAI(item.query);
      return;
    }
    if (item.kind === 'record') {
      openRecord(item.group, item.raw);
      return;
    }
    if (query.trim()) pushRecentSearch(query.trim());
    pushRecent({ label: item.label, path: item.path });
    onClose();
    navigate(item.path);
  };

  // The send button / Enter must always act. Open the selected (or first)
  // result when one exists; otherwise escalate the query to Ask (AI) so the
  // button is never a dead control.
  const submit = () => {
    const item = selectableItems[selected] || selectableItems[0];
    if (item && !item.disabled) {
      activate(item);
      return;
    }
    if (q) runAI(q);
  };

  const goQuick = (path) => {
    onClose();
    navigate(path);
  };

  // Ask Engine result handlers — each records a selection so learning can rank.
  const openRecord = (group, it) => {
    trackSelection(group, it);
    if (q) pushRecentSearch(q);
    pushRecent({ label: it.label, path: it.route });
    onClose();
    navigate(it.route);
  };
  const viewGroup = (group) => goQuick(GROUP_LIST_ROUTES[group] || '/');
  const askRecord = (it) => runAI(`Tell me about ${it.label}`);
  const recordPayment = (it) => { onClose(); navigate(it.route); };
  const togglePinRecord = (group, it) => {
    togglePin(group, it);
    setPinTick((t) => t + 1);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && e.shiftKey) return;
    const max = Math.max(selectableItems.length - 1, 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, max));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (aiAnswer) setAiAnswer(null);
      else onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, max));
    }
  };

  if (!open) return null;

  // Build sections with headers across flatItems.
  const rendered = [];
  let lastKind = null;
  flatItems.forEach((item, idx) => {
    if (item.kind !== lastKind) {
      rendered.push(
        <div key={`h-${item.kind}-${idx}`} className="px-4 sm:px-6 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
          'w-full flex items-center gap-3 px-4 sm:px-6 py-2.5 text-left text-sm transition-colors outline-none',
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

  const showWelcome = emptyQuery && !aiAnswer;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-0 sm:p-[6vh] sm:px-6 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Ask Ledgerly"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-3xl bg-card sm:rounded-2xl rounded-none shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="font-semibold tracking-tight">Ask Ledgerly</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Body */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {aiAnswer ? (
            <AskAnswer aiAnswer={aiAnswer} onBack={() => setAiAnswer(null)} />
          ) : showWelcome ? (
            <AskWelcome
              userName={userName}
              smartSuggestions={smartSuggestions}
              recentSearches={recentSearches}
              quickActions={QUICK_ACTIONS}
              onPickExample={(c) => setQuery(c)}
              onSuggestion={goQuick}
              onPickRecent={(s) => setQuery(s)}
              onQuickAction={goQuick}
            />
          ) : (
            <div className="pb-4">
              {rendered}
              {recordRows.map((g) => (
                <div key={g.label}>
                  <div className="px-4 sm:px-6 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </div>
                  {g.items.map(({ it, idx }, i) => (
                    <div
                      key={`${g.label}-${it.id || i}`}
                      data-idx={idx}
                      onMouseEnter={() => setSelected(idx)}
                      className={cn('rounded-lg transition-colors', idx === selected && 'bg-primary/10')}
                    >
                      <AskResultCard
                        group={g.label}
                        item={it}
                        icon={recordIcon(g.label)}
                        isPinned={isPinned(g.label, it)}
                        onOpen={() => openRecord(g.label, it)}
                        onView={() => viewGroup(g.label)}
                        onAsk={() => askRecord(it)}
                        onRecordPayment={() => recordPayment(it)}
                        onTogglePin={() => togglePinRecord(g.label, it)}
                      />
                    </div>
                  ))}
                </div>
              ))}
              {recordsLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching records…
                </div>
              )}
              {!recordsLoading && noResults && q.length >= 2 && !isQuestion(query) && (
                <AskRecordsEmpty
                  query={q}
                  similar={similar}
                  onPickSimilar={(it) => { if (q) pushRecentSearch(q); pushRecent({ label: it.label, path: it.route }); onClose(); navigate(it.route); }}
                  onCreateCustomer={() => goQuick('/customers')}
                  onCreateSupplier={() => goQuick('/suppliers')}
                  onSearchReports={() => goQuick('/reports')}
                  onAskAI={() => askRecord({ label: q })}
                />
              )}
            </div>
          )}
        </div>

        {/* Bottom message input */}
        <AskInput
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAiAnswer(null); }}
          onKeyDown={onKeyDown}
          onSubmit={submit}
          placeholder={placeholder}
          disabled={!!aiAnswer?.loading}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}