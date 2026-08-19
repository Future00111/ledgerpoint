import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, Receipt, X } from 'lucide-react';
import moment from 'moment';
import BillView from '@/components/bills/BillView';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const PAGE_SIZE = 25;

const STATUS_LABEL = {
  draft: 'Draft',
  awaiting_review: 'Awaiting review',
  approved: 'Approved',
  part_paid: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

const DATE_RANGES = [
  { value: 'all', label: 'All dates' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last 12 months' },
];

export default function Bills() {
  const { activeCompany } = useCompany();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  // Table state
  const [sortField, setSortField] = useState('bill_date');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);

  // Detail modal
  const [viewing, setViewing] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { toast } = useToast();
  const today = moment().format('YYYY-MM-DD');

  useEffect(() => {
    if (activeCompany) loadBills();
  }, [activeCompany]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }, '-bill_date');
      setBills(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const isOverdue = (bill) =>
    ['awaiting_review', 'approved', 'part_paid'].includes(bill.status) && bill.due_date < today;

  const updateStatus = async (bill, status) => {
    try {
      const updateData = { status };
      if (status === 'paid') {
        updateData.amount_paid = bill.total;
        updateData.balance_due = 0;
      }
      await base44.entities.PurchaseBill.update(bill.id, updateData);
      toast({ title: `Bill marked as ${STATUS_LABEL[status] || status}` });
      await loadBills();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (bill) => {
    if (!confirm(`Delete bill ${bill.bill_number}?`)) return;
    try {
      await base44.entities.PurchaseBill.delete(bill.id);
      toast({ title: 'Bill deleted' });
      await loadBills();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const openView = (bill) => { setViewing(bill); setDetailsOpen(true); };

  // ── Summary metrics ────────────────────────────────────────────────────
  const unpaidBills = useMemo(() => bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled'), [bills]);
  const overdueBills = useMemo(() => bills.filter(isOverdue), [bills, today]);
  const notDueBills = useMemo(() => unpaidBills.filter(b => !isOverdue(b)), [unpaidBills]);
  const paidBills = useMemo(() => bills.filter(b => b.status === 'paid'), [bills]);

  const unpaidTotal = unpaidBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const overdueTotal = overdueBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const notDueTotal = notDueBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const paidTotal = paidBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const overdueBarPct = unpaidTotal > 0 ? Math.round((overdueTotal / unpaidTotal) * 100) : 0;

  // ── Unique suppliers for filter dropdown ──────────────────────────────
  const suppliers = useMemo(() => {
    const names = [...new Set(bills.map(b => b.supplier_name).filter(Boolean))].sort();
    return names;
  }, [bills]);

  // ── Date cutoff ───────────────────────────────────────────────────────
  const dateCutoff = useMemo(() => {
    if (dateRange === 'all') return null;
    return moment().subtract(Number(dateRange), 'days').format('YYYY-MM-DD');
  }, [dateRange]);

  // ── Sort + filter ─────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const list = [...bills];
    list.sort((a, b) => {
      let av = a[sortField] ?? '';
      let bv = b[sortField] ?? '';
      if (sortField === 'total' || sortField === 'balance_due') { av = Number(av); bv = Number(bv); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [bills, sortField, sortDir]);

  const filtered = useMemo(() => sorted.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || b.bill_number?.toLowerCase().includes(q)
      || b.supplier_name?.toLowerCase().includes(q);
    let matchStatus = statusFilter === 'all' || b.status === statusFilter;
    if (statusFilter === 'overdue') matchStatus = isOverdue(b);
    const matchSupplier = supplierFilter === 'all' || b.supplier_name === supplierFilter;
    const matchDate = !dateCutoff || (b.bill_date && b.bill_date >= dateCutoff);
    return matchSearch && matchStatus && matchSupplier && matchDate;
  }), [sorted, search, statusFilter, supplierFilter, dateCutoff]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter, supplierFilter, dateRange]);

  // ── Selection + running total ─────────────────────────────────────────
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
  const toggleAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      pageRows.forEach(r => next.delete(r.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pageRows.forEach(r => next.add(r.id));
      setSelected(next);
    }
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  const selectedBills = bills.filter(b => selected.has(b.id));
  const selectionTotal = selectedBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const selectionOutstanding = selectedBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const selectionCount = selected.size;

  // ── Sort header ───────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };
  const Th = ({ label, field, className = '' }) => (
    <th
      className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">{label}<SortIcon field={field} /></span>
    </th>
  );

  const hasFilters = search || statusFilter !== 'all' || supplierFilter !== 'all' || dateRange !== 'all';

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">

      {/* ── Page title ── */}
      <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>

      {/* ── Summary panels ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Unpaid */}
        <div className="rounded-xl border border-border bg-card px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{gbp.format(unpaidTotal)} Unpaid</span>
            <span className="text-xs text-muted-foreground">All time</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xl font-bold">{gbp.format(overdueTotal)}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{gbp.format(notDueTotal)}</p>
              <p className="text-xs text-muted-foreground">Not due yet</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${overdueBarPct}%` }} />
          </div>
        </div>

        {/* Paid */}
        <div className="rounded-xl border border-border bg-card px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{gbp.format(paidTotal)} Paid</span>
            <span className="text-xs text-muted-foreground">All time</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xl font-bold">{gbp.format(0)}</p>
              <p className="text-xs text-muted-foreground">Not settled</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{gbp.format(paidTotal)}</p>
              <p className="text-xs text-muted-foreground">Settled</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* ── Filter toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search number or supplier"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm border-border"
          />
        </div>

        {/* Supplier */}
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="h-9 w-44 text-sm border-border">
            <SelectValue placeholder="All suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="h-9 w-40 text-sm border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40 text-sm border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="awaiting_review">Awaiting review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="part_paid">Part paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setSupplierFilter('all'); setDateRange('all'); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />Clear
          </button>
        )}

        <div className="ml-auto">
          <Button asChild size="sm" className="h-9 gap-1.5 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
            <Link to="/bills/new"><Plus className="w-3.5 h-3.5" />Add bill</Link>
          </Button>
        </div>
      </div>

      {/* ── Selection running total bar ── */}
      {selectionCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-5">
            <span className="text-sm font-medium text-foreground">
              {selectionCount} bill{selectionCount !== 1 ? 's' : ''} selected
            </span>
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{gbp.format(selectionTotal)}</span>
            </span>
            {selectionOutstanding > 0 && (
              <span className="text-sm text-muted-foreground">
                Outstanding: <span className="font-semibold text-orange-600">{gbp.format(selectionOutstanding)}</span>
              </span>
            )}
          </div>
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />Clear selection
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Receipt className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-sm">{hasFilters ? 'No bills match your filters' : 'No bills yet'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hasFilters ? 'Try adjusting or clearing your filters.' : 'Add your first bill to start tracking supplier invoices.'}
          </p>
          {!hasFilters && (
            <Button asChild size="sm" className="mt-4 h-8 gap-1.5 bg-gray-900 text-white hover:bg-gray-800">
              <Link to="/bills/new"><Plus className="w-3 h-3" />Add bill</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      aria-label="Select all on this page"
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  <Th label="Date" field="bill_date" />
                  <Th label="No." field="bill_number" />
                  <Th label="Supplier" field="supplier_name" className="min-w-[160px]" />
                  <Th label="Amount" field="total" className="text-right" />
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageRows.map(bill => {
                  const overdue = isOverdue(bill);
                  const effectiveStatus = overdue && bill.status !== 'paid' ? 'overdue' : bill.status;
                  const isSelected = selected.has(bill.id);

                  return (
                    <tr
                      key={bill.id}
                      className={`group transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/[0.03]' : ''}`}
                    >
                      {/* checkbox */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(bill.id)}
                          aria-label={`Select bill ${bill.bill_number}`}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>

                      {/* date */}
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {bill.bill_date ? moment(bill.bill_date).format('D/M/YY') : '—'}
                      </td>

                      {/* bill number */}
                      <td className="px-3 py-3 whitespace-nowrap font-medium">
                        {bill.bill_number || '—'}
                      </td>

                      {/* supplier */}
                      <td className="px-3 py-3 max-w-[220px] truncate text-muted-foreground">
                        {bill.supplier_name || 'Unnamed'}
                      </td>

                      {/* amount */}
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {gbp.format(Number(bill.total) || 0)}
                      </td>

                      {/* status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {(overdue || effectiveStatus === 'overdue') && (
                            <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          )}
                          <span className={
                            effectiveStatus === 'paid' ? 'text-emerald-700 font-medium' :
                            effectiveStatus === 'approved' ? 'text-blue-700 font-medium' :
                            effectiveStatus === 'overdue' ? 'text-orange-600 font-medium' :
                            effectiveStatus === 'awaiting_review' ? 'text-amber-700 font-medium' :
                            effectiveStatus === 'draft' ? 'text-slate-500' :
                            effectiveStatus === 'cancelled' ? 'text-slate-400' :
                            'text-foreground'
                          }>
                            {effectiveStatus === 'overdue'
                              ? `Overdue on ${bill.due_date ? moment(bill.due_date).format('D/M/YY') : '—'}`
                              : STATUS_LABEL[effectiveStatus] || effectiveStatus}
                          </span>
                        </span>
                      </td>

                      {/* actions */}
                      <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <span className="inline-flex items-center justify-end gap-3">
                          <button
                            onClick={() => openView(bill)}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            View
                          </button>
                          <Link
                            to={`/bills/${bill.id}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Edit
                          </Link>
                          {bill.status === 'awaiting_review' && (
                            <button
                              onClick={() => updateStatus(bill, 'approved')}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              Approve
                            </button>
                          )}
                          {(bill.status === 'approved' || bill.status === 'awaiting_review' || bill.status === 'part_paid' || overdue) && (
                            <button
                              onClick={() => updateStatus(bill, 'paid')}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Record payment
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <span className="text-xs text-muted-foreground">
              {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage <= 1} onClick={() => setPage(1)}>First</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)}>Next</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>Last</Button>
            </div>
          </div>
        </>
      )}

      <BillView bill={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}
