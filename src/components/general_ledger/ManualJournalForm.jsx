import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export default function ManualJournalForm({ open, onOpenChange, onSave }) {
  const { activeCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([{ account_id: '', debit: '', credit: '' }]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && activeCompany) loadAccounts();
  }, [open, activeCompany]);

  const loadAccounts = async () => {
    try {
      const list = await base44.entities.ChartOfAccount.filter({ company_id: activeCompany.id });
      setAccounts(list.filter(a => a.is_active));
    } catch (e) {
      console.error(e);
    }
  };

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const isValid = isBalanced && reference.trim() && description.trim() && lines.length > 0 && lines.every(l => l.account_id && (l.debit || l.credit));

  const handleSave = async () => {
    if (!isValid) {
      toast({ title: 'Form is invalid', description: 'Please balance the journal and fill required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      for (const line of lines) {
        const debit = parseFloat(line.debit) || 0;
        const credit = parseFloat(line.credit) || 0;
        if (debit > 0 || credit > 0) {
          const account = accounts.find(a => a.id === line.account_id);
          await base44.entities.JournalEntry.create({
            company_id: activeCompany.id,
            date,
            reference,
            description,
            account_id: line.account_id,
            account_code: account?.code,
            account_name: account?.name,
            debit,
            credit,
            source_type: 'manual_journal',
            is_system_generated: false,
          });
        }
      }
      toast({ title: 'Journal entries created' });
      onSave();
      onOpenChange(false);
      setReference('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setLines([{ account_id: '', debit: '', credit: '' }]);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Manual Journal Entry</DialogTitle>
          <DialogDescription>Debit and credit entries must balance.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g., MJ-001" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Purpose of this journal entry" rows={2} />
          </div>

          {/* Lines */}
          <div className="space-y-3">
            <Label>Entries</Label>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <Select value={line.account_id} onValueChange={v => {
                  const updated = [...lines];
                  updated[idx].account_id = v;
                  setLines(updated);
                }}>
                  <SelectTrigger className="col-span-5">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="col-span-3">
                  <Label className="text-xs">Debit</Label>
                  <Input type="number" min="0" step="0.01" value={line.debit} onChange={e => {
                    const updated = [...lines];
                    updated[idx].debit = e.target.value;
                    setLines(updated);
                  }} placeholder="0.00" />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Credit</Label>
                  <Input type="number" min="0" step="0.01" value={line.credit} onChange={e => {
                    const updated = [...lines];
                    updated[idx].credit = e.target.value;
                    setLines(updated);
                  }} placeholder="0.00" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, i) => i !== idx))} disabled={lines.length === 1} className="col-span-1 h-9">
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, { account_id: '', debit: '', credit: '' }])}>
              + Add line
            </Button>
          </div>

          {/* Balance Summary */}
          <div className={`p-3 rounded border ${isBalanced ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-start gap-2">
              {!isBalanced && <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
              <div className="text-sm">
                <p className={`font-medium ${isBalanced ? 'text-emerald-900' : 'text-red-900'}`}>
                  {isBalanced ? '✓ Journal is balanced' : '✗ Journal is not balanced'}
                </p>
                <p className={`text-xs ${isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>
                  Debits: {gbp.format(totalDebits)} | Credits: {gbp.format(totalCredits)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !isValid}>{saving ? 'Saving...' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}