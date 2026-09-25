import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ChevronsUpDown, FileText, Plus, Search } from 'lucide-react';
import moment from 'moment';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import SalesCreditNoteView from '@/components/sales_credit_notes/SalesCreditNoteView';
import SupplierCreditNoteView from '@/components/supplier_credit_notes/SupplierCreditNoteView';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const PAGE_SIZE = 25;

const CONFIG = {
  sales: {
    title: 'Sales Credit Notes',
    partyLabel: 'Customer',
    partyField: 'customer_name',
    entity: 'SalesCreditNote',
    route: '/sales-credit-notes',
    iconLabel: 'credit note',
    statuses: [
      ['draft', 'Draft'],
      ['issued', 'Issued'],
      ['applied', 'Applied'],
      ['cancelled', 'Cancelled'],
    ],
    statusLabels: { draft: 'Draft', issued: 'Issued', applied: 'Applied', cancelled: 'Cancelled' },
    view: SalesCreditNoteView,
    originalIdField: 'original_invoice_id',
    originalEntityType: 'sales_invoice',
    originalLabel: 'Invoice',
  },
  supplier: {
    title: 'Supplier Credit Notes',
    partyLabel: 'Supplier',
    partyField: 'supplier_name',
    entity: 'SupplierCreditNote',
    route: '/supplier-credit-notes',
    iconLabel: 'supplier credit note',
    statuses: [
      ['draft', 'Draft'],
      ['awaiting_review', 'Awaiting review'],
      ['approved', 'Approved'],
      ['applied', 'Applied'],
      ['cancelled', 'Cancelled'],
    ],
    statusLabels: {
      draft: 'Draft',
      awaiting_review: 'Awaiting review',
      approved: 'Approved',
      applied: 'Applied',
      cancelled: 'Cancelled',
    },
    view: SupplierCreditNoteView,
    originalIdField: 'original_bill_id',
    originalEntityType: 'purchase_bill',
    originalLabel: 'Bill',
  },
};

function isApplied(creditNote) {
  return creditNote.status === 'applied' || creditNote.is_applied === true || creditNote.is_applied === 'true';
}

