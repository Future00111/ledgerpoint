import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, Eye, ChevronUp, ChevronDown, ChevronsUpDown, Receipt, X, Calendar } from 'lucide-react';
import moment from 'moment';
import BillView from '@/components/bills/BillView';
import SupplierCreditNoteView from '@/components/supplier_credit_notes/SupplierCreditNoteView';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const num = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAGE_SIZE = 25;


// Tab → status groups
const TAB_STATUSES = {
  all: null,
  draft: ['draft'],
  awaiting_approval: ['awaiting_review'],
  awaiting_payment: null,
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
  const [supplierCreditNotes, setSupplierCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Table state
  const [sortField, setSortField] = useState('bill_date');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);

  // Detail modal
  const [viewing, setViewing] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [creditViewing, setCreditViewing] = useState(null);
  const [creditDetailsOpen, setCreditDetailsOpen] = useState(false);

  const { toast } = useToast();
  const today = moment().format('YYYY-MM-DD');

  useEffect(() => {
    if (activeCompany) loadBills();
  }, [activeCompany]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const [list, credits] = await Promise.all([
        base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }, '-bill_date'),
        base44.entities.SupplierCreditNote.filter({ company_id: activeCompany.id }, '-credit_note_date'),
      ]);
      setBills(list || []);
      setSupplierCreditNotes(credits || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const isOverdue = (bill) =>
    ['awaiting_review', 'approved', 'part_paid'].includes(bill.status) && bill.due_date < today;

  const isOutstandingBill = (bill) =>
    !['draft', 'awaiting_review', 'paid', 'cancelled'].includes(bill.status) &&
    (Number(bill.balance_due) || 0) > 0;

  const isUnallocatedCredit = (credit) =>
    credit.status !== 'cancelled' && !credit.is_applied;

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
  const openCreditView = (credit) => {
    setCreditViewing(credit);
    setCreditDetailsOpen(true);
  };

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
    awaiting_payment:  bills.filter(isOutstandingBill).length + supplierCreditNotes.filter(isUnallocatedCredit).length,
    paid:              paidBills.length,
  }), [bills, paidBills, supplierCreditNotes]);

  // ── Unique suppliers ─────────────────────────────────────────────────
  const suppliers = useMemo(() => {
    return [...new Set([
      ...bills.map(b => b.supplier_name),
      ...supplierCreditNotes.map(credit => credit.supplier_name),
    ].filter(Boolean))].sort();
  }, [bills, supplierCreditNotes]);


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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const tabStatuses = TAB_STATUSES[activeTab];
    const billRows = sorted
      .filter(b => {
        const matchSearch = !q
          || b.bill_number?.toLowerCase().includes(q)
          || b.supplier_name?.toLowerCase().includes(q)
          || b.reference?.toLowerCase().includes(q);
        const matchTab = activeTab === 'awaiting_payment'
          ? isOutstandingBill(b)
          : !tabStatuses || tabStatuses.includes(b.status);
        const matchSupplier = supplierFilter === 'all' || b.supplier_name === supplierFilter;
        const matchFrom = !dateFrom || (b.bill_date && b.bill_date >= dateFrom);
        const matchTo = !dateTo || (b.bill_date && b.bill_date <= dateTo);
        return matchSearch && matchTab && matchSupplier && matchFrom && matchTo;
      })
      .map(bill => ({ ...bill, rowType: 'bill' }));

    if (activeTab !== 'awaiting_payment') return billRows;

    const creditRows = supplierCreditNotes
      .filter(credit => {
        const matchSearch = !q
          || credit.credit_note_number?.toLowerCase().includes(q)
          || credit.supplier_name?.toLowerCase().includes(q)
          || credit.reason?.toLowerCase().includes(q);
        const matchSupplier = supplierFilter === 'all' || credit.supplier_name === supplierFilter;
        const matchFrom = !dateFrom || (credit.credit_note_date && credit.credit_note_date >= dateFrom);
        const matchTo = !dateTo || (credit.credit_note_date && credit.credit_note_date <= dateTo);
        return isUnallocatedCredit(credit) && matchSearch && matchSupplier && matchFrom && matchTo;
      })
      .map(credit => ({ ...credit, rowType: 'credit' }));

    return [...billRows, ...creditRows];
  }, [sorted, supplierCreditNotes, search, activeTab, supplierFilter, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage  = Math.min(page, pageCount);
  const pageRows  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, activeTab, supplierFilter, dateFrom, dateTo]);

  // ── Selection + running total ────────────────────────────────────────
  const selectableRows = pageRows.filter(row => row.rowType !== 'credit');
  const allOnPageSelected = selectableRows.length > 0 && selectableRows.every(r => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPageSelected) selectableRows.forEach(r => next.delete(r.id));
    else selectableRows.forEach(r => next.add(r.id));
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
  const filteredNetAmount    = filtered.reduce((sum, row) =>
    sum + (row.rowType === 'credit' ? -(Number(row.total) || 0) : (Number(row.balance_due) || 0)), 0);

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

  const hasSecondaryFilters = search || supplierFilter !== 'all' || dateFrom || dateTo;

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
        {/* Start date */}
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            aria-label="Start date"
            max={dateTo || undefined}
            className="h-9 rounded-md border border-border bg-background pl-8 pr-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-38"
          />
        </div>

        {/* End date */}
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            aria-label="End date"
            min={dateFrom || undefined}
            className="h-9 rounded-md border border-border bg-background pl-8 pr-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-38"
          />
        </div>

        {hasSecondaryFilters && (
          <button
            onClick={() => { setSearch(''); setSupplierFilter('all'); setDateFrom(''); setDateTo(''); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />Clear
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          {filtered.length > 0 && ` · ${gbp.format(filteredNetAmount)} net`}
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
          <p className="font-medium text-sm">
            {activeTab === 'awaiting_payment'
              ? 'No outstanding bills or unallocated credits'
              : hasSecondaryFilters || activeTab !== 'all'
                ? 'No bills match your filters'
                : 'No bills yet'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeTab === 'awaiting_payment'
              ? 'Approved bills and supplier credits waiting to be allocated will appear here.'
              : hasSecondaryFilters || activeTab !== 'all'
                ? 'Try adjusting your filters.'
                : 'Add your first bill to start tracking supplier invoices.'}
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
                {pageRows.map(row => {
                  const isCredit = row.rowType === 'credit';
                  const overdue = !isCredit && isOverdue(row);
                  const displayStatus = isCredit
                    ? 'unallocated_credit'
                    : overdue && row.status !== 'paid' ? 'overdue' : row.status;
                  const badge = isCredit
                    ? { label: 'Unallocated credit', cls: 'bg-violet-100 text-violet-700' }
                    : STATUS_BADGE[displayStatus] || { label: displayStatus, cls: 'bg-gray-100 text-gray-600' };
                  const isSelected = !isCredit && selected.has(row.id);
                  const canPay = !isCredit && (['approved', 'part_paid', 'awaiting_review'].includes(row.status) || overdue);
                  const reference = isCredit
                    ? row.credit_note_number || '—'
                    : row.reference || row.bill_number || '—';
                  const rowKey = isCredit ? `credit-${row.id}` : row.id;

                  return (
                    <tr
                      key={rowKey}
                      className={`group transition-colors hover:bg-muted/30 ${isCredit ? 'bg-violet-500/[0.025]' : ''} ${isSelected ? 'bg-primary/[0.03]' : ''}`}
                    >
                      {/* checkbox: credits are intentionally not selectable in the bill payment total */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        {isCredit ? (
                          <span className="block w-4 text-center text-xs text-muted-foreground/50">—</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(row.id)}
                            aria-label={`Select bill ${row.bill_number}`}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          />
                        )}
                      </td>

                      {/* view icon */}
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => isCredit ? openCreditView(row) : openView(row)}
                          aria-label={isCredit ? `View credit note ${row.credit_note_number}` : `View bill ${row.bill_number}`}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>

                      {/* From — supplier name, bold */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <span className={`font-semibold truncate block ${isCredit ? 'text-violet-700' : ''}`}>
                          {row.supplier_name || 'Unnamed'}
                        </span>
                        {isCredit && <span className="text-[10px] text-violet-600/80">Supplier credit note</span>}
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
                        {(isCredit ? row.credit_note_date : row.bill_date)
                          ? moment(isCredit ? row.credit_note_date : row.bill_date).format('D MMM YYYY')
                          : '—'}
                      </td>

                      {/* Due date */}
                      <td className={`px-3 py-3 whitespace-nowrap text-xs ${overdue ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
                        {isCredit ? '—' : row.due_date ? moment(row.due_date).format('D MMM YYYY') : '—'}
                      </td>

                      {/* Paid */}
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                        {isCredit ? '—' : num.format(Number(row.amount_paid) || 0)}
                      </td>

                      {/* Due (balance; credits reduce the payment queue) */}
                      <td className={`px-3 py-3 text-right whitespace-nowrap tabular-nums text-xs font-medium ${isCredit ? 'text-violet-700' : overdue ? 'text-orange-600' : 'text-foreground'}`}>
                        {isCredit ? `−${num.format(Number(row.total) || 0)}` : num.format(Number(row.balance_due) || 0)}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {isCredit ? (
                          <Link
                            to={`/supplier-credit-notes/${row.id}`}
                            className="rounded border border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                          >
                            Allocate credit
                          </Link>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-2">
                            {row.status === 'awaiting_review' && (
                              <button
                                onClick={() => updateStatus(row, 'approved')}
                                className="rounded border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            {canPay && (
                              <button
                                onClick={() => updateStatus(row, 'paid')}
                                className="rounded border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                              >
                                Make payment
                              </button>
                            )}
                            <Link
                              to={`/bills/${row.id}`}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Edit
                            </Link>
                          </span>
                        )}
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
      <SupplierCreditNoteView
        creditNote={creditViewing}
        open={creditDetailsOpen}
        onOpenChange={setCreditDetailsOpen}
      />
    </div>
  );
}
