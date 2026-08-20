import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Lock, CheckCircle2, RefreshCw, Eye, ChevronRight, AlertTriangle, MessageSquare } from 'lucide-react';
import moment from 'moment';
import VATReturnBreakdown from '@/components/vat_returns/VATReturnBreakdown';
import VATBoxDrillDown from '@/components/vat_returns/VATBoxDrillDown';
import { useToast } from '@/components/ui/use-toast';
import { aiApi } from '@/components/ai-accountant/api';

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
  const [drillDownBox, setDrillDownBox] = useState(null);
  const [overview, setOverview] = useState(null);
  const [audits, setAudits] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (id && activeCompany?.id) loadReturn(); }, [id, activeCompany?.id]);

  const loadReturn = async () => {
    setLoading(true);
    try {
      const result = await aiApi.vatReturn(activeCompany.id, id);
      setVatReturn(result.vat_return);
      setOverview(result.overview);
      setAudits(result.audits || []);
      setExceptions(result.exceptions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const recalculate = async () => {
    setActionLoading(true);
    try {
      const result = await aiApi.recalculateVatReturn(activeCompany.id, id);
      setVatReturn(result.vat_return);
      setOverview(result.overview);
      toast({ title: 'VAT return recalculated' });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const markReady = async () => {
    setActionLoading(true);
    try {
      const result = await aiApi.markVatReturnReady(activeCompany.id, id);
      setVatReturn(result.vat_return);
      toast({ title: 'Marked as Ready for Review' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const approve = async () => {
    setActionLoading(true);
    try {
      const result = await aiApi.approveVatReturn(activeCompany.id, id);
      setVatReturn(result.vat_return);
      await loadReturn();
      toast({ title: 'VAT return approved and locked', description: 'Ledgerly has not submitted anything to HMRC.' });
    } catch (e) { toast({ title: 'Could not approve VAT return', description: e.message, variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const askVAT = async () => {
    if (!question.trim()) return;
    try {
      setAnswer(await aiApi.explainVat(activeCompany.id, vatReturn.period_start, vatReturn.period_end, question));
    } catch (e) { toast({ title: 'Could not explain VAT position', description: e.message, variant: 'destructive' }); }
  };

  const createRevision = async () => {
    setActionLoading(true);
    try {
      const result = await aiApi.createVatRevision(activeCompany.id, id);
      toast({ title: 'VAT return revision created', description: 'The locked return is unchanged; review the revision separately.' });
      navigate(`/vat/${result.vat_return.id}`);
    } catch (e) { toast({ title: 'Could not create VAT revision', description: e.message, variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const resolveException = async (exception) => {
    const note = window.prompt(`Record why "${exception.title}" has been reviewed. This does not change accounting data.`);
    if (!note?.trim()) return;
    setResolvingId(exception.id);
    try {
      await aiApi.resolveVatException(activeCompany.id, exception.id, note.trim());
      await loadReturn();
      toast({ title: 'VAT review decision recorded' });
    } catch (e) { toast({ title: 'Could not record review decision', description: e.message, variant: 'destructive' }); }
    finally { setResolvingId(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!vatReturn) return <p className="text-muted-foreground text-center py-12">VAT return not found.</p>;

  const isLocked = vatReturn.locked || vatReturn.status === 'submitted';
  const boxes = [
    { box: 1, label: 'VAT due on sales and other outputs', value: vatReturn.box1_output_vat },
    { box: 2, label: 'VAT due on acquisitions from other EC Member States', value: vatReturn.box2_acquisitions_vat },
    { box: 3, label: 'Total VAT due (sum of boxes 1 and 2)', value: vatReturn.box3_total_vat_due, bold: true },
    { box: 4, label: 'VAT reclaimed on purchases and other inputs', value: vatReturn.box4_input_vat },
    { box: 5, label: 'Net VAT to be paid to HMRC or reclaimed', value: vatReturn.box5_net_vat_due, bold: true, highlight: true },
    { box: 6, label: 'Total value of sales excluding VAT', value: vatReturn.box6_total_sales },
    { box: 7, label: 'Total value of purchases excluding VAT', value: vatReturn.box7_total_purchases },
    { box: 8, label: 'Total value of supplies to other EC Member States', value: vatReturn.box8_eu_sales },
    { box: 9, label: 'Total value of acquisitions from other EC Member States', value: vatReturn.box9_eu_purchases },
  ];
  const sources = overview?.sources || [];
  const breakdown = {
    sales_invoices: sources.filter(s => s.source_record_type === 'sales_invoice').map(s => ({ ...s, subtotal: s.net, vat_total: s.vat, customer_name: s.counterparty })),
    sales_credit_notes: sources.filter(s => s.source_record_type === 'sales_credit_note').map(s => ({ ...s, subtotal: s.net, vat_total: s.vat, customer_name: s.counterparty })),
    purchase_bills: sources.filter(s => s.source_record_type === 'purchase_bill').map(s => ({ ...s, subtotal: s.net, vat_total: s.vat, supplier_name: s.counterparty })),
    supplier_credit_notes: sources.filter(s => s.source_record_type === 'supplier_credit_note').map(s => ({ ...s, subtotal: s.net, vat_total: s.vat, supplier_name: s.counterparty })),
  };

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
        <Badge variant="outline" className="capitalize">{vatReturn.vat_scheme?.replace(/_/g, ' ') || 'Standard'}</Badge>
        {vatReturn.locked && <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Locked</Badge>}
        {vatReturn.locked && <span className="text-xs text-muted-foreground">Approved returns are locked. Use an explicit adjustment or revision for later changes.</span>}
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
        {isLocked && (
          <Button variant="outline" onClick={createRevision} disabled={actionLoading} className="gap-2"><RefreshCw className="w-4 h-4" />Create revision</Button>
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
            <p className="text-xl font-bold mt-1">{formatCurrency(vatReturn.box4_input_vat)}</p>
          </CardContent>
        </Card>
        <Card className={`border-0 shadow-sm ${vatReturn.box5_net_vat_due >= 0 ? 'ring-2 ring-blue-100' : 'ring-2 ring-emerald-100'}`}>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">{vatReturn.box5_net_vat_due >= 0 ? 'VAT to Pay HMRC' : 'VAT Refund Due'}</p>
            <p className={`text-2xl font-bold mt-1 ${vatReturn.box5_net_vat_due >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(vatReturn.box5_net_vat_due))}</p>
          </CardContent>
        </Card>
      </div>

      {/* VAT Boxes */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">VAT Return Summary</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Click any box to see the underlying documents</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {boxes.map(row => (
              <button key={row.box} onClick={() => setDrillDownBox(row.box)} className={`w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-muted/50 transition-colors group ${row.highlight ? 'bg-primary/5' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 bg-muted rounded flex items-center justify-center text-xs font-semibold flex-shrink-0">{row.box}</span>
                  <span className={`text-sm ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className={`text-sm ${row.bold ? 'font-bold text-base' : 'font-medium'} ${row.highlight && row.value > 0 ? 'text-blue-600' : ''} ${row.highlight && row.value < 0 ? 'text-emerald-600' : ''}`}>
                    {formatCurrency(Math.abs(row.value))}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Box Drill-down */}
      <VATBoxDrillDown boxNumber={drillDownBox} boxValue={boxes.find(b => b.box === drillDownBox)?.value} breakdown={breakdown} open={!!drillDownBox} onOpenChange={(v) => !v && setDrillDownBox(null)} />

      {/* Breakdown */}
      <VATReturnBreakdown breakdown={breakdown} />

      <div className="grid md:grid-cols-2 gap-4">
        <Card className={overview?.health?.high_risk_count ? 'border-amber-200' : ''}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" />VAT review and health</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Health score: <strong>{overview?.health?.score ?? 0}/100</strong> · {overview?.health?.open_exception_count ?? 0} item(s) flagged.</p>
            {exceptions.length === 0 ? <p className="text-muted-foreground">No deterministic exceptions were found in this calculation.</p> :
              exceptions.map(item => <div key={item.id} className="p-2 rounded bg-muted/50"><div className="flex gap-2 justify-between"><strong>{item.title}</strong><Badge variant="outline" className="capitalize">{item.status}</Badge></div><p className="text-xs text-muted-foreground mt-1">{item.detail}</p>{item.status === 'open' && <Button variant="outline" size="sm" className="mt-2" disabled={resolvingId === item.id} onClick={() => resolveException(item)}>{resolvingId === item.id ? 'Recording…' : 'Record review decision'}</Button>}</div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4" />Ask Ledgerly about this VAT period</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea className="w-full min-h-20 rounded-md border p-2 text-sm" value={question} onChange={e => setQuestion(e.target.value)} placeholder="For example: Why is the VAT liability higher this period?" />
            <Button size="sm" onClick={askVAT}>Explain VAT position</Button>
            {answer && <div className="text-sm p-3 rounded-md bg-muted/50"><p>{answer.explanation}</p><p className="mt-2 text-muted-foreground">{answer.recommendation}</p><p className="mt-2 text-xs text-muted-foreground">{answer.scope_note}</p></div>}
          </CardContent>
        </Card>
      </div>

      {audits.length > 0 && <Card><CardHeader><CardTitle className="text-base">VAT audit trail</CardTitle></CardHeader><CardContent className="space-y-2">{audits.map(a => <p key={a.id} className="text-sm"><span className="font-medium">{a.description}</span> <span className="text-muted-foreground text-xs">· {moment(a.created_at).format('DD MMM YYYY HH:mm')}</span></p>)}</CardContent></Card>}
    </div>
  );
}