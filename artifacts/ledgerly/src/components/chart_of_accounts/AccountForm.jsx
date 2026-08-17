import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function AccountForm({ account, open, onOpenChange, onSave, onCreated }) {
  const { activeCompany } = useCompany();
  const [form, setForm] = useState({ code: '', name: '', type: 'expense', tax_rate: 0, description: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (account) {
      setForm({
        code: account.code || '',
        name: account.name || '',
        type: account.type || 'expense',
        tax_rate: account.tax_rate || 0,
        description: account.description || '',
        is_active: account.is_active !== false,
      });
    } else {
      setForm({ code: '', name: '', type: 'expense', tax_rate: 0, description: '', is_active: true });
    }
  }, [account, open]);

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Validation error', description: 'Code and name are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...form,
        company_id: activeCompany.id,
        tax_rate: parseFloat(form.tax_rate) || 0,
      };

      if (account) {
        await base44.entities.ChartOfAccount.update(account.id, data);
        toast({ title: 'Account updated' });
        if (onCreated) onCreated({ id: account.id, ...data });
      } else {
        const created = await base44.entities.ChartOfAccount.create(data);
        toast({ title: 'Account created' });
        if (onCreated) onCreated(created);
      }

      onOpenChange(false);
      await onSave();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'New Account'}</DialogTitle>
          <DialogDescription>
            {account ? 'Update account details' : 'Create a new chart of account entry'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Account Code</Label>
            <Input
              id="code"
              placeholder="e.g., 4000"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              placeholder="e.g., Sales"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Account Type</Label>
            <Select value={form.type} onValueChange={type => setForm({ ...form, type })}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="cost_of_sales">Cost of Sales</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="vat">VAT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_rate">Tax Rate (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              placeholder="0"
              value={form.tax_rate}
              onChange={e => setForm({ ...form, tax_rate: e.target.value })}
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Additional notes..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}