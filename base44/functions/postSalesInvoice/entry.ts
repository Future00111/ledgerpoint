import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoice_id, company_id } = await req.json();
    if (!invoice_id || !company_id) return Response.json({ error: 'Missing invoice_id or company_id' }, { status: 400 });

    // Fetch and validate invoice
    const invoice = await base44.entities.SalesInvoice.get(invoice_id);
    if (!invoice || invoice.company_id !== company_id) return Response.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status !== 'draft') return Response.json({ error: 'Only draft invoices can be posted' }, { status: 400 });
    if (invoice.posted_date) return Response.json({ error: 'Invoice already posted' }, { status: 400 });

    // Validate invoice has required fields
    if (!invoice.issue_date) return Response.json({ error: 'Invoice date is required' }, { status: 400 });
    if (!invoice.customer_name) return Response.json({ error: 'Customer name is required' }, { status: 400 });
    if (!invoice.invoice_number) return Response.json({ error: 'Invoice number is required' }, { status: 400 });

    console.log(`[POST_INVOICE] Processing invoice ${invoice.invoice_number} (ID: ${invoice_id})`);
    console.log(`[POST_INVOICE] Customer: ${invoice.customer_name}, Subtotal: ${invoice.subtotal}, VAT: ${invoice.vat_total}, Total: ${invoice.total}`);

    // Find trade debtors account
    console.log(`[POST_INVOICE] Looking for Trade Debtors account (asset type)`);
    const assetAccounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'asset' });
    console.log(`[POST_INVOICE] Found ${assetAccounts.length} asset accounts: ${assetAccounts.map(a => `${a.code}-${a.name}`).join(', ')}`);
    
    let debtorsAccount = assetAccounts.find(a => a.name?.toLowerCase().includes('trade debtor') || a.name?.toLowerCase().includes('receivable'));
    if (!debtorsAccount) {
      console.log(`[POST_INVOICE] Warning: No 'Trade Debtor' or 'Receivable' account found. Available asset accounts: ${assetAccounts.map(a => a.name).join(', ')}`);
      return Response.json({ error: `Trade Debtors account not found. Available asset accounts: ${assetAccounts.map(a => a.name).join(', ')}` }, { status: 400 });
    }
    console.log(`[POST_INVOICE] Selected debtors account: ${debtorsAccount.code} - ${debtorsAccount.name}`);

    // Find sales income account
    console.log(`[POST_INVOICE] Looking for Sales account (income type)`);
    const incomeAccounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'income' });
    console.log(`[POST_INVOICE] Found ${incomeAccounts.length} income accounts: ${incomeAccounts.map(a => `${a.code}-${a.name}`).join(', ')}`);
    
    let salesAccount = incomeAccounts.find(a => a.name?.toLowerCase().includes('sales') || a.name?.toLowerCase().includes('income'));
    if (!salesAccount) {
      console.log(`[POST_INVOICE] Warning: No 'Sales' or 'Income' account found. Available income accounts: ${incomeAccounts.map(a => a.name).join(', ')}`);
      return Response.json({ error: `Sales Income account not found. Available income accounts: ${incomeAccounts.map(a => a.name).join(', ')}` }, { status: 400 });
    }
    console.log(`[POST_INVOICE] Selected sales account: ${salesAccount.code} - ${salesAccount.name}`);

    // Find VAT control account
    console.log(`[POST_INVOICE] Looking for VAT Control account (vat type)`);
    const vatAccounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'vat' });
    console.log(`[POST_INVOICE] Found ${vatAccounts.length} VAT accounts: ${vatAccounts.map(a => `${a.code}-${a.name}`).join(', ')}`);
    
    let vatAccount = vatAccounts.find(a => a.name?.toLowerCase().includes('control') || a.name?.toLowerCase().includes('vat'));
    if (!vatAccount) {
      console.log(`[POST_INVOICE] Warning: No 'Control' or 'VAT' account found. Available VAT accounts: ${vatAccounts.map(a => a.name).join(', ')}`);
      return Response.json({ error: `VAT Control account not found. Available VAT accounts: ${vatAccounts.map(a => a.name).join(', ')}` }, { status: 400 });
    }
    console.log(`[POST_INVOICE] Selected VAT account: ${vatAccount.code} - ${vatAccount.name}`);

    // Create journal entries
    const now = new Date().toISOString();
    const journals = [
      {
        company_id,
        date: invoice.issue_date,
        reference: invoice.invoice_number,
        description: `Sales Invoice - ${invoice.customer_name}`,
        account_id: debtorsAccount.id,
        account_code: debtorsAccount.code,
        account_name: debtorsAccount.name,
        debit: invoice.total || 0,
        credit: 0,
        source_type: 'sales_invoice',
        source_record_id: invoice_id,
        source_reference: invoice.invoice_number,
        is_system_generated: true,
      },
      {
        company_id,
        date: invoice.issue_date,
        reference: invoice.invoice_number,
        description: `Sales Income - ${invoice.customer_name}`,
        account_id: salesAccount.id,
        account_code: salesAccount.code,
        account_name: salesAccount.name,
        debit: 0,
        credit: invoice.subtotal || 0,
        source_type: 'sales_invoice',
        source_record_id: invoice_id,
        source_reference: invoice.invoice_number,
        is_system_generated: true,
      },
      {
        company_id,
        date: invoice.issue_date,
        reference: invoice.invoice_number,
        description: `VAT Control - ${invoice.customer_name}`,
        account_id: vatAccount.id,
        account_code: vatAccount.code,
        account_name: vatAccount.name,
        debit: 0,
        credit: invoice.vat_total || 0,
        source_type: 'sales_invoice',
        source_record_id: invoice_id,
        source_reference: invoice.invoice_number,
        is_system_generated: true,
      },
    ];

    console.log(`[POST_INVOICE] Creating ${journals.length} journal entries...`);
    // Create all journals
    for (let i = 0; i < journals.length; i++) {
      const journal = journals[i];
      console.log(`[POST_INVOICE] Journal ${i + 1}: ${journal.account_code} ${journal.account_name} - Debit: £${journal.debit}, Credit: £${journal.credit}`);
      try {
        await base44.entities.JournalEntry.create(journal);
      } catch (journalError) {
        console.error(`[POST_INVOICE] Error creating journal entry ${i + 1}:`, journalError.message);
        return Response.json({ error: `Failed to create journal entry: ${journalError.message}` }, { status: 400 });
      }
    }

    console.log(`[POST_INVOICE] Updating invoice status to approved and setting posted_date...`);
    // Update invoice status to approved and set posted_date
    await base44.entities.SalesInvoice.update(invoice_id, {
      status: 'approved',
      posted_date: now,
    });

    console.log(`[POST_INVOICE] Invoice ${invoice.invoice_number} posted successfully`);
    return Response.json({ success: true, message: 'Invoice posted successfully' });
  } catch (error) {
    console.error(`[POST_INVOICE] Unexpected error:`, error.message, error.stack);
    return Response.json({ error: `Posting failed: ${error.message}` }, { status: 500 });
  }
});