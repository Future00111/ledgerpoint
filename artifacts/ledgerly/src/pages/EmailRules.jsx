import React from 'react';
import { EmailCaptureAvailability } from './EmailCapture';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Scan } from 'lucide-react';
import ScanConfigForm from '@/components/email_capture/ScanConfigForm';
import CaptureLog from '@/components/email_capture/CaptureLog';

export default function EmailRules() {
  const { activeCompany } = useCompany();
  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">Save preferences for future email capture and review historical records.</p>
        </div>
        <Button disabled className="gap-2"><Scan className="w-4 h-4" />Scanning unavailable</Button>
      </div>
      <EmailCaptureAvailability />

      <ScanConfigForm companyId={activeCompany.id} />

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Email Capture Log</h2>
        <CaptureLog companyId={activeCompany.id} refreshKey={0} />
      </div>
    </div>
  );
}