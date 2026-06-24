import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import InvoiceLineItems from '@/components/invoices/InvoiceLineItems';
import { ArrowLeft } from 'lucide-react';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export default function InvoiceForm() {
  const { activeCompany } = useCompany();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = id && id !== 'new';

  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!isEdit);

  const [form, setForm] = useState({
    customer_id: '', invoice_number: '', issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    payment_terms: 30, status: 'draft', notes: '', reference: '', amount_paid: 0,
    line_items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: '20', amount: 0, vat_amount: 0, line_total: 0 }]
  });

  useEffect(() => {
    if (activeCompany) {
      loadCustomers();
      if (isEdit) loadInvoice();
    }
  }, [activeCompany, id]);

  const loadCustomers = async () => {
    try {
      const list = await base44.entities.Customer.filter({ company_id: activeCompany.id });
      setCustomers(list);
    } catch (e) { console.error(e); }
  };

  const loadInvoice = async () => {
    try {
      const inv = await base44.entities.SalesInvoice.get(id);
      setForm({
        customer_id: inv.customer_id || '', invoice_number: inv.invoice_number || '',
        issue_date: inv.issue_date || '', due_date: inv.due_date || '',
        payment_terms: inv.payment_terms ?? 30, status: inv.status || 'draft',
        notes: inv.notes || '', reference: inv.reference || '', amount_paid: inv.amount_paid || 0,
        line_items: inv.line_items?.length ? inv.line_items : [{ description: '', quantity: 1, unit_price: 0, vat_rate: '20', amount: 0, vat_amount: 0, line_total: 0 }]
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const subtotal = form.line_items.reduce((s, l) => s + (l.amount || 0), 0);
  const vatTotal = form.line_items.reduce((s, l) => s + (l.vat_amount || 0), 0);
  const total = subtotal + vatTotal;
  const balanceDue = total - (parseFloat(form.amount_paid) || 0);

  const handlePaymentTermsChange = (v) => {
    const days = Number(v);
    const issue = new Date(form.issue_date);
    issue.setDate(issue.getDate() + days);
    setForm({ ...form, payment_terms: days, due_date: issue.toISOString().split('T')[0] });
  };

  const handleSave = async () => {
    if (!form.customer_id || !form.invoice_number) {
      toast({ title: 'Please fill in customer and invoice number', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const customer = customers.find(c => c.id === form.customer_id);
    const data = {
      ...form, company_id: activeCompany.id,
      customer_name: customer?.name || '',
      amount_paid: parseFloat(form.amount_paid) || 0,
      subtotal, vat_total: vatTotal, total, balance_due: balanceDue
    };
    try {
      if (isEdit) {
        await base44.entities.SalesInvoice.update(id, data);
        toast({ title: 'Invoice updated' });
      } else {
        await base44.entities.SalesInvoice.create(data);
        toast({ title: 'Invoice created' });
      }
      navigate('/invoices');
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={v => setForm({...form, customer_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Number *</Label>
              <Input value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} placeholder="INV-001" />
            </div>
            <div>
              <Label>Invoice Date</Label>
              <Input type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})} />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Select value={String(form.payment_terms)} onValueChange={handlePaymentTermsChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} placeholder="PO number, etc." />
            </div>
            <div>
              <Label>Amount Paid (£)</Label>
              <Input type="number" min="0" step="0.01" value={form.amount_paid} onChange={e => setForm({...form, amount_paid: e.target.value})} />
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Line Items</Label>
            <InvoiceLineItems lineItems={form.line_items} onChange={items => setForm({...form, line_items: items})} />
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{gbp.format(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT Total</span><span>{gbp.format(vatTotal)}</span></div>
              <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total</span><span>{gbp.format(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span>{gbp.format(parseFloat(form.amount_paid) || 0)}</span></div>
              <div className="flex justify-between font-semibold text-primary border-t pt-2"><span>Balance Due</span><span>{gbp.format(balanceDue)}</span></div>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} placeholder="Payment terms, additional info..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/invoices')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Invoice'}</Button>
      </div>
    </div>
  );
}