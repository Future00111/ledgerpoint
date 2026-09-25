import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id, bank_transaction_id } = await req.json();

    let txns = [];
    if (bank_transaction_id) {
      const txn = await base44.entities.BankTransaction.get(bank_transaction_id);
      if (!txn) return Response.json({ error: 'Transaction not found' }, { status: 404 });
      txns = [txn];
    } else if (company_id) {
      txns = await base44.entities.BankTransaction.filter({ company_id, status: 'review' });
    } else {
      return Response.json({ error: 'company_id or bank_transaction_id is required' }, { status: 400 });
    }

    if (txns.length === 0) return Response.json({ suggestions: {} });

    const companyId = txns[0].company_id;
    const [invoices, bills, salesCNs, supplierCNs] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: companyId }),
      base44.entities.PurchaseBill.filter({ company_id: companyId }),
      base44.entities.SalesCreditNote.filter({ company_id: companyId }),
      base44.entities.SupplierCreditNote.filter({ company_id: companyId }),
    ]);

    const DAY_MS = 24 * 60 * 60 * 1000;
    const allSuggestions = {};

    for (const txn of txns) {
      const txnAmount = txn.money_in || txn.money_out || 0;
      const txnDate = new Date(txn.date);
      const txnDesc = (txn.description || '').toLowerCase();
      const suggestions = [];

      const scoreMatch = (record, recordType, recordNumber, recordDate, recordAmount, recordName) => {
        const reasons = [];
        let confidence = 0;

        // 1. Exact amount match
        if (Math.abs(txnAmount - recordAmount) < 0.01) {
          reasons.push('Exact amount match');
          confidence += 40;
        }

        // 2. Name in description
        if (recordName && recordName.length > 2 && txnDesc.includes(recordName.toLowerCase())) {
          reasons.push('Name found in description');
          confidence += 25;
        }

        // 3. Number in description
        if (recordNumber && txnDesc.includes(recordNumber.toLowerCase())) {
          reasons.push('Reference number found in description');
          confidence += 25;
        }

        // 4. Date within 14 days
        if (recordDate) {
          const rDate = new Date(recordDate);
          const dayDiff = Math.abs(txnDate - rDate) / DAY_MS;
          if (dayDiff <= 14) {
            reasons.push(`Date within ${Math.round(dayDiff)} days`);
            confidence += 10;
          }
        }

        if (reasons.length > 0) {
          suggestions.push({
            record_type: recordType,
            record_id: record.id,
            record_number: recordNumber,
            record_name: recordName,
            record_amount: recordAmount,
            record_date: recordDate,
            confidence: Math.min(confidence, 100),
            reasons,
          });
        }
      };

      // Sales Invoices (money in)
      if (txn.money_in > 0) {
        for (const inv of invoices) {
          if (inv.status === 'cancelled' || inv.status === 'paid') continue;
          scoreMatch(inv, 'sales_invoice', inv.invoice_number, inv.issue_date, inv.balance_due || inv.total, inv.customer_name);
        }
      }

      // Purchase Bills (money out)
      if (txn.money_out > 0) {
        for (const bill of bills) {
          if (bill.status === 'cancelled' || bill.status === 'paid') continue;
          scoreMatch(bill, 'purchase_bill', bill.bill_number, bill.bill_date, bill.balance_due || bill.total, bill.supplier_name);
        }
      }

      // Sales Credit Notes (money out - refunds to customers)
      if (txn.money_out > 0) {
        for (const cn of salesCNs) {
          if (cn.status === 'cancelled' || cn.status === 'applied') continue;
          scoreMatch(cn, 'sales_credit_note', cn.credit_note_number, cn.credit_note_date, cn.total, cn.customer_name);
        }
      }

      // Supplier Credit Notes (money in - refunds from suppliers)
      if (txn.money_in > 0) {
        for (const cn of supplierCNs) {
          if (cn.status === 'cancelled' || cn.status === 'applied') continue;
          scoreMatch(cn, 'supplier_credit_note', cn.credit_note_number, cn.credit_note_date, cn.total, cn.supplier_name);
        }
      }

      suggestions.sort((a, b) => b.confidence - a.confidence);
      if (suggestions.length > 0) {
        allSuggestions[txn.id] = suggestions;
      }
    }

    return Response.json({ suggestions: allSuggestions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});