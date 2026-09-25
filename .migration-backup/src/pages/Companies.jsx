import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import CompanyForm from '@/components/companies/CompanyForm';
import CompanyDetails from '@/components/companies/CompanyDetails';

const BUSINESS_LABELS = {
  garage: 'Garage', retail: 'Retail', wholesale: 'Wholesale',
  manufacturing: 'Manufacturing', construction: 'Construction',
  professional_services: 'Professional Services', hospitality: 'Hospitality',
  transport: 'Transport', it_services: 'IT Services', consultancy: 'Consultancy', other: 'Other',
};

export default function Companies() {
  const { companies, loadCompanies, switchCompany, activeCompany } = useCompany();
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const { toast } = useToast();

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setFormOpen(true); };
  const openView = (c) => { setViewing(c); setDetailsOpen(true); };

  const handleDelete = async (c) => {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try {
      await base44.entities.Company.delete(c.id);
      toast({ title: 'Company deleted' });
      await loadCompanies();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your business profiles</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Company
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">No companies yet. Create your first one to get started.</p>
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add Company</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {companies.map(c => (
            <Card
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${c.name} company`}
              onClick={() => openView(c)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openView(c); } }}
              className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeCompany?.id === c.id ? 'ring-2 ring-primary/20' : ''}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{c.name}</h3>
                      {activeCompany?.id === c.id && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Active</span>
                      )}
                      {c.business_type && (
                        <Badge variant="outline" className="text-xs">{BUSINESS_LABELS[c.business_type] || c.business_type}</Badge>
                      )}
                      {c.vat_registered ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">VAT Registered</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not VAT Registered</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {c.registration_number && <p>Company No: {c.registration_number}</p>}
                      {c.vat_number && <p>VAT: {c.vat_number}</p>}
                      {c.city && <p>{[c.address_line_1, c.city, c.postcode].filter(Boolean).join(', ')}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                    {activeCompany?.id !== c.id && (
                      <Button variant="outline" size="sm" onClick={() => switchCompany(c)}>Switch to</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openView(c)} title="View"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompanyForm open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={loadCompanies} />
      <CompanyDetails company={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}