import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Download, FileText, FilePlus } from 'lucide-react';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

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

const TYPE_LABELS = {
  purchase_invoice: 'Purchase Invoice',
  sales_invoice: 'Sales Invoice',
  receipt: 'Receipt',
  credit_note: 'Credit Note',
  bank_statement: 'Bank Statement',
  other: 'Other',
};

export default function DocumentView({ open, onOpenChange, document, onApprove, onReject, actionLoading, onCreateRecord }) {
  if (!document) return null;

  const isPdf = document.mime_type === 'application/pdf' || document.file_url?.toLowerCase().endsWith('.pdf');
  const isImage = document.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(document.file_url || '');
  const canAct = document.status === 'pending_extraction' || document.status === 'pending_review';
  const canCreateRecord = document.status === 'approved' && !document.linked_record_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {document.name}
            <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[document.status]}`}>{STATUS_LABELS[document.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* File preview */}
          <div className="border rounded-lg overflow-hidden bg-muted/30 min-h-[300px] flex items-center justify-center">
            {isPdf ? (
              <iframe src={document.file_url} className="w-full h-[400px]" title="Document preview" />
            ) : isImage ? (
              <img src={document.file_url} alt={document.name} className="max-w-full max-h-[400px] object-contain" />
            ) : (
              <div className="flex flex-col items-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Preview not available</p>
                <a href={document.file_url} download target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Download file</Button>
                </a>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Document Type</p>
                <p className="font-medium">{TYPE_LABELS[document.document_type]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reference Number</p>
                <p className="font-medium">{document.reference_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Document Date</p>
                <p className="font-medium">{document.document_date ? moment(document.document_date).format('DD MMM YYYY') : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Upload Date</p>
                <p className="font-medium">{document.upload_date ? moment(document.upload_date).format('DD MMM YYYY') : '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Supplier / Customer</p>
                <p className="font-medium">{document.supplier_or_customer || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="text-sm font-semibold">{formatCurrency(document.net_amount)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">VAT</p>
                <p className="text-sm font-semibold">{formatCurrency(document.vat_amount)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Gross</p>
                <p className="text-sm font-semibold">{formatCurrency(document.gross_amount)}</p>
              </div>
            </div>

            {document.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{document.notes}</p>
              </div>
            )}

            <a href={document.file_url} download target="_blank" rel="noopener noreferrer" className="inline-block">
              <Button variant="outline" className="gap-2"><Download className="w-4 h-4" />Download original</Button>
            </a>

            {canAct && (
              <div className="flex gap-2 pt-2 border-t">
                <Button onClick={onApprove} disabled={actionLoading} className="gap-2 flex-1 bg-emerald-600 hover:bg-emerald-700"><Check className="w-4 h-4" />Approve</Button>
                <Button onClick={onReject} disabled={actionLoading} variant="destructive" className="gap-2 flex-1"><X className="w-4 h-4" />Reject</Button>
              </div>
            )}
            {canCreateRecord && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">No accounting record linked yet. Create one:</p>
                <Button onClick={onCreateRecord} className="gap-2 w-full"><FilePlus className="w-4 h-4" />Create Record</Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}