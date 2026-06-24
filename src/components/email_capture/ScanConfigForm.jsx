import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ScanConfigForm({ companyId }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (companyId) loadConfig(); }, [companyId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.EmailScanConfig.filter({ company_id: companyId });
      const existing = list[0] || {
        scan_mode: 'all',
        selected_senders: '',
        ignored_senders: '',
        only_with_attachments: true,
        ignore_older_than: '',
      };
      setConfig(existing);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        scan_mode: config.scan_mode,
        selected_senders: config.selected_senders,
        ignored_senders: config.ignored_senders,
        only_with_attachments: config.only_with_attachments,
        ignore_older_than: config.ignore_older_than || null,
      };
      if (config.id) {
        await base44.entities.EmailScanConfig.update(config.id, data);
      } else {
        await base44.entities.EmailScanConfig.create({ company_id: companyId, ...data });
      }
      toast({ title: 'Scan configuration saved' });
      await loadConfig();
    } catch (e) { toast({ title: 'Error saving configuration', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (loading || !config) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 sm:p-6 space-y-5">
        <p className="text-sm font-medium">Scan Configuration</p>

        <div className="space-y-2">
          <Label>Scan Mode</Label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border transition-colors ${config.scan_mode === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
              <input type="radio" checked={config.scan_mode === 'all'} onChange={() => setConfig({ ...config, scan_mode: 'all' })} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Scan all emails</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border transition-colors ${config.scan_mode === 'selected_senders' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
              <input type="radio" checked={config.scan_mode === 'selected_senders'} onChange={() => setConfig({ ...config, scan_mode: 'selected_senders' })} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Scan only selected senders</span>
            </label>
          </div>
        </div>

        {config.scan_mode === 'selected_senders' && (
          <div className="space-y-2">
            <Label>Selected Senders</Label>
            <Textarea
              placeholder="Enter sender email addresses, one per line or comma-separated&#10;e.g. invoices@supplier.com, billing@vendor.com"
              value={config.selected_senders}
              onChange={e => setConfig({ ...config, selected_senders: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Only emails from these senders will be scanned</p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Ignored Senders</Label>
          <Textarea
            placeholder="Enter sender email addresses to ignore, one per line or comma-separated&#10;e.g. noreply@newsletter.com, marketing@store.com"
            value={config.ignored_senders}
            onChange={e => setConfig({ ...config, ignored_senders: e.target.value })}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">Emails from these senders will always be skipped</p>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>Only scan emails with attachments</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Skip emails without file attachments</p>
          </div>
          <Switch checked={config.only_with_attachments} onCheckedChange={v => setConfig({ ...config, only_with_attachments: v })} />
        </div>

        <div className="space-y-2">
          <Label>Ignore emails older than</Label>
          <Input
            type="date"
            value={config.ignore_older_than || ''}
            onChange={e => setConfig({ ...config, ignore_older_than: e.target.value })}
            className="sm:w-48"
          />
          <p className="text-xs text-muted-foreground">Emails older than this date will be skipped</p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}