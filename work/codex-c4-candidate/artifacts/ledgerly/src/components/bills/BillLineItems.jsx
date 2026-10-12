import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const VAT_RATES = [
  { value: '20', label: '20% (Standard)' },
  { value: '5', label: '5% (Reduced)' },
  { value: '0', label: '0% (Zero)' },
  { value: 'exempt', label: 'Exempt' },
  { value: 'no_vat', label: 'No VAT' },
];

const CATEGORIES = [
  { value: 'parts', label: 'Parts' },
  { value: 'tools', label: 'Tools' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'wages', label: 'Wages' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'office', label: 'Office' },
  { value: 'professional_fees', label: 'Prof. Fees' },
  { value: 'other', label: 'Other' },
];

function getVatRate(vatRate) {
  const n = parseFloat(vatRate);
  return isNaN(n) ? 0 : n;
}

export default function BillLineItems({ lineItems, onChange }) {
  const addLine = () => {
    onChange([...lineItems, { description: '', quantity: 1, unit_price: 0, vat_rate: '20', amount: 0, vat_amount: 0, line_total: 0, category: 'other' }]);
  };

  const updateLine = (idx, field, value) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    const qty = parseFloat(updated[idx].quantity) || 0;
    const price = parseFloat(updated[idx].unit_price) || 0;
    const rate = getVatRate(updated[idx].vat_rate);
    updated[idx].amount = qty * price;
    updated[idx].vat_amount = rate > 0 ? updated[idx].amount * (rate / 100) : 0;
    updated[idx].line_total = updated[idx].amount + updated[idx].vat_amount;
    onChange(updated);
  };

  const removeLine = (idx) => {
    onChange(lineItems.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="hidden lg:grid lg:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
        <span className="col-span-2">Description</span>
        <span className="col-span-1">Qty</span>
        <span className="col-span-1">Unit Price</span>
        <span className="col-span-2">VAT Rate</span>
        <span className="col-span-2">Category</span>
        <span className="col-span-1 text-right">Net</span>
        <span className="col-span-1 text-right">VAT</span>
        <span className="col-span-1 text-right">Gross</span>
        <span className="col-span-1" />
      </div>
      {lineItems.map((line, idx) => (
        <div key={idx} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
          <Input className="lg:col-span-2" placeholder="Description" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
          <Input className="lg:col-span-1" type="number" min="0" step="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
          <Input className="lg:col-span-1" type="number" min="0" step="0.01" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
          <div className="lg:col-span-2">
            <Select value={String(line.vat_rate)} onValueChange={v => updateLine(idx, 'vat_rate', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VAT_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Select value={line.category || 'other'} onValueChange={v => updateLine(idx, 'category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-1 flex items-center justify-end h-9 text-xs font-medium">£{(line.amount || 0).toFixed(2)}</div>
          <div className="lg:col-span-1 flex items-center justify-end h-9 text-xs font-medium">£{(line.vat_amount || 0).toFixed(2)}</div>
          <div className="lg:col-span-1 flex items-center justify-end h-9 text-xs font-semibold">£{(line.line_total || 0).toFixed(2)}</div>
          <div className="lg:col-span-1 flex justify-end">
            <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5 mt-1">
        <Plus className="w-3.5 h-3.5" />Add Line
      </Button>
    </div>
  );
}