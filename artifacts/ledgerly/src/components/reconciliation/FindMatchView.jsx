import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { gbp, fmtDate } from '@/lib/format';

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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Search by number, reference or name…" 
            className="pl-9 h-11 text-sm bg-white border-slate-200 shadow-sm focus-visible:ring-[#007bff]" 
            autoFocus 
          />
        </div>
      </div>
      
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-3 text-[#007bff]" />
            <p className="text-sm font-medium">Searching potential matches…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-50/50">
            <FileText className="w-8 h-8 text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-700">No records found</p>
            <p className="text-xs font-medium mt-1">Try adjusting your search terms</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto no-scrollbar">
            {filtered.slice(0, 50).map((r) => (
              <button
                key={r.record_type + r.record_id}
                type="button"
                onClick={() => onSelect(r)}
                className="flex items-center justify-between w-full p-4 text-left hover:bg-blue-50/60 group transition-colors"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500 uppercase tracking-widest group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                      {r.record_type.split('_').pop()}
                    </span>
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-[#007bff] transition-colors">{r.record_number}</p>
                  </div>
                  <p className="text-xs font-medium text-slate-500 truncate">{r.record_name} · {fmtDate(r.date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-slate-900 tabular-nums">{gbp(r.record_amount)}</p>
                  {r.outstanding !== undefined && r.outstanding !== r.record_amount && (
                    <p className="text-[11px] font-bold text-orange-600 tabular-nums uppercase tracking-wider mt-0.5">{gbp(r.outstanding)} due</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
