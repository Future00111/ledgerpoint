import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const VAT_RATES = [
  { value: '20', label: '20% (Standard)' },
  { value: '5', label: '5% (Reduced)' },
  { value: '0', label: '0% (Zero)' },
  { value: '-1', label: 'Exempt' },
];

export default function InvoiceLineItems({ lineItems, onChange }) {
  const addLine = () => {
    onChange([...lineItems, { description: '', quantity: 1, unit_price: 0, vat_rate: 20, amount: 0, vat_amount: 0 }]);
  };

  const updateLine = (idx, field, value) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    const qty = parseFloat(updated[idx].quantity) || 0;
    const price = parseFloat(updated[idx].unit_price) || 0;
    const vatRate = parseFloat(updated[idx].vat_rate);
    updated[idx].amount = qty * price;
    updated[idx].vat_amount = vatRate > 0 ? updated[idx].amount * (vatRate / 100) : 0;
    onChange(updated);
  };

  const removeLine = (idx) => {
    onChange(lineItems.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
        <span className="col-span-4">Description</span>
        <span className="col-span-2">Qty</span>
        <span className="col-span-2">Unit Price</span>
        <span className="col-span-2">VAT Rate</span>
        <span className="col-span-1 text-right">Amount</span>
        <span className="col-span-1" />
      </div>
      {lineItems.map((line, idx) => (
        <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
          <Input className="sm:col-span-4" placeholder="Description" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
          <Input className="sm:col-span-2" type="number" min="0" step="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
          <Input className="sm:col-span-2" type="number" min="0" step="0.01" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
          <div className="sm:col-span-2">
            <Select value={String(line.vat_rate)} onValueChange={v => updateLine(idx, 'vat_rate', parseFloat(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VAT_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-1 flex items-center justify-end h-10 text-sm font-medium">
            £{(line.amount || 0).toFixed(2)}
          </div>
          <div className="sm:col-span-1 flex justify-end">
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