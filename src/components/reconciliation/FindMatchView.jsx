import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft } from 'lucide-react';
import { gbp, fmtDate } from '@/lib/format';

// Inline Find & Match search over invoices, bills and credit notes.
export default function FindMatchView({ transaction, onSelect, onBack }) {
  const [q, setQ] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [inv, bills, scn, supcn] = await Promise.all([
          base44.entities.SalesInvoice.filter({ company_id: transaction.company_id }, '-issue_date', 200),
          base44.entities.PurchaseBill.filter({ company_id: transaction.company_id }, '-bill_date', 200),
          base44.entities.SalesCreditNote.filter({ company_id: transaction.company_id }, '-credit_note_date', 100),
          base44.entities.SupplierCreditNote.filter({ company_id: transaction.company_id }, '-credit_note_date', 100),
        ]);
        const map = [
          ...inv.filter((i) => (i.balance_due ?? i.total) > 0 && i.status !== 'cancelled' && i.status !== 'draft').map((i) => ({ record_type: 'sales_invoice', record_id: i.id, record_number: i.invoice_number, record_name: i.customer_name, record_amount: i.total, date: i.issue_date, outstanding: i.balance_due })),
          ...bills.filter((b) => (b.balance_due ?? b.total) > 0 && b.status !== 'cancelled' && b.status !== 'draft').map((b) => ({ record_type: 'purchase_bill', record_id: b.id, record_number: b.bill_number, record_name: b.supplier_name, record_amount: b.total, date: b.bill_date, outstanding: b.balance_due })),
          ...scn.filter((c) => c.status !== 'cancelled').map((c) => ({ record_type: 'sales_credit_note', record_id: c.id, record_number: c.credit_note_number, record_name: c.customer_name, record_amount: c.total, date: c.credit_note_date, outstanding: c.total })),
          ...supcn.filter((c) => c.status !== 'cancelled').map((c) => ({ record_type: 'supplier_credit_note', record_id: c.id, record_number: c.credit_note_number, record_name: c.supplier_name, record_amount: c.total, date: c.credit_note_date, outstanding: c.total })),
        ];
        setRecords(map);
      } finally { setLoading(false); }
    };
    load();
  }, [transaction.company_id]);

  const filtered = q.trim()
    ? records.filter((r) =>
      (r.record_number || '').toLowerCase().includes(q.toLowerCase()) ||
      (r.record_name || '').toLowerCase().includes(q.toLowerCase()))
    : records;

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number or name…" className="pl-8 h-9 text-sm" autoFocus />
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Searching…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records found.</p>
      ) : (
        <div className="divide-y divide-border/40 -mx-1">
          {filtered.slice(0, 50).map((r) => (
            <button
              key={r.record_type + r.record_id}
              type="button"
              onClick={() => onSelect(r)}
              className="flex items-center justify-between w-full py-2.5 px-1 text-left hover:bg-muted/40 rounded-sm"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.record_number}</p>
                <p className="text-xs text-muted-foreground truncate">{r.record_name} · {fmtDate(r.date)}</p>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                <p className="text-sm font-medium tabular-nums">{gbp(r.record_amount)}</p>
                {r.outstanding !== undefined && r.outstanding !== r.record_amount && (
                  <p className="text-xs text-muted-foreground tabular-nums">{gbp(r.outstanding)} due</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}