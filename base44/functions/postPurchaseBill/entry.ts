import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bill_id, company_id } = await req.json();
    if (!bill_id || !company_id) return Response.json({ error: 'Missing bill_id or company_id' }, { status: 400 });

    const bill = await base44.entities.PurchaseBill.get(bill_id);
    if (!bill || bill.company_id !== company_id) return Response.json({ error: 'Bill not found' }, { status: 404 });
    if (bill.status !== 'draft' && bill.status !== 'awaiting_review') return Response.json({ error: 'Only draft or awaiting review bills can be posted' }, { status: 400 });
    if (bill.posted_date) return Response.json({ error: 'Bill already posted' }, { status: 400 });

    // Find expense/purchase account based on category
    const expenseAccounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'expense' });
    let expenseAccount = expenseAccounts.find(a => a.code === bill.category) || expenseAccounts[0];
    if (!expenseAccount) {
      return Response.json({ error: 'Expense account not found in Chart of Accounts' }, { status: 400 });
    }

    // Find trade creditors account
    const accounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'liability' });
    let creditorsAccount = accounts.find(a => a.name?.toLowerCase().includes('trade creditor') || a.name?.toLowerCase().includes('payable'));
    if (!creditorsAccount) {
      return Response.json({ error: 'Trade Creditors account not found in Chart of Accounts' }, { status: 400 });
    }

    // Find VAT control account
    const vatAccounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'vat' });
    let vatAccount = vatAccounts.find(a => a.name?.toLowerCase().includes('control') || a.name?.toLowerCase().includes('vat'));
    if (!vatAccount) {
      return Response.json({ error: 'VAT Control account not found in Chart of Accounts' }, { status: 400 });
    }

    // Create journal entries
    const now = new Date().toISOString();
    const journals = [
      {
        company_id,
        date: bill.bill_date,
        reference: bill.bill_number,
        description: `Purchase Bill - ${bill.supplier_name}`,
        account_id: expenseAccount.id,
        account_code: expenseAccount.code,
        account_name: expenseAccount.name,
        debit: bill.subtotal || 0,
        credit: 0,
        source_type: 'purchase_bill',
        source_record_id: bill_id,
        source_reference: bill.bill_number,
        is_system_generated: true,
      },
      {
        company_id,
        date: bill.bill_date,
        reference: bill.bill_number,
        description: `VAT Control - ${bill.supplier_name}`,
        account_id: vatAccount.id,
        account_code: vatAccount.code,
        account_name: vatAccount.name,
        debit: bill.vat_total || 0,
        credit: 0,
        source_type: 'purchase_bill',
        source_record_id: bill_id,
        source_reference: bill.bill_number,
        is_system_generated: true,
      },
      {
        company_id,
        date: bill.bill_date,
        reference: bill.bill_number,
        description: `Trade Creditors - ${bill.supplier_name}`,
        account_id: creditorsAccount.id,
        account_code: creditorsAccount.code,
        account_name: creditorsAccount.name,
        debit: 0,
        credit: bill.total || 0,
        source_type: 'purchase_bill',
        source_record_id: bill_id,
        source_reference: bill.bill_number,
        is_system_generated: true,
      },
    ];

    // Create all journals
    for (const journal of journals) {
      await base44.entities.JournalEntry.create(journal);
    }

    // Update bill status to approved and set posted_date
    await base44.entities.PurchaseBill.update(bill_id, {
      status: 'approved',
      posted_date: now,
    });

    return Response.json({ success: true, message: 'Bill posted successfully' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});