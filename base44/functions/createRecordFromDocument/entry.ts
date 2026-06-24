import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { document_id, credit_note_type } = await req.json();
    if (!document_id) return Response.json({ error: 'document_id is required' }, { status: 400 });

    const doc = await base44.entities.Document.get(document_id);
    if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 });
    if (doc.status !== 'approved') return Response.json({ error: 'Document must be approved before creating an accounting record' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    const docDate = doc.document_date || today;
    const due = new Date(docDate);
    due.setDate(due.getDate() + 30);
    const dueDateStr = due.toISOString().split('T')[0];

    let record, record_type, record_path;

    if (doc.document_type === 'purchase_invoice') {
      let suppliers = await base44.entities.Supplier.filter({ company_id: doc.company_id, name: doc.supplier_or_customer });
      let supplier_id;
      if (suppliers.length > 0) {
        supplier_id = suppliers[0].id;
      } else if (doc.supplier_or_customer) {
        const s = await base44.entities.Supplier.create({ company_id: doc.company_id, name: doc.supplier_or_customer });
        supplier_id = s.id;
      } else {
        return Response.json({ error: 'Supplier name is required to create a purchase bill' }, { status: 400 });
      }
      record = await base44.entities.PurchaseBill.create({
        company_id: doc.company_id, supplier_id, supplier_name: doc.supplier_or_customer,
        bill_number: doc.reference_number || 'PB-' + Date.now(),
        bill_date: docDate, due_date: dueDateStr, status: 'awaiting_review',
        subtotal: doc.net_amount || 0, vat_total: doc.vat_amount || 0,
        total: doc.gross_amount || 0, balance_due: doc.gross_amount || 0,
        notes: 'Created from document: ' + doc.name,
      });
      record_type = 'Purchase Bill';
      record_path = '/bills/' + record.id;

    } else if (doc.document_type === 'sales_invoice') {
      let customers = await base44.entities.Customer.filter({ company_id: doc.company_id, name: doc.supplier_or_customer });
      let customer_id;
      if (customers.length > 0) {
        customer_id = customers[0].id;
      } else if (doc.supplier_or_customer) {
        const c = await base44.entities.Customer.create({ company_id: doc.company_id, name: doc.supplier_or_customer });
        customer_id = c.id;
      } else {
        return Response.json({ error: 'Customer name is required to create a sales invoice' }, { status: 400 });
      }
      record = await base44.entities.SalesInvoice.create({
        company_id: doc.company_id, customer_id, customer_name: doc.supplier_or_customer,
        invoice_number: doc.reference_number || 'INV-' + Date.now(),
        issue_date: docDate, due_date: dueDateStr, status: 'draft',
        subtotal: doc.net_amount || 0, vat_total: doc.vat_amount || 0,
        total: doc.gross_amount || 0, balance_due: doc.gross_amount || 0,
        notes: 'Created from document: ' + doc.name,
      });
      record_type = 'Sales Invoice';
      record_path = '/invoices/' + record.id;

    } else if (doc.document_type === 'credit_note') {
      if (!credit_note_type) return Response.json({ error: 'Credit note type (sales or supplier) is required' }, { status: 400 });

      if (credit_note_type === 'sales') {
        let customers = await base44.entities.Customer.filter({ company_id: doc.company_id, name: doc.supplier_or_customer });
        let customer_id;
        if (customers.length > 0) {
          customer_id = customers[0].id;
        } else if (doc.supplier_or_customer) {
          const c = await base44.entities.Customer.create({ company_id: doc.company_id, name: doc.supplier_or_customer });
          customer_id = c.id;
        } else {
          return Response.json({ error: 'Customer name is required' }, { status: 400 });
        }
        record = await base44.entities.SalesCreditNote.create({
          company_id: doc.company_id, customer_id, customer_name: doc.supplier_or_customer,
          credit_note_number: doc.reference_number || 'CN-' + Date.now(),
          credit_note_date: docDate, status: 'draft',
          subtotal: doc.net_amount || 0, vat_total: doc.vat_amount || 0, total: doc.gross_amount || 0,
          notes: 'Created from document: ' + doc.name,
        });
        record_type = 'Sales Credit Note';
        record_path = '/sales-credit-notes/' + record.id;

      } else if (credit_note_type === 'supplier') {
        let suppliers = await base44.entities.Supplier.filter({ company_id: doc.company_id, name: doc.supplier_or_customer });
        let supplier_id;
        if (suppliers.length > 0) {
          supplier_id = suppliers[0].id;
        } else if (doc.supplier_or_customer) {
          const s = await base44.entities.Supplier.create({ company_id: doc.company_id, name: doc.supplier_or_customer });
          supplier_id = s.id;
        } else {
          return Response.json({ error: 'Supplier name is required' }, { status: 400 });
        }
        record = await base44.entities.SupplierCreditNote.create({
          company_id: doc.company_id, supplier_id, supplier_name: doc.supplier_or_customer,
          credit_note_number: doc.reference_number || 'SCN-' + Date.now(),
          credit_note_date: docDate, status: 'draft',
          subtotal: doc.net_amount || 0, vat_total: doc.vat_amount || 0, total: doc.gross_amount || 0,
          notes: 'Created from document: ' + doc.name,
        });
        record_type = 'Supplier Credit Note';
        record_path = '/supplier-credit-notes/' + record.id;
      } else {
        return Response.json({ error: 'Invalid credit note type' }, { status: 400 });
      }
    } else {
      return Response.json({ error: 'This document type does not support accounting record creation' }, { status: 400 });
    }

    return Response.json({ record, record_type, record_path });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});