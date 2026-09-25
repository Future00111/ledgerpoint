import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, AlertCircle } from 'lucide-react';
import moment from 'moment';

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
};

export default function ImportCSVDialog({ open, onOpenChange, companyId, onImported }) {
  const [step, setStep] = useState('select'); // select, map, review, importing, results
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [preview, setPreview] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const loadBankAccounts = async () => {
    try {
      const accounts = await base44.entities.BankAccount.filter({ company_id: companyId });
      setBankAccounts(accounts);
    } catch (e) { console.error(e); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { toast({ title: 'CSV appears empty', variant: 'destructive' }); return; }
    const hdrs = rows[0].map(h => h.trim().toLowerCase());
    setHeaders(hdrs);
    setRawRows(rows.slice(1));
    
    // Auto-map headers
    const map = {};
    hdrs.forEach((h, i) => {
      const field = HEADER_MAP[h];
      if (field) map[i] = field;
    });
    setColumnMap(map);
    setStep('map');
  };

  const handleMapChange = (colIndex, field) => {
    setColumnMap(prev => {
      const updated = { ...prev };
      if (field) updated[colIndex] = field;
      else delete updated[colIndex];
      return updated;
    });
  };

  const buildPreview = () => {
    const mapped = rawRows.map(row => {
      const obj = { category: 'other', vat_rate: '0' };
      headers.forEach((h, i) => {
        const field = columnMap[i];
        if (field) obj[field] = row[i]?.trim() || '';
      });
      obj.money_in = parseFloat(obj.money_in) || 0;
      obj.money_out = parseFloat(obj.money_out) || 0;
      obj.balance = parseFloat(obj.balance) || 0;
      obj.type = obj.money_in > 0 ? 'income' : 'expense';
      obj.amount = obj.money_in || obj.money_out;
      obj.status = 'review';
      obj.company_id = companyId;
      obj.bank_account_id = bankAccountId;
      return obj;
    });
    setPreview(mapped);
    setStep('review');
  };

  const checkDuplicates = async (transactions) => {
    const account = bankAccounts.find(a => a.id === bankAccountId);
    if (!account) return { imported: [], duplicates: [] };

    const existing = await base44.entities.BankTransaction.filter({
      company_id: companyId,
      bank_account_id: bankAccountId
    });

    const duplicates = [];
    const toImport = [];

    for (const txn of transactions) {
      const isDuplicate = existing.some(e =>
        moment(e.date).format('YYYY-MM-DD') === moment(txn.date).format('YYYY-MM-DD') &&
        e.description?.toLowerCase() === txn.description?.toLowerCase() &&
        Math.abs((e.money_in || 0) - (txn.money_in || 0)) < 0.01 &&
        Math.abs((e.money_out || 0) - (txn.money_out || 0)) < 0.01 &&
        e.reference?.toLowerCase() === txn.reference?.toLowerCase()
      );
      if (isDuplicate) duplicates.push(txn);
      else toImport.push(txn);
    }

    return { imported: toImport, duplicates };
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const { imported, duplicates } = await checkDuplicates(preview);
      if (imported.length > 0) {
        await base44.entities.BankTransaction.bulkCreate(imported);
      }
      setResults({
        imported: imported.length,
        duplicates: duplicates.length,
        total: preview.length
      });
      onImported();
      setStep('results');
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setImporting(false); }
  };

  const resetDialog = () => {
    setStep('select');
    setBankAccountId('');
    setRawRows([]);
    setHeaders([]);
    setColumnMap({});
    setPreview([]);
    setFileName('');
    setResults(null);
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) resetDialog();
    onOpenChange(newOpen);
  };

  useEffect(() => {
    if (open) loadBankAccounts();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Bank Transactions</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          
          {step === 'select' && (
            <>
              <div>
                <Label>Select Bank Account</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name} ({a.bank_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CSV File</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                  <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" />Choose File</Button>
                  {fileName && <p className="text-sm mt-2 text-muted-foreground">{fileName}</p>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Expected columns: date, description, reference, money in/out, balance</p>
              </div>
            </>
          )}

          {step === 'map' && (
            <>
              <div className="text-sm">
                <p className="font-medium mb-3">Map CSV columns to transaction fields:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs bg-muted px-2 py-1 rounded flex-shrink-0">{h}</span>
                      <Select value={columnMap[i] || ''} onValueChange={(v) => handleMapChange(i, v)}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue placeholder="Skip" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Skip this column</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="description">Description</SelectItem>
                          <SelectItem value="reference">Reference</SelectItem>
                          <SelectItem value="money_in">Money In</SelectItem>
                          <SelectItem value="money_out">Money Out</SelectItem>
                          <SelectItem value="balance">Balance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'review' && (
            <>
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
            </>
          )}

          {step === 'results' && results && (
            <div className="space-y-3 py-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-sm font-medium text-emerald-900">✓ Imported: <span className="text-lg font-semibold">{results.imported}</span></p>
              </div>
              {results.duplicates > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Skipped as duplicates: <span className="text-lg font-semibold">{results.duplicates}</span></p>
                    <p className="text-xs text-amber-700 mt-1">Matched by date, description, amount & reference</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Total: {results.total} transactions processed</p>
            </div>
          )}

        </div>

        <DialogFooter>
          {step === 'results' ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              {step === 'select' && <Button onClick={() => setStep('map')} disabled={!bankAccountId || !fileName}>Next</Button>}
              {step === 'map' && (
                <>
                  <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
                  <Button onClick={buildPreview}>Review</Button>
                </>
              )}
              {step === 'review' && (
                <>
                  <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
                  <Button onClick={handleImport} disabled={importing}>{importing ? 'Importing...' : 'Import'}</Button>
                </>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}