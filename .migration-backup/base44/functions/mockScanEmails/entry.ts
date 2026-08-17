import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id } = await req.json();
    if (!company_id) return Response.json({ error: 'company_id is required' }, { status: 400 });

    const accounts = await base44.entities.EmailAccount.filter({ company_id, status: 'connected' });
    if (accounts.length === 0) {
      return Response.json({ error: 'No connected email accounts. Please add an email account first.' }, { status: 400 });
    }

    // Get scan config
    const configs = await base44.entities.EmailScanConfig.filter({ company_id });
    const config = configs[0] || { scan_mode: 'all', only_with_attachments: true };

    const selectedSenders = (config.selected_senders || '').split(/[\n,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const ignoredSenders = (config.ignored_senders || '').split(/[\n,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const ignoreOlderThan = config.ignore_older_than ? new Date(config.ignore_older_than) : null;
    const onlyWithAttachments = config.only_with_attachments !== false;

    const mockEmails = generateMockEmails();

    const results = { accounts_scanned: accounts.length, emails_scanned: 0, documents_found: 0, emails_ignored: 0 };

    for (const account of accounts) {
      for (const email of mockEmails) {
        results.emails_scanned++;

        let captured = true;

        // Check scan mode - selected senders only
        if (config.scan_mode === 'selected_senders' && selectedSenders.length > 0) {
          if (!selectedSenders.some(s => email.sender.toLowerCase().includes(s))) {
            captured = false;
          }
        }

        // Check ignored senders
        if (captured && ignoredSenders.length > 0) {
          if (ignoredSenders.some(s => email.sender.toLowerCase().includes(s))) {
            captured = false;
          }
        }

        // Check attachments
        if (captured && onlyWithAttachments && !email.attachment) {
          captured = false;
        }

        // Check date
        if (captured && ignoreOlderThan && new Date(email.date) < ignoreOlderThan) {
          captured = false;
        }

        // Check if it's a business document (not a newsletter/marketing)
        if (captured && !email.isBusinessDoc) {
          captured = false;
        }

        if (captured) {
          results.documents_found++;
          const doc = await base44.entities.Document.create({
            company_id,
            name: email.attachment,
            document_type: email.docType,
            status: 'pending_extraction',
            upload_date: new Date().toISOString().split('T')[0],
            document_date: email.date,
            supplier_or_customer: email.senderName,
            reference_number: email.invoiceNum,
            net_amount: email.netAmount,
            vat_amount: email.vatAmount,
            gross_amount: email.grossAmount,
            notes: `Mock capture from ${account.email_address}`,
          });

          await base44.entities.EmailCaptureLog.create({
            company_id,
            email_sender: email.sender,
            email_subject: email.subject,
            attachment_name: email.attachment || '',
            date_found: new Date().toISOString(),
            status: 'captured',
            email_account_id: account.id,
            document_id: doc.id,
          });
        } else {
          results.emails_ignored++;
          await base44.entities.EmailCaptureLog.create({
            company_id,
            email_sender: email.sender,
            email_subject: email.subject,
            attachment_name: email.attachment || '',
            date_found: new Date().toISOString(),
            status: 'ignored',
            email_account_id: account.id,
          });
        }
      }

      await base44.entities.EmailAccount.update(account.id, { last_scan_date: new Date().toISOString().split('T')[0] });
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function generateMockEmails() {
  const data = [
    { sender: 'invoices@abcsupplies.co.uk', name: 'ABC Supplies Ltd', subject: 'Invoice #INV-12345 from ABC Supplies', attachment: 'Invoice-INV-12345.pdf', isBusiness: true, docType: 'purchase_invoice' },
    { sender: 'billing@toolmart.com', name: 'ToolMart UK', subject: 'Your purchase receipt from ToolMart', attachment: 'Receipt-2024-06-15.pdf', isBusiness: true, docType: 'receipt' },
    { sender: 'noreply@newsletter.com', name: 'Newsletter', subject: 'Weekly Newsletter - Special Offers', attachment: null, isBusiness: false, docType: null },
    { sender: 'marketing@retailstore.com', name: 'Retail Store', subject: 'Summer Sale - Up to 50% off!', attachment: null, isBusiness: false, docType: null },
    { sender: 'accounts@autoparts.co.uk', name: 'AutoParts Direct', subject: 'Invoice from AutoParts Direct', attachment: 'Invoice-AutoParts-001.pdf', isBusiness: true, docType: 'purchase_invoice' },
    { sender: 'receipts@amazon.co.uk', name: 'Amazon Business', subject: 'Your Amazon order receipt', attachment: 'amazon-receipt.pdf', isBusiness: true, docType: 'receipt' },
    { sender: 'statements@britishgas.co.uk', name: 'British Gas', subject: 'Monthly statement from British Gas', attachment: 'statement-jun-2024.pdf', isBusiness: true, docType: 'purchase_invoice' },
    { sender: 'updates@socialmedia.com', name: 'Social Media', subject: 'New product launch - Check it out!', attachment: null, isBusiness: false, docType: null },
    { sender: 'orders@rs-components.com', name: 'RS Components', subject: 'Invoice #INV-67890 from RS Components', attachment: 'invoice-rs-67890.pdf', isBusiness: true, docType: 'purchase_invoice' },
    { sender: 'finance@eurocarparts.com', name: 'Euro Car Parts', subject: 'Credit note for returned parts', attachment: 'credit-note-ECP.pdf', isBusiness: true, docType: 'credit_note' },
  ];

  return data.map(d => {
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const netAmount = d.isBusiness ? Math.round((Math.random() * 500 + 20) * 100) / 100 : 0;
    const vatAmount = d.isBusiness ? Math.round(netAmount * 0.2 * 100) / 100 : 0;
    const grossAmount = d.isBusiness ? Math.round((netAmount + vatAmount) * 100) / 100 : 0;
    const invoiceNum = d.isBusiness ? 'INV-' + Math.floor(Math.random() * 90000 + 10000) : '';

    return {
      sender: d.sender,
      senderName: d.name,
      subject: d.subject,
      attachment: d.attachment,
      date,
      isBusinessDoc: d.isBusiness,
      docType: d.docType,
      netAmount,
      vatAmount,
      grossAmount,
      invoiceNum,
    };
  });
}