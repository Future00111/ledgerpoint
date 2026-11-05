import VatWorkingsPanel from '@/components/accounting/VatWorkingsPanel';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as nativeEntities from '@/api/entities';
import { useCompany } from '@/lib/useCompany';
import PageHeader from '@/components/workspace/PageHeader';
import { ErrorBox } from '@/components/accounting/AccountingUI';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, Plus, Lock, ShieldCheck, AlertTriangle, TrendingUp, RefreshCw, Settings2 } from 'lucide-react';
import moment from 'moment';
import VATReturnForm from '@/components/vat_returns/VATReturnForm';
import { useToast } from '@/components/ui/use-toast';
import { aiApi } from '@/components/ai-accountant/api';
import VATAssistantSettingsDialog from '@/components/vat_returns/VATAssistantSettingsDialog';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground',
  ready_for_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  submitted: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS = {
  draft: 'Draft',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
  submitted: 'Historical submitted status (unverified)',
};

function CompanyVATReturns({ activeCompany }) {
  const [returns, setReturns] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const alive = useRef(false), loadVersion = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; loadVersion.current++; }; }, []);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [overview, setOverview] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (activeCompany) loadReturns(); }, [activeCompany]);

  const loadReturns = async () => {
    const version = ++loadVersion.current;
    setLoading(true); setLoadError(null);
    try {
      const [list, vatOverview] = await Promise.all([
        nativeEntities.VATReturn.filter({ company_id: activeCompany.id }, '-period_start', 50),
        aiApi.vatOverview(activeCompany.id),
      ]);
      if (!alive.current || version !== loadVersion.current) return;
      setReturns(list);
      setOverview(vatOverview);
    } catch (e) { if (alive.current && version === loadVersion.current) { setReturns([]); setOverview(null); setLoadError(new Error('Historical VAT records could not be loaded. Please retry.')); } }
    finally { if (alive.current && version === loadVersion.current) setLoading(false); }
  };

  const handleCreate = async (form) => {
    setCreating(true);
    try {
      const result = await aiApi.createVatReturn(activeCompany.id, form.period_start, form.period_end);
      if (!alive.current) return;
      const created = result.vat_return;
      toast({ title: 'Legacy VAT record created' });
      setFormOpen(false);
      navigate(`/vat/${created.id}`);
    } catch (e) { if (alive.current) toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setCreating(false); }
  };

  const refreshReview = async () => {
    setRefreshing(true);
    try {
      const result = await aiApi.refreshVatReview(activeCompany.id, overview?.period?.start, overview?.period?.end);
      if (!alive.current) return;
      setOverview(result);
      toast({ title: 'VAT review refreshed', description: 'No accounting records were changed.' });
    } catch (e) {
      if (alive.current) toast({ title: 'Could not refresh VAT review', description: e.message, variant: 'destructive' });
    } finally { setRefreshing(false); }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="workspace-page">
      <PageHeader eyebrow="Tax preparation" title="VAT preparation" description="Review posted figures and trace them back to your documents." context={<span className="font-medium">{activeCompany.name}</span>} actions={<Button asChild variant="outline"><Link to="/reports">All reports</Link></Button>} />
      <VatWorkingsPanel />
      <details className="rounded-2xl border bg-card p-4 sm:p-5" data-testid="section-historical-vat">
      <summary className="cursor-pointer font-semibold">Historical VAT returns and settings <span className="ml-2 text-xs font-normal text-muted-foreground">Legacy records · expand to view</span></summary>
      <div className="mt-4 space-y-6">
      <div role="note" data-testid="text-legacy-vat-warning" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span className="font-semibold">These historical VAT figures are incomplete.</span> They predate posted journals and may omit or misstate figures. Their statuses are not verified HMRC submission receipts. Use the posted workings above for current review.</div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Historical VAT records</h2>
          <p className="text-muted-foreground text-sm mt-1">Legacy controls remain available. They do not use the posted workings above.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)} className="gap-2"><Settings2 className="w-4 h-4" />VAT settings</Button>
          <Button variant="outline" onClick={refreshReview} disabled={refreshing} className="gap-2"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh legacy review</Button>
          <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Create legacy VAT record</Button>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="border-blue-100 bg-blue-50/40"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Legacy VAT estimate</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(Math.abs(overview.boxes?.[5] || 0))}</p>
            <p className="text-xs text-muted-foreground">{overview.boxes?.[5] >= 0 ? 'Estimated amount to pay' : 'Estimated amount to reclaim'}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex gap-1 items-center"><ShieldCheck className="w-3.5 h-3.5" />VAT health</p>
            <p className="text-xl font-bold mt-1">{overview.health?.score ?? 0}/100</p>
            <p className="text-xs text-muted-foreground capitalize">{overview.health?.band?.replace('_', ' ')}</p>
          </CardContent></Card>
          <Card className={overview.health?.high_risk_count ? 'border-amber-200 bg-amber-50/30' : ''}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex gap-1 items-center"><AlertTriangle className="w-3.5 h-3.5" />Review items</p>
            <p className="text-xl font-bold mt-1">{overview.health?.open_exception_count ?? 0}</p>
            <p className="text-xs text-muted-foreground">{overview.health?.high_risk_count ?? 0} high risk</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex gap-1 items-center"><TrendingUp className="w-3.5 h-3.5" />Registration monitor</p>
            <p className="text-xl font-bold mt-1">{overview.registration_monitor?.percentage_of_threshold ?? 0}%</p>
            <p className="text-xs text-muted-foreground capitalize">{overview.registration_monitor?.status?.replace('_', ' ')}</p>
          </CardContent></Card>
        </div>
      )}

      <ErrorBox error={loadError} onRetry={loadReturns} />
      {loadError ? null : loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : returns.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Calculator className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No VAT returns yet</p>
            <Button onClick={() => setFormOpen(true)} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" />Create legacy VAT record</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {returns.map(r => (
            <Link key={r.id} to={`/vat/${r.id}`} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Card className="border shadow-sm hover:border-primary/40 transition-colors">
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
                  <p className="text-xs text-muted-foreground">{Number(r.box5_net_vat_due) >= 0 ? 'VAT to pay' : 'VAT to reclaim'}</p>
                  <p className={`text-lg font-bold ${Number(r.box5_net_vat_due) >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(Number(r.box5_net_vat_due) || 0))}</p>
                </div>
              </CardContent>
            </Card></Link>
          ))}
        </div>
      )}

      </div>
      </details>
      <VATReturnForm open={formOpen} onOpenChange={setFormOpen} companyScheme={overview?.settings?.scheme || activeCompany?.vat_scheme} onCreate={handleCreate} creating={creating} />
      <VATAssistantSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} companyId={activeCompany.id} settings={overview?.settings} taxRules={overview?.tax_rules} onSaved={async () => { await loadReturns(); setSettingsOpen(false); toast({ title: 'VAT settings saved' }); }} />
    </div>
  );
}

export default function VATReturns() {
  const { activeCompany } = useCompany();
  return activeCompany ? <CompanyVATReturns key={activeCompany.id} activeCompany={activeCompany} />
    : <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;
}
