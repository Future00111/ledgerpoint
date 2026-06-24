import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, Plus, Lock, ArrowLeft } from 'lucide-react';
import moment from 'moment';
import VATReturnForm from '@/components/vat_returns/VATReturnForm';
import { calculateVATReturn } from '@/lib/vatCalculation';
import { useToast } from '@/components/ui/use-toast';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  ready_for_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  submitted: 'bg-emerald-100 text-emerald-700',
};

const STATUS_LABELS = {
  draft: 'Draft',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
  submitted: 'Submitted',
};

export default function VATReturns() {
  const { activeCompany } = useCompany();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (activeCompany) loadReturns(); }, [activeCompany]);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.VATReturn.filter({ company_id: activeCompany.id }, '-period_start', 50);
      setReturns(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (form) => {
    setCreating(true);
    try {
      const calc = await calculateVATReturn(activeCompany.id, form.period_start, form.period_end);
      const data = {
        company_id: activeCompany.id,
        period_start: form.period_start,
        period_end: form.period_end,
        vat_scheme: form.vat_scheme,
        status: 'draft',
        locked: false,
        ...calc,
      };
      const created = await base44.entities.VATReturn.create(data);
      toast({ title: 'VAT return created' });
      setFormOpen(false);
      navigate(`/vat/${created.id}`);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setCreating(false); }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">VAT Returns</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage UK VAT returns</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Create VAT Return</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : returns.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Calculator className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No VAT returns yet</p>
            <Button onClick={() => setFormOpen(true)} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" />Create your first VAT return</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {returns.map(r => (
            <Card key={r.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/vat/${r.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{moment(r.period_start).format('DD MMM YYYY')} — {moment(r.period_end).format('DD MMM YYYY')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[r.status] || ''}`}>{STATUS_LABELS[r.status]}</Badge>
                      {r.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground capitalize">{r.vat_scheme?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{r.box5_net_vat >= 0 ? 'VAT to pay' : 'VAT to reclaim'}</p>
                  <p className={`text-lg font-bold ${r.box5_net_vat >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(r.box5_net_vat || 0))}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VATReturnForm open={formOpen} onOpenChange={setFormOpen} companyScheme={activeCompany?.vat_scheme} onCreate={handleCreate} creating={creating} />
    </div>
  );
}