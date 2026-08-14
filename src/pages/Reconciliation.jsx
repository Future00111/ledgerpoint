import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Search, Filter, ChevronDown, Upload, Plus, Check, Landmark } from 'lucide-react';
import ReconciliationInboxCard from '@/components/reconciliation/ReconciliationInboxCard';
import BankTransactionForm from '@/components/bank_transactions/BankTransactionForm';
import MatchTransactionDialog from '@/components/bank_transactions/MatchTransactionDialog';
import ReconciliationWorkflow from '@/components/bank_transactions/ReconciliationWorkflow';
import ImportCSVDialog from '@/components/bank_transactions/ImportCSVDialog';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready to approve' },
  { key: 'review', label: 'Needs review' },
  { key: 'uncertain', label: 'AI uncertain' },
  { key: 'nomatch', label: 'No match found' },
  { key: 'highvalue', label: 'High value' },
];

// Prioritization: AI uncertain → no match → duplicates → large → standard.
function priority(suggestion, isDup, t) {
  if (suggestion && suggestion.confidence < 50) return 1;
  if (!suggestion) return 2;
  if (isDup) return 3;
  if (txnAmount(t) > 1000) return 4;
  return 5;
}

export default function Reconciliation() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [compact, setCompact] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showReconciled, setShowReconciled] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [matchTarget, setMatchTarget] = useState(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [splitTarget, setSplitTarget] = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const dialogsOpen = formOpen || matchOpen || splitOpen || importOpen;

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const [accts, txns] = await Promise.all([
        base44.entities.BankAccount.filter({ company_id: activeCompany.id }),
        base44.entities.BankTransaction.filter({ company_id: activeCompany.id }, '-date', 500),
      ]);
      setBankAccounts(accts);
      setTransactions(txns);
      try {
        const res = await base44.functions.invoke('suggestTransactionMatches', { company_id: activeCompany.id });
        const body = res?.data ?? res;
        setSuggestions(body?.suggestions || {});
      } catch { setSuggestions({}); }
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => { load(); }, [load]);

  const filteredTxns = useMemo(() => {
    let list = transactions;
    if (accountFilter !== 'all') list = list.filter((t) => t.bank_account_id === accountFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => (t.description || '').toLowerCase().includes(q) || (t.reference || '').toLowerCase().includes(q));
    }
    return list;
  }, [transactions, accountFilter, search]);

  const { reviewList, reconciledList } = useMemo(() => {
    const review = filteredTxns.filter((t) => t.status === 'review');
    const reconciled = filteredTxns.filter((t) => t.status === 'matched');
    const map = {};
    review.forEach((t) => {
      const k = `${(t.description || '').toLowerCase().trim()}|${txnAmount(t)}|${t.date}`;
      (map[k] = map[k] || []).push(t.id);
    });
    const dupIds = new Set(Object.values(map).filter((g) => g.length > 1).flat());
    let list = review.map((t) => ({ t, suggestion: suggestions[t.id]?.[0], isDup: dupIds.has(t.id) }));
    if (filter === 'ready') list = list.filter((x) => x.suggestion && x.suggestion.confidence >= 80);
    else if (filter === 'review') list = list.filter((x) => x.suggestion && x.suggestion.confidence >= 50 && x.suggestion.confidence < 80);
    else if (filter === 'uncertain') list = list.filter((x) => x.suggestion && x.suggestion.confidence < 50);
    else if (filter === 'nomatch') list = list.filter((x) => !x.suggestion);
    else if (filter === 'highvalue') list = list.filter((x) => txnAmount(x.t) > 1000);
    list.sort((a, b) => {
      const pa = priority(a.suggestion, a.isDup, a.t);
      const pb = priority(b.suggestion, b.isDup, b.t);
      if (pa !== pb) return pa - pb;
      const ca = a.suggestion?.confidence ?? -1;
      const cb = b.suggestion?.confidence ?? -1;
      if (ca !== cb) return cb - ca;
      return new Date(b.t.date) - new Date(a.t.date);
    });
    return { reviewList: list, reconciledList: reconciled };
  }, [filteredTxns, suggestions, filter]);

  const metrics = useMemo(() => {
    const total = filteredTxns.length;
    const reconciled = filteredTxns.filter((t) => t.status === 'matched').length;
    const remaining = filteredTxns.filter((t) => t.status === 'review').length;
    const completionPct = total > 0 ? Math.round((reconciled / total) * 100) : 100;
    const estimatedMinutes = remaining > 0 ? Math.max(1, Math.round((remaining * 90) / 60)) : 0;
    return { total, reconciled, remaining, completionPct, estimatedMinutes };
  }, [filteredTxns]);
  const estLabel = metrics.estimatedMinutes === 0
    ? 'Done'
    : metrics.estimatedMinutes < 60
      ? `${metrics.estimatedMinutes} min`
      : `${Math.floor(metrics.estimatedMinutes / 60)}h ${metrics.estimatedMinutes % 60}m`;

  useEffect(() => {
    if (!reviewList.length) { setSelectedId(null); return; }
    if (!reviewList.some((x) => x.t.id === selectedId)) setSelectedId(reviewList[0].t.id);
  }, [reviewList]);

  useEffect(() => {
    if (selectedId) document.getElementById(`txn-${selectedId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const applyMatch = async (txn, suggestion) => {
    let updateData = { status: 'matched', linked_invoice_id: '', linked_bill_id: '' };
    const rt = suggestion.record_type;
    if (rt === 'sales_invoice') updateData = { ...updateData, matched_type: 'sales_invoice', matched_record_id: suggestion.record_id, matched_record_number: suggestion.record_number, linked_invoice_id: suggestion.record_id };
    else if (rt === 'purchase_bill') updateData = { ...updateData, matched_type: 'purchase_bill', matched_record_id: suggestion.record_id, matched_record_number: suggestion.record_number, linked_bill_id: suggestion.record_id };
    else if (rt === 'sales_credit_note') updateData = { ...updateData, matched_type: 'sales_credit_note', matched_record_id: suggestion.record_id, matched_record_number: suggestion.record_number };
    else if (rt === 'supplier_credit_note') updateData = { ...updateData, matched_type: 'supplier_credit_note', matched_record_id: suggestion.record_id, matched_record_number: suggestion.record_number };
    await base44.entities.BankTransaction.update(txn.id, updateData);
    if (rt === 'sales_invoice' || rt === 'purchase_bill') {
      const amt = Number(txn.money_in || 0) || Number(txn.money_out || 0);
      if (amt > 0) await base44.functions.invoke('updatePaymentStatus', { entity_type: rt, record_id: suggestion.record_id, amount_paid_delta: amt });
    }
  };

  const approve = async (txn, suggestion) => {
    setApprovingId(txn.id);
    try {
      await applyMatch(txn, suggestion);
      toast({ title: 'Reconciled', description: `Matched to ${suggestion.record_number}` });
      await load();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const openMatch = (t) => { setMatchTarget(t); setMatchOpen(true); };
  const openSplit = (t) => { setSplitTarget(t); setSplitOpen(true); };
  const openEdit = (t) => { setEditing(t); setFormOpen(true); };

  // Keyboard shortcuts — A/S/F/C and arrow navigation. Ref avoids stale closures.
  const stateRef = useRef({});
  stateRef.current = { reviewList, selectedId, approve, openSplit, openMatch, dialogsOpen };
  useEffect(() => {
    const handler = (e) => {
      const s = stateRef.current;
      if (s.dialogsOpen) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target?.isContentEditable) return;
      if (!s.reviewList.length) return;
      const idx = s.reviewList.findIndex((x) => x.t.id === s.selectedId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const n = s.reviewList[Math.min(idx + 1, s.reviewList.length - 1)];
        if (n) setSelectedId(n.t.id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const n = s.reviewList[Math.max(idx - 1, 0)];
        if (n) setSelectedId(n.t.id);
      } else {
        const x = s.reviewList[idx];
        if (!x) return;
        const k = e.key.toLowerCase();
        if (k === 'a' && x.suggestion) { e.preventDefault(); s.approve(x.t, x.suggestion); }
        else if (k === 's') { e.preventDefault(); s.openSplit(x.t); }
        else if (k === 'f') { e.preventDefault(); s.openMatch(x.t); }
        else if (k === 'c') { e.preventDefault(); s.openMatch(x.t); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSave = async (data) => {
    try {
      const payload = { ...data, company_id: activeCompany.id };
      if (editing) await base44.entities.BankTransaction.update(editing.id, payload);
      else await base44.entities.BankTransaction.create(payload);
      toast({ title: editing ? 'Transaction updated' : 'Transaction recorded' });
      setFormOpen(false); setEditing(null);
      await load();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  const currentFilterLabel = FILTERS.find((f) => f.key === filter)?.label || 'All';

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header — light, single row */}
      <div className="pt-1.5 pb-3">
        <p className="text-xs text-muted-foreground">Banking <span className="opacity-40 mx-0.5">/</span> Reconciliation</p>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-1">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {loading ? 'Loading…' : <>{metrics.remaining} transaction{metrics.remaining === 1 ? '' : 's'} requiring review</>}
            </h1>
            <div className="mt-2.5 h-1 rounded-full bg-muted overflow-hidden w-full md:w-64">
              <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${metrics.completionPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{metrics.reconciled} completed · {metrics.remaining} remaining · Est. {estLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full md:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search transactions…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full md:w-40 h-9 text-sm"><SelectValue placeholder="All accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-1.5 text-sm">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{currentFilterLabel}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FILTERS.map((f) => (
                  <DropdownMenuItem key={f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? 'font-medium' : ''}>
                    {f.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => setCompact((c) => !c)}
              className={`flex items-center gap-1.5 h-9 px-2.5 rounded-md border text-xs ${compact ? 'bg-foreground/5 text-foreground border-border' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span className={`w-3 h-3 rounded-full border ${compact ? 'bg-foreground border-foreground' : 'border-border'}`} />
              Compact View
            </button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => setImportOpen(true)} title="Import"><Upload className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => { setEditing(null); setFormOpen(true); }} title="Add transaction"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {/* Inbox */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-[3px] border-muted-foreground/20 border-t-foreground rounded-full animate-spin" /></div>
      ) : reviewList.length === 0 ? (
        <div className="flex flex-col items-center py-20">
          <Landmark className="w-10 h-10 text-muted-foreground/25 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || filter !== 'all' || accountFilter !== 'all' ? 'No transactions match your filters' : 'Nothing requiring review — all reconciled.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          {reviewList.map(({ t, suggestion }) => (
            <ReconciliationInboxCard
              key={t.id}
              transaction={t}
              suggestion={suggestion}
              companyId={activeCompany.id}
              approving={approvingId === t.id}
              selected={selectedId === t.id}
              compact={compact}
              onApprove={(s) => approve(t, s)}
              onSplit={() => openSplit(t)}
              onFindMatch={() => openMatch(t)}
              onCategorise={() => openMatch(t)}
              onEdit={() => openEdit(t)}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      )}

      {/* Reconciled — collapsed by default */}
      {!loading && reconciledList.length > 0 && (
        <div className="mt-8">
          <button type="button" onClick={() => setShowReconciled((v) => !v)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Check className="w-4 h-4 text-emerald-500" />
            {reconciledList.length} transaction{reconciledList.length === 1 ? '' : 's'} automatically reconciled
            <span className="text-xs text-foreground ml-1">{showReconciled ? 'Hide' : 'View'}</span>
          </button>
          {showReconciled && (
            <div className="mt-2 rounded-lg border border-border/50 overflow-hidden">
              {reconciledList.map((t) => (
                <ReconciliationInboxCard key={t.id} transaction={t} suggestion={null} compact={compact} onEdit={() => openEdit(t)} onSelect={setSelectedId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs — underlying workflows preserved */}
      <BankTransactionForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} editing={editing} onSave={handleSave} saving={false} />
      <MatchTransactionDialog open={matchOpen} onOpenChange={setMatchOpen} transaction={matchTarget} companyId={activeCompany.id} onMatched={load} />
      <ReconciliationWorkflow open={splitOpen} onOpenChange={setSplitOpen} transaction={splitTarget} companyId={activeCompany.id} onReconciled={load} />
      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} companyId={activeCompany.id} onImported={load} />
    </div>
  );
}