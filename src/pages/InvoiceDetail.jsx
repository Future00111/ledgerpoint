import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { jsPDF } from 'jspdf';
import moment from 'moment';
import {
  ArrowLeft, Send, Mail, Wallet, FileMinus, Copy, Download, Pencil, CheckCircle2,
  MoreHorizontal, Trash2, Ban, User,
} from 'lucide-react';

import { computeInvoiceIntelligence } from '@/lib/invoiceIntelligence';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import InvoiceExecutiveSummary from '@/components/invoices/InvoiceExecutiveSummary';
import AIPaymentPrediction from '@/components/invoices/AIPaymentPrediction';
import CollectionsWorkflow from '@/components/invoices/CollectionsWorkflow';
import CustomerInsightPanel from '@/components/invoices/CustomerInsightPanel';
import RelatedInvoices from '@/components/invoices/RelatedInvoices';
import InvoiceAnalytics from '@/components/invoices/InvoiceAnalytics';
import InvoiceAIAssistant from '@/components/invoices/InvoiceAIAssistant';
import TimelineCard from '@/components/workspace/cards/TimelineCard';
import NeedsAttentionCard from '@/components/workspace/cards/NeedsAttentionCard';
import ProfileCard from '@/components/workspace/cards/ProfileCard';
import { Mail as MailIcon, Phone, MapPin, FileText, PoundSterling, CreditCard } from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const statusColors = {
  draft: 'bg-slate-100 text-slate-700', approved: 'bg-blue-50 text-blue-700', sent: 'bg-blue-50 text-blue-700',
  part_paid: 'bg-purple-50 text-purple-700', paid: 'bg-emerald-50 text-emerald-700', overdue: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};

