import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const CURRENCIES = ['GBP', 'EUR', 'USD'];

export default function BankAccountForm({ account, open, onOpenChange, onSave, companyId }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    account_name: '',
    bank_name: '',
    sort_code: '',
    account_number: '',
    currency: 'GBP',
    opening_balance: 0,
    status: 'active',
    notes: '',
  });

  useEffect(() => {
    if (account) {
      setFormData(account);
    } else {
      setFormData({
        account_name: '',
        bank_name: '',
        sort_code: '',
        account_number: '',
        currency: 'GBP',
        opening_balance: 0,
        status: 'active',
        notes: '',
      });
    }
  }, [account, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.account_name || !formData.bank_name || !formData.sort_code || !formData.account_number) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (account) {
        await base44.entities.BankAccount.update(account.id, formData);
        toast({ title: 'Account updated' });
      } else {
        await base44.entities.BankAccount.create({
          ...formData,
          company_id: companyId,
          current_balance: formData.opening_balance,
        });
        toast({ title: 'Account created' });
      }
      onSave();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="account_name">Account Name *</Label>
            <Input
              id="account_name"
              placeholder="e.g., Business Account"
              value={formData.account_name}
              onChange={e => setFormData({ ...formData, account_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="bank_name">Bank Name *</Label>
            <Input
              id="bank_name"
              placeholder="e.g., Barclays"
              value={formData.bank_name}
              onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="sort_code">Sort Code *</Label>
            <Input
              id="sort_code"
              placeholder="XX-XX-XX"
              value={formData.sort_code}
              onChange={e => setFormData({ ...formData, sort_code: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="account_number">Account Number *</Label>
            <Input
              id="account_number"
              placeholder="12345678"
              value={formData.account_number}
              onChange={e => setFormData({ ...formData, account_number: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={val => setFormData({ ...formData, currency: val })}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(curr => (
                    <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="opening_balance">Opening Balance</Label>
              <Input
                id="opening_balance"
                type="number"
                step="0.01"
                value={formData.opening_balance}
                onChange={e => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={val => setFormData({ ...formData, status: val })}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Optional notes"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}