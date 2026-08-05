import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail, Phone, MapPin, FileText, CreditCard, PoundSterling, Receipt, Pencil,
  Send, Sparkles, Loader2, CalendarClock, Download, Inbox,
} from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const toneCls = tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${toneCls}`}>{value}</p>
    </div>
  );
}

export default function CustomerWorkspace({ customer, open, onOpenChange, onEdit }) {
  const { activeCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [askQ, setAskQ] = useState('');
  const [askAnswer, setAskAnswer] = useState(null);
  const [askLoading, setAskLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const invs = await base44.entities.SalesInvoice.filter({ customer_id: customer.id }, '-issue_date', 200);
        if (cancelled) return;
        setInvoices(invs || []);
        const docs = await base44.entities.Document.filter({ company_id: customer.company_id });
        if (cancelled) return;
        setDocuments((docs || []).filter((d) => (d.supplier_or_customer || '').toLowerCase() === (customer.name || '').toLowerCase()));
        const txns = await base44.entities.BankTransaction.filter({ company_id: customer.company_id }, '-date', 200);
        if (cancelled) return;
        const invIds = new Set((invs || []).map((i) => i.id));
        setPayments((txns || []).filter((t) => t.matched_type === 'sales_invoice' && invIds.has(t.linked_invoice_id)));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, customer]);

  if (!customer) return null;

  const address = [customer.address_line_1, customer.address_line_2, customer.city, customer.county, customer.postcode, customer.country].filter(Boolean).join(', ');
  const outstandingInvoices = invoices.filter((i) => Number(i.balance_due) > 0);
  const revenue = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const outstanding = Number(customer.outstanding_balance || 0);
  const lastInvoice = invoices[0]?.issue_date || null;

  // Synthesised timeline from invoices, payments and document uploads.
  const timeline = [
    ...invoices.map((i) => ({ date: i.issue_date, text: `Invoice ${i.invoice_number} issued`, amount: i.total, kind: 'invoice' })),
    ...payments.map((p) => ({ date: p.date, text: `Payment received${p.matched_record_number ? ` for ${p.matched_record_number}` : ''}`, amount: p.money_in, kind: 'payment' })),
    ...documents.map((d) => ({ date: d.upload_date, text: `Document uploaded: ${d.name}`, amount: null, kind: 'document' })),
  ].filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : -1));

  const customerContext = `Customer: ${customer.name}. Contact: ${customer.contact_name || '—'}. Email: ${customer.email || '—'}. Outstanding balance: ${gbp.format(outstanding)}. Total revenue: ${gbp.format(revenue)}. Invoices: ${invoices.length} (${outstandingInvoices.length} outstanding). Last invoice: ${lastInvoice || '—'}. Payment terms: ${customer.payment_terms || 30} days.`;

  const runAsk = async (question) => {
    if (!activeCompany) return;
    setAskLoading(true);
    setAskAnswer(null);
    try {
      const res = await base44.functions.invoke('askAI', { company_id: activeCompany.id, question, context: customerContext });
      setAskAnswer(res?.data?.answer || res?.answer || 'No answer returned.');
    } catch (e) {
      setAskAnswer('Error: ' + (e.message || 'Something went wrong.'));
    } finally {
      setAskLoading(false);
    }
  };

  const generateInsights = async () => {
    setInsightLoading(true);
    setInsight(null);
    try {
      const res = await base44.functions.invoke('askAI', {
        company_id: activeCompany.id,
        question: 'Summarise this customer relationship: payment behaviour, revenue trend, outstanding risk and recommended next actions. Be concise.',
        context: customerContext,
      });
      setInsight(res?.data?.answer || res?.answer || 'No insights returned.');
    } catch (e) {
      setInsight('Error: ' + (e.message || 'Something went wrong.'));
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="text-xl">{customer.name}</DialogTitle>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                <Badge className={customer.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                  {customer.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
                {customer.contact_name && <span>{customer.contact_name}</span>}
                {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
                {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>}
              </div>
            </div>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onEdit(customer); }}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Outstanding Balance" value={gbp.format(outstanding)} tone={outstanding > 0 ? 'rose' : 'emerald'} />
          <Stat label="Revenue" value={loading ? '…' : gbp.format(revenue)} />
          <Stat label="Outstanding Invoices" value={loading ? '…' : outstandingInvoices.length} />
          <Stat label="Last Invoice" value={loading ? '…' : (lastInvoice || '—')} />
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invoices">Invoices & Payments</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-1">
            <Field icon={FileText} label="Customer Reference" value={customer.customer_reference} />
            <Field icon={CreditCard} label="Payment Terms" value={customer.payment_terms ? `${customer.payment_terms} days` : ''} />
            <Field icon={PoundSterling} label="Credit Limit" value={customer.credit_limit ? gbp.format(customer.credit_limit) : ''} />
            <Field icon={PoundSterling} label="VAT Number" value={customer.vat_number} />
            <Field icon={Mail} label="Contact Name" value={customer.contact_name} />
            <Field icon={Mail} label="Email" value={customer.email} />
            <Field icon={Phone} label="Phone" value={customer.phone} />
            <Field icon={MapPin} label="Address" value={address} />
            {customer.notes && <Field icon={Receipt} label="Notes" value={customer.notes} />}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Outstanding Invoices</p>
              {outstandingInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
              ) : (
                <div className="space-y-1.5">
                  {outstandingInvoices.map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{i.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">Due {i.due_date || '—'}</p>
                      </div>
                      <span className="font-medium text-rose-600">{gbp.format(Number(i.balance_due) || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payment History</p>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.description}</p>
                        <p className="text-xs text-muted-foreground">{p.date}</p>
                      </div>
                      <span className="font-medium text-emerald-600">{gbp.format(Number(p.money_in) || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="documents">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Inbox className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No documents linked to this customer.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.upload_date} · {d.document_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-3 pl-4">
                {timeline.map((e, i) => (
                  <li key={i}>
                    <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary/40 border-2 border-background" style={{ marginTop: 4 }} />
                    <p className="text-sm font-medium">{e.text}{e.amount != null ? ` · ${gbp.format(Number(e.amount) || 0)}` : ''}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="w-3 h-3" />{e.date}</p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-3">
            {!insight && !insightLoading && (
              <Button onClick={generateInsights} variant="outline" size="sm">
                <Sparkles className="w-3.5 h-3.5" /> Generate AI Insights
              </Button>
            )}
            {insightLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Analysing customer relationship…</div>
            )}
            {insight && (
              <Card className="border border-primary/20 bg-primary/5"><CardContent className="p-4 text-sm whitespace-pre-wrap">{insight}</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Contextual Ask — ask anything about this customer */}
        <div className="mt-2 rounded-xl border border-border p-3 bg-muted/30">
          {askAnswer && (
            <div className="mb-2 text-sm whitespace-pre-wrap">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mb-1"><Sparkles className="w-3 h-3" /> Ask</span>
              <p>{askAnswer}</p>
            </div>
          )}
          {askLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…</div>}
          <div className="flex items-center gap-2">
            <Input
              value={askQ}
              onChange={(e) => setAskQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && askQ.trim()) runAsk(askQ.trim()); }}
              placeholder={`Ask about ${customer.name}…`}
              className="bg-card"
            />
            <Button size="icon" disabled={!askQ.trim() || askLoading} onClick={() => runAsk(askQ.trim())}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}