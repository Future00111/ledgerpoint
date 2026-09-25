import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Download, Upload } from 'lucide-react';
import moment from 'moment';

export default function LearningTab() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    if (!activeCompany) return;
    setLoading(true);
    const list = await base44.entities.AccountLearning.filter({ company_id: activeCompany.id }, '-times_used');
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeCompany]);

  const reset = async () => {
    if (!window.confirm('Reset all learned preferences? This cannot be undone.')) return;
    setBusy(true);
    try {
      await base44.functions.invoke('manageLearning', { company_id: activeCompany.id, action: 'reset' });
      toast({ title: 'Learning reset' });
      load();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('manageLearning', { company_id: activeCompany.id, action: 'export' });
      const data = res?.data ?? res;
      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `learning-${activeCompany.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exported' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const importData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await base44.functions.invoke('manageLearning', { company_id: activeCompany.id, action: 'import', data });
      toast({ title: 'Imported' });
      load();
    } catch (err) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Business Learning</CardTitle>
          <CardDescription>Remembered preferences per supplier and customer.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportData} disabled={busy}><Download className="w-4 h-4" /> Export</Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="w-4 h-4" /> Import</Button>
          <Button size="sm" variant="destructive" onClick={reset} disabled={busy}><RefreshCw className="w-4 h-4" /> Reset</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importData} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No learned preferences yet. They build up as you post transactions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Party</th>
                  <th>Type</th>
                  <th>Preferred account</th>
                  <th>VAT</th>
                  <th>Terms</th>
                  <th>Times used</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{r.party_name || '—'}</td>
                    <td className="capitalize">{r.party_type}</td>
                    <td>{r.preferred_account_name} ({r.preferred_account_code})</td>
                    <td>{r.preferred_vat_rate ?? '—'}</td>
                    <td>{r.preferred_payment_terms ?? '—'}</td>
                    <td>{r.times_used}</td>
                    <td>{r.last_used_date ? moment(r.last_used_date).format('DD/MM/YY') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}