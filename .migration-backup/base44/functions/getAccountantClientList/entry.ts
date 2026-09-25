import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's companies (only those they've been invited to)
    const links = await base44.asServiceRole.entities.CompanyUser.filter({
      user_id: user.id, status: 'active'
    });

    const clientPromises = links.map(async (link) => {
      try {
        const company = await base44.asServiceRole.entities.Company.get(link.company_id);
        const [vatReturns, bankTxns, documents, bills] = await Promise.all([
          base44.asServiceRole.entities.VATReturn.filter({ company_id: company.id }),
          base44.asServiceRole.entities.BankTransaction.filter({ company_id: company.id }),
          base44.asServiceRole.entities.Document.filter({ company_id: company.id }),
          base44.asServiceRole.entities.PurchaseBill.filter({ company_id: company.id }),
        ]);

        // Latest VAT return
        const sortedVATReturns = vatReturns.sort((a, b) =>
          new Date(b.period_end || 0) - new Date(a.period_end || 0)
        );
        const latestVATReturn = sortedVATReturns[0];
        const estimatedVATDue = latestVATReturn ? (latestVATReturn.box5_net_vat || 0) : 0;

        // Counts
        const txnsNeedingReview = bankTxns.filter(t => t.status === 'review').length;
        const docsPendingReview = documents.filter(d =>
          d.status === 'pending_review' || d.status === 'pending_extraction'
        ).length;
        const billsAwaitingApproval = bills.filter(b =>
          b.status === 'awaiting_review' || b.status === 'draft'
        ).length;

        // Last activity date
        const allDates = [
          ...vatReturns.map(r => r.updated_date),
          ...bankTxns.map(t => t.updated_date),
          ...documents.map(d => d.updated_date),
          ...bills.map(b => b.updated_date),
          company.updated_date,
        ].filter(Boolean);
        const lastActivity = allDates.sort((a, b) => new Date(b) - new Date(a))[0] || null;

        // Determine status
        const status = determineClientStatus(latestVATReturn, txnsNeedingReview, docsPendingReview, billsAwaitingApproval);

        return {
          id: company.id,
          name: company.name,
          vat_number: company.vat_number || '',
          vat_frequency: company.vat_frequency || 'quarterly',
          vat_registered: company.vat_registered,
          estimated_vat_due: estimatedVATDue,
          latest_vat_period_end: latestVATReturn ? latestVATReturn.period_end : null,
          latest_vat_status: latestVATReturn ? latestVATReturn.status : null,
          txns_needing_review: txnsNeedingReview,
          docs_pending_review: docsPendingReview,
          bills_awaiting_approval: billsAwaitingApproval,
          last_activity: lastActivity,
          status,
          role: link.role,
        };
      } catch (e) {
        return null;
      }
    });

    const clients = (await Promise.all(clientPromises)).filter(Boolean);

    return Response.json({ clients });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function determineClientStatus(latestVATReturn, txnsNeedingReview, docsPendingReview, billsAwaitingApproval) {
  // Check overdue first (highest priority)
  if (latestVATReturn && latestVATReturn.period_end && latestVATReturn.status !== 'submitted') {
    const periodEnd = new Date(latestVATReturn.period_end);
    if (periodEnd < new Date()) {
      return 'overdue';
    }
  }

  // Check needs review
  if (txnsNeedingReview > 0 || docsPendingReview > 0 || billsAwaitingApproval > 0) {
    return 'needs_review';
  }

  // Check VAT due soon (within 30 days)
  if (latestVATReturn && latestVATReturn.period_end && latestVATReturn.status !== 'submitted') {
    const periodEnd = new Date(latestVATReturn.period_end);
    const daysUntilDue = Math.floor((periodEnd - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 30) {
      return 'vat_due_soon';
    }
  }

  return 'up_to_date';
}