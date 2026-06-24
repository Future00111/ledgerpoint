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

    const rules = await base44.entities.EmailRule.filter({ company_id, is_active: true });

    const results = { accounts_scanned: 0, emails_scanned: 0, documents_found: 0, emails_ignored: 0, documents: [] };

    const suppliers = [
      'ABC Supplies Ltd', 'ToolMart UK', 'AutoParts Direct', 'Office Depot',
      'British Gas', 'FedEx UK', 'Amazon Business', 'RS Components',
      'Euro Car Parts', 'GSF Car Parts', 'Halfords Trade', 'ToolStation'
    ];
    const docTypes = ['purchase_invoice', 'receipt', 'credit_note'];
    const ruleDocTypes = rules.filter(r => r.document_type && r.document_type !== 'auto').map(r => r.document_type);

    for (const account of accounts) {
      const emailsScanned = Math.floor(Math.random() * 25) + 15;
      const matchRate = rules.length > 0 ? 0.25 + Math.random() * 0.25 : 0.1 + Math.random() * 0.15;
      const documentsFound = Math.floor(emailsScanned * matchRate);
      const emailsIgnored = emailsScanned - documentsFound;

      results.accounts_scanned++;
      results.emails_scanned += emailsScanned;
      results.documents_found += documentsFound;
      results.emails_ignored += emailsIgnored;

      for (let i = 0; i < documentsFound; i++) {
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
        const docType = ruleDocTypes.length > 0
          ? ruleDocTypes[Math.floor(Math.random() * ruleDocTypes.length)]
          : docTypes[Math.floor(Math.random() * docTypes.length)];
        const netAmount = Math.round((Math.random() * 500 + 20) * 100) / 100;
        const vatAmount = Math.round(netAmount * 0.2 * 100) / 100;
        const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;
        const invoiceNum = 'INV-' + Math.floor(Math.random() * 90000 + 10000);
        const daysAgo = Math.floor(Math.random() * 30);
        const docDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const typeLabel = docType === 'credit_note' ? 'Credit Note' : docType === 'receipt' ? 'Receipt' : 'Invoice';

        const doc = await base44.entities.Document.create({
          company_id,
          name: `${typeLabel} from ${supplier}.pdf`,
          document_type: docType,
          status: 'pending_extraction',
          upload_date: new Date().toISOString().split('T')[0],
          document_date: docDate,
          supplier_or_customer: supplier,
          reference_number: invoiceNum,
          net_amount: netAmount,
          vat_amount: vatAmount,
          gross_amount: grossAmount,
          notes: `Mock capture from ${account.email_address}`,
        });

        results.documents.push({ id: doc.id, name: doc.name, type: docType, supplier, amount: grossAmount });
      }

      await base44.entities.EmailCaptureLog.create({
        company_id,
        email_account_id: account.id,
        email_address: account.email_address,
        scan_date: new Date().toISOString(),
        emails_scanned: emailsScanned,
        documents_found: documentsFound,
        emails_ignored: emailsIgnored,
        status: 'completed',
        details: `Scanned ${emailsScanned} emails, found ${documentsFound} documents, ignored ${emailsIgnored} emails.`,
      });

      await base44.entities.EmailAccount.update(account.id, { last_scan_date: new Date().toISOString().split('T')[0] });
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});