import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Upload } from 'lucide-react';

function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { current.push(field); field = ''; }
      else if (c === '\n') { current.push(field); rows.push(current); current = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field || current.length) { current.push(field); rows.push(current); }
  return rows.filter(r => r.some(c => c.trim()));
}

const HEADER_MAP = {
  'date': 'date', 'transaction date': 'date', 'transaction_date': 'date',
  'description': 'description', 'details': 'description', 'narrative': 'description', 'memo': 'description',
  'reference': 'reference', 'ref': 'reference',
  'money in': 'money_in', 'credit': 'money_in', 'deposit': 'money_in', 'money_in': 'money_in',
  'money out': 'money_out', 'debit': 'money_out', 'payment': 'money_out', 'money_out': 'money_out',
  'balance': 'balance',
  'category': 'category',
  'vat rate': 'vat_rate', 'vat': 'vat_rate', 'vat_rate': 'vat_rate',
  'notes': 'notes',
};

export default function ImportCSVDialog({ open, onOpenChange, companyId, onImported }) {
  const [bankAccountName, setBankAccountName] = useState('');
  const [preview, setPreview] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { toast({ title: 'CSV appears empty', variant: 'destructive' }); return; }
    const headers = rows[0].map(h => h.trim().toLowerCase());
    const mapped = rows.slice(1).map(row => {
      const obj = { bank_account_name: bankAccountName, category: 'other', vat_rate: '0' };
      headers.forEach((h, i) => {
        const field = HEADER_MAP[h];
        if (field) obj[field] = row[i]?.trim() || '';
      });
      obj.money_in = parseFloat(obj.money_in) || 0;
      obj.money_out = parseFloat(obj.money_out) || 0;
      obj.balance = parseFloat(obj.balance) || 0;
      obj.vat_amount = 0;
      const gross = obj.money_in || obj.money_out;
      const rate = parseFloat(obj.vat_rate);
      if (gross && rate && !isNaN(rate)) obj.vat_amount = Math.round((gross - gross / (1 + rate / 100)) * 100) / 100;
      obj.type = obj.money_in > 0 ? 'income' : 'expense';
      obj.amount = obj.money_in || obj.money_out;
      obj.status = 'review';
      obj.company_id = companyId;
      return obj;
    });
    setPreview(mapped);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      await base44.entities.BankTransaction.bulkCreate(preview);
      toast({ title: `Imported ${preview.length} transactions` });
      onImported();
      onOpenChange(false);
      setPreview([]);
      setFileName('');
      setBankAccountName('');
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setImporting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import CSV</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Bank Account Name</Label><Input value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="e.g. Business Current Account" /></div>
          <div>
            <Label>CSV File</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" />Choose File</Button>
              {fileName && <p className="text-sm mt-2">{fileName}</p>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Columns: date, description, reference, money in, money out, balance, category, vat rate, notes</p>
          </div>
          {preview.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{preview.length} transactions ready to import</p>
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr><th className="text-left p-2">Date</th><th className="text-left p-2">Description</th><th className="text-right p-2">In</th><th className="text-right p-2">Out</th></tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((p, i) => (
                      <tr key={i} className="border-t"><td className="p-2">{p.date}</td><td className="p-2 truncate max-w-32">{p.description}</td><td className="text-right p-2">{p.money_in || ''}</td><td className="text-right p-2">{p.money_out || ''}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || preview.length === 0}>{importing ? 'Importing...' : 'Import'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}