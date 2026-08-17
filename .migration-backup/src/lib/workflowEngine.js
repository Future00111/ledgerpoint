import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// =============================================================================
// Workflow Engine (Phase 1)
// A reusable framework that turns a record (invoice, customer, …) into a
// consistent workflow: ordered stages, the current stage, AI-style
// recommendations, configurable overdue automations, and a permanent
// activity history.
//
// The first workflow is the Invoice Workflow:
//   Customer → Invoice → Payment → Collection
// =============================================================================

// ---- Stage definitions -------------------------------------------------------
// Ordered invoice workflow stages. Each stage has a stable key, a display
// label, an ordering index, and a tone used across every workflow UI.
export const INVOICE_WORKFLOW_STAGES = [
  { key: 'draft', label: 'Draft', order: 1, tone: 'slate' },
  { key: 'approved', label: 'Approved', order: 2, tone: 'blue' },
  { key: 'sent', label: 'Sent', order: 3, tone: 'blue' },
  { key: 'viewed', label: 'Viewed', order: 4, tone: 'indigo' },
  { key: 'due', label: 'Due', order: 5, tone: 'slate' },
  { key: 'overdue', label: 'Overdue', order: 6, tone: 'amber' },
  { key: 'reminder_sent', label: 'Reminder Sent', order: 7, tone: 'amber' },
  { key: 'second_reminder_sent', label: 'Second Reminder Sent', order: 8, tone: 'amber' },
  { key: 'final_demand_sent', label: 'Final Demand Sent', order: 9, tone: 'orange' },
  { key: 'account_on_hold', label: 'Account On Hold', order: 10, tone: 'rose' },
  { key: 'legal_action', label: 'Legal Action', order: 11, tone: 'rose' },
  { key: 'paid', label: 'Paid', order: 12, tone: 'emerald' },
];

export const STAGE_BY_KEY = Object.fromEntries(INVOICE_WORKFLOW_STAGES.map((s) => [s.key, s]));

// ---- Stage resolution --------------------------------------------------------
// Derive the current workflow stage for an invoice from its status, overdue
// state, reminder history and any account-level collection flags.
export function computeInvoiceStage(invoice, { daysOverdue = 0, remindersSent = 0, onHold = false, legalAction = false } = {}) {
  if (!invoice) return STAGE_BY_KEY.draft;
  const status = invoice.status || 'draft';
  if (status === 'cancelled') return { ...STAGE_BY_KEY.draft, label: 'Cancelled', tone: 'muted', isCancelled: true };
  if (status === 'paid') return { ...STAGE_BY_KEY.paid, isFinal: true };
  if (legalAction) return { ...STAGE_BY_KEY.legal_action };
  if (onHold) return { ...STAGE_BY_KEY.account_on_hold };
  if (daysOverdue > 60) return { ...STAGE_BY_KEY.final_demand_sent };
  if (remindersSent >= 2 && daysOverdue > 30) return { ...STAGE_BY_KEY.second_reminder_sent };
  if (remindersSent >= 1 && daysOverdue > 14) return { ...STAGE_BY_KEY.reminder_sent };
  if (daysOverdue > 0) return { ...STAGE_BY_KEY.overdue };
  if (status === 'sent' || status === 'part_paid') {
    const due = invoice.due_date ? new Date(invoice.due_date) : null;
    if (due && due <= new Date()) return { ...STAGE_BY_KEY.due };
    return { ...STAGE_BY_KEY.sent };
  }
  if (status === 'approved') return { ...STAGE_BY_KEY.approved };
  return { ...STAGE_BY_KEY.draft };
}

// ---- Configurable automations -----------------------------------------------
// Optional, threshold-driven suggestions surfaced beside the workflow.
// `daysOverdue` is the trigger; `stage` is the stage the invoice moves to if
// the recommendation is accepted. These are the engine defaults and can be
// tuned or overridden per company.
export const INVOICE_WORKFLOW_AUTOMATIONS = [
  { id: 'rem_14', daysOverdue: 14, action: 'Send a reminder', reason: 'Invoice is 14 days overdue.', confidence: 94, stage: 'reminder_sent' },
  { id: 'stmt_30', daysOverdue: 30, action: 'Send a statement', reason: 'Invoice is 30 days overdue.', confidence: 91, stage: 'second_reminder_sent' },
  { id: 'call_60', daysOverdue: 60, action: 'Recommend a telephone call', reason: 'Invoice is 60 days overdue.', confidence: 88, stage: 'final_demand_sent' },
  { id: 'hold_90', daysOverdue: 90, action: 'Place account on hold', reason: 'Invoice is 90 days overdue.', confidence: 90, stage: 'account_on_hold' },
  { id: 'legal_180', daysOverdue: 180, action: 'Escalate to legal action', reason: 'Invoice is 180 days overdue.', confidence: 96, stage: 'legal_action' },
];

// Returns the single most-applicable automation for the given overdue days, or null.
export function getActiveAutomation(daysOverdue) {
  if (!daysOverdue || daysOverdue <= 0) return null;
  let match = null;
  for (const a of INVOICE_WORKFLOW_AUTOMATIONS) {
    if (daysOverdue >= a.daysOverdue) match = a;
  }
  return match;
}

