import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Scan, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ScanConfigForm from '@/components/email_capture/ScanConfigForm';
import CaptureLog from '@/components/email_capture/CaptureLog';

export default function EmailRules() {
  const { activeCompany } = useCompany();
  const [scanning, setScanning] = useState(false);
  const [logRefresh, setLogRefresh] = useState(0);
  const { toast } = useToast();

  const handleScan = async () => {
    if (!activeCompany) return;
    setScanning(true);
    try {
      const res = await base44.functions.invoke('mockScanEmails', { company_id: activeCompany.id });
      toast({ title: `Scan complete: ${res.data.documents_found} captured, ${res.data.emails_ignored} ignored` });
      setLogRefresh(k => k + 1);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Scan failed', description: msg, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure how emails are scanned and view the capture log.</p>
        </div>
        <Button onClick={handleScan} disabled={scanning} className="gap-2">
          {scanning ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning...</> : <><Scan className="w-4 h-4" />Scan Now</>}
        </Button>
      </div>

      <ScanConfigForm companyId={activeCompany.id} />

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Email Capture Log</h2>
        <CaptureLog companyId={activeCompany.id} refreshKey={logRefresh} />
      </div>
    </div>
  );
}