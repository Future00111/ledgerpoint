import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoice_id, company_id } = await req.json();
    if (!invoice_id || !company_id) return Response.json({ error: 'Missing invoice_id or company_id' }, { status: 400 });

    const invoice = await base44.entities.SalesInvoice.get(invoice_id);
    if (!invoice || invoice.company_id !== company_id) return Response.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status !== 'draft') return Response.json({ error: 'Only draft invoices can be posted' }, { status: 400 });
    if (invoice.posted_date) return Response.json({ error: 'Invoice already posted' }, { status: 400 });

    // Find trade debtors account
    const accounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'asset' });
    let debtorsAccount = accounts.find(a => a.name?.toLowerCase().includes('trade debtor') || a.name?.toLowerCase().includes('receivable'));
    if (!debtorsAccount) {
      return Response.json({ error: 'Trade Debtors account not found in Chart of Accounts' }, { status: 400 });
    }

    // Find sales income account
    const incomeAccounts = await base44.entities.ChartOfAccount.filter({ company_id, type: 'income' });
    let salesAccount = incomeAccounts.find(a => a.name?.toLowerCase().includes('sales') || a.name?.toLowerCase().includes('income'));
    if (!salesAccount) {
      return Response.json({ error: 'Sales Income account not found in Chart of Accounts' }, { status: 400 });
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

    // Create all journals
    for (const journal of journals) {
      await base44.entities.JournalEntry.create(journal);
    }

    // Update invoice status to approved and set posted_date
    await base44.entities.SalesInvoice.update(invoice_id, {
      status: 'approved',
      posted_date: now,
    });

    return Response.json({ success: true, message: 'Invoice posted successfully' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});