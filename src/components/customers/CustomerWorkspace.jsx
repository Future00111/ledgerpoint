import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import {
  Mail, Phone, MapPin, FileText, CreditCard, PoundSterling,
  Plus, Wallet, Send, Pencil, Archive, Copy, Download, GitMerge, Trash2,
  Bell, Sparkles, UserCheck, TrendingUp, TrendingDown, ArrowRight,
  LayoutDashboard, Receipt, ArrowLeftRight, FileMinus, Paperclip, StickyNote, Rss,
} from 'lucide-react';

import WorkspaceEngine from '@/components/workspace/WorkspaceEngine';
import { useFavourite } from '@/components/workspace/useFavourite';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const PREDEFINED_TAGS = ['VIP', 'Fleet', 'Trade', 'Cash Account', 'High Risk', 'Credit Hold', 'Monthly Account', 'Key Account', 'Warranty Customer', 'Repeat Customer'];

// =============================================================================
// Customer Workspace — 70/30 command centre (Sprint 39).
// Left (70%, working area): Recommended Actions · Executive Summary · KPIs ·
//   tabbed detail (Overview / Invoices / Payments / Credit Notes / Documents /
//   Notes / Activity / AI Insights).
// Right (30%, sticky context): Customer Health · Timeline · Contact · Ask.
// All existing functionality preserved — full lists remain on their tabs.
// =============================================================================
export default function CustomerWorkspace({
  customer, open, onOpenChange,
  onEdit, onArchive, onDuplicate, onExport, onMerge, onDelete,
  arrival,
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
  const [tagsState, setTagsState] = useState([]);
  const [favourite, toggleFavourite] = useFavourite(customer?.id);

  useEffect(() => {
    setNotes(customer?.notes || '');
  }, [customer?.id, customer?.notes]);

  useEffect(() => {
    setTagsState(Array.isArray(customer?.tags) ? customer.tags : []);
  }, [customer?.id, customer?.tags]);

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
  const validInvoices = invoices.filter((i) => i.status !== 'cancelled');
  const outstandingInvoices = validInvoices.filter((i) => Number(i.balance_due) > 0);
  const outstanding = outstandingInvoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);
  const overdueInvoices = outstandingInvoices.filter((i) => i.due_date && new Date(i.due_date) < now);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);
  const oldestOverdueDays = overdueInvoices.length > 0
    ? Math.max(...overdueInvoices.map((i) => Math.floor((now - new Date(i.due_date)) / 86400000)))
    : 0;
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
  const creditRemaining = customer.credit_limit > 0 ? customer.credit_limit - outstanding : null;
  const creditRemainingTone =
    creditRemaining == null ? null
    : creditRemaining < 0 ? 'rose'
    : creditRemaining < customer.credit_limit * 0.2 ? 'amber'
    : 'emerald';

  const terms = customer.payment_terms || 30;

  // ---- Customer health (historical + current) ------------------------------
  let health = 100;
  if (invoices.length === 0) {
    health = 50;
  } else {
    if (avgPaymentDays != null && avgPaymentDays > terms) health -= 10;
    if (overdueInvoices.length > 0) health -= 20;
    if (creditExceeded) health -= 20;
  }
  health = Math.max(0, Math.min(100, health));
  let healthLabel, healthTone;
  if (health >= 85) { healthLabel = 'Excellent'; healthTone = 'emerald'; }
  else if (health >= 70) { healthLabel = 'Good'; healthTone = 'emerald'; }
  else if (health >= 50) { healthLabel = 'Monitor'; healthTone = 'amber'; }
  else if (health >= 35) { healthLabel = 'Needs Attention'; healthTone = 'amber'; }
  else { healthLabel = 'At Risk'; healthTone = 'rose'; }

  const historical = invoices.length === 0
    ? 'New customer — no payment history yet.'
    : avgPaymentDays == null
      ? 'No payments recorded yet.'
      : `Reliable payer with average payment time of ${avgPaymentDays} day${avgPaymentDays === 1 ? '' : 's'}.`;

  let currentStatus, currentTone;
  if (overdueInvoices.length > 0) {
    currentStatus = `Attention required — ${gbp.format(overdueTotal)} overdue across ${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''}.`;
    currentTone = 'rose';
  } else if (outstanding > 0) {
    currentStatus = `${gbp.format(outstanding)} outstanding across ${outstandingInvoices.length} invoice${outstandingInvoices.length > 1 ? 's' : ''}.`;
    currentTone = 'amber';
  } else {
    currentStatus = 'No outstanding balance.';
    currentTone = 'emerald';
  }
  const healthExplanation = `${historical} ${currentStatus}`;

  // ---- Timeline (rich, clickable, typed events with reference) -------------
  const timeline = [
    ...(customer.created_date
      ? [{ date: customer.created_date.slice(0, 10), type: 'Customer created', reference: null, kind: 'created', amount: null, status: 'Created', onClick: null }]
      : []),
    ...invoices.flatMap((i) => {
      const evs = [{ date: i.issue_date, type: 'Invoice created', reference: i.invoice_number, amount: i.total, kind: 'invoice', status: i.status || 'Issued', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } }];
      if (i.posted_date && ['approved', 'sent', 'part_paid', 'paid'].includes(i.status)) {
        evs.push({ date: i.posted_date.slice(0, 10), type: 'Invoice approved', reference: i.invoice_number, amount: null, kind: 'invoice_approved', status: 'Approved', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } });
      }
      if (['sent', 'part_paid', 'paid'].includes(i.status)) {
        evs.push({ date: (i.posted_date || i.issue_date).slice(0, 10), type: 'Invoice sent', reference: i.invoice_number, amount: null, kind: 'invoice_sent', status: 'Sent', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } });
      }
      return evs;
    }),
    ...payments.map((p) => ({
      date: p.date,
      type: 'Payment received',
      reference: p.matched_record_number || null,
      amount: p.money_in,
      kind: 'payment',
      status: 'Received',
      onClick: () => { onOpenChange(false); nav('/transactions'); },
    })),
    ...creditNotes.map((c) => ({ date: c.credit_note_date, type: 'Credit note issued', reference: c.credit_note_number, amount: c.total, kind: 'credit_note', status: c.status || 'Issued', onClick: () => { onOpenChange(false); nav('/sales-credit-notes'); } })),
    ...documents.map((d) => ({ date: d.upload_date, type: 'Document uploaded', reference: d.name, amount: null, kind: 'document', status: d.status || 'Uploaded', onClick: () => { onOpenChange(false); nav('/documents'); } })),
  ].filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : -1));

  const address = [customer.address_line_1, customer.address_line_2, customer.city, customer.county, customer.postcode, customer.country].filter(Boolean).join(', ');

  // ---- Executive summary (structured insight cards) -------------------------
  const revPct = revenueLastYear > 0 ? Math.round((revenueYtd - revenueLastYear) / revenueLastYear * 100) : null;
  const insights = [
    {
      icon: UserCheck,
      tone: 'positive',
      title: 'Customer Status',
      onClick: () => { onOpenChange(false); nav('/invoices'); },
      detail: revenue12m > 50000 ? 'One of your highest-value customers.'
        : revenue12m > 0 ? 'A valued, active customer.'
        : outstanding > 0 ? 'Carries an outstanding balance.'
        : 'A new customer relationship.',
    },
    {
      icon: revPct != null && revPct < 0 ? TrendingDown : TrendingUp,
      tone: revPct == null ? 'info' : revPct > 0 ? 'positive' : revPct < 0 ? 'warning' : 'info',
      title: 'Revenue',
      onClick: () => { onOpenChange(false); nav('/invoices'); },
      detail: revPct != null
        ? (revPct > 0 ? `${revPct}% higher than last year.`
          : revPct < 0 ? `${Math.abs(revPct)}% lower than last year.`
          : 'In line with last year.')
        : `${gbp.format(revenueYtd)} this year.`,
    },
    {
      icon: FileText,
      tone: overdueInvoices.length > 0 ? 'critical' : outstandingInvoices.length > 0 ? 'info' : 'positive',
      title: 'Outstanding',
      onClick: () => { onOpenChange(false); nav('/invoices'); },
      detail: overdueInvoices.length > 0
        ? `${overdueInvoices.length} overdue (${gbp.format(overdueTotal)}).`
        : outstandingInvoices.length > 0
          ? `${outstandingInvoices.length} outstanding (${gbp.format(outstanding)}).`
          : 'No outstanding invoices.',
    },
    {
      icon: CreditCard,
      tone: avgPaymentDays == null ? 'info' : avgPaymentDays <= terms ? 'positive' : 'warning',
      title: 'Payment Behaviour',
      onClick: () => { onOpenChange(false); nav('/transactions'); },
      detail: avgPaymentDays != null
        ? `Average payment ${avgPaymentDays} days.`
        : 'No payment history yet.',
    },
    {
      icon: ArrowRight,
      tone: (overdueInvoices.length > 0 || outstanding > 0) ? 'info' : 'positive',
      title: 'Recommendation',
      onClick: () => focusAsk(),
      detail: overdueInvoices.length > 0
        ? 'Send a payment reminder.'
        : outstanding > 0
          ? 'Record a payment.'
          : 'No action needed.',
    },
  ];

  // ---- Ask context (inherited automatically) -------------------------------
  const customerContext = `Customer workspace for "${customer.name}". Contact: ${customer.contact_name || '—'}. Email: ${customer.email || '—'}. Phone: ${customer.phone || '—'}. Outstanding balance: ${gbp.format(outstanding)}. Credit limit: ${customer.credit_limit ? gbp.format(customer.credit_limit) : 'none'}. Credit remaining: ${creditRemaining != null ? gbp.format(creditRemaining) : 'no limit'}. Payment terms: ${terms} days. Total invoices: ${invoices.length} (${outstandingInvoices.length} outstanding, ${overdueInvoices.length} overdue worth ${gbp.format(overdueTotal)}). Revenue last 12 months: ${gbp.format(revenue12m)}. Revenue this year: ${gbp.format(revenueYtd)}. Revenue last year: ${gbp.format(revenueLastYear)}. Avg payment time: ${avgPaymentDays != null ? avgPaymentDays + ' days' : 'n/a'}. Credit notes: ${creditNotes.length}. Documents: ${documents.length}. Health: ${health}/100 (${healthLabel}).`;

  const aiInsightsPrompt = `You are an accounting analyst. Using only the Ledgerly customer data in context, write an executive analysis covering: revenue trends, payment behaviour, customer profitability, late payment trends, suggested actions, potential risks, and potential opportunities. For EACH point explain WHY using the actual figures from the data. Avoid generic advice. Use short bullet points, each with a one-line takeaway. End with "Recommended next action: …".`;

  // ---- Handlers (email / call / notes / tags) -----------------------------
  const focusAsk = () => document.getElementById('workspace-ask-input')?.focus();
  const mailtoReminder = () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Reminder — outstanding invoice')}`; };
  const mailtoStatement = () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Account Statement — ' + customer.name)}&body=${encodeURIComponent(statementBody)}`; };
  const mailtoEmail = () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Regarding your account')}`; };
  const callCustomer = () => { if (customer.phone) window.location.href = `tel:${customer.phone}`; };

  const saveNotes = async (v) => {
    if ((v || '') === (customer.notes || '')) return;
    try {
      await base44.entities.Customer.update(customer.id, { notes: v });
      toast({ title: 'Notes saved' });
    } catch (e) {
      toast({ title: 'Could not save notes', variant: 'destructive' });
    }
  };

  const saveTags = async (next) => {
    try {
      await base44.entities.Customer.update(customer.id, { tags: next });
      setTagsState(next);
    } catch (e) {
      toast({ title: 'Could not update tags', variant: 'destructive' });
    }
  };
  const toggleTag = (t) => {
    const set = new Set(tagsState);
    if (set.has(t)) set.delete(t); else set.add(t);
    saveTags(Array.from(set));
  };
  const addTag = (t) => { if (t && !tagsState.includes(t)) saveTags([...tagsState, t]); };
  const removeTag = (t) => saveTags(tagsState.filter((x) => x !== t));
  const applyCreditHold = async () => {
    if (!tagsState.includes('Credit Hold')) await saveTags([...tagsState, 'Credit Hold']);
    onOpenChange(false);
    onEdit?.(customer);
  };

  // ---- Smart Collections engine (staged, proactive) -----------------------
  const collectionsItems = [];
  if (overdueInvoices.length > 0) {
    let stage, stageLabel, onClick, severity;
    if (oldestOverdueDays > 60) { stage = 4; stageLabel = 'Place account on hold'; onClick = applyCreditHold; severity = 'critical'; }
    else if (oldestOverdueDays > 30) { stage = 3; stageLabel = 'Schedule phone call'; onClick = callCustomer; severity = 'critical'; }
    else if (oldestOverdueDays > 14) { stage = 2; stageLabel = 'Send statement'; onClick = mailtoStatement; severity = 'warning'; }
    else { stage = 1; stageLabel = 'Send reminder'; onClick = mailtoReminder; severity = 'warning'; }
    collectionsItems.push({
      label: `Collections · Stage ${stage}: ${stageLabel}`,
      detail: `${gbp.format(overdueTotal)} overdue · oldest ${oldestOverdueDays} days`,
      severity,
      onClick,
    });
  }

  // ---- What needs attention ------------------------------------------------
  const attentionItems = [...collectionsItems];
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

  // ---- What should I do next (dynamic, directly below header) --------------
  const primary = overdueInvoices.length > 0
    ? { label: 'Send Reminder', icon: Bell, onClick: mailtoReminder }
    : outstanding > 0
      ? { label: 'Record Payment', icon: Wallet, onClick: () => { onOpenChange(false); nav('/transactions'); } }
      : null;

  const secondary = [];
  if (overdueInvoices.length > 0) {
    if (outstanding > 0) secondary.push({ label: 'Record Payment', icon: Wallet, onClick: () => { onOpenChange(false); nav('/transactions'); } });
    secondary.push({ label: 'Email Customer', icon: Mail, onClick: mailtoEmail });
    secondary.push({ label: 'Ask Ledgerly', icon: Sparkles, onClick: focusAsk });
  } else if (outstanding > 0) {
    secondary.push({ label: 'Send Statement', icon: Send, onClick: mailtoStatement });
    secondary.push({ label: 'Email Customer', icon: Mail, onClick: mailtoEmail });
    secondary.push({ label: 'Ask Ledgerly', icon: Sparkles, onClick: focusAsk });
  } else {
    secondary.push({ label: 'Create Invoice', icon: Plus, onClick: () => { onOpenChange(false); nav('/invoices/new'); } });
    secondary.push({ label: 'Send Statement', icon: Send, onClick: mailtoStatement });
    secondary.push({ label: 'Email Customer', icon: Mail, onClick: mailtoEmail });
    secondary.push({ label: 'Upload Document', icon: FileText, onClick: () => { onOpenChange(false); nav('/documents'); } });
    secondary.push({ label: 'Ask Ledgerly', icon: Sparkles, onClick: focusAsk });
  }
  if (creditExceeded) secondary.push({ label: 'Review Credit Limit', icon: PoundSterling, onClick: () => { onOpenChange(false); onEdit?.(customer); } });

  // ---- Quick actions + more (header) ---------------------------------------
  const statementBody = `Account Statement — ${customer.name}\n\nOutstanding invoices:\n${outstandingInvoices.map((i) => `${i.invoice_number} — due ${i.due_date} — ${gbp.format(Number(i.balance_due) || 0)}`).join('\n') || 'None'}\n\nTotal outstanding: ${gbp.format(outstanding)}`;
  const quickActions = [
    { label: 'Create Invoice', icon: Plus, onClick: () => { onOpenChange(false); nav('/invoices/new'); } },
    { label: 'Record Payment', icon: Wallet, onClick: () => { onOpenChange(false); nav('/transactions'); } },
    { label: 'Send Statement', icon: Send, onClick: mailtoStatement },
    { label: 'Email Customer', icon: Mail, onClick: mailtoEmail },
    { label: 'Ask', icon: Sparkles, onClick: focusAsk },
  ];

  const moreActions = [
    { label: 'Edit Customer', icon: Pencil, onSelect: () => { onOpenChange(false); onEdit?.(customer); } },
    { label: 'Archive', icon: Archive, onSelect: () => onArchive?.(customer) },
    { label: 'Duplicate', icon: Copy, onSelect: () => onDuplicate?.(customer) },
    { label: 'Export', icon: Download, onSelect: () => onExport?.(customer) },
    { label: 'Merge', icon: GitMerge, onSelect: () => onMerge?.(customer) },
    { separator: true },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete?.(customer) },
  ];

  // ---- Header -------------------------------------------------------------
  const header = {
    title: customer.name,
    statusLabel: customer.status === 'active' ? 'Active' : 'Inactive',
    statusTone: customer.status === 'active' ? 'green' : 'amber',
    metrics: [
      { label: 'Outstanding', value: gbp.format(outstanding), tone: outstanding > 0 ? 'rose' : 'emerald' },
      { label: 'Credit Limit', value: customer.credit_limit ? gbp.format(customer.credit_limit) : 'None' },
      { label: 'Payment Terms', value: `${terms} days` },
    ],
    info: [],
    quickActions,
    moreActions,
    favourite,
    onToggleFavourite: toggleFavourite,
  };

  // ---- Financial summary (clickable → related tab) ------------------------
  const summaryStats = [
    { label: 'Outstanding Balance', value: gbp.format(outstanding), tone: outstanding > 0 ? 'rose' : 'emerald', tab: 'invoices', helper: 'Click to view outstanding invoices' },
    { label: 'Revenue (12 Months)', value: gbp.format(revenue12m), tab: 'ai-insights', helper: 'Click to view revenue analysis' },
    { label: 'Average Payment Days', value: avgPaymentDays != null ? `${avgPaymentDays} days` : '—', tab: 'payments', helper: 'Click to view payment history' },
    { label: 'Credit Remaining', value: creditRemaining != null ? gbp.format(creditRemaining) : 'No limit', tone: creditRemainingTone, tab: 'overview', helper: 'Click to view credit information' },
  ];

  // ---- Customer profile + contact quick actions --------------------------
  const profileFields = [
    { icon: FileText, label: 'Primary Contact', value: customer.contact_name },
    { icon: Mail, label: 'Email', value: customer.email, onClick: customer.email ? mailtoEmail : null },
    { icon: Phone, label: 'Telephone', value: customer.phone, onClick: customer.phone ? callCustomer : null },
    { icon: MapPin, label: 'Address', value: address },
    { icon: PoundSterling, label: 'VAT Number', value: customer.vat_number },
    { icon: CreditCard, label: 'Payment Terms', value: customer.payment_terms ? `${customer.payment_terms} days` : '' },
    { icon: PoundSterling, label: 'Credit Limit', value: customer.credit_limit ? gbp.format(customer.credit_limit) : 'None' },
    { icon: FileText, label: 'Account Number', value: customer.customer_reference },
  ];

  const contactActions = [
    { icon: Mail, label: 'Email', onClick: mailtoEmail },
    { icon: Phone, label: 'Call', onClick: callCustomer },
    { icon: Pencil, label: 'Edit', onClick: () => { onOpenChange(false); onEdit?.(customer); } },
  ];

  // ---- Collections Centre --------------------------------------------------
  const oldestInvoiceRec = overdueInvoices.length > 0
    ? overdueInvoices.slice().sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0]
    : null;
  const oldestInvoiceDays = oldestInvoiceRec ? Math.floor((now - new Date(oldestInvoiceRec.due_date)) / 86400000) : 0;
  let collectionsStageNum = 0, collectionsStageLabel = 'Clear', collectionsNextAction = null, collectionsNextOnClick = null, legalStatus = 'Clear', legalTone = 'emerald';
  if (overdueInvoices.length > 0) {
    if (oldestOverdueDays > 60) { collectionsStageNum = 4; collectionsStageLabel = 'Account on hold'; collectionsNextAction = 'Place account on hold'; collectionsNextOnClick = applyCreditHold; legalStatus = 'Pre-legal'; legalTone = 'rose'; }
    else if (oldestOverdueDays > 30) { collectionsStageNum = 3; collectionsStageLabel = 'Schedule call'; collectionsNextAction = 'Schedule phone call'; collectionsNextOnClick = callCustomer; legalStatus = 'Escalating'; legalTone = 'rose'; }
    else if (oldestOverdueDays > 14) { collectionsStageNum = 2; collectionsStageLabel = 'Send statement'; collectionsNextAction = 'Send statement'; collectionsNextOnClick = mailtoStatement; legalStatus = 'Pre-collection'; legalTone = 'amber'; }
    else { collectionsStageNum = 1; collectionsStageLabel = 'Send reminder'; collectionsNextAction = 'Send reminder'; collectionsNextOnClick = mailtoReminder; legalStatus = 'Pre-collection'; legalTone = 'amber'; }
  }
  const collectionsHistory = overdueInvoices.slice().sort((a, b) => (a.due_date < b.due_date ? -1 : 1)).slice(0, 4).map((i) => ({
    reference: i.invoice_number,
    detail: `${Math.floor((now - new Date(i.due_date)) / 86400000)} days · ${gbp.format(Number(i.balance_due) || 0)}`,
    onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); },
  }));

  // ---- Revenue Analytics ---------------------------------------------------
  const invoiceTotals = invoices.map((i) => Number(i.total) || 0);
  const avgInvoiceValue = invoiceTotals.length ? invoiceTotals.reduce((a, b) => a + b, 0) / invoiceTotals.length : 0;
  const largestInvoiceRec = invoices.length ? invoices.slice().sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))[0] : null;
  const invoiceCount12m = invoices.filter((i) => i.issue_date && new Date(i.issue_date) >= twelveAgo).length;
  let invoiceFrequency = 'None';
  if (invoiceCount12m >= 10) invoiceFrequency = 'Monthly';
  else if (invoiceCount12m >= 4) invoiceFrequency = 'Quarterly';
  else if (invoiceCount12m >= 1) invoiceFrequency = 'Occasional';

  // ---- Tabs (iconified, familiar accounting navigation) ------------------
  const tabs = [
    {
      label: 'Overview', icon: LayoutDashboard, columns: 2,
      cards: [
        { kind: 'collections-centre', span: 'full', stage: collectionsStageNum, stageLabel: collectionsStageLabel, nextAction: collectionsNextAction, onNextAction: collectionsNextOnClick, oldestInvoice: oldestInvoiceRec ? { number: oldestInvoiceRec.invoice_number, days: oldestInvoiceDays, amount: Number(oldestInvoiceRec.balance_due) || 0 } : null, onOpenOldest: oldestInvoiceRec ? () => { onOpenChange(false); nav(`/invoices/${oldestInvoiceRec.id}`); } : null, legalStatus, legalTone, history: collectionsHistory },
        { kind: 'revenue-analytics', span: 'full', revenue12m, growthPct: revPct, avgInvoiceValue, largestInvoice: largestInvoiceRec ? { number: largestInvoiceRec.invoice_number, amount: Number(largestInvoiceRec.total) || 0 } : null, invoiceFrequency, onOpenLargest: largestInvoiceRec ? () => { onOpenChange(false); nav(`/invoices/${largestInvoiceRec.id}`); } : null, onOpenInvoices: () => { onOpenChange(false); nav('/invoices'); } },
        { kind: 'needs-attention', span: 'full', items: attentionItems },
        { kind: 'related-records', span: 1, sections: [
          { title: 'Outstanding Invoices', records: outstandingInvoices.slice(0, 5).map((i) => ({ primary: i.invoice_number, secondary: `Due ${i.due_date}`, amount: Number(i.balance_due) || 0, onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })) },
        ] },
        { kind: 'related-records', span: 1, sections: [
          { title: 'Recent Payments', records: payments.slice(0, 5).map((p) => ({ primary: p.description, secondary: p.date, amount: Number(p.money_in) || 0, onClick: () => {} })) },
        ] },
        { kind: 'documents', span: 'full', compact: true, documents: documents.slice(0, 5).map((d) => ({ id: d.id, name: d.name, date: d.upload_date, type: d.document_type })), onOpen: () => { onOpenChange(false); nav('/documents'); } },
        { kind: 'notes', span: 'full', value: notes, onChange: setNotes, onSave: saveNotes, updatedDate: customer.updated_date },
      ],
    },
    {
      label: 'Invoices', icon: Receipt, columns: 3,
      cards: [
        { kind: 'related-records', span: 'full', sections: [{
          title: 'All Invoices',
          records: invoices.map((i) => ({ primary: i.invoice_number, secondary: `Issued ${i.issue_date} · Due ${i.due_date} · ${i.status}`, amount: Number(i.total) || 0, onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })),
        }] },
      ],
    },
    {
      label: 'Payments', icon: ArrowLeftRight, columns: 3,
      cards: [
        { kind: 'related-records', span: 'full', sections: [{
          title: 'Payment History',
          records: payments.map((p) => ({ primary: p.description, secondary: `${p.date}${p.matched_record_number ? ' · ' + p.matched_record_number : ''}`, amount: Number(p.money_in) || 0, onClick: () => {} })),
        }] },
      ],
    },
    {
      label: 'Credit Notes', icon: FileMinus, columns: 3,
      cards: [
        { kind: 'related-records', span: 'full', sections: [{
          title: 'Sales Credit Notes',
          records: creditNotes.map((c) => ({ primary: c.credit_note_number, secondary: `${c.credit_note_date} · ${c.reason || c.status}`, amount: -Math.abs(Number(c.total) || 0), onClick: () => { onOpenChange(false); nav('/sales-credit-notes'); } })),
        }] },
      ],
    },
    {
      label: 'Documents', icon: Paperclip, columns: 3,
      cards: [
        { kind: 'documents', span: 'full', documents: documents.map((d) => ({ id: d.id, name: d.name, date: d.upload_date, type: d.document_type })), onOpen: () => { onOpenChange(false); nav('/documents'); } },
      ],
    },
    {
      label: 'Notes', icon: StickyNote, columns: 3,
      cards: [
        { kind: 'notes', span: 'full', value: notes, onChange: setNotes, onSave: saveNotes, updatedDate: customer.updated_date, expanded: true },
      ],
    },
    {
      label: 'Activity', icon: Rss, columns: 3,
      cards: [{ kind: 'timeline', span: 'full', events: timeline, filterable: true }],
    },
    {
      label: 'AI Insights', icon: Sparkles, columns: 3,
      cards: [{ kind: 'ai-insights', span: 'full', companyId: activeCompany?.id, context: customerContext, prompt: aiInsightsPrompt }],
    },
  ];

  // ---- Relationship intelligence (data-driven CRM signals) ---------------
  const created = customer.created_date ? new Date(customer.created_date) : null;
  let relationshipAge = '—';
  if (created) {
    const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    const yrs = Math.floor(months / 12);
    const mos = months % 12;
    relationshipAge = yrs > 0 ? `${yrs} yr${yrs > 1 ? 's' : ''}${mos > 0 ? ' ' + mos + ' mo' : ''}` : `${mos} mo`;
  }

  let customerValue, customerValueTone;
  if (revenue12m >= 50000) { customerValue = 'Strategic'; customerValueTone = 'primary'; }
  else if (revenue12m >= 20000) { customerValue = 'High Value'; customerValueTone = 'emerald'; }
  else if (revenue12m > 0) { customerValue = 'Standard'; customerValueTone = 'muted'; }
  else { customerValue = 'Low Activity'; customerValueTone = 'amber'; }

  let paymentRisk, paymentRiskTone;
  if (overdueInvoices.length === 0) { paymentRisk = 'Low Risk'; paymentRiskTone = 'emerald'; }
  else if (oldestOverdueDays > 60 || creditExceeded || (outstanding > 0 && overdueTotal / outstanding > 0.5)) { paymentRisk = 'High Risk'; paymentRiskTone = 'rose'; }
  else { paymentRisk = 'Medium Risk'; paymentRiskTone = 'amber'; }

  let buyingTrend, buyingTrendTone;
  if (revenue12m === 0 && invoices.length === 0) { buyingTrend = 'Inactive'; buyingTrendTone = 'muted'; }
  else if (revenueLastYear === 0 && revenueYtd > 0) { buyingTrend = 'New'; buyingTrendTone = 'primary'; }
  else if (revPct == null) { buyingTrend = 'Steady'; buyingTrendTone = 'muted'; }
  else if (revPct > 10) { buyingTrend = 'Increasing'; buyingTrendTone = 'emerald'; }
  else if (revPct < -10) { buyingTrend = 'Declining'; buyingTrendTone = 'rose'; }
  else { buyingTrend = 'Steady'; buyingTrendTone = 'muted'; }

  const lastInvoiceDate = invoices.length > 0
    ? invoices.map((i) => i.issue_date).filter(Boolean).sort().pop()
    : null;
  const commsCount = (notes ? 1 : 0) + documents.length + payments.length;
  const comms = commsCount > 0
    ? `${commsCount} interaction${commsCount > 1 ? 's' : ''}${lastInvoiceDate ? ' · last ' + lastInvoiceDate : ''}`
    : 'No communication recorded.';

  const opportunities = [];
  if (customerValue === 'Strategic') opportunities.push({ tone: 'primary', text: 'Strategic account — schedule a quarterly review.' });
  if (buyingTrend === 'Increasing') opportunities.push({ tone: 'positive', text: 'Growing spend — propose an annual contract.' });
  if (invoices.length >= 5 && paymentRisk === 'Low Risk') opportunities.push({ tone: 'positive', text: 'Loyal, reliable customer — upsell premium services.' });
  if (overdueInvoices.length > 0) opportunities.push({ tone: 'critical', text: 'Overdue balance — prioritise collections.' });
  if (revenue12m === 0 && invoices.length > 0) opportunities.push({ tone: 'warning', text: 'No recent sales — run a re-engagement campaign.' });
  if (opportunities.length === 0) opportunities.push({ tone: 'info', text: 'Maintain regular contact to grow the relationship.' });

  // ---- Customer Lifecycle --------------------------------------------------
  let lifecycleStage = 'New', lifecycleTone = 'muted', lifecycleDetail = 'Early-stage relationship.';
  if (revenue12m === 0 && invoices.length === 0) { lifecycleStage = 'Inactive'; lifecycleTone = 'muted'; lifecycleDetail = 'No sales activity recorded.'; }
  else if (paymentRisk === 'High Risk' || creditExceeded) { lifecycleStage = 'At-risk'; lifecycleTone = 'rose'; lifecycleDetail = 'Financial concerns require attention.'; }
  else if (buyingTrend === 'Declining') { lifecycleStage = 'Declining'; lifecycleTone = 'amber'; lifecycleDetail = 'Revenue trending down vs last year.'; }
  else if (buyingTrend === 'Increasing') { lifecycleStage = 'Growing'; lifecycleTone = 'emerald'; lifecycleDetail = 'Revenue trending up vs last year.'; }
  else if (invoices.length >= 5) { lifecycleStage = 'Established'; lifecycleTone = 'primary'; lifecycleDetail = 'Long-standing, steady customer.'; }

  // ---- Communication Centre ------------------------------------------------
  const preferredMethod = customer.email ? 'Email' : customer.phone ? 'Phone' : '—';

  // ---- Smart tags (auto-assigned from behaviour) ---------------------------
  const smartTagsSet = new Set();
  if (customerValue === 'Strategic') { smartTagsSet.add('VIP'); smartTagsSet.add('Key Account'); }
  if (invoices.length >= 5) smartTagsSet.add('Repeat Customer');
  if (paymentRisk === 'High Risk') smartTagsSet.add('High Risk');
  if (oldestOverdueDays > 60 || creditExceeded) smartTagsSet.add('Credit Hold');
  if (invoiceCount12m >= 10) smartTagsSet.add('Monthly Account');
  if (creditNotes.length > 0) smartTagsSet.add('Warranty Customer');
  const smartTags = Array.from(smartTagsSet);

  // ---- Right context panel (sticky) --------------------------------------
  const contextPanel = [
    { kind: 'customer-health', score: health, label: healthLabel, tone: healthTone, historical, current: currentStatus, currentTone },
    { kind: 'customer-lifecycle', stage: lifecycleStage, detail: lifecycleDetail, tone: lifecycleTone },
    { kind: 'relationship-intelligence', value: customerValue, valueTone: customerValueTone, relationshipAge, risk: paymentRisk, riskTone: paymentRiskTone, trend: buyingTrend, trendTone: buyingTrendTone, comms, opportunities },
    { kind: 'communication-centre', preferredMethod, onEmail: mailtoEmail, onStatement: mailtoStatement, onReminder: mailtoReminder, onCall: callCustomer },
    { kind: 'customer-tags', smartTags, tags: tagsState, predefined: PREDEFINED_TAGS, onToggle: toggleTag, onAdd: addTag, onRemove: removeTag },
    { kind: 'timeline', events: timeline.slice(0, 8), maxHeight: '18rem' },
    { kind: 'profile', title: customer.name, subtitle: customer.status === 'active' ? 'Active customer' : 'Inactive customer', fields: profileFields, actions: contactActions },
  ];

  const primaryActions = { kind: 'next-actions', primary, secondary, noActionLabel: 'No immediate action is required.' };

  return (
    <WorkspaceEngine
      type="customer"
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      header={header}
      executiveSummary={{ kind: 'executive-summary', insights }}
      primaryActions={primaryActions}
      summaryStats={summaryStats}
      tabs={tabs}
      contextPanel={contextPanel}
      arrival={arrival}
      ask={{
        placeholder: `Ask about ${customer.name}…`,
        context: customerContext,
        companyId: activeCompany?.id,
        suggestions: ['Summarise this customer', 'Show overdue invoices', 'Create invoice', 'Email statement', 'Explain revenue trend'],
      }}
    />
  );
}