import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Search, Filter, ChevronDown, Upload, Plus, Landmark, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import ReconciliationRow from '@/components/reconciliation/ReconciliationRow';
import CompactRow from '@/components/reconciliation/CompactRow';
import BankTransactionForm from '@/components/bank_transactions/BankTransactionForm';
import ReconciliationWorkflow from '@/components/bank_transactions/ReconciliationWorkflow';
import ImportCSVDialog from '@/components/bank_transactions/ImportCSVDialog';
import { aiApi } from '@/components/ai-accountant/api';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'review', label: 'Review' },
  { key: 'nomatch', label: 'No match' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'vat', label: 'VAT review' },
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTransactionId = searchParams.get('transaction_id');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [aiRecon, setAiRecon] = useState({});
  const [categorisation, setCategorisation] = useState({});
  const [analysisDecisions, setAnalysisDecisions] = useState({});
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [approvingId, setApprovingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const didInit = useRef(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [splitTarget, setSplitTarget] = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedReady, setSelectedReady] = useState(new Set());
  const [batchApproving, setBatchApproving] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const [accts, txns, requestedTransaction] = await Promise.all([
        base44.entities.BankAccount.filter({ company_id: activeCompany.id }),
        base44.entities.BankTransaction.filter({ company_id: activeCompany.id }, '-date', 500),
        requestedTransactionId
          ? base44.entities.BankTransaction.get(requestedTransactionId).catch(() => null)
          : Promise.resolve(null),
      ]);
      // An AI task can reference an older receipt outside this register's
      // default 500-row window. Fetch it directly and verify it belongs to the
      // active company before putting it at the top of the review queue.
      const focusedTransaction = requestedTransaction?.company_id === activeCompany.id
        ? requestedTransaction
        : null;
      const visibleTransactions = focusedTransaction && !txns.some((transaction) => transaction.id === focusedTransaction.id)
        ? [focusedTransaction, ...txns]
        : txns;
      setBankAccounts(accts);
      setTransactions(visibleTransactions);
      if (focusedTransaction?.status === 'review') {
        didInit.current = true;
        setAccountFilter('all');
        setSearch('');
        setFilter('all');
        setExpandedId(focusedTransaction.id);
      }
      try {
        const res = await base44.functions.invoke('suggestTransactionMatches', { company_id: activeCompany.id });
        const body = res?.data ?? res;
        setSuggestions(body?.suggestions || {});
        setAiRecon(body?.reconciliation || {});
        setCategorisation(body?.categorisation || {});
        setAnalysisDecisions(body?.decisions || {});
      } catch { setSuggestions({}); setAiRecon({}); setCategorisation({}); setAnalysisDecisions({}); }
    } finally { setLoading(false); }
  }, [activeCompany, requestedTransactionId]);

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

  const reviewList = useMemo(() => {
    const review = filteredTxns.filter((t) => t.status === 'review');
    const map = {};
    review.forEach((t) => {
      const k = `${(t.description || '').toLowerCase().trim()}|${txnAmount(t)}|${t.date}`;
      (map[k] = map[k] || []).push(t.id);
    });
    const dupIds = new Set(Object.values(map).filter((g) => g.length > 1).flat());
    let list = review.map((t) => ({ t, suggestion: suggestions[t.id]?.[0], isDup: dupIds.has(t.id), decision: analysisDecisions[t.id] }));
    if (filter === 'ready') list = list.filter((x) => x.decision?.state === 'READY');
    else if (filter === 'review') list = list.filter((x) => x.decision?.state && x.decision.state !== 'READY');
    else if (filter === 'nomatch') list = list.filter((x) => x.decision?.state === 'NO_MATCH');
    else if (filter === 'duplicates') list = list.filter((x) => x.decision?.duplicate_flag || x.decision?.state === 'POSSIBLE_DUPLICATE' || x.isDup);
    else if (filter === 'vat') list = list.filter((x) => x.decision?.vat_review_required || x.decision?.state === 'VAT_REVIEW');
    list.sort((a, b) => {
      const pa = priority(a.suggestion, a.isDup, a.t);
      const pb = priority(b.suggestion, b.isDup, b.t);
      if (pa !== pb) return pa - pb;
      const ca = a.suggestion?.confidence ?? -1;
      const cb = b.suggestion?.confidence ?? -1;
      if (ca !== cb) return cb - ca;
      return new Date(b.t.date) - new Date(a.t.date);
    });
    return list;
  }, [filteredTxns, suggestions, analysisDecisions, filter]);

  // Auto-select first review item once loaded.
  useEffect(() => {
    if (!didInit.current && !loading && reviewList.length) {
      didInit.current = true;
      setExpandedId(reviewList[0].t.id);
    }
  }, [loading, reviewList]);

  // Keep selection valid.
  useEffect(() => {
    if (expandedId && !reviewList.some((x) => x.t.id === expandedId)) setExpandedId(null);
  }, [expandedId, reviewList]);

  // Scroll expanded row into view.
  useEffect(() => {
    if (expandedId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`txn-${expandedId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [expandedId]);

  const advance = useCallback((id) => {
    const idx = reviewList.findIndex((x) => x.t.id === id);
    const next = reviewList[idx + 1];
    setExpandedId(next ? next.t.id : null);
  }, [reviewList]);

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

  const headerAccount = accountFilter !== 'all'
    ? (bankAccounts.find((a) => a.id === accountFilter)?.account_name || '')
    : (bankAccounts[0]?.account_name || '');

  const readyItems = reviewList.filter(({ decision }) => decision?.state === 'READY' && !decision.duplicate_flag && !decision.vat_review_required && !decision.transfer_flag);
  const toggleReady = (id) => setSelectedReady((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllReady = () => setSelectedReady(new Set(readyItems.map(({ t }) => t.id)));
  const approveReadyBatch = async () => {
    const ids = [...selectedReady].filter((id) => readyItems.some(({ t }) => t.id === id));
    if (!ids.length) return;
    setBatchApproving(true);
    try {
      const result = await aiApi.approveReadyBatch(activeCompany.id, ids);
      const skipped = result.skipped?.length || 0;
      toast({ title: `${result.approved?.length || 0} transaction${result.approved?.length === 1 ? '' : 's'} reconciled`, description: skipped ? `${skipped} item${skipped === 1 ? '' : 's'} were skipped because their evidence changed.` : 'Only current high-confidence matches were included.' });
      setSelectedReady(new Set());
      await load();
    } catch (e) {
      toast({ title: 'Batch approval could not complete', description: e.message, variant: 'destructive' });
    } finally { setBatchApproving(false); }
  };

  const applyNonPaymentMatch = async (txn, rec) => {
    const rt = rec.record_type;
    if (!['sales_credit_note', 'supplier_credit_note', 'ledger_account'].includes(rt)) {
      throw new Error('This match type requires payment approval');
    }
    const response = await base44.functions.invoke('approveNonPaymentReconciliationMatch', {
      bank_transaction_id: txn.id,
      record_type: rt,
      record_id: rec.record_id || undefined,
      record_number: rec.record_number || undefined,
    });
    const body = response?.data ?? response;
    return body?.updateData || { status: 'matched' };
  };

  const onMatch = async (txn, rec) => {
    if (!txn || !rec) return;
    setApprovingId(txn.id);
    try {
      const isPaymentMatch = rec.record_type === 'sales_invoice' || rec.record_type === 'purchase_bill';
      const response = isPaymentMatch
        ? await base44.functions.invoke('approveReconciliationMatches', {
            bank_transaction_id: txn.id,
            records: [{ record_type: rec.record_type, record_id: rec.record_id }],
          })
        : null;
      const body = response?.data ?? response;
      const updateData = isPaymentMatch
        ? (body?.updateData || { status: 'matched' })
        : await applyNonPaymentMatch(txn, rec);
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...updateData } : t)));
      toast({ title: 'Reconciled', description: `Matched to ${rec.record_number}` });
      advance(txn.id);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  // One-to-many: approve several records against a single bank transaction.
  const onMatchMany = async (txn, recs) => {
    if (!txn || !recs?.length) return;
    if (recs.length === 1) return onMatch(txn, recs[0]);
    setApprovingId(txn.id);
    try {
      // Server applies everything atomically: re-checks status, caps payment
      // amounts at each record's outstanding balance, and links the records.
      const res = await base44.functions.invoke('approveReconciliationMatches', {
        bank_transaction_id: txn.id,
        records: recs.map((r) => ({
          record_type: r.record_type,
          record_id: r.record_id,
          amount: r.record_amount,
        })),
      });
      const body = res?.data ?? res;
      const updateData = body?.updateData || { status: 'matched' };
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...updateData } : t)));
      toast({ title: 'Reconciled', description: `Matched to ${recs.length} records (${body?.label || ''})` });
      advance(txn.id);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const onCreate = async (txn, data) => {
    if (!txn) return;
    setApprovingId(txn.id);
    try {
      const response = await base44.functions.invoke('approveNonPaymentReconciliationMatch', {
        bank_transaction_id: txn.id,
        record_type: 'ledger_account',
        record_number: data.category || 'Categorised transaction',
        category: data.category || undefined,
        vat_rate: data.vat_rate == null ? null : Number(data.vat_rate),
        notes: data.notes || null,
      });
      const body = response?.data ?? response;
      const updateData = body?.updateData || { status: 'matched' };
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...updateData } : t)));
      toast({ title: 'Reconciled', description: 'Transaction categorised' });
      advance(txn.id);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const onTransfer = async (txn, data) => {
    if (!txn) return;
    setApprovingId(txn.id);
    try {
      const response = await base44.functions.invoke('recordBankTransfer', {
        bank_transaction_id: txn.id,
        to_account_id: data.to_account_id,
        amount: data.amount,
        description: data.description || undefined,
      });
      const body = response?.data ?? response;
      const updateData = body?.updateData || { status: 'matched' };
      setTransactions((prev) => [
        ...prev.map((t) => (t.id === txn.id ? { ...t, ...updateData } : t)),
        ...(body?.created ? [body.created] : []),
      ]);
      toast({ title: 'Reconciled', description: 'Transfer recorded' });
      advance(txn.id);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const openSplit = (t) => { setSplitTarget(t); setSplitOpen(true); };

  const handleSave = async (data) => {
    try {
      const payload = { ...data, company_id: activeCompany.id };
      if (editing) {
        const { date, description, reference, transaction_type, category, vat_rate, notes } = payload;
        await base44.functions.invoke('updateBankTransactionClassification', {
          bank_transaction_id: editing.id, date, description, reference, transaction_type, category, vat_rate, notes,
        });
      }
      else await base44.functions.invoke('recordBankTransaction', payload);
      toast({ title: editing ? 'Transaction updated' : 'Transaction recorded' });
      setFormOpen(false); setEditing(null);
      await load();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  const currentFilterLabel = FILTERS.find((f) => f.key === filter)?.label || 'All';

  return (
    <div className="bg-slate-50 min-h-[100dvh]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {requestedTransactionId && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <span>Focused review: this receipt was opened from an AI Accountant task.</span>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-700 hover:text-indigo-900" onClick={() => setSearchParams({})}>
              Clear focused receipt
            </Button>
          </div>
        )}
        
        {/* Header & Metrics */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              <Landmark className="w-4 h-4 text-[#007bff]" />
              <span>Banking</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700">Reconciliation</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Reconcile {headerAccount}</h1>
            
            <div className="pt-3 flex flex-col gap-2 w-full md:w-80">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-700">{metrics.completionPct}% Complete</span>
                <span className="text-slate-500">Est. {estLabel}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden w-full shadow-inner relative">
                <motion.div 
                  className="h-full bg-[#007bff] rounded-full relative" 
                  initial={{ width: 0 }}
                  animate={{ width: `${metrics.completionPct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-shimmer" />
                </motion.div>
              </div>
              <p className="text-xs text-slate-500">{metrics.reconciled} done, {metrics.remaining} to review</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search amounts, refs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-slate-200 shadow-sm focus-visible:ring-[#007bff]" />
            </div>
            
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full md:w-48 h-10 bg-white border-slate-200 shadow-sm font-medium"><SelectValue placeholder="All accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
              </SelectContent>
            </Select>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 bg-white border-slate-200 shadow-sm font-medium text-slate-700 hover:text-slate-900">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">{currentFilterLabel}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {FILTERS.map((f) => (
                  <DropdownMenuItem key={f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? 'font-bold bg-slate-50' : 'font-medium'}>
                    {f.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="flex gap-2 pl-2 border-l border-slate-200">
              <Button variant="outline" size="icon" className="h-10 w-10 bg-white border-slate-200 text-slate-600 hover:text-[#007bff] hover:border-[#007bff]/30 hover:bg-blue-50 shadow-sm transition-colors" onClick={() => setImportOpen(true)} title="Import CSV">
                <Upload className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 bg-white border-slate-200 text-slate-600 hover:text-[#007bff] hover:border-[#007bff]/30 hover:bg-blue-50 shadow-sm transition-colors" onClick={() => { setEditing(null); setFormOpen(true); }} title="Add manual transaction">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-5">
          {[
            ['Ready', readyItems.length, 'text-emerald-700'],
            ['Review', reviewList.filter(({ decision }) => decision?.state && decision.state !== 'READY').length, 'text-amber-700'],
            ['No match', reviewList.filter(({ decision }) => decision?.state === 'NO_MATCH').length, 'text-slate-700'],
            ['Duplicates', reviewList.filter(({ decision, isDup }) => decision?.duplicate_flag || isDup).length, 'text-rose-700'],
            ['VAT review', reviewList.filter(({ decision }) => decision?.vat_review_required).length, 'text-amber-700'],
          ].map(([label, value, colour]) => <div key={label} className="px-2 py-1"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xl font-black ${colour}`}>{value}</p></div>)}
        </div>
        {readyItems.length > 0 && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-bold text-emerald-950">Ready to approve</p><p className="text-xs text-emerald-800">{readyItems.length} high-confidence match{readyItems.length === 1 ? '' : 'es'} have passed the deterministic safety checks.</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-emerald-300 bg-white text-emerald-800" onClick={selectAllReady}>Select all</Button>
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" disabled={selectedReady.size === 0 || batchApproving} onClick={approveReadyBatch}>{batchApproving ? 'Approving…' : `Approve selected (${[...selectedReady].filter((id) => readyItems.some(({ t }) => t.id === id)).length})`}</Button>
            </div>
          </div>
        )}

        {/* Transaction rows */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#007bff] rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium">Loading transactions...</p>
          </div>
        ) : reviewList.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 px-6 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl text-center"
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">You're all caught up!</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {search || filter !== 'all' || accountFilter !== 'all' 
                ? 'No transactions match your current filters. Try adjusting them.' 
                : 'All transactions have been reviewed and reconciled.'}
            </p>
            {(search || filter !== 'all' || accountFilter !== 'all') && (
              <Button variant="outline" onClick={() => { setSearch(''); setFilter('all'); setAccountFilter('all'); }}>
                Clear filters
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false} mode="popLayout">
              {reviewList.map(({ t, suggestion, decision }) => (
                <motion.div 
                  layout="position"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, height: 0, marginTop: 0, overflow: 'hidden' }}
                  transition={{ 
                    opacity: { duration: 0.2 },
                    layout: { type: "spring", bounce: 0, duration: 0.4 },
                    exit: { duration: 0.2 }
                  }}
                  id={`txn-${t.id}`} 
                  key={t.id}
                  className="rounded-xl shadow-sm border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow duration-300 relative z-10"
                >
                   {decision?.state === 'READY' && (
                     <label className="absolute left-3 top-3 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-emerald-300 bg-white shadow-sm">
                       <input aria-label={`Select ${t.description || 'transaction'} for batch approval`} type="checkbox" checked={selectedReady.has(t.id)} onChange={() => toggleReady(t.id)} className="h-3.5 w-3.5 accent-emerald-700" />
                     </label>
                   )}
                  {expandedId === t.id ? (
                    <ReconciliationRow
                      transaction={t}
                      suggestions={suggestions[t.id] || (suggestion ? [suggestion] : [])}
                      aiRecon={aiRecon[t.id]}
                      categorySuggestion={categorisation[t.id]}
                      analysisDecision={analysisDecisions[t.id]}
                      onMatchMany={(recs) => onMatchMany(t, recs)}
                      bankAccounts={bankAccounts}
                      companyId={activeCompany.id}
                      approving={approvingId === t.id}
                      onMatch={(rec) => onMatch(t, rec)}
                      onCreate={(data) => onCreate(t, data)}
                      onTransfer={(data) => onTransfer(t, data)}
                      onSplit={() => openSplit(t)}
                      onCollapse={() => setExpandedId(null)}
                    />
                  ) : (
                    <CompactRow transaction={t} onSelect={() => setExpandedId(t.id)} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <BankTransactionForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} editing={editing} onSave={handleSave} saving={false} />
        <ReconciliationWorkflow open={splitOpen} onOpenChange={setSplitOpen} transaction={splitTarget} companyId={activeCompany.id} onReconciled={load} />
        <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} companyId={activeCompany.id} onImported={load} />
      </div>
    </div>
  );
}
