import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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

const VAT_RATES = [
  { value: '20', label: '20% Standard' },
  { value: '5', label: '5% Reduced' },
  { value: '0', label: '0% Zero' },
  { value: 'exempt', label: 'Exempt' },
];

function calcVatAmount(gross, rate) {
  const g = parseFloat(gross) || 0;
  const r = parseFloat(rate);
  if (!r || isNaN(r)) return 0;
  return Math.round((g - g / (1 + r / 100)) * 100) / 100;
}

export default function BankTransactionForm({ open, onOpenChange, editing, onSave, saving }) {
  const emptyForm = {
    bank_account_name: '', date: new Date().toISOString().split('T')[0], description: '',
    reference: '', money_in: '', money_out: '', balance: '', category: 'other',
    vat_rate: '0', notes: ''
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editing) {
      setForm({
        bank_account_name: editing.bank_account_name || '',
        date: editing.date || '',
        description: editing.description || '',
        reference: editing.reference || '',
        money_in: editing.money_in || '',
        money_out: editing.money_out || '',
        balance: editing.balance || '',
        category: editing.category || 'other',
        vat_rate: editing.vat_rate || '0',
        notes: editing.notes || ''
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing, open]);

  const gross = parseFloat(form.money_in) || parseFloat(form.money_out) || 0;
  const vatAmount = calcVatAmount(gross, form.vat_rate);

  const handleSubmit = () => {
    const moneyIn = parseFloat(form.money_in) || 0;
    const moneyOut = parseFloat(form.money_out) || 0;
    const data = {
      ...form,
      money_in: moneyIn,
      money_out: moneyOut,
      balance: parseFloat(form.balance) || 0,
      vat_amount: vatAmount,
      type: moneyIn > 0 ? 'income' : 'expense',
      amount: moneyIn || moneyOut,
    };
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit Transaction' : 'New Transaction'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Bank Account Name</Label><Input value={form.bank_account_name} onChange={e => setForm({ ...form, bank_account_name: e.target.value })} placeholder="e.g. Business Current Account" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Transaction Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
          </div>
          <div><Label>Description *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What was this transaction for?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Money In (£)</Label><Input type="number" min="0" step="0.01" value={form.money_in} onChange={e => setForm({ ...form, money_in: e.target.value })} /></div>
            <div><Label>Money Out (£)</Label><Input type="number" min="0" step="0.01" value={form.money_out} onChange={e => setForm({ ...form, money_out: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Balance (£)</Label><Input type="number" step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} /></div>
            <div>
              <Label>VAT Rate</Label>
              <Select value={form.vat_rate} onValueChange={v => setForm({ ...form, vat_rate: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VAT_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {vatAmount > 0 && <p className="text-xs text-muted-foreground">VAT amount: £{vatAmount.toFixed(2)}</p>}
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.description.trim() || (!form.money_in && !form.money_out)}>{saving ? 'Saving...' : editing ? 'Save' : 'Record'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}