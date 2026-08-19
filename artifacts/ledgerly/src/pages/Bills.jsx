import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, Eye, ChevronUp, ChevronDown, ChevronsUpDown, Receipt, X } from 'lucide-react';
import moment from 'moment';
import BillView from '@/components/bills/BillView';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const num = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAGE_SIZE = 25;

const DATE_RANGES = [
  { value: 'all', label: 'All dates' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last 12 months' },
];

// Tab → status groups
const TAB_STATUSES = {
  all: null,
  draft: ['draft'],
  awaiting_approval: ['awaiting_review'],
  awaiting_payment: ['approved', 'part_paid'],
  paid: ['paid'],
};

const STATUS_BADGE = {
  draft:           { label: 'Draft',              cls: 'bg-slate-100 text-slate-600' },
  awaiting_review: { label: 'Awaiting approval',  cls: 'bg-amber-100 text-amber-700' },
  approved:        { label: 'Awaiting payment',   cls: 'bg-blue-100 text-blue-700' },
  part_paid:       { label: 'Part paid',          cls: 'bg-purple-100 text-purple-700' },
  paid:            { label: 'Paid',               cls: 'bg-emerald-100 text-emerald-700' },
  overdue:         { label: 'Overdue',            cls: 'bg-orange-100 text-orange-700' },
  cancelled:       { label: 'Cancelled',          cls: 'bg-gray-100 text-gray-500' },
};

export default function Bills() {
  const { activeCompany } = useCompany();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
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
      toast({ title: `Bill marked as ${STATUS_BADGE[status]?.label || status}` });
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

  // ── Summary metrics ──────────────────────────────────────────────────
  const unpaidBills  = useMemo(() => bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled'), [bills]);
  const overdueBills = useMemo(() => bills.filter(isOverdue), [bills, today]);
  const notDueBills  = useMemo(() => unpaidBills.filter(b => !isOverdue(b)), [unpaidBills]);
  const paidBills    = useMemo(() => bills.filter(b => b.status === 'paid'), [bills]);

  const unpaidTotal   = unpaidBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const overdueTotal  = overdueBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const notDueTotal   = notDueBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const paidTotal     = paidBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const overdueBarPct = unpaidTotal > 0 ? Math.round((overdueTotal / unpaidTotal) * 100) : 0;

  // ── Tab counts ───────────────────────────────────────────────────────
  const tabCount = useMemo(() => ({
    all:               bills.length,
    draft:             bills.filter(b => b.status === 'draft').length,
    awaiting_approval: bills.filter(b => b.status === 'awaiting_review').length,
    awaiting_payment:  bills.filter(b => ['approved', 'part_paid'].includes(b.status)).length,
    paid:              paidBills.length,
  }), [bills, paidBills]);

  // ── Unique suppliers ─────────────────────────────────────────────────
  const suppliers = useMemo(() => {
    return [...new Set(bills.map(b => b.supplier_name).filter(Boolean))].sort();
  }, [bills]);

  // ── Date cutoff ──────────────────────────────────────────────────────
  const dateCutoff = useMemo(() => {
    if (dateRange === 'all') return null;
    return moment().subtract(Number(dateRange), 'days').format('YYYY-MM-DD');
  }, [dateRange]);

  // ── Sort + filter ────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const list = [...bills];
    list.sort((a, b) => {
      let av = a[sortField] ?? '';
      let bv = b[sortField] ?? '';
      if (['total','balance_due','amount_paid'].includes(sortField)) { av = Number(av); bv = Number(bv); }
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
      || b.supplier_name?.toLowerCase().includes(q)
      || b.reference?.toLowerCase().includes(q);

    // Tab-based status filter
    const tabStatuses = TAB_STATUSES[activeTab];
    const matchTab = !tabStatuses || tabStatuses.includes(b.status);

    const matchSupplier = supplierFilter === 'all' || b.supplier_name === supplierFilter;
    const matchDate = !dateCutoff || (b.bill_date && b.bill_date >= dateCutoff);

    return matchSearch && matchTab && matchSupplier && matchDate;
  }), [sorted, search, activeTab, supplierFilter, dateCutoff]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage  = Math.min(page, pageCount);
  const pageRows  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, activeTab, supplierFilter, dateRange]);

  // ── Selection + running total ────────────────────────────────────────
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPageSelected) pageRows.forEach(r => next.delete(r.id));
    else pageRows.forEach(r => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  const selectedBills       = bills.filter(b => selected.has(b.id));
  const selectionTotal      = selectedBills.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const selectionOutstanding= selectedBills.reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const selectionCount      = selected.size;

  // ── Sort header ──────────────────────────────────────────────────────
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

  const hasSecondaryFilters = search || supplierFilter !== 'all' || dateRange !== 'all';

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  const TABS = [
    { key: 'all',               label: 'All' },
    { key: 'draft',             label: 'Draft' },
    { key: 'awaiting_approval', label: 'Awaiting approval' },
    { key: 'awaiting_payment',  label: 'Awaiting payment' },
    { key: 'paid',              label: 'Paid' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
        <Button asChild size="sm" className="h-9 gap-1.5 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
          <Link to="/bills/new"><Plus className="w-3.5 h-3.5" />New bill</Link>
        </Button>
      </div>

      {/* ── Summary panels ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{gbp.format(unpaidTotal)} Unpaid</span>
            <span className="text-xs text-muted-foreground">All time</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-xl font-bold">{gbp.format(overdueTotal)}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
            <div className="text-right"><p className="text-xl font-bold">{gbp.format(notDueTotal)}</p><p className="text-xs text-muted-foreground">Not due yet</p></div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${overdueBarPct}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{gbp.format(paidTotal)} Paid</span>
            <span className="text-xs text-muted-foreground">All time</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-xl font-bold">{gbp.format(0)}</p><p className="text-xs text-muted-foreground">Not settled</p></div>
            <div className="text-right"><p className="text-xl font-bold">{gbp.format(paidTotal)}</p><p className="text-xs text-muted-foreground">Settled</p></div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* ── Status tabs ── */}
      <div className="border-b border-border">
        <nav className="flex gap-0 overflow-x-auto" aria-label="Bill status filter">
          {TABS.map(tab => {
            const count = tabCount[tab.key];
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors
                  ${active
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums
                    ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Filter toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search supplier, reference or number"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm border-border"
          />
        </div>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="h-9 w-44 text-sm border-border"><SelectValue placeholder="All suppliers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="h-9 w-40 text-sm border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasSecondaryFilters && (
          <button
            onClick={() => { setSearch(''); setSupplierFilter('all'); setDateRange('all'); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />Clear
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          {filtered.length > 0 && ` · ${gbp.format(filtered.reduce((s, b) => s + (Number(b.balance_due) || 0), 0))}`}
        </span>
      </div>

      {/* ── Sticky selection bar ── */}
      {selectionCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-background/95 backdrop-blur-sm shadow-lg ring-1 ring-black/5 px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-5">
              <span className="text-sm font-semibold text-foreground">
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
            <button onClick={clearSelection} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />Clear
            </button>
          </div>
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
          <p className="font-medium text-sm">{search || supplierFilter !== 'all' || dateRange !== 'all' || activeTab !== 'all' ? 'No bills match your filters' : 'No bills yet'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hasSecondaryFilters || activeTab !== 'all' ? 'Try adjusting your filters.' : 'Add your first bill to start tracking supplier invoices.'}
          </p>
          {!hasSecondaryFilters && activeTab === 'all' && (
            <Button asChild size="sm" className="mt-4 h-8 gap-1.5 bg-gray-900 text-white hover:bg-gray-800">
              <Link to="/bills/new"><Plus className="w-3 h-3" />New bill</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {/* select all */}
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      aria-label="Select all on this page"
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  {/* view icon col — no label */}
                  <th className="w-8 px-2 py-2.5" />
                  <Th label="From"     field="supplier_name" className="min-w-[140px]" />
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Status</th>
                  <Th label="Reference" field="reference" className="min-w-[120px]" />
                  <Th label="Date"      field="bill_date" />
                  <Th label="Due date"  field="due_date" />
                  <Th label="Paid"      field="amount_paid" className="text-right" />
                  <Th label="Due"       field="balance_due" className="text-right" />
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageRows.map(bill => {
                  const overdue     = isOverdue(bill);
                  const displayStatus = overdue && bill.status !== 'paid' ? 'overdue' : bill.status;
                  const badge       = STATUS_BADGE[displayStatus] || { label: displayStatus, cls: 'bg-gray-100 text-gray-600' };
                  const isSelected  = selected.has(bill.id);
                  const canPay      = ['approved','part_paid','awaiting_review'].includes(bill.status) || overdue;
                  const reference   = bill.reference || bill.bill_number || '—';

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

                      {/* view icon */}
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openView(bill)}
                          aria-label={`View bill ${bill.bill_number}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>

                      {/* From — supplier name, bold */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <span className="font-semibold truncate block">{bill.supplier_name || 'Unnamed'}</span>
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="px-3 py-3 max-w-[180px] text-muted-foreground text-xs truncate">
                        {reference}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {bill.bill_date ? moment(bill.bill_date).format('D MMM YYYY') : '—'}
                      </td>

                      {/* Due date */}
                      <td className={`px-3 py-3 whitespace-nowrap text-xs ${overdue ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                        {bill.due_date ? moment(bill.due_date).format('D MMM YYYY') : '—'}
                      </td>

                      {/* Paid */}
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                        {num.format(Number(bill.amount_paid) || 0)}
                      </td>

                      {/* Due (balance) */}
                      <td className={`px-3 py-3 text-right whitespace-nowrap tabular-nums text-xs font-medium ${overdue ? 'text-orange-600' : 'text-foreground'}`}>
                        {num.format(Number(bill.balance_due) || 0)}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <span className="inline-flex items-center justify-end gap-2">
                          {bill.status === 'awaiting_review' && (
                            <button
                              onClick={() => updateStatus(bill, 'approved')}
                              className="rounded border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          {canPay && (
                            <button
                              onClick={() => updateStatus(bill, 'paid')}
                              className="rounded border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                              Make payment
                            </button>
                          )}
                          <Link
                            to={`/bills/${bill.id}`}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Edit
                          </Link>
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
