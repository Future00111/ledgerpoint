import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Mail, Phone, MapPin, FileText, CreditCard, PoundSterling,
  Plus, Wallet, Send, Pencil, Archive, Copy, Download, GitMerge, Trash2,
  Bell, Sparkles,
} from 'lucide-react';

import WorkspaceEngine from '@/components/workspace/WorkspaceEngine';
import { useFavourite } from '@/components/workspace/useFavourite';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// =============================================================================
// Customer Workspace
// =============================================================================
// Reference implementation of the Ledgerly Workspace Engine. The layout,
// cards, tabs and interaction model come from the engine; this file only
// supplies the customer-specific data and actions. Future Workspaces
// (Supplier, Invoice, Bill, Bank, VAT, Document…) follow the same pattern.
// See src/docs/19-workspace-framework.md.
// =============================================================================
export default function CustomerWorkspace({
  customer, open, onOpenChange,
  onEdit, onArchive, onDuplicate, onExport, onMerge, onDelete,
}) {
  const { activeCompany } = useCompany();
  const nav = useNavigate();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [favourite, toggleFavourite] = useFavourite(customer?.id);

  useEffect(() => {
    setNotes(customer?.notes || '');
  }, [customer?.id, customer?.notes]);

  useEffect(() => {
    if (!open || !customer) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const invs = await base44.entities.SalesInvoice.filter({ customer_id: customer.id }, '-issue_date', 200);
        if (cancelled) return;
        setInvoices(invs || []);

        const cns = await base44.entities.SalesCreditNote.filter({ customer_id: customer.id }, '-credit_note_date', 200);
        if (cancelled) return;
        setCreditNotes(cns || []);

        const docs = await base44.entities.Document.filter({ company_id: customer.company_id });
        if (cancelled) return;
        setDocuments(
          (docs || []).filter(
            (d) => (d.supplier_or_customer || '').toLowerCase() === (customer.name || '').toLowerCase()
          )
        );

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

  // ---- Derived metrics ------------------------------------------------------
  const outstanding = Number(customer.outstanding_balance || 0);
  const now = new Date();
  const twelveAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const revenue12m = invoices
    .filter((i) => i.issue_date && new Date(i.issue_date) >= twelveAgo)
    .reduce((s, i) => s + Number(i.total || 0), 0);
  const ytd = new Date(now.getFullYear(), 0, 1);
  const revenueYtd = invoices
    .filter((i) => i.issue_date && new Date(i.issue_date) >= ytd)
    .reduce((s, i) => s + Number(i.total || 0), 0);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
  const revenueLastYear = invoices
    .filter((i) => i.issue_date && new Date(i.issue_date) >= lastYearStart && new Date(i.issue_date) <= lastYearEnd)
    .reduce((s, i) => s + Number(i.total || 0), 0);
  const outstandingInvoices = invoices.filter((i) => Number(i.balance_due) > 0);
  const overdueInvoices = outstandingInvoices.filter((i) => i.due_date && new Date(i.due_date) < now);
  const lastPayment = payments[0] || null;

  const payDays = [];
  payments.forEach((p) => {
    const inv = invoices.find((i) => i.id === p.linked_invoice_id);
    if (inv && inv.issue_date && p.date) {
      payDays.push(Math.max(0, (new Date(p.date) - new Date(inv.issue_date)) / 86400000));
    }
  });
  const avgPaymentDays = payDays.length
    ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length)
    : null;

  // ---- Health score ---------------------------------------------------------
  let health = 100;
  const factors = [];
  if (invoices.length === 0) {
    health = 50;
    factors.push({ label: 'New customer', value: 'No history yet', positive: false });
  } else {
    if (customer.credit_limit > 0 && outstanding > customer.credit_limit) {
      health -= 30;
      factors.push({ label: 'Over credit limit', value: gbp.format(outstanding - customer.credit_limit), positive: false });
    } else {
      factors.push({ label: 'Within credit limit', value: 'Good', positive: true });
    }
    if (overdueInvoices.length > 0) {
      health -= 20;
      factors.push({ label: 'Overdue invoices', value: String(overdueInvoices.length), positive: false });
    } else {
      factors.push({ label: 'No overdue invoices', value: 'Good', positive: true });
    }
    if (avgPaymentDays != null && avgPaymentDays > (customer.payment_terms || 30)) {
      health -= 15;
      factors.push({ label: 'Avg payment time', value: `${avgPaymentDays} days`, positive: false });
    } else if (avgPaymentDays != null) {
      factors.push({ label: 'Avg payment time', value: `${avgPaymentDays} days`, positive: true });
    }
  }
  health = Math.max(0, Math.min(100, health));
  const healthLabel = health >= 75 ? 'Healthy relationship' : health >= 50 ? 'Needs attention' : 'At risk';

  // ---- Timeline (complete history) ----------------------------------------
  const timeline = [
    ...(customer.created_date
      ? [{ date: customer.created_date.slice(0, 10), text: 'Customer created', kind: 'created', amount: null, onClick: null }]
      : []),
    ...invoices.map((i) => ({ date: i.issue_date, text: `Invoice ${i.invoice_number} issued`, amount: i.total, kind: 'invoice', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })),
    ...payments.map((p) => ({
      date: p.date,
      text: `Payment received${p.matched_record_number ? ` for ${p.matched_record_number}` : ''}`,
      amount: p.money_in,
      kind: 'payment',
      onClick: () => { onOpenChange(false); nav('/transactions'); },
    })),
    ...creditNotes.map((c) => ({ date: c.credit_note_date, text: `Credit note ${c.credit_note_number} issued`, amount: c.total, kind: 'credit_note', onClick: () => { onOpenChange(false); nav('/sales-credit-notes'); } })),
    ...documents.map((d) => ({ date: d.upload_date, text: `Document uploaded: ${d.name}`, amount: null, kind: 'document', onClick: () => { onOpenChange(false); nav('/documents'); } })),
  ].filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : -1));

  const recentActivity = timeline.slice(0, 8).map((e) => ({ text: e.text, time: e.date }));
  const address = [customer.address_line_1, customer.address_line_2, customer.city, customer.county, customer.postcode, customer.country].filter(Boolean).join(', ');

  // ---- Ask context (inherited automatically) -------------------------------
  const customerContext = `Customer workspace for "${customer.name}". Contact: ${customer.contact_name || '—'}. Email: ${customer.email || '—'}. Phone: ${customer.phone || '—'}. Outstanding balance: ${gbp.format(outstanding)}. Credit limit: ${customer.credit_limit ? gbp.format(customer.credit_limit) : 'none'}. Payment terms: ${customer.payment_terms || 30} days. Total invoices: ${invoices.length} (${outstandingInvoices.length} outstanding, ${overdueInvoices.length} overdue). Revenue last 12 months: ${gbp.format(revenue12m)}. Revenue this year: ${gbp.format(revenueYtd)}. Revenue last year: ${gbp.format(revenueLastYear)}. Avg payment time: ${avgPaymentDays != null ? avgPaymentDays + ' days' : 'n/a'}. Credit notes: ${creditNotes.length}. Documents: ${documents.length}. Health score: ${health}/100 (${healthLabel}).`;

  // ---- Quick actions --------------------------------------------------------
  const statementBody = `Account Statement — ${customer.name}\n\nOutstanding invoices:\n${outstandingInvoices.map((i) => `${i.invoice_number} — due ${i.due_date} — ${gbp.format(Number(i.balance_due) || 0)}`).join('\n') || 'None'}\n\nTotal outstanding: ${gbp.format(outstanding)}`;
  const quickActions = [
    { label: 'Create Invoice', icon: Plus, onClick: () => { onOpenChange(false); nav('/invoices/new'); } },
    { label: 'Record Payment', icon: Wallet, onClick: () => { onOpenChange(false); nav('/transactions'); } },
    { label: 'Send Statement', icon: Send, onClick: () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Account Statement — ' + customer.name)}&body=${encodeURIComponent(statementBody)}`; } },
    { label: 'Email Customer', icon: Mail, onClick: () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Regarding your account')}`; } },
  ];

  const moreActions = [
    { label: 'Edit', icon: Pencil, onSelect: () => { onOpenChange(false); onEdit?.(customer); } },
    { label: 'Archive', icon: Archive, onSelect: () => onArchive?.(customer) },
    { label: 'Duplicate', icon: Copy, onSelect: () => onDuplicate?.(customer) },
    { label: 'Export', icon: Download, onSelect: () => onExport?.(customer) },
    { label: 'Merge', icon: GitMerge, onSelect: () => onMerge?.(customer) },
    { separator: true },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete?.(customer) },
  ];

  // ---- Recommended next actions (What Next) ---------------------------------
  const nextActions = [];
  if (overdueInvoices.length > 0) {
    nextActions.push({ label: 'Send Reminder', icon: Bell, onClick: () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Reminder — outstanding invoice')}`; } });
  }
  if (outstanding > 0) {
    nextActions.push({ label: 'Record Payment', icon: Wallet, onClick: () => { onOpenChange(false); nav('/transactions'); } });
  }
  nextActions.push({ label: 'Create Invoice', icon: Plus, onClick: () => { onOpenChange(false); nav('/invoices/new'); } });
  nextActions.push({ label: 'Upload Document', icon: FileText, onClick: () => { onOpenChange(false); nav('/documents'); } });
  nextActions.push({ label: 'Ask Ledgerly', icon: Sparkles, onClick: () => document.getElementById('workspace-ask-input')?.focus() });

  const header = {
    title: customer.name,
    statusLabel: customer.status === 'active' ? 'Active' : 'Inactive',
    statusTone: customer.status === 'active' ? 'green' : 'amber',
    metrics: [
      { label: 'Outstanding', value: gbp.format(outstanding), tone: outstanding > 0 ? 'rose' : 'emerald' },
      { label: 'Credit Limit', value: customer.credit_limit ? gbp.format(customer.credit_limit) : 'None' },
      { label: 'Payment Terms', value: `${customer.payment_terms || 30} days` },
      { label: 'Health', value: `${health}/100`, tone: health >= 75 ? 'emerald' : health >= 50 ? 'amber' : 'rose' },
    ],
    info: [
      ...(customer.contact_name ? [{ icon: Mail, text: customer.contact_name }] : []),
      ...(customer.email ? [{ icon: Mail, text: customer.email }] : []),
      ...(customer.phone ? [{ icon: Phone, text: customer.phone }] : []),
    ],
    quickActions,
    moreActions,
    favourite,
    onToggleFavourite: toggleFavourite,
  };

  const summaryStats = [
    { label: 'Outstanding', value: gbp.format(outstanding), tone: outstanding > 0 ? 'rose' : 'emerald' },
    { label: 'Revenue (12 mo)', value: gbp.format(revenue12m) },
    { label: 'Outstanding Inv.', value: String(outstandingInvoices.length) },
    { label: 'Avg Payment', value: avgPaymentDays != null ? `${avgPaymentDays} days` : '—' },
    { label: 'Last Payment', value: lastPayment ? gbp.format(Number(lastPayment.money_in) || 0) : '—' },
    { label: 'Health', value: `${health}/100`, tone: health >= 75 ? 'emerald' : health >= 50 ? 'amber' : 'rose' },
  ];

  // ---- AI Insights prompt (data-grounded, concise) -------------------------
  const aiInsightsPrompt = `Using the Ledgerly customer data in the context, write 3-5 concise business insights as short bullet points. Every insight must reference the customer's actual figures (average payment days, revenue this year vs last year, overdue invoice count, credit-limit usage). Example style: "This customer usually pays within 18 days." / "Revenue has increased by 14% this year." / "There is one overdue invoice." / "Consider sending a payment reminder." Do not give generic advice. End with one recommended next action.`;

  // ---- Declarative tab + panel configuration (rendered by the engine) -------
  const tabs = [
    {
      label: 'Overview', columns: 3,
      cards: [
        { kind: 'overview', span: 1, fields: [
          { icon: FileText, label: 'Customer Reference', value: customer.customer_reference },
          { icon: CreditCard, label: 'Payment Terms', value: customer.payment_terms ? `${customer.payment_terms} days` : '' },
          { icon: PoundSterling, label: 'Credit Limit', value: customer.credit_limit ? gbp.format(customer.credit_limit) : '' },
          { icon: PoundSterling, label: 'VAT Number', value: customer.vat_number },
          { icon: FileText, label: 'Last Invoice', value: invoices[0]?.issue_date || '—' },
          { icon: FileText, label: 'Customer Since', value: customer.created_date?.slice(0, 10) || '—' },
        ] },
        { kind: 'overview', span: 1, fields: [
          { icon: Mail, label: 'Contact Name', value: customer.contact_name },
          { icon: Mail, label: 'Email', value: customer.email },
          { icon: Phone, label: 'Phone', value: customer.phone },
          { icon: MapPin, label: 'Address', value: address },
        ] },
        { kind: 'related-records', span: 1, sections: [
          { title: 'Outstanding Invoices', records: outstandingInvoices.slice(0, 5).map((i) => ({ primary: i.invoice_number, secondary: `Due ${i.due_date}`, amount: Number(i.balance_due) || 0, onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })) },
          { title: 'Recent Payments', records: payments.slice(0, 5).map((p) => ({ primary: p.description, secondary: p.date, amount: Number(p.money_in) || 0, onClick: () => {} })) },
        ] },
        { kind: 'documents', span: 2, documents: documents.slice(0, 4).map((d) => ({ id: d.id, name: d.name, date: d.upload_date, type: d.document_type })), onOpen: () => { onOpenChange(false); nav('/documents'); } },
        { kind: 'tasks', span: 1, tasks: [] },
        { kind: 'ai-insights', span: 'full', companyId: activeCompany?.id, context: customerContext, prompt: aiInsightsPrompt },
        { kind: 'next-actions', span: 'full', actions: nextActions },
      ],
    },
    {
      label: 'Invoices', columns: 3,
      cards: [
        { kind: 'related-records', span: 'full', sections: [{
          title: 'All Invoices',
          records: invoices.map((i) => ({ primary: i.invoice_number, secondary: `Issued ${i.issue_date} · Due ${i.due_date} · ${i.status}`, amount: Number(i.total) || 0, onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })),
        }] },
      ],
    },
    {
      label: 'Payments', columns: 3,
      cards: [
        { kind: 'related-records', span: 'full', sections: [{
          title: 'Payment History',
          records: payments.map((p) => ({ primary: p.description, secondary: `${p.date}${p.matched_record_number ? ' · ' + p.matched_record_number : ''}`, amount: Number(p.money_in) || 0, onClick: () => {} })),
        }] },
      ],
    },
    {
      label: 'Credit Notes', columns: 3,
      cards: [
        { kind: 'related-records', span: 'full', sections: [{
          title: 'Sales Credit Notes',
          records: creditNotes.map((c) => ({ primary: c.credit_note_number, secondary: `${c.credit_note_date} · ${c.reason || c.status}`, amount: -Math.abs(Number(c.total) || 0), onClick: () => { onOpenChange(false); nav('/sales-credit-notes'); } })),
        }] },
      ],
    },
    {
      label: 'Documents', columns: 3,
      cards: [
        { kind: 'documents', span: 'full', documents: documents.map((d) => ({ id: d.id, name: d.name, date: d.upload_date, type: d.document_type })), onOpen: () => { onOpenChange(false); nav('/documents'); } },
      ],
    },
    {
      label: 'Timeline', columns: 3,
      cards: [{ kind: 'timeline', span: 'full', events: timeline }],
    },
    {
      label: 'Notes', columns: 3,
      cards: [{
        kind: 'overview', span: 'full',
        children: (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={async () => {
              if (notes !== (customer.notes || '')) {
                try {
                  await base44.entities.Customer.update(customer.id, { notes });
                  toast({ title: 'Notes saved' });
                } catch (e) {
                  toast({ title: 'Could not save notes', variant: 'destructive' });
                }
              }
            }}
            placeholder="Add notes about this customer…"
            className="min-h-[160px]"
          />
        ),
      }],
    },
    {
      label: 'AI Insights', columns: 3,
      cards: [{ kind: 'ai-insights', span: 'full', companyId: activeCompany?.id, context: customerContext, prompt: aiInsightsPrompt }],
    },
    {
      label: 'Activity', columns: 2,
      cards: [
        { kind: 'recent-activity', span: 1, activities: recentActivity },
        { kind: 'automation', span: 1, automations: [] },
      ],
    },
  ];

  const contextPanel = [
    { kind: 'business-health', score: health, label: healthLabel, factors },
    { kind: 'recent-activity', activities: recentActivity },
    { kind: 'tasks', tasks: [] },
    { kind: 'reminders', reminders: [] },
    { kind: 'automation', automations: [] },
    { kind: 'ai-suggestions', suggestions: [] },
  ];

  return (
    <WorkspaceEngine
      type="customer"
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      header={header}
      summaryStats={summaryStats}
      tabs={tabs}
      contextPanel={contextPanel}
      ask={{ placeholder: `Ask about ${customer.name}…`, context: customerContext, companyId: activeCompany?.id }}
    />
  );
}