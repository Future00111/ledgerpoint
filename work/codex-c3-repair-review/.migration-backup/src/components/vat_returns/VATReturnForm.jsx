import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import moment from 'moment';

const SCHEMES = [
  { value: 'standard', label: 'Standard Accounting' },
  { value: 'cash_accounting', label: 'Cash Accounting' },
  { value: 'flat_rate', label: 'Flat Rate' },
];

export default function VATReturnForm({ open, onOpenChange, companyScheme, onCreate, creating }) {
  const [form, setForm] = useState({
    period_start: moment().startOf('quarter').format('YYYY-MM-DD'),
    period_end: moment().endOf('quarter').format('YYYY-MM-DD'),
    vat_scheme: 'standard',
  });

  useEffect(() => {
    if (open) {
      setForm({
        period_start: moment().startOf('quarter').format('YYYY-MM-DD'),
        period_end: moment().endOf('quarter').format('YYYY-MM-DD'),
        vat_scheme: companyScheme || 'standard',
      });
    }
  }, [open, companyScheme]);

  const handleSubmit = () => {
    onCreate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create VAT Return</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>VAT Period Start *</Label>
              <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} />
            </div>
            <div>
              <Label>VAT Period End *</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>VAT Scheme</Label>
            <Select value={form.vat_scheme} onValueChange={v => setForm({ ...form, vat_scheme: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCHEMES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">VAT figures will be calculated automatically from sales invoices, purchase bills, and credit notes within the period. Draft and cancelled documents are excluded.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={creating || !form.period_start || !form.period_end || form.period_start > form.period_end}>
            {creating ? 'Calculating...' : 'Create & Calculate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}