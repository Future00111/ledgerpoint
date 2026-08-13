import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { computeCustomerHealth } from '@/lib/customerHealth';
import {
  Mail, Phone, MapPin, FileText, CreditCard, PoundSterling,
  Plus, Wallet, Send, Pencil, Archive, Copy, Download, GitMerge, Trash2,
  Sparkles, UserCheck, TrendingUp, TrendingDown,
} from 'lucide-react';

import WorkspaceEngine from '@/components/workspace/WorkspaceEngine';
import { useFavourite } from '@/components/workspace/useFavourite';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const PREDEFINED_TAGS = ['VIP', 'Fleet', 'Trade', 'Cash Account', 'High Risk', 'Credit Hold', 'Monthly Account', 'Key Account', 'Warranty Customer', 'Repeat Customer'];

// =============================================================================
// Customer Workspace — action-led command centre.
// Answers four questions immediately: Who is this customer? How valuable are
// they? Do we have a payment problem? What should we do next?
// Single-scroll two-column layout (no tabs):
//   LEFT  (working): Executive Summary · Collections Centre · AI Collections
//                    Recommendation · What Needs Attention · Outstanding
//                    Invoices · Recent Payments · Revenue Analytics ·
//                    Documents · Notes
//   RIGHT (context):  Customer Health · Customer Lifecycle · Relationship
//                    Intelligence · Customer Tags · Activity Timeline ·
//                    Customer Details · AI Assistant
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

  useEffect(() => { setNotes(customer?.notes || ''); }, [customer?.id, customer?.notes]);
  useEffect(() => { setTagsState(Array.isArray(customer?.tags) ? customer.tags : []); }, [customer?.id, customer?.tags]);

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

  // ---- Derived metrics ------------------------------------------------------
  const now = new Date();
  const twelveAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const revenue12m = invoices.filter((i) => i.issue_date && new Date(i.issue_date) >= twelveAgo).reduce((s, i) => s + Number(i.total || 0), 0);
  const ytd = new Date(now.getFullYear(), 0, 1);
  const revenueYtd = invoices.filter((i) => i.issue_date && new Date(i.issue_date) >= ytd).reduce((s, i) => s + Number(i.total || 0), 0);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
  const revenueLastYear = invoices.filter((i) => i.issue_date && new Date(i.issue_date) >= lastYearStart && new Date(i.issue_date) <= lastYearEnd).reduce((s, i) => s + Number(i.total || 0), 0);
  const validInvoices = invoices.filter((i) => i.status !== 'cancelled');
  const lifetimeValue = validInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const outstandingInvoices = validInvoices.filter((i) => Number(i.balance_due) > 0);
  const outstanding = outstandingInvoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);
  const overdueInvoices = outstandingInvoices.filter((i) => i.due_date && new Date(i.due_date) < now);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);
  const oldestOverdueDays = overdueInvoices.length > 0
    ? Math.max(...overdueInvoices.map((i) => Math.floor((now - new Date(i.due_date)) / 86400000)))
    : 0;
  const invoiceCount12m = invoices.filter((i) => i.issue_date && new Date(i.issue_date) >= twelveAgo).length;
  const largestInvoiceRec = invoices.length ? invoices.slice().sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))[0] : null;

  const payDays = [];
  payments.forEach((p) => {
    const inv = invoices.find((i) => i.id === p.linked_invoice_id);
    if (inv && inv.issue_date && p.date) payDays.push(Math.max(0, (new Date(p.date) - new Date(inv.issue_date)) / 86400000));
  });
  const avgPaymentDays = payDays.length ? Math.round(payDays.reduce((a, b) => a + b, 0) / payDays.length) : null;

  const creditExceeded = customer.credit_limit > 0 && outstanding > customer.credit_limit;
  const terms = customer.payment_terms || 30;

  // ---- Customer Health (multi-factor, no contradictions) -------------------
  const health = computeCustomerHealth({
    overdueCount: overdueInvoices.length, overdueTotal, oldestOverdueDays,
    outstanding, avgPaymentDays, terms,
    revenue12m, revenueLastYear, revenueYtd,
    invoiceCount12m, lifetimeValue, creditExceeded, hasInvoices: invoices.length > 0,
  });

  // ---- Timeline ------------------------------------------------------------
  const timeline = [
    ...(customer.created_date
      ? [{ date: customer.created_date.slice(0, 10), type: 'Customer created', reference: null, kind: 'created', amount: null, status: 'Created', onClick: null }]
      : []),
    ...invoices.flatMap((i) => {
      const evs = [{ date: i.issue_date, type: 'Invoice created', reference: i.invoice_number, amount: i.total, kind: 'invoice', status: i.status || 'Issued', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } }];
      if (i.posted_date && ['approved', 'sent', 'part_paid', 'paid'].includes(i.status)) evs.push({ date: i.posted_date.slice(0, 10), type: 'Invoice approved', reference: i.invoice_number, amount: null, kind: 'invoice_approved', status: 'Approved', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } });
      if (['sent', 'part_paid', 'paid'].includes(i.status)) evs.push({ date: (i.posted_date || i.issue_date).slice(0, 10), type: 'Invoice sent', reference: i.invoice_number, amount: null, kind: 'invoice_sent', status: 'Sent', onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } });
      return evs;
    }),
    ...payments.map((p) => ({ date: p.date, type: 'Payment received', reference: p.matched_record_number || null, amount: p.money_in, kind: 'payment', status: 'Received', onClick: () => { onOpenChange(false); nav('/transactions'); } })),
    ...creditNotes.map((c) => ({ date: c.credit_note_date, type: 'Credit note issued', reference: c.credit_note_number, amount: c.total, kind: 'credit_note', status: c.status || 'Issued', onClick: () => { onOpenChange(false); nav('/sales-credit-notes'); } })),
    ...documents.map((d) => ({ date: d.upload_date, type: 'Document uploaded', reference: d.name, amount: null, kind: 'document', status: d.status || 'Uploaded', onClick: () => { onOpenChange(false); nav('/documents'); } })),
  ].filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : -1));

  const address = [customer.address_line_1, customer.address_line_2, customer.city, customer.county, customer.postcode, customer.country].filter(Boolean).join(', ');

  // ---- Handlers -----------------------------------------------------------
  const focusAsk = () => document.getElementById('workspace-ask-input')?.focus();
  const mailtoReminder = () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Reminder — outstanding invoice')}`; };
  const mailtoEmail = () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Regarding your account')}`; };
  const callCustomer = () => { if (customer.phone) window.location.href = `tel:${customer.phone}`; };
  const finalDemandBody = `Final Demand\n\n${customer.name},\n\nDespite previous reminders, the following invoices remain unpaid:\n\n${overdueInvoices.map((i) => `${i.invoice_number} — due ${i.due_date} — ${gbp.format(Number(i.balance_due) || 0)}`).join('\n') || 'None'}\n\nTotal overdue: ${gbp.format(overdueTotal)}\n\nPlease settle immediately to avoid account hold and further action.`;
  const mailtoFinalDemand = () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Final Demand — overdue account')}&body=${encodeURIComponent(finalDemandBody)}`; };
  const statementBody = `Account Statement — ${customer.name}\n\nOutstanding invoices:\n${outstandingInvoices.map((i) => `${i.invoice_number} — due ${i.due_date} — ${gbp.format(Number(i.balance_due) || 0)}`).join('\n') || 'None'}\n\nTotal outstanding: ${gbp.format(outstanding)}`;
  const mailtoStatement = () => { window.location.href = `mailto:${customer.email || ''}?subject=${encodeURIComponent('Account Statement — ' + customer.name)}&body=${encodeURIComponent(statementBody)}`; };

  const saveNotes = async (v) => {
    if ((v || '') === (customer.notes || '')) return;
    try { await base44.entities.Customer.update(customer.id, { notes: v }); toast({ title: 'Notes saved' }); }
    catch (e) { toast({ title: 'Could not save notes', variant: 'destructive' }); }
  };
  const saveTags = async (next) => {
    try { await base44.entities.Customer.update(customer.id, { tags: next }); setTagsState(next); }
    catch (e) { toast({ title: 'Could not update tags', variant: 'destructive' }); }
  };
  const toggleTag = (t) => { const set = new Set(tagsState); if (set.has(t)) set.delete(t); else set.add(t); saveTags(Array.from(set)); };
  const addTag = (t) => { if (t && !tagsState.includes(t)) saveTags([...tagsState, t]); };
  const removeTag = (t) => saveTags(tagsState.filter((x) => x !== t));
  const applyCreditHold = async () => {
    if (!tagsState.includes('Credit Hold')) await saveTags([...tagsState, 'Credit Hold']);
    onOpenChange(false); onEdit?.(customer);
  };
  const escalateLegal = async () => {
    if (!tagsState.includes('Legal Action')) await saveTags([...tagsState, 'Legal Action']);
    toast({ title: 'Legal escalation flagged', description: 'Refer this account to your solicitor. Tagged "Legal Action".' });
  };

  // ---- Collections (5-stage progression) ----------------------------------
  const COLLECTION_STAGES = [
    { n: 1, label: 'Reminder', legal: 'Pre-collection', tone: 'amber', next: { label: 'Send reminder', onClick: mailtoReminder } },
    { n: 2, label: 'Escalation', legal: 'Escalating', tone: 'amber', next: { label: 'Send escalation notice', onClick: mailtoStatement } },
    { n: 3, label: 'Final demand', legal: 'Final demand', tone: 'amber', next: { label: 'Send final demand', onClick: mailtoFinalDemand } },
    { n: 4, label: 'Account on hold', legal: 'Pre-legal', tone: 'rose', next: { label: 'Place account on hold', destructive: true, onClick: applyCreditHold, description: 'Place this account on hold? New sales will be blocked and a Credit Hold tag added.' } },
    { n: 5, label: 'Legal action', legal: 'Legal action', tone: 'rose', next: { label: 'Escalate to legal action', destructive: true, onClick: escalateLegal, description: 'Escalate to legal action? This flags the account for your solicitor and adds a Legal Action tag.' } },
  ];
  let collectionsStage = null;
  if (overdueInvoices.length > 0) {
    if (oldestOverdueDays > 90) collectionsStage = COLLECTION_STAGES[4];
    else if (oldestOverdueDays > 60) collectionsStage = COLLECTION_STAGES[3];
    else if (oldestOverdueDays > 30) collectionsStage = COLLECTION_STAGES[2];
    else if (oldestOverdueDays > 14) collectionsStage = COLLECTION_STAGES[1];
    else collectionsStage = COLLECTION_STAGES[0];
  }
  const oldestInvoiceRec = overdueInvoices.length > 0
    ? overdueInvoices.slice().sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0]
    : null;
  const oldestInvoiceDays = oldestInvoiceRec ? Math.floor((now - new Date(oldestInvoiceRec.due_date)) / 86400000) : 0;
  const collectionsHistory = overdueInvoices.slice().sort((a, b) => (a.due_date < b.due_date ? -1 : 1)).slice(0, 4).map((i) => ({
    reference: i.invoice_number,
    detail: `${Math.floor((now - new Date(i.due_date)) / 86400000)} days · ${gbp.format(Number(i.balance_due) || 0)}`,
    onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); },
  }));

  // ---- AI Collections Recommendation ---------------------------------------
  const hasCollections = overdueInvoices.length > 0;
  let aiCollections = null;
  if (hasCollections) {
    const confidence = Math.max(55, Math.min(95,
      72 + Math.min(16, Math.floor(oldestOverdueDays / 10))
        + (overdueTotal >= 10000 ? 4 : 0)
        + (creditExceeded ? 3 : 0)
        + (avgPaymentDays != null && avgPaymentDays > terms ? 3 : 0)
    ));
    let aiActions;
    if (oldestOverdueDays <= 14) {
      aiActions = [
        { label: 'Send a payment reminder', onClick: mailtoReminder },
        { label: 'Call the customer', onClick: callCustomer },
      ];
    } else if (oldestOverdueDays <= 30) {
      aiActions = [
        { label: 'Send an escalation notice', onClick: mailtoStatement },
        { label: 'Call the customer', onClick: callCustomer },
        { label: 'Send a final demand notice', onClick: mailtoFinalDemand },
      ];
    } else if (oldestOverdueDays <= 60) {
      aiActions = [
        { label: 'Send a final demand notice', onClick: mailtoFinalDemand },
        { label: 'Place account on hold', destructive: true, onClick: applyCreditHold, description: 'Place this account on hold? New sales will be blocked and a Credit Hold tag added.' },
        { label: 'Call the customer', onClick: callCustomer },
      ];
    } else {
      aiActions = [
        { label: 'Place account on hold', destructive: true, onClick: applyCreditHold, description: 'Place this account on hold? New sales will be blocked and a Credit Hold tag added.' },
        { label: 'Send a final demand notice', onClick: mailtoFinalDemand },
        { label: 'Call the customer', onClick: callCustomer },
        { label: 'Escalate to legal action within 14 days', destructive: true, onClick: escalateLegal, description: 'Escalate to legal action? This flags the account for your solicitor and adds a Legal Action tag.' },
      ];
    }
    const reasoning = [
      `Oldest debt: ${oldestOverdueDays} days overdue`,
      `Outstanding balance: ${gbp.format(overdueTotal)}`,
    ];
    if (avgPaymentDays != null && avgPaymentDays > terms) reasoning.push('Payment behaviour has deteriorated');
    if (revenue12m >= 20000) reasoning.push('Customer remains strategically valuable');
    else if (revenue12m > 0 && overdueTotal > revenue12m) reasoning.push('Overdue balance exceeds annual revenue');
    if (creditExceeded) reasoning.push('Credit limit exceeded');
    if (overdueInvoices.length > 1) reasoning.push(`${overdueInvoices.length} invoices in arrears`);
    aiCollections = { confidence, actions: aiActions, reasoning };
  }

  // ---- What needs attention ----------------------------------------------
  const attentionItems = [];
  if (overdueInvoices.length > 0) attentionItems.push({ label: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''}`, detail: `${gbp.format(overdueTotal)} overdue · oldest ${oldestOverdueDays} days`, severity: 'critical', onClick: () => { onOpenChange(false); nav('/invoices'); } });
  if (creditExceeded) attentionItems.push({ label: 'Credit limit exceeded', detail: `${gbp.format(outstanding)} owed vs ${gbp.format(customer.credit_limit)} limit`, severity: 'critical', onClick: () => { onOpenChange(false); onEdit?.(customer); } });
  if (overdueInvoices.length === 0 && outstandingInvoices.length > 0) attentionItems.push({ label: `${outstandingInvoices.length} outstanding invoice${outstandingInvoices.length > 1 ? 's' : ''}`, detail: `${gbp.format(outstanding)} outstanding`, severity: 'warning', onClick: () => { onOpenChange(false); nav('/invoices'); } });
  if (documents.length === 0) attentionItems.push({ label: 'No documents on file', detail: 'Upload invoices or statements to keep records complete', severity: 'info', onClick: () => { onOpenChange(false); nav('/documents'); } });

  // ---- Executive summary -------------------------------------------------
  const revPct = revenueLastYear > 0 ? Math.round((revenueYtd - revenueLastYear) / revenueLastYear * 100) : null;
  const insights = [
    {
      icon: UserCheck, tone: 'positive', title: 'Customer Status',
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
        ? (revPct > 0 ? `${revPct}% higher than last year.` : revPct < 0 ? `${Math.abs(revPct)}% lower than last year.` : 'In line with last year.')
        : `${gbp.format(revenueYtd)} this year.`,
    },
    {
      icon: FileText,
      tone: overdueInvoices.length > 0 ? 'critical' : outstandingInvoices.length > 0 ? 'info' : 'positive',
      title: 'Outstanding',
      onClick: () => { onOpenChange(false); nav('/invoices'); },
      detail: overdueInvoices.length > 0
        ? `${overdueInvoices.length} overdue (${gbp.format(overdueTotal)}).`
        : outstandingInvoices.length > 0 ? `${outstandingInvoices.length} outstanding (${gbp.format(outstanding)}).` : 'No outstanding invoices.',
    },
    {
      icon: CreditCard,
      tone: avgPaymentDays == null ? 'info' : avgPaymentDays <= terms ? 'positive' : 'warning',
      title: 'Payment Behaviour',
      onClick: () => { onOpenChange(false); nav('/transactions'); },
      detail: avgPaymentDays != null ? `Average payment ${avgPaymentDays} days.` : 'No payment history yet.',
    },
  ];

  // ---- Relationship intelligence -----------------------------------------
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

  const lastInvoiceDate = invoices.length > 0 ? invoices.map((i) => i.issue_date).filter(Boolean).sort().pop() : null;
  const commsCount = (notes ? 1 : 0) + documents.length + payments.length;
  const comms = commsCount > 0 ? `${commsCount} interaction${commsCount > 1 ? 's' : ''}${lastInvoiceDate ? ' · last ' + lastInvoiceDate : ''}` : 'No communication recorded.';

  const opportunities = [];
  if (customerValue === 'Strategic') opportunities.push({ tone: 'primary', text: 'Strategic account — schedule a quarterly review.' });
  if (buyingTrend === 'Increasing') opportunities.push({ tone: 'positive', text: 'Growing spend — propose an annual contract.' });
  if (invoices.length >= 5 && paymentRisk === 'Low Risk') opportunities.push({ tone: 'positive', text: 'Loyal, reliable customer — upsell premium services.' });
  if (overdueInvoices.length > 0) opportunities.push({ tone: 'critical', text: 'Overdue balance — prioritise collections.' });
  if (revenue12m === 0 && invoices.length > 0) opportunities.push({ tone: 'warning', text: 'No recent sales — run a re-engagement campaign.' });
  if (opportunities.length === 0) opportunities.push({ tone: 'info', text: 'Maintain regular contact to grow the relationship.' });

  // ---- Lifecycle (single active state, consistent with health & risk) ----
  let lifecycleStage = 'New', lifecycleTone = 'muted', lifecycleDetail = 'Early-stage relationship.';
  if (revenue12m === 0 && invoices.length === 0) { lifecycleStage = 'Inactive'; lifecycleTone = 'muted'; lifecycleDetail = 'No sales activity recorded.'; }
  else if (paymentRisk === 'High Risk' || creditExceeded) { lifecycleStage = 'At-risk'; lifecycleTone = 'rose'; lifecycleDetail = 'Financial concerns require immediate attention.'; }
  else if (buyingTrend === 'Declining') { lifecycleStage = 'Declining'; lifecycleTone = 'amber'; lifecycleDetail = 'Revenue trending down vs last year.'; }
  else if (buyingTrend === 'Increasing') { lifecycleStage = 'Growing'; lifecycleTone = 'emerald'; lifecycleDetail = 'Revenue trending up vs last year.'; }
  else if (invoices.length >= 5) { lifecycleStage = 'Established'; lifecycleTone = 'primary'; lifecycleDetail = 'Long-standing, steady customer.'; }

  // ---- Smart tags (auto-assigned from behaviour) ------------------------
  const smartTagsSet = new Set();
  if (customerValue === 'Strategic') { smartTagsSet.add('VIP'); smartTagsSet.add('Key Account'); }
  if (invoices.length >= 5) smartTagsSet.add('Repeat Customer');
  if (paymentRisk === 'High Risk') smartTagsSet.add('High Risk');
  if (oldestOverdueDays > 60 || creditExceeded) smartTagsSet.add('Credit Hold');
  if (invoiceCount12m >= 10) smartTagsSet.add('Monthly Account');
  if (creditNotes.length > 0) smartTagsSet.add('Warranty Customer');
  const smartTags = Array.from(smartTagsSet);

  // ---- Profile + contact ------------------------------------------------
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

  // ---- Header -----------------------------------------------------------
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
    quickActions: [
      { label: 'Create Invoice', icon: Plus, onClick: () => { onOpenChange(false); nav('/invoices/new'); } },
      { label: 'Record Payment', icon: Wallet, onClick: () => { onOpenChange(false); nav('/transactions'); } },
      { label: 'Send Statement', icon: Send, onClick: mailtoStatement },
      { label: 'Email Customer', icon: Mail, onClick: mailtoEmail },
      { label: 'Ask', icon: Sparkles, onClick: focusAsk },
    ],
    moreActions: [
      { label: 'Edit Customer', icon: Pencil, onSelect: () => { onOpenChange(false); onEdit?.(customer); } },
      { label: 'Archive', icon: Archive, onSelect: () => onArchive?.(customer) },
      { label: 'Duplicate', icon: Copy, onSelect: () => onDuplicate?.(customer) },
      { label: 'Export', icon: Download, onSelect: () => onExport?.(customer) },
      { label: 'Merge', icon: GitMerge, onSelect: () => onMerge?.(customer) },
      { separator: true },
      { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete?.(customer) },
    ],
    favourite,
    onToggleFavourite: toggleFavourite,
  };

  // ---- Ask context ------------------------------------------------------
  const customerContext = `Customer workspace for "${customer.name}". Contact: ${customer.contact_name || '—'}. Email: ${customer.email || '—'}. Phone: ${customer.phone || '—'}. Outstanding balance: ${gbp.format(outstanding)}. Credit limit: ${customer.credit_limit ? gbp.format(customer.credit_limit) : 'none'}. Payment terms: ${terms} days. Invoices: ${invoices.length} (${outstandingInvoices.length} outstanding, ${overdueInvoices.length} overdue worth ${gbp.format(overdueTotal)}, oldest ${oldestOverdueDays} days). Revenue 12m: ${gbp.format(revenue12m)}. YTD: ${gbp.format(revenueYtd)}. Last year: ${gbp.format(revenueLastYear)}. Lifetime value: ${gbp.format(lifetimeValue)}. Avg payment: ${avgPaymentDays != null ? avgPaymentDays + ' days' : 'n/a'}. Health: ${health.score}/100 (${health.label}). Payment risk: ${paymentRisk}.`;

  // ---- LEFT column (working) --------------------------------------------
  const leftCards = [
    { kind: 'executive-summary', insights },
    {
      kind: 'collections-centre',
      stage: collectionsStage?.n || 0,
      stageLabel: collectionsStage?.label || 'Clear',
      legalStatus: collectionsStage?.legal || 'Clear',
      legalTone: collectionsStage?.tone || 'emerald',
      oldestInvoice: oldestInvoiceRec ? { number: oldestInvoiceRec.invoice_number, days: oldestInvoiceDays, amount: Number(oldestInvoiceRec.balance_due) || 0 } : null,
      onOpenOldest: oldestInvoiceRec ? () => { onOpenChange(false); nav(`/invoices/${oldestInvoiceRec.id}`); } : null,
      totalOverdue: overdueTotal,
      overdueCount: overdueInvoices.length,
      oldestDays: oldestOverdueDays,
      history: collectionsHistory,
      nextAction: collectionsStage ? collectionsStage.next : null,
    },
    ...(aiCollections ? [{ kind: 'ai-collections-recommendation', confidence: aiCollections.confidence, actions: aiCollections.actions, reasoning: aiCollections.reasoning }] : []),
    { kind: 'needs-attention', items: attentionItems },
    {
      kind: 'related-records',
      sections: [{
        title: 'Outstanding Invoices',
        records: outstandingInvoices.slice(0, 6).map((i) => ({ primary: i.invoice_number, secondary: `Due ${i.due_date}`, amount: Number(i.balance_due) || 0, onClick: () => { onOpenChange(false); nav(`/invoices/${i.id}`); } })),
        footer: { label: 'View all invoices', onClick: () => { onOpenChange(false); nav('/invoices'); } },
      }],
    },
    {
      kind: 'related-records',
      sections: [{
        title: 'Recent Payments',
        records: payments.slice(0, 6).map((p) => ({ primary: p.description, secondary: p.date, amount: Number(p.money_in) || 0, onClick: () => { onOpenChange(false); nav('/transactions'); } })),
        footer: { label: 'View all transactions', onClick: () => { onOpenChange(false); nav('/transactions'); } },
      }],
    },
    {
      kind: 'revenue-analytics',
      revenue12m, growthPct: revPct, avgInvoiceValue: invoices.length ? invoices.reduce((s, i) => s + Number(i.total || 0), 0) / invoices.length : 0,
      largestInvoice: largestInvoiceRec ? { number: largestInvoiceRec.invoice_number, amount: Number(largestInvoiceRec.total) || 0 } : null,
      invoiceFrequency: invoiceCount12m >= 10 ? 'Monthly' : invoiceCount12m >= 4 ? 'Quarterly' : invoiceCount12m >= 1 ? 'Occasional' : 'None',
      onOpenLargest: largestInvoiceRec ? () => { onOpenChange(false); nav(`/invoices/${largestInvoiceRec.id}`); } : null,
      onOpenInvoices: () => { onOpenChange(false); nav('/invoices'); },
    },
    {
      kind: 'documents', compact: true,
      documents: documents.slice(0, 5).map((d) => ({ id: d.id, name: d.name, date: d.upload_date, type: d.document_type })),
      onOpen: () => { onOpenChange(false); nav('/documents'); },
    },
    { kind: 'notes', value: notes, onChange: setNotes, onSave: saveNotes, updatedDate: customer.updated_date },
  ];

  // ---- RIGHT column (context) -------------------------------------------
  const rightCards = [
    { kind: 'customer-health', score: health.score, label: health.label, tone: health.tone, historical: health.historical, current: health.current, currentTone: health.currentTone },
    { kind: 'customer-lifecycle', stage: lifecycleStage, detail: lifecycleDetail, tone: lifecycleTone },
    { kind: 'relationship-intelligence', value: customerValue, valueTone: customerValueTone, relationshipAge, risk: paymentRisk, riskTone: paymentRiskTone, trend: buyingTrend, trendTone: buyingTrendTone, comms, opportunities },
    { kind: 'customer-tags', smartTags, tags: tagsState, predefined: PREDEFINED_TAGS, onToggle: toggleTag, onAdd: addTag, onRemove: removeTag },
    { kind: 'timeline', events: timeline.slice(0, 10), filterable: true, maxHeight: '20rem' },
    { kind: 'profile', title: customer.name, subtitle: customer.status === 'active' ? 'Active customer' : 'Inactive customer', fields: profileFields, actions: contactActions },
  ];

  return (
    <WorkspaceEngine
      type="customer"
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      header={header}
      layout="columns"
      leftCards={leftCards}
      rightCards={rightCards}
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