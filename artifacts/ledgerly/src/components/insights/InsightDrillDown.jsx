import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import moment from 'moment';

function formatCurrency(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);
}

function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

function Table({ columns, rows }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">No records found.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {columns.map(c => <th key={c.key} className="py-2 px-2 font-medium">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className="border-b border-border/60 hover:bg-muted/40">
              {columns.map(c => (
                <td key={c.key} className="py-2 px-2">{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InsightDrillDown({ insight, companyId, open, onClose }) {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!insight || !companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await loadData(insight, companyId);
        if (!cancelled) {
          setRows(data.rows);
          setColumns(data.columns);
          setTitle(data.title);
        }
      } catch (e) {
        if (!cancelled) { setRows([]); setColumns([]); setTitle('Error loading data: ' + e.message); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [insight?.id, companyId]);

  async function loadData(insight, companyId) {
    const sourceType = insight.source_type;
    const ids = insight.source_ids || [];

    if (sourceType === 'overdue_invoices') {
      const inv = await base44.entities.SalesInvoice.filter({ company_id: companyId });
      const today = new Date(); today.setHours(0,0,0,0);
      const filtered = inv.filter(i => i.due_date && new Date(i.due_date) < today && i.status !== 'paid' && !['cancelled','draft'].includes(i.status) && (ids.length === 0 || ids.includes(i.id)));
      return {
        title: 'Overdue invoices',
        rows: filtered,
        columns: [
          { key: 'invoice_number', label: 'Invoice', render: i => <span className="font-medium">{i.invoice_number}</span> },
          { key: 'customer_name', label: 'Customer', render: i => i.customer_name || '—' },
          { key: 'issue_date', label: 'Issued', render: i => moment(i.issue_date).format('DD/MM/YYYY') },
          { key: 'due_date', label: 'Due', render: i => moment(i.due_date).format('DD/MM/YYYY') },
          { key: 'balance_due', label: 'Balance', render: i => <span className="font-semibold">{formatCurrency(i.balance_due || i.total)}</span> },
        ],
      };
    }

    if (sourceType === 'bills_due_this_week') {
      const bil = await base44.entities.PurchaseBill.filter({ company_id: companyId });
      const today = new Date(); today.setHours(0,0,0,0);
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
      const filtered = bil.filter(b => b.due_date && !['paid','cancelled'].includes(b.status) && new Date(b.due_date) >= today && new Date(b.due_date) <= weekEnd && (ids.length === 0 || ids.includes(b.id)));
      return {
        title: 'Bills due this week',
        rows: filtered,
        columns: [
          { key: 'bill_number', label: 'Bill', render: b => <span className="font-medium">{b.bill_number}</span> },
          { key: 'supplier_name', label: 'Supplier', render: b => b.supplier_name || '—' },
          { key: 'bill_date', label: 'Dated', render: b => moment(b.bill_date).format('DD/MM/YYYY') },
          { key: 'due_date', label: 'Due', render: b => moment(b.due_date).format('DD/MM/YYYY') },
          { key: 'total', label: 'Amount', render: b => <span className="font-semibold">{formatCurrency(b.balance_due || b.total)}</span> },
        ],
      };
    }

    if (sourceType === 'revenue_comparison') {
      const inv = await base44.entities.SalesInvoice.filter({ company_id: companyId });
      const valid = inv.filter(i => !['cancelled','draft'].includes(i.status));
      const thisStart = startOfMonth(new Date());
      const nextStart = addMonths(thisStart, 1);
      const lastStart = addMonths(thisStart, -1);
      const filtered = valid.filter(i => {
        const d = new Date(i.issue_date);
        return (d >= lastStart && d < nextStart);
      });
      return {
        title: 'Invoices — last month vs this month',
        rows: filtered,
        columns: [
          { key: 'invoice_number', label: 'Invoice', render: i => <span className="font-medium">{i.invoice_number}</span> },
          { key: 'customer_name', label: 'Customer', render: i => i.customer_name || '—' },
          { key: 'issue_date', label: 'Date', render: i => moment(i.issue_date).format('DD/MM/YYYY') },
          { key: 'period', label: 'Period', render: i => { const d = new Date(i.issue_date); return d >= thisStart ? 'This month' : 'Last month'; } },
          { key: 'subtotal', label: 'Net', render: i => <span className="font-semibold">{formatCurrency(i.subtotal)}</span> },
        ],
      };
    }

    if (sourceType === 'cost_increase') {
      const cat = ids[0];
      const bil = await base44.entities.PurchaseBill.filter({ company_id: companyId });
      const valid = bil.filter(b => b.status !== 'cancelled' && (b.category || 'other') === cat);
      const thisStart = startOfMonth(new Date());
      const lastStart = addMonths(thisStart, -1);
      const nextStart = addMonths(thisStart, 1);
      const filtered = valid.filter(b => {
        const d = new Date(b.bill_date);
        return d >= lastStart && d < nextStart;
      });
      return {
        title: `${cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Costs'} — this month vs last month`,
        rows: filtered,
        columns: [
          { key: 'bill_number', label: 'Bill', render: b => <span className="font-medium">{b.bill_number}</span> },
          { key: 'supplier_name', label: 'Supplier', render: b => b.supplier_name || '—' },
          { key: 'bill_date', label: 'Date', render: b => moment(b.bill_date).format('DD/MM/YYYY') },
          { key: 'period', label: 'Period', render: b => { const d = new Date(b.bill_date); return d >= thisStart ? 'This month' : 'Last month'; } },
          { key: 'subtotal', label: 'Net', render: b => <span className="font-semibold">{formatCurrency(b.subtotal)}</span> },
        ],
      };
    }

    if (sourceType === 'vat_due') {
      const vat = await base44.entities.VATReturn.filter({ company_id: companyId }, '-period_end');
      return {
        title: 'VAT returns',
        rows: vat,
        columns: [
          { key: 'period_start', label: 'Period', render: v => `${moment(v.period_start).format('DD/MM/YY')} – ${moment(v.period_end).format('DD/MM/YY')}` },
          { key: 'status', label: 'Status', render: v => v.status },
          { key: 'box5_net_vat', label: 'Net VAT', render: v => <span className="font-semibold">{formatCurrency(v.box5_net_vat)}</span> },
          { key: 'submission_date', label: 'Submitted', render: v => v.submission_date ? moment(v.submission_date).format('DD/MM/YYYY') : '—' },
        ],
      };
    }

    if (sourceType === 'duplicate_bills') {
      const bil = await base44.entities.PurchaseBill.filter({ company_id: companyId });
      const filtered = bil.filter(b => ids.includes(b.id));
      return {
        title: 'Possible duplicate supplier invoices',
        rows: filtered,
        columns: [
          { key: 'bill_number', label: 'Bill', render: b => <span className="font-medium">{b.bill_number}</span> },
          { key: 'supplier_name', label: 'Supplier', render: b => b.supplier_name || '—' },
          { key: 'bill_date', label: 'Date', render: b => moment(b.bill_date).format('DD/MM/YYYY') },
          { key: 'total', label: 'Total', render: b => <span className="font-semibold">{formatCurrency(b.total)}</span> },
        ],
      };
    }

    if (sourceType === 'reconciliation') {
      const txn = await base44.entities.BankTransaction.filter({ company_id: companyId });
      const filtered = txn.filter(t => t.status !== 'matched');
      return {
        title: 'Bank transactions needing review',
        rows: filtered,
        columns: [
          { key: 'date', label: 'Date', render: t => moment(t.date).format('DD/MM/YYYY') },
          { key: 'description', label: 'Description', render: t => t.description },
          { key: 'bank_account_name', label: 'Account', render: t => t.bank_account_name || '—' },
          { key: 'amount', label: 'Amount', render: t => <span className="font-semibold">{formatCurrency(t.amount)}</span> },
          { key: 'status', label: 'Status', render: t => t.status },
        ],
      };
    }

    return { title: 'Underlying data', rows: [], columns: [] };
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title || insight?.title}</DialogTitle>
          <DialogDescription>{insight?.description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <Table columns={columns} rows={rows} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}