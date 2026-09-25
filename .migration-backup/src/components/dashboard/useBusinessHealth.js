import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Shared business-health engine. Used by the header, the Business Snapshot
// hero, and the KPI Health card so the score is consistent everywhere.

export const OPEN_HEALTH_EVENT = 'ledgerly:open-health';
export function openHealthDetails() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_HEALTH_EVENT));
}

export function computeHealth({ accts, txns, docs, vat, inv, bills }) {
  const today = new Date().toISOString().slice(0, 10);
  const review = (txns || []).filter((t) => t.status === 'review').length;
  const pendingDocs = (docs || []).filter((d) => d.status === 'pending_review' || d.status === 'pending_extraction').length;
  const draftVat = (vat || []).filter((v) => v.status === 'draft' || v.status === 'ready_for_review').length;
  const overdueInv = (inv || []).filter(
    (i) => ['approved', 'sent', 'part_paid'].includes(i.status) && (Number(i.balance_due) || 0) > 0 && i.due_date < today
  ).length;
  const approveBills = (bills || []).filter((b) => b.status === 'awaiting_review' || b.status === 'draft').length;

  let score = 0;
  score += (accts || []).length > 0 ? 20 : 0;
  score += review === 0 ? 20 : Math.max(0, 20 - Math.min(10, review));
  score += pendingDocs === 0 ? 20 : Math.max(0, 20 - Math.min(10, pendingDocs));
  score += draftVat === 0 ? 20 : 10;
  score += overdueInv === 0 ? 20 : Math.max(0, 20 - Math.min(10, overdueInv));

  const positives = [];
  if ((accts || []).length > 0) positives.push('Bank accounts connected');
  if (review === 0) positives.push('Bank reconciled');
  if (pendingDocs === 0) positives.push('Documents reviewed');
  if (draftVat === 0) positives.push('VAT ready');
  if (overdueInv === 0) positives.push('No overdue invoices');

  const attention = [];
  if ((accts || []).length === 0) attention.push('No bank account connected yet');
  if (review > 0) attention.push(`${review} bank transaction${review > 1 ? 's' : ''} to review`);
  if (approveBills > 0) attention.push(`${approveBills} bill${approveBills > 1 ? 's' : ''} awaiting approval`);
  if (overdueInv > 0) attention.push(`${overdueInv} overdue invoice${overdueInv > 1 ? 's' : ''}`);
  if (pendingDocs > 0) attention.push(`${pendingDocs} document${pendingDocs > 1 ? 's' : ''} to review`);
  if (draftVat > 0) attention.push('VAT return pending');

  const suggestions = [];
  if (review > 0) suggestions.push({ label: 'Review bank transactions', route: '/transactions' });
  if (approveBills > 0) suggestions.push({ label: 'Approve outstanding bills', route: '/bills' });
  if (overdueInv > 0) suggestions.push({ label: 'Chase overdue invoices', route: '/invoices' });
  if (pendingDocs > 0) suggestions.push({ label: 'Review uploaded documents', route: '/documents' });
  if (draftVat > 0) suggestions.push({ label: 'Prepare VAT return', route: '/vat' });
  if (!suggestions.length) suggestions.push({ label: "You're all caught up — nothing to do", route: '/' });

  let priority = null;
  if (review > 0) priority = { label: `Review ${review} bank transaction${review > 1 ? 's' : ''}`, route: '/transactions' };
  else if (approveBills > 0) priority = { label: `Approve ${approveBills} bill${approveBills > 1 ? 's' : ''}`, route: '/bills' };
  else if (overdueInv > 0) priority = { label: `Chase ${overdueInv} overdue invoice${overdueInv > 1 ? 's' : ''}`, route: '/invoices' };
  else if (pendingDocs > 0) priority = { label: `Review ${pendingDocs} document${pendingDocs > 1 ? 's' : ''}`, route: '/documents' };
  else if (draftVat > 0) priority = { label: 'Prepare your VAT return', route: '/vat' };
  else priority = { label: "You're all caught up today", route: '/' };

  let summary;
  if (overdueInv > 0) summary = `Reviewing ${overdueInv} overdue invoice${overdueInv > 1 ? 's' : ''} could increase your score.`;
  else if (review > 0) summary = `Reviewing ${review} bank transaction${review > 1 ? 's' : ''} will improve your score.`;
  else if (approveBills > 0) summary = `Approving ${approveBills} bill${approveBills > 1 ? 's' : ''} will lift your score.`;
  else if (pendingDocs > 0) summary = `Reviewing ${pendingDocs} document${pendingDocs > 1 ? 's' : ''} will tidy your books.`;
  else if ((accts || []).length === 0) summary = 'Connect a bank account to start tracking your health.';
  else summary = 'Your business is performing well — keep it up.';

  return { score, summary, positives, attention, suggestions, priority };
}

export function healthStatus(score) {
  if (score == null) return '—';
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Critical';
}

export function healthStatusTone(score) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 90) return 'text-emerald-600';
  if (score >= 70) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-rose-600';
}

export function useBusinessHealth(companyId) {
  const [data, setData] = useState({ loading: true });
  useEffect(() => {
    if (!companyId) {
      setData({ loading: false, score: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [accts, txns, docs, vat, inv, bills] = await Promise.all([
          base44.entities.BankAccount.filter({ company_id: companyId }),
          base44.entities.BankTransaction.filter({ company_id: companyId }, '-date', 500),
          base44.entities.Document.filter({ company_id: companyId }),
          base44.entities.VATReturn.filter({ company_id: companyId }),
          base44.entities.SalesInvoice.filter({ company_id: companyId }, '-due_date', 300),
          base44.entities.PurchaseBill.filter({ company_id: companyId }, '-due_date', 300),
        ]);
        if (cancelled) return;
        const result = computeHealth({ accts, txns, docs, vat, inv, bills });
        let trend = 0;
        try {
          const key = `lp.health.last.${companyId}`;
          const last = Number(localStorage.getItem(key));
          if (!Number.isNaN(last)) trend = result.score - last;
          localStorage.setItem(key, String(result.score));
        } catch {
          /* ignore */
        }
        setData({ loading: false, ...result, trend });
      } catch {
        if (!cancelled) setData({ loading: false, score: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  return data;
}

export function healthOneLiner(score) {
  if (score == null) return 'Checking your books…';
  if (score >= 90) return 'Everything looks healthy — nice work.';
  if (score >= 70) return 'A couple of things to tidy up.';
  if (score >= 50) return 'A few items need your attention today.';
  return 'Your books need some attention.';
}