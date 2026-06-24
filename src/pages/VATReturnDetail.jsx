import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calculator, Lock, CheckCircle2, Send, RefreshCw, Eye } from 'lucide-react';
import moment from 'moment';
import VATReturnBreakdown from '@/components/vat_returns/VATReturnBreakdown';
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

export default function VATReturnDetail() {
  const { id } = useParams();
  const { activeCompany } = useCompany();
  const [vatReturn, setVatReturn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (id) loadReturn(); }, [id]);

  const loadReturn = async () => {
    setLoading(true);
    try {
      const r = await base44.entities.VATReturn.get(id);
      setVatReturn(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const recalculate = async () => {
    setActionLoading(true);
    try {
      const calc = await calculateVATReturn(vatReturn.company_id, vatReturn.period_start, vatReturn.period_end);
      const updated = await base44.entities.VATReturn.update(id, calc);
      setVatReturn(updated);
      toast({ title: 'VAT return recalculated' });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const markReady = async () => {
    setActionLoading(true);
    try {
      const updated = await base44.entities.VATReturn.update(id, { status: 'ready_for_review' });
      setVatReturn(updated);
      toast({ title: 'Marked as Ready for Review' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const approve = async () => {
    setActionLoading(true);
    try {
      const updated = await base44.entities.VATReturn.update(id, { status: 'approved' });
      setVatReturn(updated);
      toast({ title: 'VAT return approved' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const lock = async () => {
    setActionLoading(true);
    try {
      const updated = await base44.entities.VATReturn.update(id, { locked: true });
      setVatReturn(updated);
      toast({ title: 'VAT return locked' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const submit = async () => {
    setActionLoading(true);
    try {
      const updated = await base44.entities.VATReturn.update(id, { status: 'submitted', locked: true, submission_date: new Date().toISOString().split('T')[0] });
      setVatReturn(updated);
      toast({ title: 'VAT return submitted to HMRC' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!vatReturn) return <p className="text-muted-foreground text-center py-12">VAT return not found.</p>;

  const isLocked = vatReturn.locked || vatReturn.status === 'submitted';
  const boxes = [
    { box: 1, label: 'VAT due on sales and other outputs', value: vatReturn.box1_output_vat },
    { box: 2, label: 'VAT due on acquisitions from other EC Member States', value: vatReturn.box2_acquisitions },
    { box: 3, label: 'Total VAT due (sum of boxes 1 and 2)', value: vatReturn.box3_total_vat_due, bold: true },
    { box: 4, label: 'VAT reclaimed on purchases and other inputs', value: vatReturn.box4_vat_reclaimed },
    { box: 5, label: 'Net VAT to be paid to HMRC or reclaimed', value: vatReturn.box5_net_vat, bold: true, highlight: true },
    { box: 6, label: 'Total value of sales excluding VAT', value: vatReturn.box6_total_sales },
    { box: 7, label: 'Total value of purchases excluding VAT', value: vatReturn.box7_total_purchases },
    { box: 8, label: 'Total value of supplies to other EC Member States', value: vatReturn.box8_total_acquisitions },
    { box: 9, label: 'Total value of acquisitions from other EC Member States', value: vatReturn.box9_total_supplies },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vat')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">VAT Return</h1>
          <p className="text-muted-foreground text-sm mt-1">{moment(vatReturn.period_start).format('DD MMM YYYY')} — {moment(vatReturn.period_end).format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={STATUS_STYLES[vatReturn.status]}>{STATUS_LABELS[vatReturn.status]}</Badge>
        <Badge variant="outline" className="capitalize">{vatReturn.vat_scheme?.replace(/_/g, ' ')}</Badge>
        {vatReturn.locked && <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Locked</Badge>}
        {vatReturn.submission_date && <span className="text-xs text-muted-foreground">Submitted: {moment(vatReturn.submission_date).format('DD MMM YYYY')}</span>}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isLocked && vatReturn.status === 'draft' && (
          <Button variant="outline" onClick={recalculate} disabled={actionLoading} className="gap-2"><RefreshCw className="w-4 h-4" />Recalculate</Button>
        )}
        {!isLocked && vatReturn.status === 'ready_for_review' && (
          <Button variant="outline" onClick={recalculate} disabled={actionLoading} className="gap-2"><RefreshCw className="w-4 h-4" />Recalculate</Button>
        )}
        {!isLocked && vatReturn.status === 'draft' && (
          <Button variant="outline" onClick={markReady} disabled={actionLoading} className="gap-2"><Eye className="w-4 h-4" />Mark as Ready</Button>
        )}
        {!isLocked && (vatReturn.status === 'draft' || vatReturn.status === 'ready_for_review') && (
          <Button onClick={approve} disabled={actionLoading} className="gap-2"><CheckCircle2 className="w-4 h-4" />Approve</Button>
        )}
        {vatReturn.status === 'approved' && !vatReturn.locked && (
          <Button onClick={lock} disabled={actionLoading} className="gap-2"><Lock className="w-4 h-4" />Lock</Button>
        )}
        {vatReturn.status === 'approved' && vatReturn.locked && (
          <Button onClick={submit} disabled={actionLoading} className="gap-2"><Send className="w-4 h-4" />Submit to HMRC</Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Output VAT (Box 1)</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(vatReturn.box1_output_vat)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Input VAT (Box 4)</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(vatReturn.box4_vat_reclaimed)}</p>
          </CardContent>
        </Card>
        <Card className={`border-0 shadow-sm ${vatReturn.box5_net_vat >= 0 ? 'ring-2 ring-blue-100' : 'ring-2 ring-emerald-100'}`}>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">{vatReturn.box5_net_vat >= 0 ? 'VAT to Pay HMRC' : 'VAT Refund Due'}</p>
            <p className={`text-2xl font-bold mt-1 ${vatReturn.box5_net_vat >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(vatReturn.box5_net_vat))}</p>
          </CardContent>
        </Card>
      </div>

      {/* VAT Boxes */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">VAT Return Summary</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {boxes.map(row => (
              <div key={row.box} className={`flex items-center justify-between px-6 py-3.5 ${row.highlight ? 'bg-primary/5' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 bg-muted rounded flex items-center justify-center text-xs font-semibold flex-shrink-0">{row.box}</span>
                  <span className={`text-sm ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</span>
                </div>
                <span className={`text-sm flex-shrink-0 ml-3 ${row.bold ? 'font-bold text-base' : 'font-medium'} ${row.highlight && row.value > 0 ? 'text-blue-600' : ''} ${row.highlight && row.value < 0 ? 'text-emerald-600' : ''}`}>
                  {formatCurrency(Math.abs(row.value))}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <VATReturnBreakdown breakdown={vatReturn.breakdown} />
    </div>
  );
}