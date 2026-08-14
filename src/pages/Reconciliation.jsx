import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, Upload, Plus, Search, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { gbp, fmtDate } from '@/lib/format';
import {
  computeReconMetrics, computeAttentionItems, RECON_THRESHOLDS,
} from '@/lib/reconciliationEngine';
import ReconSummary from '@/components/reconciliation/ReconSummary';
import TransactionCard from '@/components/reconciliation/TransactionCard';
import ReconSidebar from '@/components/reconciliation/ReconSidebar';
import BankTransactionForm from '@/components/bank_transactions/BankTransactionForm';
import MatchTransactionDialog from '@/components/bank_transactions/MatchTransactionDialog';
import ReconciliationWorkflow from '@/components/bank_transactions/ReconciliationWorkflow';
import ImportCSVDialog from '@/components/bank_transactions/ImportCSVDialog';

const { HIGH_CONFIDENCE } = RECON_THRESHOLDS;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Needs review' },
  { key: 'low', label: 'Low confidence' },
  { key: 'high', label: 'High value' },
];

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

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
  const [approvingId, setApprovingId] = useState(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [askSeed, setAskSeed] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [matchTarget, setMatchTarget] = useState(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [splitTarget, setSplitTarget] = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
      } catch (e) { setSuggestions({}); }
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
    if (filter === 'review') list = list.filter((t) => t.status === 'review');
    if (filter === 'low') list = list.filter((t) => t.status === 'review' && suggestions[t.id]?.[0] && suggestions[t.id][0].confidence < 60);
    if (filter === 'high') list = list.filter((t) => t.status === 'review' && txnAmount(t) > 1000);
    return list;
  }, [transactions, accountFilter, search, filter, suggestions]);

  const metrics = useMemo(() => computeReconMetrics(filteredTxns, suggestions, bankAccounts), [filteredTxns, suggestions, bankAccounts]);
  const attention = useMemo(() => computeAttentionItems(filteredTxns, suggestions, bankAccounts), [filteredTxns, suggestions, bankAccounts]);

  const groups = useMemo(() => {
    const review = filteredTxns.filter((t) => t.status === 'review');
    const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);
    const auto = review.filter((t) => suggestions[t.id]?.[0]?.confidence >= HIGH_CONFIDENCE)
      .sort((a, b) => (suggestions[b.id][0].confidence - suggestions[a.id][0].confidence) || byDateDesc(a, b));
    const manual = review.filter((t) => !(suggestions[t.id]?.[0]?.confidence >= HIGH_CONFIDENCE)).sort(byDateDesc);
    const matched = filteredTxns.filter((t) => t.status === 'matched').sort(byDateDesc);
    return { auto, manual, matched };
  }, [filteredTxns, suggestions]);

  // Compact recommendation
  const recommendation = useMemo(() => {
    const find = (type) => attention.find((a) => a.type === type);
    const feed = find('feed');
    if (feed) return { alert: true, body: `${feed.count} bank feed${feed.count > 1 ? 's' : ''} interrupted — reconnect to resume syncing.`, action: null };
    const dup = find('duplicate');
    if (dup) return { body: `verifying ${dup.count} possible duplicate${dup.count > 1 ? 's' : ''}`, actionLabel: 'Review now', actionId: dup.transactionIds?.[0] };
    const large = find('large');
    if (large) return { body: `reviewing ${large.count} high-value transaction${large.count > 1 ? 's' : ''} first`, actionLabel: 'Review now', actionId: large.transactionIds?.[0] };
    const lowConf = find('error');
    if (lowConf) return { body: `verifying ${lowConf.count} low-confidence match${lowConf.count > 1 ? 'es' : ''}`, actionLabel: 'Review now', actionId: lowConf.transactionIds?.[0] };
    const unmatched = find('unmatched');
    if (unmatched) return { body: `categorising ${unmatched.count} unmatched transaction${unmatched.count > 1 ? 's' : ''}`, actionLabel: 'Review now', actionId: unmatched.transactionIds?.[0] };
    if (metrics.autoMatchableCount) return { body: `approving ${metrics.autoMatchableCount} ready-matched transaction${metrics.autoMatchableCount > 1 ? 's' : ''}`, actionLabel: 'Approve all', actionType: 'approveAll' };
    return { body: 'Reconciliation complete — nothing left to do.', action: null };
  }, [attention, metrics]);

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
      toast({ title: 'Transaction reconciled', description: `Matched to ${suggestion.record_number}` });
      await load();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const approveAllAuto = async () => {
    const targets = groups.auto.map((t) => ({ t, s: suggestions[t.id][0] }));
    if (!targets.length) return;
    setBulkApproving(true);
    let ok = 0;
    for (const { t, s } of targets) { try { await applyMatch(t, s); ok++; } catch (e) { /* continue */ } }
    setBulkApproving(false);
    toast({ title: `${ok} transaction${ok === 1 ? '' : 's'} reconciled` });
    await load();
  };

  const openCategorise = (t) => { setMatchTarget(t); setMatchOpen(true); };
  const openSplit = (t) => { setSplitTarget(t); setSplitOpen(true); };
  const openEdit = (t) => { setEditing(t); setFormOpen(true); };
  const askAbout = (t) => {
    const amt = gbp(txnAmount(t));
    setAskSeed(`Explain this transaction: "${t.description}" on ${fmtDate(t.date)} for ${amt}.`);
  };
  const pickAttention = (txnId) => {
    setHighlightId(txnId);
    setTimeout(() => document.getElementById(`txn-${txnId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    setTimeout(() => setHighlightId(null), 2500);
  };

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

  const GroupLabel = ({ label, count, action }) => (
    <div className="flex items-center justify-between pt-5 pb-1 first:pt-0">
      <p className="text-xs font-medium text-muted-foreground">{label} <span className="text-muted-foreground/50">{count}</span></p>
      {action}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-xs text-muted-foreground">Banking <span className="mx-1 opacity-40">/</span> Reconciliation</p>
          <h1 className="text-xl font-semibold tracking-tight mt-1">Banking &amp; Reconciliation</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All accounts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {bankAccounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="w-4 h-4" /> Import</Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pb-6 border-b border-border">
        {loading ? (
          <div className="flex gap-12">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 w-28 bg-muted/40 animate-pulse rounded" />)}
          </div>
        ) : <ReconSummary metrics={metrics} />}
      </div>

      {/* AI recommendation */}
      <div className="mt-4">
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-2.5">
          {recommendation.alert ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          )}
          <p className="text-sm text-foreground/80 flex-1 min-w-0">
            {recommendation.action === null ? recommendation.body : <>Ledgerly recommends {recommendation.body}.</>}
          </p>
          {recommendation.actionType === 'approveAll' && (
            <button onClick={approveAllAuto} disabled={bulkApproving} className="text-sm font-medium text-primary hover:underline flex-shrink-0 flex items-center gap-1">
              {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}{recommendation.actionLabel} →
            </button>
          )}
          {recommendation.actionId && (
            <button onClick={() => pickAttention(recommendation.actionId)} className="text-sm font-medium text-primary hover:underline flex-shrink-0">
              {recommendation.actionLabel} →
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-6 grid lg:grid-cols-[3fr_1fr] gap-8">
        {/* Transaction list */}
        <div className="min-w-0">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search transactions…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
            <div className="flex items-center gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filter === f.key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" /></div>
          ) : filteredTxns.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <Landmark className="w-10 h-10 text-muted-foreground/25 mb-3" />
              <p className="text-sm text-muted-foreground">{search || filter !== 'all' || accountFilter !== 'all' ? 'No transactions match your filters' : 'No bank transactions yet.'}</p>
            </div>
          ) : (
            <div>
              {groups.auto.length > 0 && (
                <>
                  <GroupLabel label="Ready to approve" count={groups.auto.length}
                    action={<button onClick={approveAllAuto} disabled={bulkApproving} className="text-xs font-medium text-primary hover:underline">{bulkApproving ? 'Approving…' : 'Approve all'}</button>} />
                  {groups.auto.map((t) => (
                    <TransactionCard key={t.id} transaction={t} suggestion={suggestions[t.id]?.[0]} highlight={highlightId === t.id}
                      onApprove={(s) => approve(t, s)} onSplit={() => openSplit(t)} onCategorise={() => openCategorise(t)}
                      onFindMatch={() => openCategorise(t)} onAsk={() => askAbout(t)} onEdit={() => openEdit(t)} approving={approvingId === t.id} />
                  ))}
                </>
              )}
              {groups.manual.length > 0 && (
                <>
                  <GroupLabel label="Needs review" count={groups.manual.length} />
                  {groups.manual.map((t) => (
                    <TransactionCard key={t.id} transaction={t} suggestion={suggestions[t.id]?.[0]} highlight={highlightId === t.id}
                      onApprove={(s) => approve(t, s)} onSplit={() => openSplit(t)} onCategorise={() => openCategorise(t)}
                      onFindMatch={() => openCategorise(t)} onAsk={() => askAbout(t)} onEdit={() => openEdit(t)} approving={approvingId === t.id} />
                  ))}
                </>
              )}
              {groups.matched.length > 0 && (
                <>
                  <GroupLabel label="Reconciled" count={groups.matched.length} />
                  {groups.matched.map((t) => (
                    <TransactionCard key={t.id} transaction={t} suggestion={null} highlight={highlightId === t.id}
                      onApprove={() => {}} onSplit={() => {}} onCategorise={() => {}} onFindMatch={() => openCategorise(t)}
                      onAsk={() => askAbout(t)} onEdit={() => openEdit(t)} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:pt-5">
          <ReconSidebar metrics={metrics} attentionItems={attention} onPickAttention={pickAttention} companyId={activeCompany?.id} askSeed={askSeed} />
        </aside>
      </div>

      {/* Dialogs */}
      <BankTransactionForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} editing={editing} onSave={handleSave} saving={false} />
      <MatchTransactionDialog open={matchOpen} onOpenChange={setMatchOpen} transaction={matchTarget} companyId={activeCompany?.id} onMatched={load} />
      <ReconciliationWorkflow open={splitOpen} onOpenChange={setSplitOpen} transaction={splitTarget} companyId={activeCompany?.id} onReconciled={load} />
      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} companyId={activeCompany?.id} onImported={load} />
    </div>
  );
}