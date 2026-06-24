import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function SetupStep4BankAccount({ companyId, data, onUpdate }) {
  const [formData, setFormData] = useState(data || {
    account_name: '',
    bank_name: '',
    sort_code: '',
    account_number: '',
    opening_balance: 0,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'opening_balance' ? parseFloat(value) || 0 : value }));
  };

  const handleSave = async () => {
    if (!formData.account_name.trim() || !formData.bank_name.trim() || !formData.sort_code.trim() || !formData.account_number.trim()) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const account = await base44.entities.BankAccount.create({
        company_id: companyId,
        account_name: formData.account_name,
        bank_name: formData.bank_name,
        sort_code: formData.sort_code,
        account_number: formData.account_number,
        opening_balance: formData.opening_balance,
        current_balance: formData.opening_balance,
        status: 'active',
        connection_type: 'manual',
      });
      onUpdate(account);
      toast({ title: 'Bank account created successfully' });
    } catch (e) {
      toast({ title: 'Error creating bank account', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="account_name">Account Name *</Label>
          <Input
            id="account_name"
            name="account_name"
            placeholder="e.g., Business Account"
            value={formData.account_name}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="bank_name">Bank Name *</Label>
          <Input
            id="bank_name"
            name="bank_name"
            placeholder="e.g., Barclays"
            value={formData.bank_name}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sort_code">Sort Code (XX-XX-XX) *</Label>
            <Input
              id="sort_code"
              name="sort_code"
              placeholder="20-20-20"
              value={formData.sort_code}
              onChange={handleChange}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="account_number">Account Number *</Label>
            <Input
              id="account_number"
              name="account_number"
              placeholder="12345678"
              value={formData.account_number}
              onChange={handleChange}
              className="mt-2"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="opening_balance">Opening Balance (£)</Label>
          <Input
            id="opening_balance"
            name="opening_balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.opening_balance}
            onChange={handleChange}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-2">The balance when you started using LedgerPoint</p>
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Creating...' : 'Create Bank Account & Continue'}
        </Button>
      </div>
    </div>
  );
}