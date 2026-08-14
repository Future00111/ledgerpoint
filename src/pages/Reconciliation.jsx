import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Search, Filter, ChevronDown, Upload, Plus, Landmark } from 'lucide-react';
import ReconciliationRow from '@/components/reconciliation/ReconciliationRow';
import BankTransactionForm from '@/components/bank_transactions/BankTransactionForm';
import ReconciliationWorkflow from '@/components/bank_transactions/ReconciliationWorkflow';
import ImportCSVDialog from '@/components/bank_transactions/ImportCSVDialog';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'suggested', label: 'Suggested match' },
  { key: 'nomatch', label: 'No match' },
  { key: 'highvalue', label: 'High value' },
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
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [approvingId, setApprovingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
      } catch { setSuggestions({}); }
    } finally { setLoading(false); }
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

  const reviewList = useMemo(() => {
    const review = filteredTxns.filter((t) => t.status === 'review');
    const map = {};
    review.forEach((t) => {
      const k = `${(t.description || '').toLowerCase().trim()}|${txnAmount(t)}|${t.date}`;
      (map[k] = map[k] || []).push(t.id);
    });
    const dupIds = new Set(Object.values(map).filter((g) => g.length > 1).flat());
    let list = review.map((t) => ({ t, suggestion: suggestions[t.id]?.[0], isDup: dupIds.has(t.id) }));
    if (filter === 'suggested') list = list.filter((x) => x.suggestion);
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
    return list;
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

  const headerAccount = accountFilter !== 'all'
    ? (bankAccounts.find((a) => a.id === accountFilter)?.account_name || '')
    : (bankAccounts[0]?.account_name || '');

  const applyMatch = async (txn, rec) => {
    let updateData = { status: 'matched', linked_invoice_id: '', linked_bill_id: '' };
    const rt = rec.record_type;
    if (rt === 'sales_invoice') updateData = { ...updateData, matched_type: 'sales_invoice', matched_record_id: rec.record_id, matched_record_number: rec.record_number, linked_invoice_id: rec.record_id };
    else if (rt === 'purchase_bill') updateData = { ...updateData, matched_type: 'purchase_bill', matched_record_id: rec.record_id, matched_record_number: rec.record_number, linked_bill_id: rec.record_id };
    else if (rt === 'sales_credit_note') updateData = { ...updateData, matched_type: 'sales_credit_note', matched_record_id: rec.record_id, matched_record_number: rec.record_number };
    else if (rt === 'supplier_credit_note') updateData = { ...updateData, matched_type: 'supplier_credit_note', matched_record_id: rec.record_id, matched_record_number: rec.record_number };
    else if (rt === 'ledger_account') updateData = { ...updateData, matched_type: 'ledger_account', matched_record_id: rec.record_id || '', matched_record_number: rec.record_number || '' };
    await base44.entities.BankTransaction.update(txn.id, updateData);
    if (rt === 'sales_invoice' || rt === 'purchase_bill') {
      const amt = Number(txn.money_in || 0) || Number(txn.money_out || 0);
      if (amt > 0) await base44.functions.invoke('updatePaymentStatus', { entity_type: rt, record_id: rec.record_id, amount_paid_delta: amt });
    }
    return updateData;
  };

  const onMatch = async (txn, rec) => {
    if (!txn || !rec) return;
    setApprovingId(txn.id);
    try {
      const updateData = await applyMatch(txn, rec);
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...updateData } : t)));
      toast({ title: 'Reconciled', description: `Matched to ${rec.record_number}` });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const onCreate = async (txn, data) => {
    if (!txn) return;
    setApprovingId(txn.id);
    try {
      const updateData = { status: 'matched', matched_type: 'ledger_account', category: data.category, vat_rate: data.vat_rate, notes: data.notes };
      await base44.entities.BankTransaction.update(txn.id, updateData);
      setTransactions((prev) => prev.map((t) => (t.id === txn.id ? { ...t, ...updateData } : t)));
      toast({ title: 'Reconciled', description: 'Transaction categorised' });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const onTransfer = async (txn, data) => {
    if (!txn) return;
    setApprovingId(txn.id);
    try {
      const toAcc = bankAccounts.find((a) => a.id === data.to_account_id);
      const isIncome = Number(txn.money_in || 0) > 0;
      const created = await base44.entities.BankTransaction.create({
        company_id: activeCompany.id, bank_account_id: data.to_account_id, bank_account_name: toAcc?.account_name || '',
        date: txn.date, description: data.description || `Transfer ${isIncome ? 'from' : 'to'} ${txn.bank_account_name}`,
        reference: 'Transfer', money_in: isIncome ? 0 : data.amount, money_out: isIncome ? data.amount : 0, amount: data.amount, type: 'transfer',
        status: 'matched', matched_type: 'ledger_account', matched_record_number: `Transfer ${isIncome ? 'from' : 'to'} ${txn.bank_account_name}`, category: 'other',
      });
      const updateData = { status: 'matched', matched_type: 'ledger_account', matched_record_number: `Transfer to ${toAcc?.account_name || ''}`, reference: data.description || txn.reference };
      await base44.entities.BankTransaction.update(txn.id, updateData);
      setTransactions((prev) => [...prev.map((t) => (t.id === txn.id ? { ...t, ...updateData } : t)), created]);
      toast({ title: 'Reconciled', description: 'Transfer recorded' });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setApprovingId(null); }
  };

  const openSplit = (t) => { setSplitTarget(t); setSplitOpen(true); };

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
    <div className="bg-[#f4f7f9] min-h-full">
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-10">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-xs text-[#666]">Banking <span className="opacity-40 mx-0.5">/</span> Reconciliation</p>
            <h1 className="text-lg font-medium text-[#333] mt-0.5">Reconcile {headerAccount}</h1>
            <div className="mt-2 h-1 rounded-full bg-[#e5e7eb] overflow-hidden w-full md:w-64">
              <div className="h-full bg-[#007bff] rounded-full transition-all" style={{ width: `${metrics.completionPct}%` }} />
            </div>
            <p className="text-xs text-[#666] mt-1.5">{metrics.reconciled} completed · {metrics.remaining} remaining · Est. {estLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full md:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666]" />
              <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm bg-white border-[#cccccc]" />
            </div>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full md:w-40 h-9 text-sm bg-white border-[#cccccc]"><SelectValue placeholder="All accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-1.5 text-sm bg-white border-[#cccccc]"><Filter className="w-3.5 h-3.5" /><span className="hidden sm:inline">{currentFilterLabel}</span><ChevronDown className="w-3.5 h-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FILTERS.map((f) => <DropdownMenuItem key={f.key} onClick={() => setFilter(f.key)} className={filter === f.key ? 'font-medium' : ''}>{f.label}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" className="h-9 w-9 border-[#cccccc] bg-white" onClick={() => setImportOpen(true)} title="Import"><Upload className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9 border-[#cccccc] bg-white" onClick={() => { setEditing(null); setFormOpen(true); }} title="Add transaction"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Transaction blocks */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-7 h-7 border-[3px] border-[#cccccc] border-t-[#007bff] rounded-full animate-spin" /></div>
        ) : reviewList.length === 0 ? (
          <div className="flex flex-col items-center py-20 border border-[#cccccc] bg-white rounded-sm">
            <Landmark className="w-10 h-10 text-[#ccc] mb-3" />
            <p className="text-sm text-[#666]">{search || filter !== 'all' || accountFilter !== 'all' ? 'No transactions match your filters' : 'Nothing requiring review — all reconciled.'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviewList.map(({ t, suggestion }) => (
              <ReconciliationRow
                key={t.id}
                transaction={t}
                suggestions={suggestions[t.id] || (suggestion ? [suggestion] : [])}
                bankAccounts={bankAccounts}
                companyId={activeCompany.id}
                approving={approvingId === t.id}
                onMatch={(rec) => onMatch(t, rec)}
                onCreate={(data) => onCreate(t, data)}
                onTransfer={(data) => onTransfer(t, data)}
                onSplit={() => openSplit(t)}
              />
            ))}
          </div>
        )}

        <BankTransactionForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} editing={editing} onSave={handleSave} saving={false} />
        <ReconciliationWorkflow open={splitOpen} onOpenChange={setSplitOpen} transaction={splitTarget} companyId={activeCompany.id} onReconciled={load} />
        <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} companyId={activeCompany.id} onImported={load} />
      </div>
    </div>
  );
}