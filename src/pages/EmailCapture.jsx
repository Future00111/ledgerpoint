import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scan, Loader2, FileText, Receipt, Undo2, FolderOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import EmailAccountManager from '@/components/email_capture/EmailAccountManager';
import EmailRuleManager from '@/components/email_capture/EmailRuleManager';
import CaptureLog from '@/components/email_capture/CaptureLog';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const TYPE_ICONS = {
  purchase_invoice: Receipt,
  sales_invoice: FileText,
  receipt: Receipt,
  credit_note: Undo2,
};

const TYPE_LABELS = {
  purchase_invoice: 'Purchase Invoice',
  sales_invoice: 'Sales Invoice',
  receipt: 'Receipt',
  credit_note: 'Credit Note',
};

const STATUS_STYLES = {
  pending_extraction: 'bg-muted text-muted-foreground',
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = {
  pending_extraction: 'Pending Extraction',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function EmailCapture() {
  const { activeCompany } = useCompany();
  const [tab, setTab] = useState('accounts');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [capturedDocs, setCapturedDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [logRefresh, setLogRefresh] = useState(0);
  const { toast } = useToast();

  const loadCapturedDocs = async () => {
    if (!activeCompany) return;
    setDocsLoading(true);
    try {
      const docs = await base44.entities.Document.filter({ company_id: activeCompany.id }, '-upload_date', 200);
      setCapturedDocs(docs.filter(d => d.notes && d.notes.toLowerCase().includes('capture')));
    } catch (e) { console.error(e); }
    finally { setDocsLoading(false); }
  };

  useEffect(() => { if (activeCompany) loadCapturedDocs(); }, [activeCompany]);

  const handleScan = async () => {
    if (!activeCompany) return;
    setScanning(true);
    try {
      const res = await base44.functions.invoke('mockScanEmails', { company_id: activeCompany.id });
      setScanResult(res.data);
      toast({ title: `Scan complete: ${res.data.documents_found} document(s) found` });
      setLogRefresh(k => k + 1);
      loadCapturedDocs();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Scan failed', description: msg, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  const tabs = [
    { value: 'accounts', label: 'Email Accounts' },
    { value: 'rules', label: 'Rules' },
    { value: 'log', label: 'Capture Log' },
    { value: 'captured', label: 'Captured Documents' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Invoice Capture</h1>
          <p className="text-muted-foreground text-sm mt-1">Add email accounts, create rules, and scan for invoices and receipts.</p>
        </div>
        <Button onClick={handleScan} disabled={scanning} className="gap-2">
          {scanning ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning...</> : <><Scan className="w-4 h-4" />Scan All</>}
        </Button>
      </div>

      {scanResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-semibold">{scanResult.accounts_scanned}</p><p className="text-xs text-muted-foreground">Accounts Scanned</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-semibold">{scanResult.emails_scanned}</p><p className="text-xs text-muted-foreground">Emails Scanned</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-semibold text-emerald-600">{scanResult.documents_found}</p><p className="text-xs text-muted-foreground">Documents Found</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-2xl font-semibold">{scanResult.emails_ignored}</p><p className="text-xs text-muted-foreground">Emails Ignored</p></CardContent></Card>
        </div>
      )}

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && <EmailAccountManager companyId={activeCompany.id} />}
      {tab === 'rules' && <EmailRuleManager companyId={activeCompany.id} />}
      {tab === 'log' && <CaptureLog companyId={activeCompany.id} refreshKey={logRefresh} />}
      {tab === 'captured' && (
        <div className="space-y-3">
          {docsLoading ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
          ) : capturedDocs.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center py-12">
                <FolderOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No documents captured yet</p>
                <p className="text-xs text-muted-foreground mt-1">Run a scan to capture documents from your email accounts</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {capturedDocs.map(doc => {
                const Icon = TYPE_ICONS[doc.document_type] || FileText;
                return (
                  <Card key={doc.id} className="border-0 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{doc.name}</p>
                            <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[doc.status]}`}>{STATUS_LABELS[doc.status]}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {TYPE_LABELS[doc.document_type] || 'Other'}
                            {doc.supplier_or_customer ? ` · ${doc.supplier_or_customer}` : ''}
                            {doc.reference_number ? ` · ${doc.reference_number}` : ''}
                            {doc.document_date ? ` · ${moment(doc.document_date).format('DD MMM YYYY')}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(doc.gross_amount)}</p>
                        <Link to="/documents"><ArrowRight className="w-4 h-4 text-muted-foreground" /></Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {capturedDocs.length > 0 && (
            <Link to="/documents" className="flex items-center gap-1 text-sm text-primary hover:underline justify-center">
              View all in Documents <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}