import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Lightweight activity scores used by Smart Suggestions and the Adaptive
// dashboard. One fetch per company; widgets keep their own richer data — this
// only needs counts to decide what to surface/highlight.
export function useDashboardActivity(companyId) {
  const [activity, setActivity] = useState({});

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const [txns, inv, bills, docs, vat] = await Promise.all([
          base44.entities.BankTransaction.filter({ company_id: companyId }, '-date', 500),
          base44.entities.SalesInvoice.filter({ company_id: companyId }, '-due_date', 500),
          base44.entities.PurchaseBill.filter({ company_id: companyId }, '-due_date', 500),
          base44.entities.Document.filter({ company_id: companyId }),
          base44.entities.VATReturn.filter({ company_id: companyId }, '-created_date', 5),
        ]);
        if (cancelled) return;
        const review = (txns || []).filter((t) => t.status === 'review').length;
        const overdueInv = (inv || []).filter((i) => i.status === 'overdue').length;
        const billsAwaiting = (bills || []).filter((b) => b.status === 'awaiting_review').length;
        const docsPending = (docs || []).filter((d) => d.status === 'pending_review' || d.status === 'pending_extraction').length;
        let vatScore = 0;
        if (vat && vat[0] && vat[0].period_end) {
          const days = Math.ceil((new Date(vat[0].period_end).getTime() - Date.now()) / 86400000);
          vatScore = days >= 0 && days <= 30 ? 1 : 0;
        }
        setActivity({
          transactionsReview: review,
          invoices: overdueInv,
          billsApproval: billsAwaiting,
          docsReview: docsPending,
          vat: vatScore,
        });
      } catch {
        if (!cancelled) setActivity({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return activity;
}