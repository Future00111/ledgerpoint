import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, FileText } from 'lucide-react';
import moment from 'moment';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const PAGE_SIZE = 25;

const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  part_paid: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export default function Invoices() {
  const { activeCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('issue_date');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();
  const today = moment().format('YYYY-MM-DD');

  useEffect(() => {
    if (activeCompany) loadInvoices();
  }, [activeCompany]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }, '-issue_date');
      setInvoices(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const isOverdue = (inv) => ['sent', 'part_paid'].includes(inv.status) && inv.due_date < today;

  const updateStatus = async (inv, status) => {
    try {
      const updateData = { status };
      if (status === 'paid') {
        updateData.amount_paid = inv.total;
        updateData.balance_due = 0;
      }
      await base44.entities.SalesInvoice.update(inv.id, updateData);
      toast({ title: `Invoice marked as ${STATUS_LABEL[status] || status}` });
      await loadInvoices();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (inv) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    try { await base44.entities.SalesInvoice.delete(inv.id); toast({ title: 'Invoice deleted' }); await loadInvoices(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  // ── Summary metrics ────────────────────────────────────────────────────
  const unpaidInvoices = useMemo(() => invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled'), [invoices]);
  const overdueInvoices = useMemo(() => invoices.filter(isOverdue), [invoices, today]);
  const notDueInvoices = useMemo(() => unpaidInvoices.filter(i => !isOverdue(i)), [unpaidInvoices]);
  const paidInvoices = useMemo(() => invoices.filter(i => i.status === 'paid'), [invoices]);

  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
  const notDueTotal = notDueInvoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
  const paidTotal = paidInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const overdueBarPct = unpaidTotal > 0 ? Math.round((overdueTotal / unpaidTotal) * 100) : 0;
  const paidBarPct = 100;

  // ── Sort + filter ──────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const list = [...invoices];
    list.sort((a, b) => {
      let av = a[sortField] ?? '';
      let bv = b[sortField] ?? '';
      if (sortField === 'total' || sortField === 'balance_due') { av = Number(av); bv = Number(bv); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [invoices, sortField, sortDir]);

  const filtered = useMemo(() => sorted.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.invoice_number?.toLowerCase().includes(q) || i.customer_name?.toLowerCase().includes(q);
    let matchStatus = statusFilter === 'all' || i.status === statusFilter;
    if (statusFilter === 'overdue') matchStatus = isOverdue(i);
    return matchSearch && matchStatus;
  }), [sorted, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  // ── Selection ──────────────────────────────────────────────────────────
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

  // ── Sort header ────────────────────────────────────────────────────────
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

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">

      {/* ── Page title ── */}
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>

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
          {/* progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${overdueBarPct}%` }}
            />
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
              <p className="text-xs text-muted-foreground">Not deposited</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{gbp.format(paidTotal)}</p>
              <p className="text-xs text-muted-foreground">Deposited</p>
            </div>
          </div>
          {/* progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${paidBarPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Filter toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search number or customer"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="part_paid">Part paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button asChild size="sm" className="h-9 gap-1.5 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
            <Link to="/invoices/new"><Plus className="w-3.5 h-3.5" />Create invoice</Link>
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-sm">{search || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || statusFilter !== 'all' ? 'Try clearing the search or status filter.' : 'Create your first invoice to get started.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild size="sm" className="mt-4 h-8 gap-1.5 bg-gray-900 text-white hover:bg-gray-800">
              <Link to="/invoices/new"><Plus className="w-3 h-3" />Create invoice</Link>
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
                  <Th label="Date" field="issue_date" />
                  <Th label="No." field="invoice_number" />
                  <Th label="Customer" field="customer_name" className="min-w-[160px]" />
                  <Th label="Amount" field="total" className="text-right" />
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageRows.map(inv => {
                  const overdue = isOverdue(inv);
                  const effectiveStatus = overdue && inv.status !== 'paid' ? 'overdue' : inv.status;
                  return (
                    <tr
                      key={inv.id}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      {/* checkbox */}
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleOne(inv.id)}
                          aria-label={`Select invoice ${inv.invoice_number}`}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>

                      {/* date */}
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {inv.issue_date ? moment(inv.issue_date).format('D/M/YY') : '—'}
                      </td>

                      {/* invoice number */}
                      <td className="px-3 py-3 whitespace-nowrap font-medium">
                        {inv.invoice_number || '—'}
                      </td>

                      {/* customer */}
                      <td className="px-3 py-3 max-w-[220px] truncate text-muted-foreground">
                        {inv.customer_name || 'Unnamed'}
                      </td>

                      {/* amount */}
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {gbp.format(Number(inv.total) || 0)}
                      </td>

                      {/* status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {(overdue || effectiveStatus === 'overdue') && (
                            <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          )}
                          <span className={
                            effectiveStatus === 'paid' ? 'text-emerald-700 font-medium' :
                            effectiveStatus === 'overdue' ? 'text-orange-600 font-medium' :
                            effectiveStatus === 'draft' ? 'text-slate-500' :
                            effectiveStatus === 'cancelled' ? 'text-slate-400' :
                            'text-blue-700 font-medium'
                          }>
                            {effectiveStatus === 'overdue'
                              ? `Overdue on ${inv.due_date ? moment(inv.due_date).format('D/M/YY') : '—'}`
                              : STATUS_LABEL[effectiveStatus] || effectiveStatus}
                          </span>
                        </span>
                      </td>

                      {/* actions */}
                      <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <span className="inline-flex items-center justify-end gap-3">
                          <Link
                            to={`/invoices/${inv.id}/view`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            View
                          </Link>
                          <Link
                            to={`/invoices/${inv.id}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Edit
                          </Link>
                          {(inv.status === 'sent' || inv.status === 'part_paid' || overdue) && (
                            <button
                              onClick={() => updateStatus(inv, 'paid')}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Receive payment
                            </button>
                          )}
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => updateStatus(inv, 'sent')}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Mark sent
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
    </div>
  );
}
