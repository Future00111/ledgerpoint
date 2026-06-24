import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Landmark, Plus, Search, ArrowUpRight, ArrowDownRight, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const CATEGORIES = [
  { value: 'sales', label: 'Sales' },
  { value: 'parts', label: 'Parts & Materials' },
  { value: 'tools', label: 'Tools & Equipment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'wages', label: 'Wages' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'professional_fees', label: 'Professional Fees' },
  { value: 'bank_charges', label: 'Bank Charges' },
  { value: 'other', label: 'Other' },
];

export default function BankTransactions() {
  const { activeCompany } = useCompany();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const { toast } = useToast();

  const emptyForm = {
    date: new Date().toISOString().split('T')[0], description: '', type: 'income',
    amount: '', category: 'other', reference: '', vat_amount: '', notes: ''
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (activeCompany) loadTransactions();
  }, [activeCompany]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.BankTransaction.filter({ company_id: activeCompany.id }, '-date', 200);
      setTransactions(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      date: t.date || '', description: t.description || '', type: t.type || 'income',
      amount: t.amount || '', category: t.category || 'other', reference: t.reference || '',
      vat_amount: t.vat_amount || '', notes: t.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) || 0, vat_amount: parseFloat(form.vat_amount) || 0, company_id: activeCompany.id };
    try {
      if (editing) {
        await base44.entities.BankTransaction.update(editing.id, data);
        toast({ title: 'Transaction updated' });
      } else {
        await base44.entities.BankTransaction.create(data);
        toast({ title: 'Transaction recorded' });
      }
      await loadTransactions();
      setDialogOpen(false);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const toggleReconciled = async (t) => {
    try {
      await base44.entities.BankTransaction.update(t.id, { reconciled: !t.reconciled });
      await loadTransactions();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const handleDelete = async (t) => {
    if (!confirm('Delete this transaction?')) return;
    try { await base44.entities.BankTransaction.delete(t.id); toast({ title: 'Deleted' }); await loadTransactions(); }
    catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const filtered = transactions.filter(t => {
    const matchSearch = t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.reference?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Income: <span className="text-emerald-600 font-medium">{formatCurrency(totalIncome)}</span> · 
            Expenses: <span className="text-red-600 font-medium">{formatCurrency(totalExpenses)}</span>
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add Transaction</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Landmark className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search || typeFilter !== 'all' ? 'No transactions match' : 'No transactions yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map(t => (
            <Card key={t.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${t.type === 'income' ? 'bg-emerald-50' : t.type === 'expense' ? 'bg-rose-50' : 'bg-blue-50'}`}>
                    {t.type === 'income' ? <ArrowDownRight className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{t.description}</p>
                      {t.reconciled && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{moment(t.date).format('DD MMM YYYY')} · {t.category?.replace(/_/g, ' ')}{t.reference ? ` · ${t.reference}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : ''}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleReconciled(t)} title={t.reconciled ? 'Unreconcile' : 'Reconcile'}>
                    <CheckCircle2 className={`w-4 h-4 ${t.reconciled ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(t)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Transaction' : 'New Transaction'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description *</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What was this payment for?" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (£) *</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
              <div><Label>VAT Amount (£)</Label><Input type="number" min="0" step="0.01" value={form.vat_amount} onChange={e => setForm({...form, vat_amount: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.description.trim() || !form.amount}>{saving ? 'Saving...' : editing ? 'Save' : 'Record'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}