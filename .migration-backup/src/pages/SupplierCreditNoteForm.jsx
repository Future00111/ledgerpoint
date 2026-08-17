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

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export default function SupplierCreditNoteForm() {
  const { activeCompany } = useCompany();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = id && id !== 'new';

  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!isEdit);

  const [form, setForm] = useState({
    supplier_id: '', original_bill_id: '', credit_note_number: '',
    credit_note_date: new Date().toISOString().split('T')[0],
    reason: '', status: 'draft', notes: '', is_applied: false,
    line_items: [{ description: '', quantity: 1, unit_price: 0, vat_rate: '20', amount: 0, vat_amount: 0, line_total: 0, category: 'other' }]
  });

  useEffect(() => {
    if (activeCompany) {
      loadSuppliers();
      if (isEdit) loadCreditNote();
      else suggestNumber();
    }
  }, [activeCompany, id]);

  useEffect(() => {
    if (activeCompany && form.supplier_id) loadBills();
  }, [activeCompany, form.supplier_id]);

  const loadSuppliers = async () => {
    try { setSuppliers(await base44.entities.Supplier.filter({ company_id: activeCompany.id })); }
    catch (e) { console.error(e); }
  };

  const loadBills = async () => {
    try {
      const list = await base44.entities.PurchaseBill.filter({ company_id: activeCompany.id, supplier_id: form.supplier_id });
      setBills(list.filter(b => b.status !== 'cancelled' && b.status !== 'draft'));
    } catch (e) { console.error(e); }
  };

  const suggestNumber = async () => {
    try {
      const list = await base44.entities.SupplierCreditNote.filter({ company_id: activeCompany.id });
      let maxNum = 0;
      list.forEach(cn => {
        const match = cn.credit_note_number?.match(/SCN-(\d+)/i);
        if (match) { const n = parseInt(match[1], 10); if (n > maxNum) maxNum = n; }
      });
      setForm(prev => ({ ...prev, credit_note_number: `SCN-${String(maxNum + 1).padStart(4, '0')}` }));
    } catch (e) { console.error(e); }
  };

  const loadCreditNote = async () => {
    try {
      const cn = await base44.entities.SupplierCreditNote.get(id);
      setForm({
        supplier_id: cn.supplier_id || '', original_bill_id: cn.original_bill_id || '',
        credit_note_number: cn.credit_note_number || '', credit_note_date: cn.credit_note_date || '',
        reason: cn.reason || '', status: cn.status || 'draft', notes: cn.notes || '', is_applied: cn.is_applied || false,
        line_items: cn.line_items?.length ? cn.line_items : [{ description: '', quantity: 1, unit_price: 0, vat_rate: '20', amount: 0, vat_amount: 0, line_total: 0, category: 'other' }]
      });
      if (cn.supplier_id) {
        const list = await base44.entities.PurchaseBill.filter({ company_id: activeCompany.id, supplier_id: cn.supplier_id });
        setBills(list.filter(b => b.status !== 'cancelled' && b.status !== 'draft'));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const subtotal = form.line_items.reduce((s, l) => s + (l.amount || 0), 0);
  const vatTotal = form.line_items.reduce((s, l) => s + (l.vat_amount || 0), 0);
  const total = subtotal + vatTotal;

  const handleSave = async () => {
    if (!form.supplier_id || !form.credit_note_number) {
      toast({ title: 'Please fill in supplier and credit note number', variant: 'destructive' });
      return;
    }
    const existing = await base44.entities.SupplierCreditNote.filter({ company_id: activeCompany.id, supplier_id: form.supplier_id, credit_note_number: form.credit_note_number });
    if (existing.find(cn => cn.id !== id)) {
      toast({ title: 'This credit note number already exists for this supplier.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    const bill = bills.find(b => b.id === form.original_bill_id);
    const shouldApply = form.status === 'applied' && form.original_bill_id;
    const wasApplied = form.is_applied || false;
    const data = {
      ...form, company_id: activeCompany.id,
      supplier_name: supplier?.name || '',
      original_bill_number: bill?.bill_number || '',
      subtotal, vat_total: vatTotal, total,
      is_applied: shouldApply
    };
    try {
      let savedId;
      if (isEdit) { await base44.entities.SupplierCreditNote.update(id, data); savedId = id; }
      else { const created = await base44.entities.SupplierCreditNote.create(data); savedId = created.id; }
      // Apply or reverse credit note on original bill
      if (shouldApply && !wasApplied && form.original_bill_id) {
        await base44.functions.invoke('updatePaymentStatus', {
          entity_type: 'purchase_bill', record_id: form.original_bill_id, amount_paid_delta: total
        });
      } else if (!shouldApply && wasApplied && form.original_bill_id) {
        await base44.functions.invoke('updatePaymentStatus', {
          entity_type: 'purchase_bill', record_id: form.original_bill_id, amount_paid_delta: -total
        });
      }
      toast({ title: isEdit ? 'Credit note updated' : 'Credit note created' });
      navigate('/supplier-credit-notes');
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/supplier-credit-notes')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? 'Edit Credit Note' : 'New Supplier Credit Note'}</h1>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm({...form, supplier_id: v, original_bill_id: ''})}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Original Bill</Label>
              <Select value={form.original_bill_id} onValueChange={v => setForm({...form, original_bill_id: v})} disabled={!form.supplier_id}>
                <SelectTrigger><SelectValue placeholder="Select bill" /></SelectTrigger>
                <SelectContent>
                  {bills.map(b => <SelectItem key={b.id} value={b.id}>{b.bill_number} · {gbp.format(b.balance_due || b.total || 0)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit Note Number *</Label>
              <Input value={form.credit_note_number} onChange={e => setForm({...form, credit_note_number: e.target.value})} placeholder="SCN-0001" />
            </div>
            <div>
              <Label>Credit Note Date</Label>
              <Input type="date" value={form.credit_note_date} onChange={e => setForm({...form, credit_note_date: e.target.value})} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="awaiting_review">Awaiting Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Returned goods, overcharge, etc." />
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
              <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total Credit</span><span>{gbp.format(total)}</span></div>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/supplier-credit-notes')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Credit Note'}</Button>
      </div>
    </div>
  );
}