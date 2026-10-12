import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, X, FileText, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function ConfidenceBadge({ score }) {
  const pct = Math.round((score || 0) * 100);
  let style = 'bg-muted text-muted-foreground';
  if (score >= 0.8) style = 'bg-emerald-100 text-emerald-700';
  else if (score >= 0.5) style = 'bg-amber-100 text-amber-700';
  else if (score > 0) style = 'bg-red-100 text-red-700';
  return <Badge variant="secondary" className={`text-xs ${style}`}>{pct}%</Badge>;
}

export default function ExtractionReview({ open, onOpenChange, document: doc, onApprove, onRejected }) {
  const [form, setForm] = useState({
    supplier_name: '', invoice_number: '', invoice_date: '',
    net_amount: '', vat_amount: '', gross_amount: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (doc?.extraction_data) {
      const ext = doc.extraction_data;
      setForm({
        supplier_name: ext.supplier_name?.value || '',
        invoice_number: ext.invoice_number?.value || '',
        invoice_date: ext.invoice_date?.value || '',
        net_amount: ext.net_amount?.value != null ? String(ext.net_amount.value) : '',
        vat_amount: ext.vat_amount?.value != null ? String(ext.vat_amount.value) : '',
        gross_amount: ext.gross_amount?.value != null ? String(ext.gross_amount.value) : '',
      });
    }
  }, [doc?.id]);

  if (!doc) return null;

  const isPdf = doc.mime_type === 'application/pdf' || doc.file_url?.toLowerCase().endsWith('.pdf');
  const isImage = doc.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.file_url || '');
  const ext = doc.extraction_data || {};

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const saved = await base44.entities.Document.update(doc.id, {
        supplier_or_customer: form.supplier_name,
        reference_number: form.invoice_number,
        document_date: form.invoice_date,
        net_amount: parseFloat(form.net_amount) || 0,
        vat_amount: parseFloat(form.vat_amount) || 0,
        gross_amount: parseFloat(form.gross_amount) || 0,
      });
      onOpenChange(false);
      onApprove?.(saved);
    } catch (e) {
      toast({ title: 'Error saving document', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await base44.entities.Document.update(doc.id, { status: 'rejected' });
      toast({ title: 'Document rejected' });
      onRejected?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Review Extracted Data
            <span className="text-sm font-normal text-muted-foreground">— {doc.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border rounded-lg overflow-hidden bg-muted/30 min-h-[300px] flex items-center justify-center">
            {isPdf ? (
              <iframe src={doc.file_url} className="w-full h-[450px]" title="Document preview" />
            ) : isImage ? (
              <img src={doc.file_url} alt={doc.name} className="max-w-full max-h-[450px] object-contain" />
            ) : (
              <div className="flex flex-col items-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Preview not available</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Review the AI-extracted data below. Edit any fields as needed before confirming.</p>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Supplier Name</Label>
                <ConfidenceBadge score={ext.supplier_name?.confidence} />
              </div>
              <Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} placeholder="Supplier name" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Invoice Number</Label>
                <ConfidenceBadge score={ext.invoice_number?.confidence} />
              </div>
              <Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} placeholder="Invoice number" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Invoice Date</Label>
                <ConfidenceBadge score={ext.invoice_date?.confidence} />
              </div>
              <Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Net</Label>
                  <ConfidenceBadge score={ext.net_amount?.confidence} />
                </div>
                <Input type="number" step="0.01" value={form.net_amount} onChange={e => setForm({ ...form, net_amount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">VAT</Label>
                  <ConfidenceBadge score={ext.vat_amount?.confidence} />
                </div>
                <Input type="number" step="0.01" value={form.vat_amount} onChange={e => setForm({ ...form, vat_amount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Gross</Label>
                  <ConfidenceBadge score={ext.gross_amount?.confidence} />
                </div>
                <Input type="number" step="0.01" value={form.gross_amount} onChange={e => setForm({ ...form, gross_amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button onClick={handleConfirm} disabled={saving} className="gap-2 flex-1 bg-emerald-600 hover:bg-emerald-700"><Check className="w-4 h-4" />Approve</Button>
              <Button onClick={handleReject} disabled={saving} variant="destructive" className="gap-2 flex-1"><X className="w-4 h-4" />Reject</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}