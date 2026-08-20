import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, FileText, Gavel, Mail, RefreshCw, ShieldAlert, Wallet,
} from 'lucide-react';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { aiApi } from '@/components/ai-accountant/api';
import ReminderDraftDialog from '@/components/collections/ReminderDraftDialog';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const fmt = (date) => date ? new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const PRIORITY_STYLES = {
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};
const RISK_STYLES = {
  high: 'bg-rose-50 text-rose-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-emerald-50 text-emerald-700',
};

export default function Collections() {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      setOverview(await aiApi.collectionsOverview(activeCompany.id));
    } catch (error) {
      toast({ title: 'Could not load collections', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, toast]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    if (!activeCompany?.id) return;
    setRefreshing(true);
    try {
      await aiApi.refreshCollections(activeCompany.id);
      await load();
      toast({ title: 'Collection priorities refreshed', description: 'No invoices or payments were changed.' });
    } catch (error) {
      toast({ title: 'Could not refresh collections', description: error.message, variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const invoices = useMemo(() => {
    const rows = overview?.overdue_invoices || [];
    return filter === 'all' ? rows : rows.filter((row) => row.priority === filter);
  }, [overview, filter]);
  const summary = overview?.summary;

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 -mt-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:-mt-6 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold"><Gavel className="h-5 w-5 text-primary" /> Customer collections</h1>
              <p className="text-sm text-muted-foreground">Live overdue debt and approval-first payment reminders · {activeCompany?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} /> {refreshing ? 'Refreshing...' : 'Refresh analysis'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Wallet} label="Total outstanding" value={gbp.format(summary?.total_outstanding || 0)} tone="text-blue-600" />
        <StatCard icon={AlertTriangle} label="Total overdue" value={gbp.format(summary?.total_overdue || 0)} tone="text-rose-600" />
        <StatCard icon={FileText} label="Overdue invoices" value={String(summary?.overdue_invoice_count || 0)} tone="text-amber-600" />
        <StatCard icon={ShieldAlert} label="High priority customers" value={String(summary?.high_priority_customer_count || 0)} tone="text-orange-600" />
        <StatCard icon={Gavel} label="Customers affected" value={String(summary?.overdue_customer_count || 0)} tone="text-primary" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Today’s collection priorities</h2>
                <p className="text-sm text-muted-foreground">Ranked from invoice amount, days overdue, payment history, and customer risk.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['all', 'critical', 'high', 'medium', 'low'].map((value) => (
                  <Button key={value} type="button" size="sm" variant={filter === value ? 'default' : 'outline'} className="capitalize" onClick={() => setFilter(value)}>
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className="rounded-lg border border-dashed px-5 py-10 text-center">
                <FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
                <p className="text-sm font-medium">No overdue invoices match this filter</p>
                <p className="mt-1 text-xs text-muted-foreground">Paid and current invoices are not included in the collection queue.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice, index) => {
                  const history = overview?.reminder_history?.[invoice.invoice_id] || [];
                  return (
                    <div key={invoice.invoice_id} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                            <button type="button" onClick={() => navigate(`/invoices/${invoice.invoice_id}/view`)} className="text-sm font-semibold hover:text-primary hover:underline">{invoice.invoice_number}</button>
                            <Badge variant="outline" className={cn('capitalize', PRIORITY_STYLES[invoice.priority])}>{invoice.priority} priority</Badge>
                            <Badge variant="secondary" className={cn('capitalize', RISK_STYLES[invoice.risk_label])}>{invoice.risk_label} risk</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{invoice.customer_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Due {fmt(invoice.due_date)} · {invoice.days_overdue} days overdue · {gbp.format(invoice.balance_due)} outstanding</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{gbp.format(invoice.balance_due)}</p>
                          <p className="text-xs text-muted-foreground">{history.filter((activity) => activity.event_type === 'reminder_sent').length} reminder{history.filter((activity) => activity.event_type === 'reminder_sent').length === 1 ? '' : 's'} sent</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md border border-primary/15 bg-primary/5 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Why this is prioritised</p>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">{invoice.explanation}</p>
                        <p className="mt-1 text-xs font-medium text-primary">{invoice.recommended_action}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Historic payment delay: {invoice.average_payment_delay_days == null ? 'No linked payment history yet' : `${invoice.average_payment_delay_days} days`} · Previous late invoices: {invoice.previous_overdue_invoices}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/invoices/${invoice.invoice_id}/view`)}>View invoice</Button>
                          <Button size="sm" onClick={() => setSelectedInvoice({ ...invoice, id: invoice.invoice_id })}><Mail className="mr-1.5 h-3.5 w-3.5" /> Draft reminder</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-base font-semibold">Collection insights</h2>
              <div className="mt-3 space-y-3">
                {(overview?.insights || []).map((insight) => (
                  <div key={insight.title} className={cn('rounded-md border p-3', insight.severity === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50/50')}>
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-base font-semibold">Customer collection summary</h2>
              <div className="mt-3 space-y-3">
                {(overview?.customers || []).slice(0, 6).map((customer) => (
                  <button key={`${customer.customer_id || customer.customer_name}`} type="button" onClick={() => customer.customer_id && navigate(`/customers/${customer.customer_id}`)} className="w-full rounded-md border p-3 text-left hover:bg-muted/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{customer.customer_name}</p>
                      <Badge variant="secondary" className={cn('capitalize', RISK_STYLES[customer.risk_label])}>{customer.risk_label} risk</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{gbp.format(customer.total_overdue)} overdue · {customer.overdue_invoice_count} invoice{customer.overdue_invoice_count === 1 ? '' : 's'} · oldest {customer.oldest_days_overdue} days</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ReminderDraftDialog
        open={Boolean(selectedInvoice)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedInvoice(null); }}
        companyId={activeCompany?.id}
        invoice={selectedInvoice}
        onRecorded={load}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <Icon className={cn('h-4 w-4', tone)} />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}