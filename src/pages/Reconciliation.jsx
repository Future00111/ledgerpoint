import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, Upload, Plus, Search, Sparkles, ArrowRight, Loader2, Check } from 'lucide-react';
import { gbp, fmtDate } from '@/lib/format';
import {
  computeReconMetrics, computeAttentionItems, computeNextAction, RECON_THRESHOLDS,
} from '@/lib/reconciliationEngine';
import ReconKpiBar from '@/components/reconciliation/ReconKpiBar';
import ReconProgress from '@/components/reconciliation/ReconProgress';
import TransactionCard from '@/components/reconciliation/TransactionCard';
import ReconAttentionCard from '@/components/reconciliation/ReconAttentionCard';
import ReconAskPanel from '@/components/reconciliation/ReconAskPanel';
import BankTransactionForm from '@/components/bank_transactions/BankTransactionForm';
import MatchTransactionDialog from '@/components/bank_transactions/MatchTransactionDialog';
import ReconciliationWorkflow from '@/components/bank_transactions/ReconciliationWorkflow';
import ImportCSVDialog from '@/components/bank_transactions/ImportCSVDialog';

const { HIGH_CONFIDENCE } = RECON_THRESHOLDS;
const NEXT_TONE = {
  positive: 'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
};

export default function Reconciliation() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState('all');
  const [search, setSearch] = useState('');
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
      } catch (e) { console.error(e); setSuggestions({}); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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

  const metrics = useMemo(() => computeReconMetrics(filteredTxns, suggestions, bankAccounts), [filteredTxns, suggestions, bankAccounts]);
  const attention = useMemo(() => computeAttentionItems(filteredTxns, suggestions, bankAccounts), [filteredTxns, suggestions, bankAccounts]);
  const nextAction = useMemo(() => computeNextAction(filteredTxns, suggestions, metrics), [filteredTxns, suggestions, metrics]);

  const groups = useMemo(() => {
    const review = filteredTxns.filter((t) => t.status === 'review');
    const matched = filteredTxns.filter((t) => t.status === 'matched');
    const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);
    const auto = review.filter((t) => suggestions[t.id]?.[0]?.confidence >= HIGH_CONFIDENCE)
      .sort((a, b) => (suggestions[b.id][0].confidence - suggestions[a.id][0].confidence) || byDateDesc(a, b));
    const manual = review.filter((t) => !(suggestions[t.id]?.[0]?.confidence >= HIGH_CONFIDENCE)).sort(byDateDesc);
    return { auto, manual, matched: matched.sort(byDateDesc) };
  }, [filteredTxns, suggestions]);

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
    try {
      for (const { t, s } of targets) {
        try { await applyMatch(t, s); ok++; } catch (e) { /* continue */ }
      }
      toast({ title: `${ok} transaction${ok === 1 ? '' : 's'} reconciled`, description: 'Auto-matches approved.' });
      await load();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setBulkApproving(false); }
  };

  const openCategorise = (t) => { setMatchTarget(t); setMatchOpen(true); };
  const openSplit = (t) => { setSplitTarget(t); setSplitOpen(true); };
  const openEdit = (t) => { setEditing(t); setFormOpen(true); };

  const askAbout = (t) => {
    const amt = gbp(Number(t.money_in || 0) + Number(t.money_out || 0));
    setAskSeed(`Explain this transaction: "${t.description}" on ${fmtDate(t.date)} for ${amt}.`);
  };

  const pickAttention = (txnId) => {
    setHighlightId(txnId);
    setTimeout(() => {
      document.getElementById(`txn-${txnId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    setTimeout(() => setHighlightId(null), 2500);
  };

  const handleSave = async (data) => {
    try {
      const payload = { ...data, company_id: activeCompany.id };
      if (editing) await base44.entities.BankTransaction.update(editing.id, payload);
      else await base44.entities.BankTransaction.create(payload);
      toast({ title: editing ? 'Transaction updated' : 'Transaction recorded' });
      setFormOpen(false);
      await load();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  const GroupHeader = ({ label, count, action }) => (
    <div className="flex items-center justify-between mt-5 mb-2 first:mt-0">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      {action}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Banking &amp; Reconciliation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? 'Loading your transactions…' : (
              metrics.remaining === 0
                ? 'All transactions reconciled — nothing left to do.'
                : <>Next: <span className="font-medium text-foreground">{nextAction.label}</span> — {nextAction.reason}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All accounts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {bankAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="w-4 h-4" /> Import</Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
        </div>
      </div>

      {/* Bank dashboard — six KPIs answering the first four questions */}
      <ReconKpiBar metrics={metrics} loading={loading} />

      {/* Two-column workspace */}
      <div className="grid lg:grid-cols-[7fr_3fr] gap-5 items-start">
        {/* LEFT — next action + transaction list */}
        <div className="space-y-4 min-w-0">
          {/* What should I do next */}
          {!loading && (
            <button
              type="button"
              onClick={() => nextAction.transactionId && pickAttention(nextAction.transactionId)}
              className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${nextAction.transactionId ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'} ${NEXT_TONE[nextAction.tone] || NEXT_TONE.info}`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/70 flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">What should I do next</p>
                <p className="text-sm font-semibold leading-tight">{nextAction.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{nextAction.reason}</p>
              </div>
              {nextAction.transactionId && <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            </button>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search transactions…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
          ) : filteredTxns.length === 0 ? (
            <div className="rounded-xl border bg-card shadow-sm flex flex-col items-center py-16">
              <Landmark className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">{search || accountFilter !== 'all' ? 'No transactions match your filters' : 'No bank transactions yet — import a CSV or add one.'}</p>
            </div>
          ) : (
            <div>
              {groups.auto.length > 0 && (
                <>
                  <GroupHeader label="Auto-matchable" count={groups.auto.length}
                    action={<Button size="sm" onClick={approveAllAuto} disabled={bulkApproving} className="h-7 gap-1 text-xs">{bulkApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve all</Button>} />
                  <div className="space-y-2">
                    {groups.auto.map((t) => (
                      <TransactionCard key={t.id} transaction={t} suggestion={suggestions[t.id]?.[0]} highlight={highlightId === t.id}
                        onApprove={(s) => approve(t, s)} onSplit={() => openSplit(t)} onCategorise={() => openCategorise(t)}
                        onFindMatch={() => openCategorise(t)} onAsk={() => askAbout(t)} onEdit={() => openEdit(t)} approving={approvingId === t.id} />
                    ))}
                  </div>
                </>
              )}

              {groups.manual.length > 0 && (
                <>
                  <GroupHeader label="Needs review" count={groups.manual.length} />
                  <div className="space-y-2">
                    {groups.manual.map((t) => (
                      <TransactionCard key={t.id} transaction={t} suggestion={suggestions[t.id]?.[0]} highlight={highlightId === t.id}
                        onApprove={(s) => approve(t, s)} onSplit={() => openSplit(t)} onCategorise={() => openCategorise(t)}
                        onFindMatch={() => openCategorise(t)} onAsk={() => askAbout(t)} onEdit={() => openEdit(t)} approving={approvingId === t.id} />
                    ))}
                  </div>
                </>
              )}

              {groups.matched.length > 0 && (
                <>
                  <GroupHeader label="Reconciled" count={groups.matched.length} />
                  <div className="space-y-2">
                    {groups.matched.map((t) => (
                      <TransactionCard key={t.id} transaction={t} suggestion={null} highlight={highlightId === t.id}
                        onApprove={() => {}} onSplit={() => {}} onCategorise={() => {}} onFindMatch={() => openCategorise(t)}
                        onAsk={() => askAbout(t)} onEdit={() => openEdit(t)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — progress, attention, ask */}
        <aside className="space-y-4 min-w-0 lg:sticky lg:top-20 self-start">
          <ReconProgress metrics={metrics} />
          <ReconAttentionCard items={attention} onPick={pickAttention} />
          <ReconAskPanel companyId={activeCompany?.id} seed={askSeed} />
        </aside>
      </div>

      {/* Dialogs */}
      <BankTransactionForm open={formOpen} onOpenChange={setFormOpen} editing={editing} onSave={handleSave} saving={false} />
      <MatchTransactionDialog open={matchOpen} onOpenChange={setMatchOpen} transaction={matchTarget} companyId={activeCompany?.id} onMatched={load} />
      <ReconciliationWorkflow open={splitOpen} onOpenChange={setSplitOpen} transaction={splitTarget} companyId={activeCompany?.id} onReconciled={load} />
      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} companyId={activeCompany?.id} onImported={load} />
    </div>
  );
}