import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = [
  { value: 'sales', label: 'Sales' },
  { value: 'parts', label: 'Parts' },
  { value: 'tools', label: 'Tools' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'wages', label: 'Wages' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'office', label: 'Office' },
  { value: 'professional_fees', label: 'Professional fees' },
  { value: 'bank_charges', label: 'Bank charges' },
  { value: 'other', label: 'Other' },
];

function Field({ label, required, children }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function CreateTab({ transaction, onCreate }) {
  const [who, setWho] = useState('');
  const [category, setCategory] = useState('');
  const [why, setWhy] = useState('');
  const [site, setSite] = useState('');
  const [taxRate, setTaxRate] = useState('20');
  const [details, setDetails] = useState('');

  const submit = () => {
    if (!category) return;
    const notes = [who && `Who: ${who}`, why, site && `Site: ${site}`, details].filter(Boolean).join('\n');
    onCreate({ category, vat_rate: taxRate, notes });
  };

  return (
    <div className="space-y-3">
      <Field label="Who">
        <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Contact name (optional)" className="h-9 text-sm" />
      </Field>
      <Field label="What" required>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nominal account" /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Why">
        <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Description" className="h-9 text-sm" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Site">
          <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
        </Field>
        <Field label="Tax rate">
          <Select value={taxRate} onValueChange={setTaxRate}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0%</SelectItem>
              <SelectItem value="5">5%</SelectItem>
              <SelectItem value="20">20%</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Add details">
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Optional" className="text-sm" />
      </Field>
      <div className="pt-1">
        <Button size="sm" onClick={submit} disabled={!category} className="h-8 w-full">Add &amp; reconcile</Button>
      </div>
    </div>
  );
}