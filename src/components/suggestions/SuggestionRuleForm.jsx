import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

const MATCH_TYPES = [
  { value: 'supplier_name_contains', label: 'Supplier name contains' },
  { value: 'description_contains', label: 'Description contains' },
  { value: 'category', label: 'Category equals' },
  { value: 'line_description_contains', label: 'Line item contains' },
];

export default function SuggestionRuleForm({ rule, open, onOpenChange, onSave }) {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: '', match_type: 'description_contains', match_value: '', target_account_id: '', priority: 0, is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rule) {
      setForm({ name: rule.name, match_type: rule.match_type, match_value: rule.match_value, target_account_id: rule.target_account_id || '', priority: rule.priority || 0, is_active: rule.is_active !== false });
    } else {
      setForm({ name: '', match_type: 'description_contains', match_value: '', target_account_id: '', priority: 0, is_active: true });
    }
  }, [rule, open]);

  useEffect(() => {
    if (!activeCompany) return;
    (async () => {
      const list = await base44.entities.ChartOfAccount.filter({ company_id: activeCompany.id });
      setAccounts(list.filter(a => a.is_active !== false));
    })();
  }, [activeCompany]);

  const handleSave = async () => {
    if (!form.name || !form.match_value || !form.target_account_id) {
      toast({ title: 'All fields required', variant: 'destructive' });
      return;
    }
    const acc = accounts.find(a => a.id === form.target_account_id);
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: activeCompany.id,
        target_account_code: acc.code,
        target_account_name: acc.name,
        priority: Number(form.priority) || 0,
      };
      if (rule) await base44.entities.SuggestionRule.update(rule.id, payload);
      else await base44.entities.SuggestionRule.create(payload);
      toast({ title: rule ? 'Rule updated' : 'Rule created' });
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Rule' : 'New Suggestion Rule'}</DialogTitle>
          <DialogDescription>Automation rules take priority over learned history and AI.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., British Gas → Utilities" />
          </div>
          <div>
            <Label>Match type</Label>
            <Select value={form.match_type} onValueChange={v => setForm({ ...form, match_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Match value</Label>
            <Input value={form.match_value} onChange={e => setForm({ ...form, match_value: e.target.value })} placeholder="e.g., british gas" />
          </div>
          <div>
            <Label>Ledger account</Label>
            <Select value={form.target_account_id} onValueChange={v => setForm({ ...form, target_account_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority (lower runs first)</Label>
            <Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} id="rule-active" />
            <Label htmlFor="rule-active">Active</Label>
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