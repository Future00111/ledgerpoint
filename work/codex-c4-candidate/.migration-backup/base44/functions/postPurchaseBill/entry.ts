import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bill_id, company_id } = await req.json();
    if (!bill_id || !company_id) return Response.json({ error: 'Missing bill_id or company_id' }, { status: 400 });

    // Fetch and validate bill
    const bill = await base44.entities.PurchaseBill.get(bill_id);
    if (!bill || bill.company_id !== company_id) return Response.json({ error: 'Bill not found' }, { status: 404 });
    if (bill.status !== 'draft' && bill.status !== 'awaiting_review') return Response.json({ error: 'Only draft or awaiting review bills can be posted' }, { status: 400 });
    if (bill.posted_date) return Response.json({ error: 'Bill already posted' }, { status: 400 });

    // Validate bill has required fields
    if (!bill.bill_date) return Response.json({ error: 'Bill date is required' }, { status: 400 });
    if (!bill.supplier_name) return Response.json({ error: 'Supplier name is required' }, { status: 400 });
    if (!bill.bill_number) return Response.json({ error: 'Bill number is required' }, { status: 400 });

    console.log(`[POST_BILL] Processing bill ${bill.bill_number} (ID: ${bill_id})`);
    console.log(`[POST_BILL] Category: ${bill.category}, Subtotal: ${bill.subtotal}, VAT: ${bill.vat_total}, Total: ${bill.total}`);

    // Fetch all accounts for company
    const allAccounts = await base44.entities.ChartOfAccount.filter({ company_id });
    const accountMap = {};
    allAccounts.forEach(a => { accountMap[a.code] = a; });

    // Verify required accounts
    const requiredCodes = ['5000', '2100', '2200'];
    const missingCodes = requiredCodes.filter(code => !accountMap[code]);
    
    if (missingCodes.length > 0) {
      return Response.json({ error: `Missing required account codes: ${missingCodes.join(', ')}. Please ensure default accounts are created.` }, { status: 400 });
    }

    const purchasesAccount = accountMap['5000'];
    const creditorsAccount = accountMap['2100'];
    const vatAccount = accountMap['2200'];

    console.log(`[POST_BILL] Found accounts: 5000=${purchasesAccount.name}, 2100=${creditorsAccount.name}, 2200=${vatAccount.name}`);

    // Create journal entries
    const now = new Date().toISOString();
    const journals = [
      {
        company_id,
        date: bill.bill_date,
        reference: bill.bill_number,
        description: `Purchases - ${bill.supplier_name}`,
        account_id: purchasesAccount.id,
        account_code: purchasesAccount.code,
        account_name: purchasesAccount.name,
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

    console.log(`[POST_BILL] Creating ${journals.length} journal entries...`);
    // Create all journals
    for (let i = 0; i < journals.length; i++) {
      const journal = journals[i];
      console.log(`[POST_BILL] Journal ${i + 1}: ${journal.account_code} ${journal.account_name} - Debit: £${journal.debit}, Credit: £${journal.credit}`);
      try {
        await base44.entities.JournalEntry.create(journal);
      } catch (journalError) {
        console.error(`[POST_BILL] Error creating journal entry ${i + 1}:`, journalError.message);
        return Response.json({ error: `Failed to create journal entry: ${journalError.message}` }, { status: 400 });
      }
    }

    console.log(`[POST_BILL] Updating bill status to approved and setting posted_date...`);
    // Update bill status to approved and set posted_date
    await base44.entities.PurchaseBill.update(bill_id, {
      status: 'approved',
      posted_date: now,
    });

    console.log(`[POST_BILL] Bill ${bill.bill_number} posted successfully`);
    return Response.json({ success: true, message: 'Bill posted successfully' });
  } catch (error) {
    console.error(`[POST_BILL] Unexpected error:`, error.message, error.stack);
    return Response.json({ error: `Posting failed: ${error.message}` }, { status: 500 });
  }
});