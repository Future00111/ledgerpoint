import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, X, Image as ImageIcon } from 'lucide-react';
import moment from 'moment';

const DOC_TYPES = [
  { value: 'purchase_invoice', label: 'Purchase Invoice' },
  { value: 'sales_invoice', label: 'Sales Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'other', label: 'Other' },
];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function DocumentForm({ open, onOpenChange, companyId, onSaved }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    document_type: 'purchase_invoice',
    document_date: moment().format('YYYY-MM-DD'),
    supplier_or_customer: '',
    reference_number: '',
    net_amount: '',
    vat_amount: '',
    gross_amount: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setForm({
        name: '',
        document_type: 'purchase_invoice',
        document_date: moment().format('YYYY-MM-DD'),
        supplier_or_customer: '',
        reference_number: '',
        net_amount: '',
        vat_amount: '',
        gross_amount: '',
        notes: '',
      });
    }
  }, [open]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!form.name) setForm(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAmountChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      const net = parseFloat(updated.net_amount) || 0;
      const vat = parseFloat(updated.vat_amount) || 0;
      updated.gross_amount = (net + vat).toFixed(2);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!selectedFile || !form.name || !form.document_type) return;
    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const data = {
        company_id: companyId,
        name: form.name,
        document_type: form.document_type,
        upload_date: moment().format('YYYY-MM-DD'),
        document_date: form.document_date,
        supplier_or_customer: form.supplier_or_customer,
        reference_number: form.reference_number,
        net_amount: parseFloat(form.net_amount) || 0,
        vat_amount: parseFloat(form.vat_amount) || 0,
        gross_amount: parseFloat(form.gross_amount) || 0,
        status: 'pending_extraction',
        file_url: result.file_url,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        notes: form.notes,
      };
      await base44.entities.Document.create(data);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      alert('Failed to upload document: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>

        <div className="space-y-4 py-2">
          {/* File upload */}
          <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileSelect} />
          {!selectedFile ? (
            <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center justify-center hover:bg-muted/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">PDF or image file</p>
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              {previewUrl ? <img src={previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded" /> :
                <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center"><FileText className="w-6 h-6 text-primary" /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)} · {selectedFile.type || 'unknown'}</p>
              </div>
              <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
          )}

          <div>
            <Label>Document Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Document name" />
          </div>

          <div>
            <Label>Document Type *</Label>
            <Select value={form.document_type} onValueChange={v => setForm({ ...form, document_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Document Date</Label>
            <Input type="date" value={form.document_date} onChange={e => setForm({ ...form, document_date: e.target.value })} />
          </div>

          <div>
            <Label>Supplier or Customer</Label>
            <Input value={form.supplier_or_customer} onChange={e => setForm({ ...form, supplier_or_customer: e.target.value })} placeholder="Supplier or customer name" />
          </div>

          <div>
            <Label>Reference Number</Label>
            <Input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} placeholder="Invoice or receipt number" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Net Amount</Label>
              <Input type="number" step="0.01" value={form.net_amount} onChange={e => handleAmountChange('net_amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>VAT Amount</Label>
              <Input type="number" step="0.01" value={form.vat_amount} onChange={e => handleAmountChange('vat_amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Gross</Label>
              <Input type="number" step="0.01" value={form.gross_amount} readOnly className="bg-muted/50" placeholder="0.00" />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={uploading || !selectedFile || !form.name}>
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}