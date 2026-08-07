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
// Customer Workspace — the Command Centre
// =============================================================================
// Reference implementation of the Ledgerly Workspace Engine. This file only
// supplies customer-specific data, derived metrics, and a declarative config
// (executive summary, header, key metrics, tabs, context panel, ask). The
// engine renders the shared layout and pulls cards from the registry.
//
// Information hierarchy: Executive Summary → What Needs Attention → Key
// Metrics → What Should I Do Next → Recent Activity → Related Records →
// Timeline → Supporting Information (Customer Profile).
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
  const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);
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

  const creditExceeded = customer.credit_limit > 0 && outstanding > customer.credit_limit;

  // ---- Health score ---------------------------------------------------------
  let health = 100;
  const factors = [];
  if (invoices.length === 0) {
    health = 50;
    factors.push({ label: 'New customer', value: 'No history yet', positive: false });
  } else {
    if (creditExceeded) {
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

  // ---- Timeline (rich, clickable) ----------------------------------------
  const timeline = [
    ...(customer.created_date
      ? [{ date: customer.created_date.slice(0, 10), text: 'Customer created', kind: 'created', amount: null, status: 'Created', onClick: null }]
      : []),
    ...invoices.map((i) => ({ date: i.issue_date, text: `Invoice ${i.invoice_number}`, amount: i.total, kind: 'invoice', status: i.status || 'Issued', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })),
    ...payments.map((p) => ({
      date: p.date,
      text: `Payment received${p.matched_record_number ? ` · ${p.matched_record_number}` : ''}`,
      amount: p.money_in,
      kind: 'payment',
      status: 'Received',
      onClick: () => { onOpenChange(false); nav('/transactions'); },
    })),
    ...creditNotes.map((c) => ({ date: c.credit_note_date, text: `Credit note ${c.credit_note_number}`, amount: c.total, kind: 'credit_note', status: c.status || 'Issued', onClick: () => { onOpenChange(false); nav('/sales-credit-notes'); } })),
    ...documents.map((d) => ({ date: d.upload_date, text: `Document uploaded: ${d.name}`, amount: null, kind: 'document', status: d.status || 'Uploaded', onClick: () => { onOpenChange(false); nav('/documents'); } })),
  ].filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : -1));

  const recentActivity = timeline.slice(0, 8).map((e) => ({ text: e.text, time: e.date }));
  const address = [customer.address_line_1, customer.address_line_2, customer.city, customer.county, customer.postcode, customer.country].filter(Boolean).join(', ');

  // ---- Ask context (inherited automatically) -------------------------------
  const customerContext = `Customer workspace for "${customer.name}". Contact: ${customer.contact_name || '—'}. Email: ${customer.email || '—'}. Phone: ${customer.phone || '—'}. Outstanding balance: ${gbp.format(outstanding)}. Credit limit: ${customer.credit_limit ? gbp.format(customer.credit_limit) : 'none'}. Payment terms: ${customer.payment_terms || 30} days. Total invoices: ${invoices.length} (${outstandingInvoices.length} outstanding, ${overdueInvoices.length} overdue worth ${gbp.format(overdueTotal)}). Revenue last 12 months: ${gbp.format(revenue12m)}. Revenue this year: ${gbp.format(revenueYtd)}. Revenue last year: ${gbp.format(revenueLastYear)}. Avg payment time: ${avgPaymentDays != null ? avgPaymentDays + ' days' : 'n/a'}. Credit notes: ${creditNotes.length}. Documents: ${documents.length}. Health score: ${health}/100 (${healthLabel}).`;

  // ---- AI prompts -----------------------------------------------------------
  const execPrompt = `Write a 4-6 sentence executive briefing about this customer for a business owner, using only the Ledgerly data in context. Sentence 1: how valuable they are (reference revenue this year). Sentence 2: how revenue has changed this year vs last year (state the direction and approximate percentage). Sentence 3: whether there are any overdue invoices (state the count and amount if any, else say there are none). Sentence 4: average payment time in days. Final sentence: a clear action statement — either "No action is currently required." or a specific action the owner should take. Write as one short paragraph. No bullet points, no headings, no generic advice.`;

  const aiInsightsPrompt = `You are an accounting analyst. Using only the Ledgerly customer data in context, write an executive analysis covering: payment behaviour, revenue trends (this year vs last year), late payment trends, buying patterns, profitability (where inferable), customer risk, opportunities, and suggested actions. For EACH point explain WHY using the actual figures from the data. Avoid generic advice. Use short bullet points, each with a one-line takeaway. End with "Recommended next action: …".`;

  // ---- What needs attention ------------------------------------------------
  const attentionItems = [];
  if (overdueInvoices.length > 0) {
    attentionItems.push({ label: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`, detail: `${gbp.format(overdueTotal)} overdue`, severity: 'critical', onClick: () => { onOpenChange(false); nav('/invoices'); } });
  }
  if (creditExceeded) {
    attentionItems.push({ label: 'Credit limit exceeded', detail: `${gbp.format(outstanding)} owed vs ${gbp.format(customer.credit_limit)} limit`, severity: 'critical', onClick: () => { onOpenChange(false); onEdit?.(customer); } });
  }
  if (overdueInvoices.length === 0 && outstandingInvoices.length > 0) {
    attentionItems.push({ label: `${outstandingInvoices.length} outstanding invoice${outstandingInvoices.length > 1 ? 's' : ''}`, detail: `${gbp.format(outstanding)} outstanding`, severity: 'warning', onClick: () => { onOpenChange(false); nav('/invoices'); } });
  }
  if (documents.length === 0) {
    attentionItems.push({ label: 'No documents on file', detail: 'Upload invoices or statements to keep records complete', severity: 'info', onClick: () => { onOpenChange(false); nav('/documents'); } });
  }

  // ---- Quick actions + more ------------------------------------------------
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

  // ---- What should I do next (recommendations) -----------------------------
  const nextActions = [];
  if (overdueInvoices.length > 0) {
    nextActions.push({ label: 'Send Reminder', icon: Bell, onClick: () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Reminder — outstanding invoice')}`; } });
  }
  if (outstanding > 0) {
    nextActions.push({ label: 'Record Payment', icon: Wallet, onClick: () => { onOpenChange(false); nav('/transactions'); } });
  }
  nextActions.push({ label: 'Create Invoice', icon: Plus, onClick: () => { onOpenChange(false); nav('/invoices/new'); } });
  nextActions.push({ label: 'Send Statement', icon: Send, onClick: () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Account Statement — ' + customer.name)}&body=${encodeURIComponent(statementBody)}`; } });
  nextActions.push({ label: 'Email Customer', icon: Mail, onClick: () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Regarding your account')}`; } });
  nextActions.push({ label: 'Upload Document', icon: FileText, onClick: () => { onOpenChange(false); nav('/documents'); } });
  if (creditExceeded) {
    nextActions.push({ label: 'Review Credit Limit', icon: PoundSterling, onClick: () => { onOpenChange(false); onEdit?.(customer); } });
  }
  nextActions.push({ label: 'Ask Ledgerly', icon: Sparkles, onClick: () => document.getElementById('workspace-ask-input')?.focus() });

  // ---- Header (clean: name · status · health · outstanding) ----------------
  const header = {
    title: customer.name,
    statusLabel: customer.status === 'active' ? 'Active' : 'Inactive',
    statusTone: customer.status === 'active' ? 'green' : 'amber',
    metrics: [
      { label: 'Outstanding', value: gbp.format(outstanding), tone: outstanding > 0 ? 'rose' : 'emerald' },
      { label: 'Health', value: `${health}/100`, tone: health >= 75 ? 'emerald' : health >= 50 ? 'amber' : 'rose' },
    ],
    info: [],
    quickActions,
    moreActions,
    favourite,
    onToggleFavourite: toggleFavourite,
  };

  // ---- Key metrics (clickable → related section) ---------------------------
  const summaryStats = [
    { label: 'Outstanding Balance', value: gbp.format(outstanding), tone: outstanding > 0 ? 'rose' : 'emerald', tab: 'invoices' },
    { label: 'Revenue (12 Months)', value: gbp.format(revenue12m), tab: 'ai-insights' },
    { label: 'Invoices Outstanding', value: String(outstandingInvoices.length), tab: 'invoices' },
    { label: 'Average Payment Days', value: avgPaymentDays != null ? `${avgPaymentDays} days` : '—', tab: 'payments' },
    { label: 'Last Payment', value: lastPayment ? gbp.format(Number(lastPayment.money_in) || 0) : '—', tab: 'payments' },
    { label: 'Customer Health', value: `${health}/100`, tone: health >= 75 ? 'emerald' : health >= 50 ? 'amber' : 'rose', tab: 'ai-insights' },
  ];

  // ---- Customer profile (supporting information) --------------------------
  const profileFields = [
    { icon: FileText, label: 'Primary Contact', value: customer.contact_name },
    { icon: Mail, label: 'Email', value: customer.email },
    { icon: Phone, label: 'Telephone', value: customer.phone },
    { icon: MapPin, label: 'Address', value: address },
    { icon: PoundSterling, label: 'VAT Number', value: customer.vat_number },
    { icon: CreditCard, label: 'Payment Terms', value: customer.payment_terms ? `${customer.payment_terms} days` : '' },
    { icon: PoundSterling, label: 'Credit Limit', value: customer.credit_limit ? gbp.format(customer.credit_limit) : 'None' },
    { icon: FileText, label: 'Customer Reference', value: customer.customer_reference },
  ];

  // ---- Tabs (Overview = command centre; rest = deep dives) -----------------
  const tabs = [
    {
      label: 'Overview', columns: 2,
      cards: [
        { kind: 'needs-attention', span: 'full', items: attentionItems },
        { kind: 'next-actions', span: 'full', actions: nextActions },
        { kind: 'recent-activity', span: 1, activities: recentActivity.slice(0, 5) },
        { kind: 'related-records', span: 1, sections: [
          { title: 'Outstanding Invoices', records: outstandingInvoices.slice(0, 5).map((i) => ({ primary: i.invoice_number, secondary: `Due ${i.due_date}`, amount: Number(i.balance_due) || 0, onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })) },
          { title: 'Recent Payments', records: payments.slice(0, 5).map((p) => ({ primary: p.description, secondary: p.date, amount: Number(p.money_in) || 0, onClick: () => {} })) },
        ] },
        { kind: 'timeline', span: 'full', events: timeline.slice(0, 6) },
        { kind: 'profile', span: 'full', title: customer.name, subtitle: customer.status === 'active' ? 'Active customer' : 'Inactive customer', fields: profileFields },
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

  // ---- Right-hand context panel (persistent) ------------------------------
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
      executiveSummary={{ kind: 'executive-summary', companyId: activeCompany?.id, context: customerContext, prompt: execPrompt }}
      summaryStats={summaryStats}
      tabs={tabs}
      contextPanel={contextPanel}
      ask={{
        placeholder: `Ask about ${customer.name}…`,
        context: customerContext,
        companyId: activeCompany?.id,
        suggestions: ['Summarise this customer', 'Show overdue invoices', 'Create invoice', 'Show revenue trend', 'Email statement', 'Why has revenue changed?'],
      }}
    />
  );
}