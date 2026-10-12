import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function SetupStep1Company({ data, onUpdate, onNext }) {
  const [formData, setFormData] = useState(data || {
    name: '',
    registrationNumber: '',
    postcode: '',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const company = await base44.entities.Company.create({
        name: formData.name,
        registration_number: formData.registrationNumber || undefined,
        postcode: formData.postcode || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
      });
      onUpdate(company);
      toast({ title: 'Company created successfully' });
      onNext?.();
    } catch (e) {
      toast({ title: 'Error creating company', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Company Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g., ABC Garage Ltd"
            value={formData.name}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="registrationNumber">Companies House Number</Label>
          <Input
            id="registrationNumber"
            name="registrationNumber"
            placeholder="e.g., 12345678"
            value={formData.registrationNumber}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="postcode">Postcode</Label>
          <Input
            id="postcode"
            name="postcode"
            placeholder="e.g., SW1A 1AA"
            value={formData.postcode}
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="hello@example.com"
            value={formData.email}
            onChange={handleChange}
            className="mt-2"
          />
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Creating...' : 'Create Company & Continue'}
        </Button>
      </div>
    </div>
  );
}