const Btn = ({ label, icon: Icon, onClick, variant = 'default' }) => (
  <Button variant={variant} size="sm" onClick={onClick} className="gap-1.5">
    {Icon && <Icon className="w-3.5 h-3.5" />} {label}
  </Button>
);

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { activeCompany } = useCompany();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const inv = await base44.entities.SalesInvoice.get(id);
      setInvoice(inv);
      const cust = await base44.entities.Customer.get(inv.customer_id);
      setCustomer(cust);
      const custInv = await base44.entities.SalesInvoice.filter({ customer_id: inv.customer_id }, '-issue_date', 200);
      setCustomerInvoices(custInv || []);
      const cns = await base44.entities.SalesCreditNote.filter({ customer_id: inv.customer_id }, '-credit_note_date', 200);
      setCreditNotes(cns || []);
      const txns = await base44.entities.BankTransaction.filter({ company_id: inv.company_id, matched_type: 'sales_invoice' }, '-date', 200);
      const invIds = new Set((custInv || []).map((i) => i.id));
      setPayments((txns || []).filter((t) => invIds.has(t.linked_invoice_id)));
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not load invoice', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!invoice) return <p className="text-muted-foreground text-center py-20">Invoice not found.</p>;

  const intel = computeInvoiceIntelligence({ invoice, customer, customerInvoices, payments, creditNotes });

  // ---- Actions ----
  const reload = () => load();
  const sendInvoice = async () => { await base44.entities.SalesInvoice.update(id, { status: 'sent' }); toast({ title: 'Invoice sent' }); reload(); };
  const approve = async () => {
    try { await base44.functions.invoke('postSalesInvoice', { invoice_id: id, company_id: invoice.company_id }); toast({ title: 'Invoice approved & posted' }); reload(); }
    catch (e) { toast({ title: 'Error approving invoice', description: e.message, variant: 'destructive' }); }
  };
  const recordPayment = () => nav('/transactions');
  const sendReminder = () => { window.location.href = `mailto:${customer?.email || ''}?subject=${encodeURIComponent('Reminder — invoice ' + invoice.invoice_number)}&body=${encodeURIComponent(`Reminder: invoice ${invoice.invoice_number} for ${gbp.format(intel.balanceDue)} is ${intel.isOverdue ? `${intel.daysOverdue} days overdue` : 'now due'}.`)}`; };
  const addCreditNote = () => nav('/sales-credit-notes/new');
  const edit = () => nav(`/invoices/${id}`);
  const viewCustomer = () => nav(`/customers/${customer?.id}`);
  const callCustomer = () => { if (customer?.phone) window.location.href = `tel:${customer.phone}`; };
  const mailCustomer = () => { if (customer?.email) window.location.href = `mailto:${customer.email}`; };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`Invoice ${invoice.invoice_number}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Customer: ${customer?.name || invoice.customer_name}`, 14, 30);
    doc.text(`Issued: ${fmt(invoice.issue_date)}   Due: ${fmt(invoice.due_date)}   Terms: ${intel.terms} days`, 14, 36);
    doc.text(`Status: ${invoice.status}`, 14, 42);
    let y = 52;
    doc.text('Description', 14, y); doc.text('Qty', 120, y); doc.text('Net', 150, y); doc.text('Gross', 180, y);
    y += 6;
    (invoice.line_items || []).forEach((l) => {
      doc.text(String(l.description || '').slice(0, 55), 14, y);
      doc.text(String(l.quantity || ''), 120, y);
      doc.text(gbp.format(l.amount || 0), 150, y);
      doc.text(gbp.format(l.line_total || 0), 180, y);
      y += 6;
    });
    y += 4;
    doc.text(`Subtotal: ${gbp.format(invoice.subtotal || 0)}`, 150, y); y += 6;
    doc.text(`VAT: ${gbp.format(invoice.vat_total || 0)}`, 150, y); y += 6;
    doc.text(`Total: ${gbp.format(invoice.total || 0)}`, 150, y); y += 6;
    doc.text(`Balance Due: ${gbp.format(invoice.balance_due || 0)}`, 150, y);
    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const duplicate = async () => {
    try {
      const list = await base44.entities.SalesInvoice.filter({ company_id: invoice.company_id });
      let maxNum = 0;
      list.forEach((i) => { const m = i.invoice_number?.match(/INV-(\d+)/i); if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; } });
      const next = `INV-${String(maxNum + 1).padStart(4, '0')}`;
      const created = await base44.entities.SalesInvoice.create({
        company_id: invoice.company_id, customer_id: invoice.customer_id, customer_name: invoice.customer_name,
        invoice_number: next, issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + (invoice.payment_terms || 30) * 86400000).toISOString().split('T')[0],
        payment_terms: invoice.payment_terms || 30, status: 'draft', line_items: invoice.line_items || [],
        subtotal: invoice.subtotal, vat_total: invoice.vat_total, total: invoice.total, amount_paid: 0, balance_due: invoice.total,
        notes: invoice.notes, reference: invoice.reference,
      });
      toast({ title: 'Invoice duplicated', description: next });
      nav(`/invoices/${created.id}/view`);
    } catch (e) { toast({ title: 'Error duplicating', description: e.message, variant: 'destructive' }); }
  };

  const cancelInvoice = async () => {
    if (!confirm('Cancel this invoice?')) return;
    await base44.entities.SalesInvoice.update(id, { status: 'cancelled' });
    toast({ title: 'Invoice cancelled' }); reload();
  };
  const deleteInvoice = async () => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    await base44.entities.SalesInvoice.delete(id);
    toast({ title: 'Invoice deleted' }); nav('/invoices');
  };

  // ---- Primary actions by status ----
  let primary = [];
  if (invoice.status === 'draft') primary = [<Btn key="e" label="Edit" icon={Pencil} onClick={edit} variant="outline" />, <Btn key="a" label="Approve" icon={CheckCircle2} onClick={approve} />, <Btn key="s" label="Send" icon={Send} onClick={sendInvoice} variant="outline" />];
  else if (invoice.status === 'approved') primary = [<Btn key="s" label="Send" icon={Send} onClick={sendInvoice} />, <Btn key="e" label="Edit" icon={Pencil} onClick={edit} variant="outline" />];
  else if (['sent', 'part_paid', 'overdue'].includes(invoice.status)) primary = [<Btn key="r" label="Send reminder" icon={Mail} onClick={sendReminder} />, <Btn key="p" label="Record payment" icon={Wallet} onClick={recordPayment} variant="outline" />, <Btn key="c" label="Add credit note" icon={FileMinus} onClick={addCreditNote} variant="outline" />];
  else if (invoice.status === 'paid') primary = [<Btn key="p" label="View payment" icon={Wallet} onClick={recordPayment} />, <Btn key="d" label="Duplicate" icon={Copy} onClick={duplicate} variant="outline" />];
  else if (invoice.status === 'cancelled') primary = [<Btn key="d" label="Duplicate" icon={Copy} onClick={duplicate} variant="outline" />];

  // ---- Invoice timeline ----
  const events = [];
  if (invoice.issue_date) events.push({ date: fmt(invoice.issue_date), type: 'Invoice created', reference: invoice.invoice_number, kind: 'created', status: 'Created', onClick: null });
  if (invoice.posted_date && ['approved', 'sent', 'part_paid', 'paid', 'overdue'].includes(invoice.status)) events.push({ date: fmt(invoice.posted_date), type: 'Invoice approved', reference: invoice.invoice_number, kind: 'invoice_approved', status: 'Approved', onClick: null });
  if (['sent', 'part_paid', 'paid', 'overdue'].includes(invoice.status)) events.push({ date: fmt(invoice.posted_date || invoice.issue_date), type: 'Invoice emailed', reference: invoice.invoice_number, kind: 'invoice_sent', status: 'Sent', onClick: null });
  if (intel.isOverdue) {
    const dd = new Date(invoice.due_date);
    if (intel.stageNum >= 2) events.push({ date: fmt(new Date(dd.getTime() + 14 * 86400000)), type: 'First reminder sent', kind: 'reminder_sent', status: 'Reminder', onClick: null });
    if (intel.stageNum >= 3) events.push({ date: fmt(new Date(dd.getTime() + 30 * 86400000)), type: 'Second reminder sent', kind: 'reminder_sent', status: 'Reminder', onClick: null });
    if (intel.stageNum >= 4) events.push({ date: fmt(new Date(dd.getTime() + 60 * 86400000)), type: 'Final demand sent', kind: 'reminder_sent', status: 'Final demand', onClick: null });
  }
  payments.filter((p) => p.linked_invoice_id === invoice.id).forEach((p) => events.push({ date: fmt(p.date), type: 'Payment received', reference: p.matched_record_number, amount: Number(p.money_in) || 0, kind: 'payment', status: 'Received', onClick: () => nav('/transactions') }));
  creditNotes.filter((c) => c.original_invoice_id === invoice.id).forEach((c) => events.push({ date: fmt(c.credit_note_date), type: 'Credit note issued', reference: c.credit_note_number, amount: -(Number(c.total) || 0), kind: 'credit_note', status: c.status, onClick: () => nav('/sales-credit-notes') }));
  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  // ---- Customer details (right sidebar) ----
  const address = [customer?.address_line_1, customer?.address_line_2, customer?.city, customer?.county, customer?.postcode, customer?.country].filter(Boolean).join(', ');
  const profileFields = [
    { icon: MailIcon, label: 'Email', value: customer?.email, onClick: customer?.email ? mailCustomer : null },
    { icon: Phone, label: 'Telephone', value: customer?.phone, onClick: customer?.phone ? callCustomer : null },
    { icon: MapPin, label: 'Address', value: address },
    { icon: CreditCard, label: 'Payment Terms', value: customer?.payment_terms ? `${customer.payment_terms} days` : '—' },
    { icon: PoundSterling, label: 'Credit Limit', value: customer?.credit_limit ? gbp.format(customer.credit_limit) : 'None' },
    { icon: FileText, label: 'Account Ref', value: customer?.customer_reference || '—' },
  ];
  const contactActions = [
    { icon: MailIcon, label: 'Email', onClick: mailCustomer },
    { icon: Phone, label: 'Call', onClick: callCustomer },
    { icon: User, label: 'View', onClick: viewCustomer },
  ];

  const aiContext = `Invoice ${invoice.invoice_number} for ${customer?.name || invoice.customer_name}. Status ${invoice.status}, total ${gbp.format(intel.total)}, balance due ${gbp.format(intel.balanceDue)}. Issued ${fmt(invoice.issue_date)}, due ${fmt(invoice.due_date)}, ${intel.isOverdue ? `${intel.daysOverdue} days overdue` : 'not overdue'}. Terms ${intel.terms} days. Payment probability ${intel.probability}% (${intel.likelihood}). Customer health ${intel.health.label} (${intel.health.score}/100). Customer lifetime revenue ${gbp.format(intel.lifetimeRevenue)}, avg payment ${intel.avgPaymentDays != null ? intel.avgPaymentDays + ' days' : 'n/a'}, ${intel.openInvoices} open invoices, ${gbp.format(intel.customerOutstanding)} outstanding. Recommendation: ${intel.recommendation}.`;

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6 px-4 lg:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => nav('/invoices')} className="mt-0.5"><ArrowLeft className="w-4 h-4" /></Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold truncate">{invoice.invoice_number}</h1>
                <Badge variant="secondary" className={`text-xs ${statusColors[invoice.status] || ''}`}>{invoice.status}</Badge>
                {intel.isOverdue && <Badge variant="secondary" className="text-xs bg-red-50 text-red-700">{intel.daysOverdue} days overdue</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{customer?.name || invoice.customer_name} · {gbp.format(intel.total)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {primary}
            <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-1.5"><Download className="w-3.5 h-3.5" />PDF</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={edit} className="gap-2"><Pencil className="w-3.5 h-3.5" /> Edit invoice</DropdownMenuItem>
                <DropdownMenuItem onClick={addCreditNote} className="gap-2"><FileMinus className="w-3.5 h-3.5" /> Add credit note</DropdownMenuItem>
                <DropdownMenuItem onClick={viewCustomer} className="gap-2"><User className="w-3.5 h-3.5" /> View customer</DropdownMenuItem>
                {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={cancelInvoice} className="gap-2"><Ban className="w-3.5 h-3.5" /> Cancel invoice</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={deleteInvoice} className="gap-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
          <span>Issued {fmt(invoice.issue_date)}</span>
          <span>Due {fmt(invoice.due_date)}</span>
          <span>Terms {intel.terms} days</span>
          <span>Outstanding <span className="font-medium text-foreground">{gbp.format(intel.balanceDue)}</span></span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid lg:grid-cols-[7fr_3fr] gap-5 items-start">
        {/* LEFT — the invoice + its history */}
        <div className="space-y-4 min-w-0">
          <InvoiceDocument invoice={invoice} customer={customer} company={activeCompany} />
          <div>
            <p className="text-sm font-semibold mb-2">Invoice Timeline</p>
            <TimelineCard events={events} maxHeight="24rem" />
          </div>
          <RelatedInvoices invoices={intel.relatedInvoices} onOpen={(rid) => nav(`/invoices/${rid}/view`)} />
          <InvoiceAnalytics amountVsAvgPct={intel.amountVsAvgPct} largestPrevious={intel.largestPrevious} isLargestEver={intel.isLargestEver} trend={intel.trend} onTimeRate={intel.onTimeRate} />
        </div>

        {/* RIGHT — AI insights, customer intelligence, workflow */}
        <aside className="space-y-4 min-w-0 lg:sticky lg:top-24 self-start">
          <InvoiceExecutiveSummary
            balanceDue={intel.balanceDue} probability={intel.probability} likelihood={intel.likelihood} likelihoodTone={intel.likelihoodTone}
            behaviour={intel.behaviour} avgPaymentDays={intel.avgPaymentDays} recommendation={intel.recommendation} recommendationTone={intel.recommendationTone}
          />
          <AIPaymentPrediction
            likelihood={intel.likelihood} likelihoodTone={intel.likelihoodTone} riskScore={intel.riskScore} riskLabel={intel.riskLabel} riskTone={intel.riskTone}
            predictedDate={intel.predictedDate} confidence={intel.confidence} riskFactors={intel.riskFactors}
          />
          <CollectionsWorkflow stages={intel.workflowStages} stageNum={intel.stageNum} />
          <CustomerInsightPanel
            health={intel.health.label} healthTone={intel.health.tone} relationshipValue={intel.relationshipValue} relationshipValueTone={intel.relationshipValueTone}
            lifetimeRevenue={intel.lifetimeRevenue} avgPaymentDays={intel.avgPaymentDays} openInvoices={intel.openInvoices} customerOutstanding={intel.customerOutstanding} onOpenCustomer={viewCustomer}
          />
          <div>
            <p className="text-sm font-semibold mb-2">What Needs Attention</p>
            <NeedsAttentionCard items={intel.attention} />
          </div>
          <ProfileCard title={customer?.name || invoice.customer_name} subtitle={customer?.status === 'active' ? 'Active customer' : 'Inactive customer'} fields={profileFields} actions={contactActions} />
          <InvoiceAIAssistant
            companyId={invoice.company_id}
            context={aiContext}
            suggestions={['Will this invoice be paid?', 'Summarise this customer', 'What should I do next?', 'Draft a reminder email']}
          />
        </aside>
      </div>
    </div>
  );
}