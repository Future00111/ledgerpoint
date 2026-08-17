import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function SetupStep3VATSetup({ data, onUpdate }) {
  const [formData, setFormData] = useState(data || {
    registered: false,
    scheme: 'standard',
    frequency: 'quarterly',
  });

  const handleRegisteredChange = (value) => {
    const updated = { ...formData, registered: value === 'yes' };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleSchemeChange = (value) => {
    const updated = { ...formData, scheme: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleFrequencyChange = (value) => {
    const updated = { ...formData, frequency: value };
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-8">
      <div>
        <Label className="text-base font-semibold mb-4 block">Are you VAT registered?</Label>
        <RadioGroup value={formData.registered ? 'yes' : 'no'} onValueChange={handleRegisteredChange}>
          <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="yes" id="vat-yes" />
            <Label htmlFor="vat-yes" className="flex-1 cursor-pointer font-normal">Yes, I'm VAT registered</Label>
          </div>
          <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="no" id="vat-no" />
            <Label htmlFor="vat-no" className="flex-1 cursor-pointer font-normal">No, I'm not VAT registered</Label>
          </div>
        </RadioGroup>
      </div>

      {formData.registered && (
        <>
          <div>
            <Label htmlFor="scheme" className="text-base font-semibold mb-2 block">VAT Scheme</Label>
            <Select value={formData.scheme} onValueChange={handleSchemeChange}>
              <SelectTrigger id="scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard VAT</SelectItem>
                <SelectItem value="cash_accounting">Cash Accounting Scheme</SelectItem>
                <SelectItem value="flat_rate">Flat Rate Scheme</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {formData.scheme === 'standard' && 'Report VAT on invoices issued and received.'}
              {formData.scheme === 'cash_accounting' && 'Report VAT based on cash paid and received.'}
              {formData.scheme === 'flat_rate' && 'Pay a fixed percentage of turnover as VAT.'}
            </p>
          </div>

          <div>
            <Label htmlFor="frequency" className="text-base font-semibold mb-2 block">VAT Return Frequency</Label>
            <Select value={formData.frequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {formData.frequency === 'monthly' && 'File VAT returns every month.'}
              {formData.frequency === 'quarterly' && 'File VAT returns every 3 months.'}
              {formData.frequency === 'yearly' && 'File VAT returns once per year.'}
            </p>
          </div>
        </>
      )}

      {!formData.registered && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-900">
            You can register for VAT at any time. You'll need to register if your turnover exceeds the VAT threshold (currently £90,000).
          </p>
        </div>
      )}
    </div>
  );
}