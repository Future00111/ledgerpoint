import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, Plus, Search, ArrowUpRight, ArrowDownRight, Pencil, Trash2, Link2, CheckCircle2, Upload } from 'lucide-react';
import moment from 'moment';
import BankTransactionForm from '@/components/bank_transactions/BankTransactionForm';
import MatchTransactionDialog from '@/components/bank_transactions/MatchTransactionDialog';
import ImportCSVDialog from '@/components/bank_transactions/ImportCSVDialog';
import { useToast } from '@/components/ui/use-toast';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const STATUS_STYLES = {
  unmatched: 'bg-muted text-muted-foreground',
  suggested: 'bg-amber-100 text-amber-700',
  matched: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-emerald-100 text-emerald-700',
};

const MATCHED_LABELS = {
  sales_invoice: 'Sales Invoice',
  purchase_bill: 'Purchase Bill',
  credit_note: 'Credit Note',
  manual: 'Manual',
};

export default function BankTransactions() {
  const { activeCompany } = useCompany();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [moneyFilter, setMoneyFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (activeCompany) loadTransactions(); }, [activeCompany]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.BankTransaction.filter({ company_id: activeCompany.id }, '-date', 200);
      setTransactions(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t) => { setEditing(t); setFormOpen(true); };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      const payload = { ...data, company_id: activeCompany.id };
      if (editing) {
        await base44.entities.BankTransaction.update(editing.id, payload);
        toast({ title: 'Transaction updated' });
      } else {
        await base44.entities.BankTransaction.create(payload);
        toast({ title: 'Transaction recorded' });
      }
      await loadTransactions();
      setFormOpen(false);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t) => {
    if (!confirm('Delete this transaction?')) return;
    try { await base44.entities.BankTransaction.delete(t.id); toast({ title: 'Deleted' }); await loadTransactions(); }
    catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const openMatch = (t) => { setMatchTarget(t); setMatchOpen(true); };

  const markReviewed = async (t) => {
    try { await base44.entities.BankTransaction.update(t.id, { status: 'reviewed' }); toast({ title: 'Marked as reviewed' }); await loadTransactions(); }
    catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const filtered = transactions.filter(t => {
    const matchSearch = t.description?.toLowerCase().includes(search.toLowerCase()) || t.reference?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchMoney = moneyFilter === 'all' || (moneyFilter === 'money_in' && (t.money_in || 0) > 0) || (moneyFilter === 'money_out' && (t.money_out || 0) > 0);
    return matchSearch && matchStatus && matchMoney;
  });

  const totalIn = filtered.reduce((s, t) => s + (t.money_in || 0), 0);
  const totalOut = filtered.reduce((s, t) => s + (t.money_out || 0), 0);

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Money In: <span className="text-emerald-600 font-medium">{formatCurrency(totalIn)}</span> ·
            Money Out: <span className="text-red-600 font-medium">{formatCurrency(totalOut)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="w-4 h-4" />Import CSV</Button>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add Transaction</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
            <SelectItem value="suggested">Suggested</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moneyFilter} onValueChange={setMoneyFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All money</SelectItem>
            <SelectItem value="money_in">Money In</SelectItem>
            <SelectItem value="money_out">Money Out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Landmark className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search || statusFilter !== 'all' || moneyFilter !== 'all' ? 'No transactions match' : 'No transactions yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map(t => (
            <Card key={t.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${(t.money_in || 0) > 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      {(t.money_in || 0) > 0 ? <ArrowDownRight className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{t.description}</p>
                        <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[t.status] || ''}`}>{t.status}</Badge>
                        {t.matched_type && t.matched_type !== 'manual' && t.matched_record_number && (
                          <Badge variant="outline" className="text-xs">{MATCHED_LABELS[t.matched_type]}: {t.matched_record_number}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {moment(t.date).format('DD MMM YYYY')}
                        {t.bank_account_name ? ` · ${t.bank_account_name}` : ''}
                        {t.reference ? ` · ${t.reference}` : ''}
                        {t.category ? ` · ${t.category.replace(/_/g, ' ')}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      {(t.money_in || 0) > 0 && <p className="text-sm font-semibold text-emerald-600">+{formatCurrency(t.money_in)}</p>}
                      {(t.money_out || 0) > 0 && <p className="text-sm font-semibold text-rose-600">-{formatCurrency(t.money_out)}</p>}
                      {t.balance != null && <p className="text-xs text-muted-foreground">Bal: {formatCurrency(t.balance)}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMatch(t)} title="Match"><Link2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markReviewed(t)} title="Mark as Reviewed" disabled={t.status === 'reviewed'}><CheckCircle2 className={`w-3.5 h-3.5 ${t.status === 'reviewed' ? 'text-emerald-500' : ''}`} /></Button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BankTransactionForm open={formOpen} onOpenChange={setFormOpen} editing={editing} onSave={handleSave} saving={saving} />
      <MatchTransactionDialog open={matchOpen} onOpenChange={setMatchOpen} transaction={matchTarget} companyId={activeCompany?.id} onMatched={loadTransactions} />
      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} companyId={activeCompany?.id} onImported={loadTransactions} />
    </div>
  );
}