// ---- AI recommendation ------------------------------------------------------
export function computeWorkflowRecommendation(invoice, ctx = {}) {
  const { daysOverdue = 0 } = ctx;
  const stage = computeInvoiceStage(invoice, ctx);
  if (stage.isFinal) return { nextAction: 'No action required', reason: 'Invoice has been paid in full.', confidence: 100, tone: 'emerald', automation: null, stage };
  if (stage.isCancelled) return { nextAction: 'No action required', reason: 'Invoice was cancelled.', confidence: 100, tone: 'muted', automation: null, stage };
  if ((invoice.status || 'draft') === 'draft') return { nextAction: 'Approve and send invoice', reason: 'Invoice is still in draft.', confidence: 90, tone: 'primary', automation: null, stage };
  const auto = getActiveAutomation(daysOverdue);
  if (auto) return { nextAction: auto.action, reason: auto.reason, confidence: auto.confidence, tone: stage.tone, automation: auto, stage };
  if (invoice.status === 'approved') return { nextAction: 'Send invoice to customer', reason: 'Invoice is approved but not yet sent.', confidence: 88, tone: 'primary', automation: null, stage };
  return { nextAction: 'Await payment', reason: `Due ${invoice.due_date || 'soon'}.`, confidence: 80, tone: 'muted', automation: null, stage };
}

// ---- Activity history (permanent store) ------------------------------------
// Log a workflow event. Best-effort: never throws (a logging failure must not
// break the user's action).
export async function logWorkflowActivity({
  company_id, entity_type, entity_id, entity_name,
  workflow_type = 'invoice', stage, action, action_label,
  user_id, user_name, notes, metadata, event_date,
}) {
  if (!company_id || !entity_type || !entity_id || !action) return null;
  try {
    return await base44.entities.WorkflowActivity.create({
      company_id, entity_type, entity_id, entity_name, workflow_type,
      stage, action, action_label,
      user_id: user_id || '', user_name: user_name || 'System',
      notes: notes || '', metadata: metadata || {},
      event_date: event_date || new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to log workflow activity', e);
    return null;
  }
}

// React hook: fetch all stored workflow activities for a record.
export function useWorkflowActivities(entityType, entityId) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!entityType || !entityId) { setActivities([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    base44.entities.WorkflowActivity.filter({ entity_type: entityType, entity_id: entityId }, '-event_date', 200)
      .then((a) => { if (!cancelled) setActivities(a || []); })
      .catch(() => { if (!cancelled) setActivities([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);
  return { activities, loading };
}

// ---- Timeline builder -------------------------------------------------------
// Merge permanently-stored activities with derived baseline events so the
// timeline is never empty even before activities are logged. Returns events
// newest-first, each with { id, timestamp, user, action, label, notes, stage, done }.
export function buildWorkflowTimeline(invoice, { payments = [], creditNotes = [], activities = [] } = {}) {
  if (!invoice) return [];
  const events = [];
  const activeStatuses = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];

  if (invoice.issue_date) events.push({ id: 'd_created', timestamp: invoice.issue_date, user: 'System', action: 'invoice_created', label: 'Invoice created', notes: invoice.invoice_number || '', stage: 'draft', done: true, source: 'derived' });
  if (invoice.posted_date && activeStatuses.includes(invoice.status)) events.push({ id: 'd_approved', timestamp: invoice.posted_date, user: 'User', action: 'invoice_approved', label: 'Invoice approved', notes: '', stage: 'approved', done: true, source: 'derived' });
  if (['sent', 'part_paid', 'paid', 'overdue'].includes(invoice.status)) events.push({ id: 'd_sent', timestamp: invoice.posted_date || invoice.issue_date, user: 'User', action: 'invoice_emailed', label: 'Invoice emailed', notes: '', stage: 'sent', done: true, source: 'derived' });
  if (invoice.status === 'paid') events.push({ id: 'd_paid', timestamp: invoice.posted_date || new Date().toISOString(), user: 'System', action: 'payment_received', label: 'Payment received', notes: 'Paid in full', stage: 'paid', done: true, source: 'derived' });

  (activities || []).forEach((a) => {
    events.push({ id: 'a_' + a.id, timestamp: a.event_date, user: a.user_name || 'User', action: a.action, label: a.action_label || a.action, notes: a.notes || '', stage: a.stage, done: true, source: 'activity' });
  });
  (payments || []).filter((p) => p.linked_invoice_id === invoice.id).forEach((p) => {
    events.push({ id: 'p_' + p.id, timestamp: p.date, user: 'System', action: 'payment_received', label: 'Payment received', notes: p.matched_record_number || '', stage: 'paid', done: true, source: 'payment' });
  });
  (creditNotes || []).filter((c) => c.original_invoice_id === invoice.id).forEach((c) => {
    events.push({ id: 'c_' + c.id, timestamp: c.credit_note_date, user: 'User', action: 'credit_note_issued', label: 'Credit note issued', notes: c.credit_note_number || '', stage: 'paid', done: true, source: 'credit' });
  });

  events.sort((a, b) => ((a.timestamp || '') < (b.timestamp || '') ? 1 : -1));
  return events;
}