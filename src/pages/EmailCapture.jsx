import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Scan, FileText, Receipt, Undo2, CheckCircle, AlertCircle, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const PROVIDERS = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Scan your Gmail inbox for invoice, receipt, and credit note attachments.',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Scan your Outlook inbox for invoice, receipt, and credit note attachments.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
];

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

export default function EmailCapture() {
  const { activeCompany } = useCompany();
  const [scanning, setScanning] = useState(null);
  const [results, setResults] = useState({});
  const { toast } = useToast();

  const handleScan = async (provider) => {
    if (!activeCompany) {
      toast({ title: 'Please select a company first', variant: 'destructive' });
      return;
    }
    setScanning(provider);
    try {
      const res = await base44.functions.invoke('scanEmailsForInvoices', {
        provider,
        company_id: activeCompany.id,
      });
      setResults(prev => ({ ...prev, [provider]: res.data }));
      if (res.data.found > 0) {
        toast({ title: `Found ${res.data.found} document(s) from ${provider === 'gmail' ? 'Gmail' : 'Outlook'}` });
      } else {
        toast({ title: `No invoices or receipts found in ${provider === 'gmail' ? 'Gmail' : 'Outlook'}` });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Scan failed', description: msg, variant: 'destructive' });
      setResults(prev => ({ ...prev, [provider]: { error: msg } }));
    } finally {
      setScanning(null);
    }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Invoice Capture</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your email account and automatically find invoices, receipts, and credit notes.
          Documents are created as pending extraction and appear in the Documents page for your review.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map(provider => {
          const isScanning = scanning === provider.id;
          const result = results[provider.id];
          return (
            <Card key={provider.id} className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${provider.bg} rounded-lg flex items-center justify-center`}>
                    <Mail className={`w-5 h-5 ${provider.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                    <CardDescription className="text-xs">{provider.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => handleScan(provider.id)}
                  disabled={isScanning}
                  className="w-full gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Scan className="w-4 h-4" />
                      Scan Emails
                    </>
                  )}
                </Button>

                {result && !result.error && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted rounded-lg p-2">
                        <p className="text-lg font-semibold">{result.scanned}</p>
                        <p className="text-xs text-muted-foreground">Scanned</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-2">
                        <p className="text-lg font-semibold text-emerald-700">{result.found}</p>
                        <p className="text-xs text-muted-foreground">Found</p>
                      </div>
                      <div className="bg-muted rounded-lg p-2">
                        <p className="text-lg font-semibold">{result.ignored}</p>
                        <p className="text-xs text-muted-foreground">Ignored</p>
                      </div>
                    </div>

                    {result.documents?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Captured Documents:</p>
                        {result.documents.map((doc, i) => {
                          const DocIcon = TYPE_ICONS[doc.type] || FileText;
                          return (
                            <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                              <DocIcon className="w-4 h-4 text-primary flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">{TYPE_LABELS[doc.type]} · {doc.sender}</p>
                              </div>
                              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            </div>
                          );
                        })}
                        <Link to="/documents" className="flex items-center gap-1 text-sm text-primary hover:underline">
                          View in Documents <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}

                    {result.errors?.length > 0 && (
                      <div className="space-y-1">
                        {result.errors.slice(0, 3).map((err, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-amber-600">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <p>{err}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {result?.error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Scan failed</p>
                      <p className="text-xs text-red-600">{result.error}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-0 shadow-sm bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">How it works</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                <li>• Scans your email inbox for messages with attachments from the last 30 days</li>
                <li>• AI identifies invoices, receipts, and credit notes — newsletters and personal emails are ignored</li>
                <li>• PDF and image attachments are saved as documents with "Pending Extraction" status</li>
                <li>• AI extraction runs automatically — review extracted data in the Documents page</li>
                <li>• Your emails are never deleted or modified</li>
                <li>• User approval is required before creating bills, invoices, or credit notes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}