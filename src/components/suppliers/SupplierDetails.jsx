import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MapPin, FileText, CreditCard, PoundSterling, Receipt } from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const CATEGORY_LABELS = {
  parts: 'Parts', tools: 'Tools', utilities: 'Utilities', rent: 'Rent',
  insurance: 'Insurance', wages: 'Wages', fuel: 'Fuel', office: 'Office',
  professional_fees: 'Professional Fees', other: 'Other',
};

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function SupplierDetails({ supplier, open, onOpenChange }) {
  const [stats, setStats] = useState({ billCount: 0, totalPurchases: 0, lastBillDate: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supplier) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const bills = await base44.entities.PurchaseBill.filter({ supplier_id: supplier.id });
        if (cancelled) return;
        const totalPurchases = bills.reduce((sum, b) => sum + (b.total || 0), 0);
        const dates = bills.map(b => b.bill_date).filter(Boolean).sort();
        setStats({
          billCount: bills.length,
          totalPurchases,
          lastBillDate: dates.length ? dates[dates.length - 1] : null,
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, supplier]);

  if (!supplier) return null;
  const address = [supplier.address_line_1, supplier.address_line_2, supplier.city, supplier.county, supplier.postcode, supplier.country].filter(Boolean).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supplier Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{supplier.name}</h3>
            <Badge className={supplier.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
              {supplier.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Outstanding Bills</p>
              <p className="text-lg font-semibold">{gbp.format(supplier.outstanding_balance || 0)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Number of Bills</p>
              <p className="text-lg font-semibold">{loading ? '…' : stats.billCount}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Total Purchases</p>
              <p className="text-lg font-semibold">{loading ? '…' : gbp.format(stats.totalPurchases)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Last Bill Date</p>
              <p className="text-lg font-semibold">{loading ? '…' : (stats.lastBillDate || '—')}</p>
            </div>
          </div>

          <Field icon={FileText} label="Supplier Reference" value={supplier.supplier_reference} />
          <Field icon={Receipt} label="Default Expense Category" value={CATEGORY_LABELS[supplier.default_expense_category] || supplier.default_expense_category} />
          <Field icon={CreditCard} label="Payment Terms" value={supplier.payment_terms ? `${supplier.payment_terms} days` : ''} />
          <Field icon={PoundSterling} label="VAT Number" value={supplier.vat_number} />
          <Field icon={Mail} label="Contact Name" value={supplier.contact_name} />
          <Field icon={Mail} label="Email" value={supplier.email} />
          <Field icon={Phone} label="Phone" value={supplier.phone} />
          <Field icon={MapPin} label="Address" value={address} />
          {supplier.notes && <Field icon={Receipt} label="Notes" value={supplier.notes} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}