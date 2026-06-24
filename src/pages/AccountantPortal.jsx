import React from 'react';
import { Briefcase, FileCheck, Calculator } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function AccountantPortal() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accountant Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">Share access with your accountant and review submissions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <CardTitle>Invite Accountant</CardTitle>
            <CardDescription>Grant your accountant secure access to your books.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <FileCheck className="w-5 h-5 text-primary" />
            </div>
            <CardTitle>Submissions</CardTitle>
            <CardDescription>Track VAT returns and filings shared with your accountant.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
            <CardTitle>Reports</CardTitle>
            <CardDescription>Generate and share financial reports for review.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}