import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MapPin, FileText, CreditCard, PoundSterling, Receipt, CalendarClock } from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

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

export default function CustomerDetails({ customer, open, onOpenChange }) {
  const [stats, setStats] = useState({ invoiceCount: 0, totalSales: 0, lastInvoiceDate: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const invoices = await base44.entities.SalesInvoice.filter({ customer_id: customer.id });
        if (cancelled) return;
        const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const dates = invoices.map(i => i.issue_date).filter(Boolean).sort();
        setStats({
          invoiceCount: invoices.length,
          totalSales,
          lastInvoiceDate: dates.length ? dates[dates.length - 1] : null,
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, customer]);

  if (!customer) return null;
  const address = [customer.address_line_1, customer.address_line_2, customer.city, customer.county, customer.postcode, customer.country].filter(Boolean).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{customer.name}</h3>
            <Badge className={customer.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
              {customer.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className="text-lg font-semibold">{gbp.format(customer.outstanding_balance || 0)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Number of Invoices</p>
              <p className="text-lg font-semibold">{loading ? '…' : stats.invoiceCount}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Total Sales</p>
              <p className="text-lg font-semibold">{loading ? '…' : gbp.format(stats.totalSales)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Last Invoice Date</p>
              <p className="text-lg font-semibold">{loading ? '…' : (stats.lastInvoiceDate || '—')}</p>
            </div>
          </div>

          <Field icon={FileText} label="Customer Reference" value={customer.customer_reference} />
          <Field icon={CreditCard} label="Payment Terms" value={customer.payment_terms ? `${customer.payment_terms} days` : ''} />
          <Field icon={PoundSterling} label="Credit Limit" value={customer.credit_limit ? gbp.format(customer.credit_limit) : ''} />
          <Field icon={PoundSterling} label="VAT Number" value={customer.vat_number} />
          <Field icon={Mail} label="Contact Name" value={customer.contact_name} />
          <Field icon={Mail} label="Email" value={customer.email} />
          <Field icon={Phone} label="Phone" value={customer.phone} />
          <Field icon={MapPin} label="Address" value={address} />
          {customer.notes && <Field icon={Receipt} label="Notes" value={customer.notes} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}