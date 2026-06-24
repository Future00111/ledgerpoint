import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SetupStep7CreateInvoice({ companyId, customerId, data, onUpdate }) {
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState(data || {
    customer_id: customerId || '',
    invoice_number: '',
    amount: '',
    description: 'Professional Services',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCustomers();
  }, [companyId]);

  const loadCustomers = async () => {
    try {
      const list = await base44.entities.Customer.filter({ company_id: companyId, status: 'active' });
      setCustomers(list);
    } catch (e) {
      console.error('Error loading customers:', e);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'amount' ? value : value }));
  };

  const handleSave = async () => {
    if (!formData.customer_id || !formData.invoice_number || !formData.amount) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const amount = parseFloat(formData.amount);
      const customer = customers.find(c => c.id === formData.customer_id);

      const invoice = await base44.entities.SalesInvoice.create({
        company_id: companyId,
        customer_id: formData.customer_id,
        customer_name: customer?.name || '',
        invoice_number: formData.invoice_number,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        line_items: [{
          description: formData.description,
          quantity: 1,
          unit_price: amount,
          vat_rate: '20',
          amount: amount,
          vat_amount: amount * 0.2,
          line_total: amount * 1.2,
        }],
        subtotal: amount,
        vat_total: amount * 0.2,
        total: amount * 1.2,
        status: 'draft',
      });
      onUpdate(invoice);
      toast({ title: 'Invoice created successfully' });
    } catch (e) {
      toast({ title: 'Error creating invoice', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Create your first invoice. You can edit and approve it later.</p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="customer_id">Customer *</Label>
          <Select value={formData.customer_id} onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}>
            <SelectTrigger id="customer_id" className="mt-2">
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="invoice_number">Invoice Number *</Label>
            <Input
              id="invoice_number"
              name="invoice_number"
              placeholder="INV-001"
              value={formData.invoice_number}
              onChange={handleChange}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="amount">Amount (£) *</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              placeholder="500.00"
              value={formData.amount}
              onChange={handleChange}
              className="mt-2"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            placeholder="What are you invoicing for?"
            value={formData.description}
            onChange={handleChange}
            className="mt-2"
          />
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end gap-3">
        <Button variant="outline" onClick={() => onUpdate(null)}>Skip</Button>
        <Button onClick={handleSave} disabled={saving || !formData.customer_id || !formData.invoice_number || !formData.amount}>
          {saving ? 'Creating...' : 'Create Invoice & Continue'}
        </Button>
      </div>
    </div>
  );
}