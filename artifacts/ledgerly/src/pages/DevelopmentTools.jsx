import React from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { useCanAccessDevTools } from '@/lib/devAccess';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, Building2, ArrowRight } from 'lucide-react';

const WORKFLOWS = [
  { label: 'Sales invoices', path: '/invoices', detail: 'Create, review and post customer invoices.' },
  { label: 'Purchase bills', path: '/bills', detail: 'Record supplier bills and their accounting entries.' },
  { label: 'Sales credits', path: '/sales-credit-notes', detail: 'Credit an existing customer invoice.' },
  { label: 'Supplier credits', path: '/supplier-credit-notes', detail: 'Record a credit against a supplier bill.' },
  { label: 'Chart of accounts', path: '/chart-of-accounts', detail: 'Manage nominal codes, names and report groups.' },
  { label: 'Ledger and reports', path: '/accounting/reports', detail: 'Review posted entries, balances and VAT workings.' },
];

export default function DevelopmentTools() {
  const { activeCompany } = useCompany();
  const canDev = useCanAccessDevTools();

  if (!canDev) return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <Wrench className="w-10 h-10 text-muted-foreground mb-3" />
      <h2 className="text-lg font-semibold">Access denied</h2>
      <p className="text-sm text-muted-foreground mt-1">Development tools are only available in development or to users with the Developer role.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl pb-28">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2"><Wrench className="w-5 h-5" />Development tools</h1>
        <p className="text-sm text-muted-foreground mt-1">Review sample records through the accounting workflows.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />Current company</CardTitle>
          <CardDescription>{activeCompany?.name || 'Choose a company to review its records.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm"><Link to="/companies">Choose company</Link></Button>
        </CardContent>
      </Card>
      {activeCompany && (
        <div className="grid gap-4 sm:grid-cols-2">
          {WORKFLOWS.map(workflow => (
            <Card key={workflow.path}>
              <CardHeader>
                <CardTitle className="text-base">{workflow.label}</CardTitle>
                <CardDescription>{workflow.detail}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm"><Link to={workflow.path}>Open {workflow.label.toLowerCase()}<ArrowRight className="w-4 h-4 ml-2" /></Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">Create sample invoices, bills and credits in these screens. Post them when ready, then review their ledger entries and reports.</p>
    </div>
  );
}
