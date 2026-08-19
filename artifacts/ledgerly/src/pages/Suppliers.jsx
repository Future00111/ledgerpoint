import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import moment from 'moment';
import SupplierForm from '@/components/suppliers/SupplierForm';
import SupplierDetails from '@/components/suppliers/SupplierDetails';

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

const number = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PAGE_SIZE = 25;

export default function Suppliers() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    if (activeCompany) loadData();
  }, [activeCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [supplierList, billList] = await Promise.all([
        base44.entities.Supplier.filter({ company_id: activeCompany.id }),
        base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }, '-bill_date'),
      ]);
      setSuppliers(supplierList || []);
      setBills(billList || []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not load suppliers', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setFormOpen(true);
  };

  const openView = (supplier) => {
    setViewing(supplier);
    setDetailsOpen(true);
  };

  const handleDelete = async (supplier) => {
    if (!confirm(`Delete ${supplier.name}?`)) return;
    try {
      await base44.entities.Supplier.delete(supplier.id);
      toast({ title: 'Supplier deleted' });
      await loadData();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const today = moment().format('YYYY-MM-DD');
  const yearAgo = moment().subtract(365, 'days').format('YYYY-MM-DD');

  const billMetrics = useMemo(() => {
    const recentBills = bills.filter(
      (bill) =>
        bill.bill_date >= yearAgo &&
        bill.status !== 'cancelled',
    );
    const unpaidBills = recentBills.filter(
      (bill) => bill.status !== 'paid' && Number(bill.balance_due) > 0,
    );
    const overdue = unpaidBills
      .filter((bill) => bill.due_date && bill.due_date < today)
      .reduce((sum, bill) => sum + (Number(bill.balance_due) || 0), 0);
    const notDue = unpaidBills
      .filter((bill) => !bill.due_date || bill.due_date >= today)
      .reduce((sum, bill) => sum + (Number(bill.balance_due) || 0), 0);
    const paid = recentBills.reduce((sum, bill) => sum + (Number(bill.amount_paid) || 0), 0);

    return {
      overdue,
      notDue,
      paid,
      unpaid: overdue + notDue,
      overduePercent: overdue + notDue > 0
        ? Math.round((overdue / (overdue + notDue)) * 100)
        : 0,
    };
  }, [bills, today, yearAgo]);

  const supplierRows = useMemo(() => {
    const balances = new Map();
    bills.forEach((bill) => {
      if (!bill.supplier_id || bill.status === 'cancelled') return;
      const current = balances.get(bill.supplier_id) || 0;
      balances.set(
        bill.supplier_id,
        current + (bill.status === 'paid' ? 0 : Number(bill.balance_due) || 0),
      );
    });

    return suppliers.map((supplier) => ({
      ...supplier,
      openBalance: balances.has(supplier.id)
        ? balances.get(supplier.id)
        : Number(supplier.outstanding_balance) || 0,
    }));
  }, [suppliers, bills]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = supplierRows.filter((supplier) => {
      if (!query) return true;
      return [
        supplier.name,
        supplier.contact_name,
        supplier.email,
        supplier.phone,
        supplier.supplier_reference,
      ].some((value) => value?.toLowerCase().includes(query));
    });

    return rows.sort((a, b) => {
      const aValue = sortField === 'openBalance' ? a.openBalance : (a[sortField] || '');
      const bValue = sortField === 'openBalance' ? b.openBalance : (b[sortField] || '');
      if (aValue < bValue) return sortDir === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [supplierRows, search, sortField, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every((supplier) => selected.has(supplier.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((supplier) => next.delete(supplier.id));
    else filtered.forEach((supplier) => next.add(supplier.id));
    setSelected(next);
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  const SortHeader = ({ label, field, className = '' }) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <SortIcon field={field} />
      </span>
    </th>
  );

  if (!activeCompany) {
    return <p className="py-12 text-center text-muted-foreground">Please select a company first.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage supplier contacts, balances, and bills in one place.
          </p>
        </div>
        <Button
          onClick={openCreate}
          size="sm"
          className="h-9 gap-1.5 bg-emerald-800 text-white hover:bg-emerald-900"
        >
          <Plus className="h-3.5 w-3.5" />
          New supplier
        </Button>
      </div>

      <section aria-label="Supplier balances" className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Unpaid
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Last 365 days</p>
            </div>
            <p className="text-lg font-semibold tabular-nums">{gbp.format(billMetrics.unpaid)}</p>
          </div>
          <div className="flex h-14 overflow-hidden rounded-md bg-slate-100">
            <div
              className="flex min-w-[120px] flex-1 flex-col justify-center bg-orange-500 px-3 text-white"
              style={{ flexGrow: Math.max(billMetrics.overdue, 0.01) }}
            >
              <span className="text-lg font-semibold tabular-nums">{gbp.format(billMetrics.overdue)}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-85">Overdue</span>
            </div>
            <div
              className="flex min-w-[120px] flex-1 flex-col justify-center bg-slate-200 px-3 text-slate-700"
              style={{ flexGrow: Math.max(billMetrics.notDue, 0.01) }}
            >
              <span className="text-lg font-semibold tabular-nums">{gbp.format(billMetrics.notDue)}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Open bills</span>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{billMetrics.overduePercent}% of unpaid balance is overdue</span>
            <span>{bills.filter((bill) => bill.status !== 'paid' && bill.status !== 'cancelled').length} open bills</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Paid</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Last 365 days</p>
            </div>
            <p className="text-lg font-semibold tabular-nums">{gbp.format(billMetrics.paid)}</p>
          </div>
          <div className="flex h-14 items-center rounded-md bg-emerald-600 px-3 text-white">
            <div>
              <p className="text-lg font-semibold tabular-nums">{gbp.format(billMetrics.paid)}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-100">Paid in last 365 days</p>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Payments recorded against supplier bills
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search suppliers, contacts, or email"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}
        </span>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear {selected.size} selected
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-20 text-center">
          <Truck className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">{search ? 'No suppliers match your search' : 'No suppliers yet'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? 'Try a different name, contact, or email.' : 'Add your first supplier to start tracking bills.'}
          </p>
          {!search && (
            <Button onClick={openCreate} size="sm" className="mt-4 h-8 gap-1.5">
              <Plus className="h-3 w-3" />
              New supplier
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all suppliers"
                      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </th>
                  <SortHeader label="Supplier" field="name" />
                  <SortHeader label="Company name" field="contact_name" />
                  <SortHeader label="Phone" field="phone" />
                  <SortHeader label="Email" field="email" />
                  <SortHeader label="Open balance" field="openBalance" className="text-right" />
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((supplier) => {
                  const isSelected = selected.has(supplier.id);
                  const hasBalance = supplier.openBalance > 0;
                  return (
                    <tr
                      key={supplier.id}
                      className={`transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/[0.03]' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(supplier.id)}
                          aria-label={`Select ${supplier.name}`}
                          className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                        />
                      </td>
                      <td className="max-w-[190px] px-3 py-2.5">
                        <button
                          onClick={() => openView(supplier)}
                          className="block max-w-full truncate text-left font-semibold text-foreground hover:text-primary hover:underline"
                        >
                          {supplier.name || 'Unnamed supplier'}
                        </button>
                        {supplier.status !== 'active' && (
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">Inactive</span>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                        {supplier.contact_name || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                        {supplier.phone || '—'}
                      </td>
                      <td className="max-w-[210px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                        {supplier.email ? (
                          <a href={`mailto:${supplier.email}`} className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                            <Mail className="h-3 w-3 shrink-0" />
                            {supplier.email}
                          </a>
                        ) : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-right text-xs tabular-nums ${hasBalance ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {number.format(supplier.openBalance)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <Link
                            to={hasBalance ? '/bills' : '/bills/new'}
                            className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              hasBalance
                                ? 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
                                : 'border-border bg-background text-primary hover:bg-muted'
                            }`}
                          >
                            {hasBalance ? 'Make payment' : 'Create bill'}
                          </Link>
                          <button
                            onClick={() => openView(supplier)}
                            title="View supplier"
                            aria-label={`View ${supplier.name}`}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(supplier)}
                            title="Edit supplier"
                            aria-label={`Edit ${supplier.name}`}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier)}
                            title="Delete supplier"
                            aria-label={`Delete ${supplier.name}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {Math.min(filtered.length, PAGE_SIZE)} of {filtered.length} suppliers</span>
            <span className="hidden sm:inline">Select a supplier name to view details</span>
          </div>
        </div>
      )}

      <SupplierForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        companyId={activeCompany.id}
        onSaved={loadData}
      />
      <SupplierDetails
        supplier={viewing}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}