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
import BillLineItems from '@/components/bills/BillLineItems';
import { ArrowLeft } from 'lucide-react';
import { calculatePaymentStatus } from '@/lib/paymentStatus';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const CATEGORIES = [
  { value: 'parts', label: 'Parts & Materials' },
  { value: 'tools', label: 'Tools & Equipment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'wages', label: 'Wages' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'professional_fees', label: 'Professional Fees' },
  { value: 'other', label: 'Other' },
];

export default function BillForm() {
  const { activeCompany } = useCompany();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = id && id !== 'new';

  const [suppliers, setSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!isEdit);

  const [form, setForm] = useState({
    supplier_id: '', bill_number: '', bill_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    status: 'draft', category: 'other', notes: '', reference: '', amount_paid: 0,
    line_items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: '20', amount: 0, vat_amount: 0, line_total: 0, category: 'other' }]
  });

  useEffect(() => {
    if (activeCompany) {
      loadSuppliers();
      if (isEdit) loadBill();
    }
  }, [activeCompany, id]);

  const loadSuppliers = async () => {
    try {
      const list = await base44.entities.Supplier.filter({ company_id: activeCompany.id });
      setSuppliers(list);
    } catch (e) { console.error(e); }
  };

  const loadBill = async () => {
    try {
      const bill = await base44.entities.PurchaseBill.get(id);
      setForm({
        supplier_id: bill.supplier_id || '', bill_number: bill.bill_number || '',
        bill_date: bill.bill_date || '', due_date: bill.due_date || '',
        status: bill.status || 'draft', category: bill.category || 'other',
        notes: bill.notes || '', reference: bill.reference || '', amount_paid: bill.amount_paid || 0,
        line_items: bill.line_items?.length ? bill.line_items : [{ description: '', quantity: 1, unit_price: 0, vat_rate: '20', amount: 0, vat_amount: 0, line_total: 0, category: 'other' }]
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const subtotal = form.line_items.reduce((s, l) => s + (l.amount || 0), 0);
  const vatTotal = form.line_items.reduce((s, l) => s + (l.vat_amount || 0), 0);
  const total = subtotal + vatTotal;
  const balanceDue = total - (parseFloat(form.amount_paid) || 0);

  const handleSave = async () => {
    if (!form.supplier_id || !form.bill_number) {
      toast({ title: 'Please fill in supplier and bill number', variant: 'destructive' });
      return;
    }
    // Validate unique bill number within supplier and company
    const existing = await base44.entities.PurchaseBill.filter({ company_id: activeCompany.id, supplier_id: form.supplier_id, bill_number: form.bill_number });
    const duplicate = existing.find(b => b.id !== id);
    if (duplicate) {
      toast({ title: 'This supplier bill number already exists for this supplier.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    const amountPaid = parseFloat(form.amount_paid) || 0;
    const calculatedStatus = calculatePaymentStatus(form.status, amountPaid, total, form.due_date);
    const data = {
      ...form, company_id: activeCompany.id,
      supplier_name: supplier?.name || '',
      amount_paid: amountPaid,
      status: calculatedStatus,
      subtotal, vat_total: vatTotal, total, balance_due: balanceDue
    };
    try {
      if (isEdit) {
        await base44.entities.PurchaseBill.update(id, data);
        toast({ title: 'Bill updated' });
      } else {
        await base44.entities.PurchaseBill.create(data);
        toast({ title: 'Bill created' });
      }
      navigate('/bills');
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/bills')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? 'Edit Bill' : 'New Purchase Bill'}</h1>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm({...form, supplier_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bill Number *</Label>
              <Input value={form.bill_number} onChange={e => setForm({...form, bill_number: e.target.value})} placeholder="BILL-001" />
            </div>
            <div>
              <Label>Bill Date</Label>
              <Input type="date" value={form.bill_date} onChange={e => setForm({...form, bill_date: e.target.value})} />
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
                  <SelectItem value="awaiting_review">Awaiting Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="part_paid">Part Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
            <BillLineItems lineItems={form.line_items} onChange={items => setForm({...form, line_items: items})} />
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
            <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/bills')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Bill'}</Button>
      </div>
    </div>
  );
}