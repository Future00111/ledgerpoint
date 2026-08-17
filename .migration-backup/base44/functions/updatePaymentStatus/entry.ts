import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity_type, record_id, amount_paid_delta } = await req.json();

    let entity, record;
    if (entity_type === 'sales_invoice') {
      entity = base44.entities.SalesInvoice;
      record = await entity.get(record_id);
    } else if (entity_type === 'purchase_bill') {
      entity = base44.entities.PurchaseBill;
      record = await entity.get(record_id);
    } else {
      return Response.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const currentAmountPaid = record.amount_paid || 0;
    const delta = amount_paid_delta || 0;
    const newAmountPaid = Math.max(0, currentAmountPaid + delta);
    const total = record.total || 0;
    const balanceDue = Math.max(0, total - newAmountPaid);
    const dueDate = record.due_date || '';
    const today = new Date().toISOString().split('T')[0];

    // Don't override draft or cancelled
    let newStatus = record.status;
    if (record.status !== 'draft' && record.status !== 'cancelled') {
      if (newAmountPaid >= total && total > 0) {
        newStatus = 'paid';
      } else if (dueDate && dueDate < today && balanceDue > 0) {
        newStatus = 'overdue';
      } else if (newAmountPaid > 0 && newAmountPaid < total) {
        newStatus = 'part_paid';
      }
    }

    await entity.update(record_id, {
      amount_paid: newAmountPaid,
      balance_due: balanceDue,
      status: newStatus
    });

    return Response.json({
      status: newStatus,
      amount_paid: newAmountPaid,
      balance_due: balanceDue
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});