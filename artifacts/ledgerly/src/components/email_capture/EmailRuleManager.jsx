import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Filter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DOC_TYPES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'purchase_invoice', label: 'Purchase Invoice' },
  { value: 'sales_invoice', label: 'Sales Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'credit_note', label: 'Credit Note' },
];

const ATTACH_TYPES = [
  { value: 'any', label: 'Any attachment' },
  { value: 'pdf', label: 'PDF only' },
  { value: 'image', label: 'Image only' },
];

export default function EmailRuleManager({ companyId }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', sender_contains: '', subject_contains: '', attachment_type: 'any', document_type: 'auto' });
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (companyId) loadRules(); }, [companyId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.EmailRule.filter({ company_id: companyId });
      setRules(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.name) { toast({ title: 'Rule name is required', variant: 'destructive' }); return; }
    setCreating(true);
    try {
      await base44.entities.EmailRule.create({ company_id: companyId, ...form, is_active: true });
      setForm({ name: '', sender_contains: '', subject_contains: '', attachment_type: 'any', document_type: 'auto' });
      toast({ title: 'Rule created' });
      await loadRules();
    } catch (e) { toast({ title: 'Error creating rule', variant: 'destructive' }); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await base44.entities.EmailRule.delete(id);
      toast({ title: 'Rule deleted' });
      await loadRules();
    } catch (e) { toast({ title: 'Error deleting rule', variant: 'destructive' }); }
  };

  const handleToggle = async (rule) => {
    try {
      await base44.entities.EmailRule.update(rule.id, { is_active: !rule.is_active });
      await loadRules();
    } catch (e) { toast({ title: 'Error updating rule', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Create a new rule</p>
          <Input placeholder="Rule name (e.g. 'Supplier Invoices')" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input placeholder="Sender contains (e.g. @supplier.com)" value={form.sender_contains} onChange={e => setForm({ ...form, sender_contains: e.target.value })} />
            <Input placeholder="Subject contains (e.g. invoice)" value={form.subject_contains} onChange={e => setForm({ ...form, subject_contains: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={form.attachment_type} onValueChange={v => setForm({ ...form, attachment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ATTACH_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.document_type} onValueChange={v => setForm({ ...form, document_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Rule
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : rules.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <Filter className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No rules created yet</p>
            <p className="text-xs text-muted-foreground mt-1">Rules help filter which emails are captured as documents</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {rules.map(rule => (
            <Card key={rule.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{rule.name}</p>
                      <Badge className={`text-xs ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      {rule.sender_contains && <span>Sender: "{rule.sender_contains}"</span>}
                      {rule.subject_contains && <span>Subject: "{rule.subject_contains}"</span>}
                      <span>Attachment: {ATTACH_TYPES.find(t => t.value === rule.attachment_type)?.label || 'Any'}</span>
                      <span>Type: {DOC_TYPES.find(t => t.value === rule.document_type)?.label || 'Auto'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(rule)}>{rule.is_active ? 'Disable' : 'Enable'}</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}