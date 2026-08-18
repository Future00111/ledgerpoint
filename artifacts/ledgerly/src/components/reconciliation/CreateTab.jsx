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
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}{required && <span className="text-rose-500 ml-1">*</span>}</Label>
      {children}
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
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Who">
          <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Contact name (optional)" className="h-10 bg-white border-slate-200 shadow-sm focus-visible:ring-[#007bff]" />
        </Field>
        <Field label="What" required>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-[#007bff] font-medium"><SelectValue placeholder="Select nominal account" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Why">
        <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Description or reference" className="h-10 bg-white border-slate-200 shadow-sm focus-visible:ring-[#007bff]" />
      </Field>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Site">
          <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Location (optional)" className="h-10 bg-white border-slate-200 shadow-sm focus-visible:ring-[#007bff]" />
        </Field>
        <Field label="Tax rate">
          <Select value={taxRate} onValueChange={setTaxRate}>
            <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-[#007bff] font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0%</SelectItem>
              <SelectItem value="5">5%</SelectItem>
              <SelectItem value="20">20%</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      
      <Field label="Additional details">
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Optional notes..." className="bg-white border-slate-200 shadow-sm focus-visible:ring-[#007bff] resize-none text-sm p-3" />
      </Field>
      
      <div className="pt-2">
        <Button 
          onClick={submit} 
          disabled={!category} 
          className="w-full h-11 bg-[#007bff] hover:bg-[#0062cc] text-white font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
        >
          Add & reconcile
        </Button>
      </div>
    </div>
  );
}
