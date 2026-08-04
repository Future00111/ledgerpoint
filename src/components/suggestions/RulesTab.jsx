import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import SuggestionRuleForm from './SuggestionRuleForm';

const MATCH_LABELS = {
  supplier_name_contains: 'Supplier contains',
  description_contains: 'Description contains',
  category: 'Category',
  line_description_contains: 'Line contains',
};

export default function RulesTab() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [rules, setRules] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!activeCompany) return;
    setLoading(true);
    const list = await base44.entities.SuggestionRule.filter({ company_id: activeCompany.id }, 'priority');
    setRules(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeCompany]);

  const remove = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    await base44.entities.SuggestionRule.delete(id);
    load();
    toast({ title: 'Rule deleted' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Automation Rules</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4" /> New rule</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules yet. Rules take priority over learned history and AI.</p>
        ) : (
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {r.name}
                    {!r.is_active && <Badge variant="secondary">inactive</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {MATCH_LABELS[r.match_type]}: "{r.match_value}" → {r.target_account_name} ({r.target_account_code})
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <SuggestionRuleForm rule={editing} open={open} onOpenChange={setOpen} onSave={load} />
    </Card>
  );
}