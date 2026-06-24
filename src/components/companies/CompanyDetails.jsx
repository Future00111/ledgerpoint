import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, MapPin, FileText, Calendar, PoundSterling } from 'lucide-react';

const BUSINESS_LABELS = {
  garage: 'Garage / Motor Trade', retail: 'Retail', wholesale: 'Wholesale',
  manufacturing: 'Manufacturing', construction: 'Construction',
  professional_services: 'Professional Services', hospitality: 'Hospitality',
  transport: 'Transport', it_services: 'IT Services', consultancy: 'Consultancy', other: 'Other',
};

const SCHEME_LABELS = { standard: 'Standard', cash_accounting: 'Cash Accounting', flat_rate: 'Flat Rate' };
const FREQ_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

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

export default function CompanyDetails({ company, open, onOpenChange }) {
  if (!company) return null;
  const address = [company.address_line_1, company.address_line_2, company.city, company.county, company.postcode].filter(Boolean).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Company Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{company.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {company.vat_registered ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">VAT Registered</Badge>
                ) : (
                  <Badge variant="secondary">Not VAT Registered</Badge>
                )}
                {company.business_type && (
                  <Badge variant="outline">{BUSINESS_LABELS[company.business_type] || company.business_type}</Badge>
                )}
              </div>
            </div>
          </div>

          <Field icon={FileText} label="Company Number" value={company.registration_number} />
          <Field icon={PoundSterling} label="VAT Number" value={company.vat_number} />
          <Field icon={FileText} label="VAT Scheme" value={SCHEME_LABELS[company.vat_scheme]} />
          <Field icon={Calendar} label="VAT Frequency" value={FREQ_LABELS[company.vat_frequency]} />
          <Field icon={Calendar} label="Financial Year End" value={company.financial_year_end} />
          <Field icon={MapPin} label="Address" value={address} />
          <Field icon={Phone} label="Phone" value={company.phone} />
          <Field icon={Mail} label="Email" value={company.email} />
        </div>
      </DialogContent>
    </Dialog>
  );
}