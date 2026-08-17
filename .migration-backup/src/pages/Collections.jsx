import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Eye, Mail, Wallet, Gavel, AlertTriangle, Clock, Pause, Scale, FileText,
} from 'lucide-react';
import { computeInvoiceStage, computeWorkflowRecommendation } from '@/lib/workflowEngine';
import { cn } from '@/lib/utils';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const TONE_BADGE = {
  slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-700', indigo: 'bg-indigo-50 text-indigo-700',
  amber: 'bg-amber-50 text-amber-700', orange: 'bg-orange-50 text-orange-700', rose: 'bg-rose-50 text-rose-700',
  emerald: 'bg-emerald-50 text-emerald-700', muted: 'bg-muted text-muted-foreground',
};

const STAGE_FILTERS = [
  { key: 'all', label: 'All', icon: Gavel },
  { key: 'overdue', label: 'Overdue', icon: Clock },
  { key: 'reminder_sent', label: 'Reminder Sent', icon: Mail },
  { key: 'final_demand_sent', label: 'Final Demand', icon: AlertTriangle },
  { key: 'account_on_hold', label: 'On Hold', icon: Pause },
  { key: 'legal_action', label: 'Legal', icon: Scale },
];

// Collections Workspace — every invoice currently in the collection phases of
// the invoice workflow, with its current stage, AI recommendation and actions.
export default function Collections() {
  const nav = useNavigate();
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!activeCompany?.id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [inv, cust, acts] = await Promise.all([
          base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }, '-due_date', 500),
          base44.entities.Customer.filter({ company_id: activeCompany.id }, '-created_date', 500),
          base44.entities.WorkflowActivity.filter({ company_id: activeCompany.id, workflow_type: 'invoice' }, '-event_date', 500),
        ]);
        if (cancelled) return;
        setInvoices(inv || []);
        setCustomers(cust || []);
        setActivities(acts || []);
      } catch (e) {
        console.error(e);
        toast({ title: 'Could not load collections', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeCompany?.id]);

  const reminderCount = (invId) => activities.filter((a) => a.entity_id === invId && a.action === 'reminder_sent').length;
  const customerById = (id) => customers.find((c) => c.id === id);

  const rows = invoices
    .filter((i) => i.status !== 'cancelled' && i.status !== 'paid' && i.status !== 'draft')
    .map((i) => {
      const now = new Date();
      const daysOverdue = i.due_date && new Date(i.due_date) < now ? Math.floor((now - new Date(i.due_date)) / 86400000) : 0;
      const cust = customerById(i.customer_id);
      const onHold = cust?.tags?.includes('Credit Hold');
      const legalAction = cust?.tags?.includes('Legal Action');
      const remindersSent = reminderCount(i.id);
      const stage = computeInvoiceStage(i, { daysOverdue, remindersSent, onHold, legalAction });
      const recommendation = computeWorkflowRecommendation(i, { daysOverdue, remindersSent, onHold, legalAction });
      return { inv: i, cust, daysOverdue, stage, recommendation, balance: Number(i.balance_due) || 0 };
    })
    .filter((r) => r.daysOverdue > 0 || ['reminder_sent', 'second_reminder_sent', 'final_demand_sent', 'account_on_hold', 'legal_action'].includes(r.stage.key))
    .sort((a, b) => b.stage.order - a.stage.order || b.daysOverdue - a.daysOverdue);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.stage.key === filter || (filter === 'overdue' && r.daysOverdue > 0));

  const totals = {
    count: rows.length,
    value: rows.reduce((s, r) => s + r.balance, 0),
    customers: new Set(rows.map((r) => r.inv.customer_id)).size,
    onHold: rows.filter((r) => r.stage.key === 'account_on_hold').length,
    legal: rows.filter((r) => r.stage.key === 'legal_action').length,
  };

  const sendReminder = (r) => {
    const cust = r.cust;
    window.location.href = `mailto:${cust?.email || ''}?subject=${encodeURIComponent('Reminder — invoice ' + r.inv.invoice_number)}&body=${encodeURIComponent(`Reminder: invoice ${r.inv.invoice_number} for ${gbp.format(r.balance)} is ${r.daysOverdue} days overdue.`)}`;
    base44.entities.WorkflowActivity.create({
      company_id: activeCompany.id, workflow_type: 'invoice', entity_type: 'sales_invoice', entity_id: r.inv.id,
      entity_name: r.inv.invoice_number, stage: 'reminder_sent', action: 'reminder_sent', action_label: 'Reminder sent',
      user_name: 'User', notes: `Email reminder for ${r.daysOverdue} days overdue`, event_date: new Date().toISOString(),
    }).catch(() => {});
    toast({ title: 'Reminder prepared', description: r.inv.invoice_number });
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6 px-4 lg:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => nav('/')}><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2"><Gavel className="w-5 h-5 text-primary" /> Collections</h1>
              <p className="text-sm text-muted-foreground">Invoices in the collection workflow · {activeCompany?.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={FileText} label="In collections" value={String(totals.count)} tone="text-amber-600" />
        <StatCard icon={Wallet} label="Total overdue" value={gbp.format(totals.value)} tone="text-rose-600" />
        <StatCard icon={Gavel} label="Customers affected" value={String(totals.customers)} tone="text-blue-600" />
        <StatCard icon={Pause} label="Accounts on hold" value={String(totals.onHold)} tone="text-rose-600" />
        <StatCard icon={Scale} label="Legal action" value={String(totals.legal)} tone="text-rose-600" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STAGE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
            )}
          >
            <f.icon className="w-3.5 h-3.5" /> {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <Gavel className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No invoices in collections</p>
          <p className="text-xs text-muted-foreground mt-1">All invoices are paid or on track.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.inv.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold">{r.inv.invoice_number}</p>
                      <Badge variant="secondary" className={cn('text-[10px]', TONE_BADGE[r.stage.tone] || TONE_BADGE.muted)}>{r.stage.label}</Badge>
                      {r.daysOverdue > 0 && <span className="text-xs text-rose-600 font-medium">{r.daysOverdue} days overdue</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{r.cust?.name || r.inv.customer_name}</p>
                    <p className="text-xs text-muted-foreground">Due {fmt(r.inv.due_date)} · {gbp.format(r.balance)} outstanding</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold">{gbp.format(r.balance)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-md border border-primary/15 bg-primary/5 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Recommended next action</p>
                    <p className="text-sm font-semibold text-primary truncate">{r.recommendation.nextAction}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.recommendation.reason} · {r.recommendation.confidence}% confidence</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => nav(`/invoices/${r.inv.id}/view`)} className="gap-1.5"><Eye className="w-3.5 h-3.5" /> View</Button>
                    <Button size="sm" onClick={() => sendReminder(r)} className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Remind</Button>
                    <Button size="sm" variant="outline" onClick={() => nav('/transactions')} className="gap-1.5"><Wallet className="w-3.5 h-3.5" /> Payment</Button>
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

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn('w-4 h-4', tone)} />
          <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">{label}</p>
        </div>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}