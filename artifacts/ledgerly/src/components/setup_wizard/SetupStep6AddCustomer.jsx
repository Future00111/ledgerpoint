import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function SetupStep6AddCustomer({ companyId, data, onUpdate }) {
  const [formData, setFormData] = useState(data || {
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Customer name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const customer = await base44.entities.Customer.create({
        company_id: companyId,
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address_line_1: formData.address || undefined,
        status: 'active',
      });
      onUpdate(customer);
      toast({ title: 'Customer added successfully' });
    } catch (e) {
      toast({ title: 'Error adding customer', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Add your first customer. You can add more customers later.</p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Customer Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g., John Smith"
            value={formData.name}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            placeholder="+44 (0)20 1234 5678"
            value={formData.phone}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            name="address"
            placeholder="123 High Street, London"
            value={formData.address}
            onChange={handleChange}
            className="mt-2"
          />
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end gap-3">
        <Button variant="outline" onClick={() => onUpdate(null)}>Skip</Button>
        <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
          {saving ? 'Adding...' : 'Add Customer & Continue'}
        </Button>
      </div>
    </div>
  );
}