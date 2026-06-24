import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { document_id, credit_note_type, supplier_id, new_supplier_name } = await req.json();
    if (!document_id) return Response.json({ error: 'document_id is required' }, { status: 400 });

    const doc = await base44.entities.Document.get(document_id);
    if (!doc) return Response.json({ error: 'Document not found' }, { status: 404 });
    if (!['approved', 'pending_review'].includes(doc.status)) {
      return Response.json({ error: 'Document must be pending review or approved before creating an accounting record' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const docDate = doc.document_date || today;
    const due = new Date(docDate);
    due.setDate(due.getDate() + 30);
    const dueDateStr = due.toISOString().split('T')[0];

    let record, record_type, record_path;

    if (doc.document_type === 'purchase_invoice' || doc.document_type === 'receipt') {
      let final_supplier_id;
      let final_supplier_name;

      if (supplier_id) {
        const supplier = await base44.entities.Supplier.get(supplier_id);
        final_supplier_id = supplier.id;
        final_supplier_name = supplier.name;
      } else if (new_supplier_name) {
        const s = await base44.entities.Supplier.create({ company_id: doc.company_id, name: new_supplier_name });
        final_supplier_id = s.id;
        final_supplier_name = s.name;
      } else {
        let suppliers = await base44.entities.Supplier.filter({ company_id: doc.company_id, name: doc.supplier_or_customer });
        if (suppliers.length > 0) {
          final_supplier_id = suppliers[0].id;
          final_supplier_name = suppliers[0].name;
        } else if (doc.supplier_or_customer) {
          const s = await base44.entities.Supplier.create({ company_id: doc.company_id, name: doc.supplier_or_customer });
          final_supplier_id = s.id;
          final_supplier_name = s.name;
        } else {
          return Response.json({ error: 'Supplier is required to create a purchase bill' }, { status: 400 });
        }
      }

      record = await base44.entities.PurchaseBill.create({
        company_id: doc.company_id,
        supplier_id: final_supplier_id,
        supplier_name: final_supplier_name,
        bill_number: doc.reference_number || 'PB-' + Date.now(),
        bill_date: docDate,
        due_date: dueDateStr,
        status: 'awaiting_review',
        subtotal: doc.net_amount || 0,
        vat_total: doc.vat_amount || 0,
        total: doc.gross_amount || 0,
        balance_due: doc.gross_amount || 0,
        document_id: doc.id,
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
        let supplier_id_resolved;
        if (suppliers.length > 0) {
          supplier_id_resolved = suppliers[0].id;
        } else if (doc.supplier_or_customer) {
          const s = await base44.entities.Supplier.create({ company_id: doc.company_id, name: doc.supplier_or_customer });
          supplier_id_resolved = s.id;
        } else {
          return Response.json({ error: 'Supplier name is required' }, { status: 400 });
        }
        record = await base44.entities.SupplierCreditNote.create({
          company_id: doc.company_id, supplier_id: supplier_id_resolved, supplier_name: doc.supplier_or_customer,
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

    // Change document status to Approved
    await base44.entities.Document.update(document_id, { status: 'approved' });

    return Response.json({ record, record_type, record_path });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});