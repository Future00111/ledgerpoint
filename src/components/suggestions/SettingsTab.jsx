import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SettingsTab() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [mode, setMode] = useState('hybrid');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    (async () => {
      setLoading(true);
      const list = await base44.entities.SuggestionSettings.filter({ company_id: activeCompany.id });
      if (list[0]) {
        setSettings(list[0]);
        setMode(list[0].mode || 'hybrid');
        setAiEnabled(list[0].ai_enabled !== false);
      } else {
        setSettings(null);
        setMode('hybrid');
        setAiEnabled(true);
      }
      setLoading(false);
    })();
  }, [activeCompany]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { company_id: activeCompany.id, mode, ai_enabled: mode === 'rules_only' ? false : aiEnabled };
      if (settings) {
        await base44.entities.SuggestionSettings.update(settings.id, payload);
      } else {
        const created = await base44.entities.SuggestionSettings.create(payload);
        setSettings(created);
      }
      toast({ title: 'Settings saved' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggestion Engine</CardTitle>
        <CardDescription>Control how ledger account suggestions are generated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Mode</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hybrid">Hybrid (Rules + History + AI)</SelectItem>
              <SelectItem value="rules_only">Rules Only (No AI)</SelectItem>
              <SelectItem value="ai_only">AI Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Enable AI suggestions</p>
            <p className="text-xs text-muted-foreground">Uses AI when rules and history can't decide.</p>
          </div>
          <Switch checked={mode === 'rules_only' ? false : aiEnabled} disabled={mode === 'rules_only'} onCheckedChange={setAiEnabled} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
      </CardContent>
    </Card>
  );
}