export default function CreditNotesRegister({ kind }) {
  const config = CONFIG[kind];
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('credit_note_date');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const entity = base44.entities[config.entity];
  const ViewComponent = config.view;

  useEffect(() => {
    if (activeCompany) loadCreditNotes();
  }, [activeCompany, kind]);

  const loadCreditNotes = async () => {
    setLoading(true);
    try {
      const list = await entity.filter({ company_id: activeCompany.id }, '-credit_note_date');
      setCreditNotes(list || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (creditNote, status) => {
    try {
      const originalId = creditNote[config.originalIdField] || null;
      const shouldApply = status === 'applied' && Boolean(originalId);
      const wasApplied = isApplied(creditNote);
      await entity.update(creditNote.id, { status, is_applied: shouldApply });

      if (shouldApply && !wasApplied) {
        await base44.functions.invoke('updatePaymentStatus', {
          entity_type: config.originalEntityType,
          record_id: originalId,
          amount_paid_delta: Number(creditNote.total) || 0,
        });
      } else if (!shouldApply && wasApplied && originalId) {
        await base44.functions.invoke('updatePaymentStatus', {
          entity_type: config.originalEntityType,
          record_id: originalId,
          amount_paid_delta: -(Number(creditNote.total) || 0),
        });
      }

      toast({ title: `Credit note marked as ${config.statusLabels[status] || status}` });
      await loadCreditNotes();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (creditNote) => {
    if (!confirm(`Delete credit note ${creditNote.credit_note_number}?`)) return;
    try {
      await entity.delete(creditNote.id);
      toast({ title: 'Credit note deleted' });
      await loadCreditNotes();
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openView = (creditNote) => {
    setViewing(creditNote);
    setDetailsOpen(true);
  };

  const totals = useMemo(() => {
    const active = creditNotes.filter(note => note.status !== 'cancelled');
    const unallocated = active.filter(note => !isApplied(note));
    const applied = active.filter(isApplied);
    return {
      total: active.reduce((sum, note) => sum + (Number(note.total) || 0), 0),
      unallocated: unallocated.reduce((sum, note) => sum + (Number(note.total) || 0), 0),
      applied: applied.reduce((sum, note) => sum + (Number(note.total) || 0), 0),
      unallocatedCount: unallocated.length,
      appliedCount: applied.length,
      draftCount: creditNotes.filter(note => note.status === 'draft').length,
    };
  }, [creditNotes]);

  const sorted = useMemo(() => {
    const list = [...creditNotes];
    list.sort((a, b) => {
      let av = a[sortField] ?? '';
      let bv = b[sortField] ?? '';
      if (sortField === 'total') {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [creditNotes, sortField, sortDir]);

  const filtered = useMemo(() => sorted.filter(creditNote => {
    const q = search.toLowerCase();
    const party = creditNote[config.partyField]?.toLowerCase() || '';
    const reference = kind === 'sales' ? creditNote.original_invoice_number : creditNote.original_bill_number;
    const matchSearch = !q
      || creditNote.credit_note_number?.toLowerCase().includes(q)
      || party.includes(q)
      || reference?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || creditNote.status === statusFilter;
    return matchSearch && matchStatus;
  }), [sorted, search, statusFilter, config.partyField, kind]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every(row => selected.has(row.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPageSelected) pageRows.forEach(row => next.delete(row.id));
    else pageRows.forEach(row => next.add(row.id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(dir => dir === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDir('asc');
    }
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

  const appliedBarPct = totals.total > 0 ? Math.round((totals.applied / totals.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
        <Button asChild size="sm" className="h-9 gap-1.5 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
          <Link to={`${config.route}/new`}><Plus className="w-3.5 h-3.5" />Create credit note</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{gbp.format(totals.unallocated)} Unallocated</span>
            <span className="text-xs text-muted-foreground">All time</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xl font-bold">{totals.unallocatedCount}</p>
              <p className="text-xs text-muted-foreground">Open notes</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{gbp.format(totals.applied)}</p>
              <p className="text-xs text-muted-foreground">Applied</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${100 - appliedBarPct}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{gbp.format(totals.total)} Total credits</span>
            <span className="text-xs text-muted-foreground">Excluding cancelled</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xl font-bold">{creditNotes.length}</p>
              <p className="text-xs text-muted-foreground">All notes</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{totals.draftCount}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${creditNotes.length ? (totals.draftCount / creditNotes.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search number or ${config.partyLabel.toLowerCase()}`}
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="h-9 pl-8 text-sm border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40 text-sm border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {config.statuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} note{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-sm">{search || statusFilter !== 'all' ? 'No credit notes match your filters' : 'No credit notes yet'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || statusFilter !== 'all' ? 'Try clearing the search or status filter.' : 'Create your first credit note to get started.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild size="sm" className="mt-4 h-8 gap-1.5 bg-gray-900 text-white hover:bg-gray-800">
              <Link to={`${config.route}/new`}><Plus className="w-3 h-3" />Create credit note</Link>
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
                  <Th label="Date" field="credit_note_date" />
                  <Th label="No." field="credit_note_number" />
                  <Th label={config.partyLabel} field={config.partyField} className="min-w-[160px]" />
                  <Th label="Amount" field="total" className="text-right" />
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageRows.map(creditNote => {
                  const effectiveStatus = creditNote.status;
                  return (
                    <tr key={creditNote.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3" onClick={event => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(creditNote.id)}
                          onChange={() => toggleOne(creditNote.id)}
                          aria-label={`Select credit note ${creditNote.credit_note_number}`}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {creditNote.credit_note_date ? moment(creditNote.credit_note_date).format('D/M/YY') : '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-medium">{creditNote.credit_note_number || '—'}</td>
                      <td className="px-3 py-3 max-w-[220px] truncate text-muted-foreground">
                        {creditNote[config.partyField] || 'Unnamed'}
                      </td>
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {gbp.format(Number(creditNote.total) || 0)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={
                          effectiveStatus === 'applied' ? 'text-emerald-700 font-medium' :
                          effectiveStatus === 'cancelled' ? 'text-slate-400' :
                          effectiveStatus === 'draft' ? 'text-slate-500' :
                          effectiveStatus === 'awaiting_review' ? 'text-amber-700 font-medium' :
                          'text-blue-700 font-medium'
                        }>
                          {config.statusLabels[effectiveStatus] || effectiveStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap" onClick={event => event.stopPropagation()}>
                        <span className="inline-flex items-center justify-end gap-3">
                          <button onClick={() => openView(creditNote)} className="text-xs text-primary hover:underline font-medium">View</button>
                          <Link to={`${config.route}/${creditNote.id}`} className="text-xs text-primary hover:underline font-medium">Edit</Link>
                          {kind === 'sales' && creditNote.status === 'draft' && (
                            <button onClick={() => updateStatus(creditNote, 'issued')} className="text-xs text-primary hover:underline font-medium">Mark issued</button>
                          )}
                          {kind === 'sales' && creditNote.status === 'issued' && (
                            <button onClick={() => updateStatus(creditNote, 'applied')} className="text-xs text-primary hover:underline font-medium">Apply to invoice</button>
                          )}
                          {kind === 'supplier' && creditNote.status === 'awaiting_review' && (
                            <button onClick={() => updateStatus(creditNote, 'approved')} className="text-xs text-primary hover:underline font-medium">Approve</button>
                          )}
                          {kind === 'supplier' && (creditNote.status === 'approved' || creditNote.status === 'awaiting_review') && (
                            <button onClick={() => updateStatus(creditNote, 'applied')} className="text-xs text-primary hover:underline font-medium">Apply to bill</button>
                          )}
                          <button onClick={() => handleDelete(creditNote)} className="text-xs text-destructive hover:underline font-medium">Delete</button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <span className="text-xs text-muted-foreground">
              {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage <= 1} onClick={() => setPage(1)}>First</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage <= 1} onClick={() => setPage(current => current - 1)}>Previous</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage >= pageCount} onClick={() => setPage(current => current + 1)}>Next</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>Last</Button>
            </div>
          </div>
        </>
      )}

      <ViewComponent creditNote={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}