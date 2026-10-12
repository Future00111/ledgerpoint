import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilePlus, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

export default function CreatePurchaseBillDialog({ open, onOpenChange, document: doc, onCreated }) {
  const { activeCompany } = useCompany();
  const [suppliers, setSuppliers] = useState([]);
  const [mode, setMode] = useState('existing');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && activeCompany) {
      base44.entities.Supplier.filter({ company_id: activeCompany.id }, 'name', 200)
        .then(setSuppliers)
        .catch(() => {});
    }
  }, [open, activeCompany]);

  useEffect(() => {
    if (open && doc) {
      setMode('existing');
      setSelectedSupplierId('');
      setNewSupplierName(doc.supplier_or_customer || '');
      setSearch('');
    }
  }, [open, doc?.id]);

  if (!doc) return null;

  const filteredSuppliers = suppliers.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
  const extractedSupplierName = doc.supplier_or_customer || '';
  const existingMatch = suppliers.find(s => s.name === extractedSupplierName);

  const handleCreate = async () => {
    if (mode === 'existing' && !selectedSupplierId) {
      toast({ title: 'Please select a supplier', variant: 'destructive' });
      return;
    }
    if (mode === 'new' && !newSupplierName.trim()) {
      toast({ title: 'Please enter a supplier name', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const payload = { document_id: doc.id };
      if (mode === 'existing') {
        payload.supplier_id = selectedSupplierId;
      } else {
        payload.new_supplier_name = newSupplierName.trim();
      }
      const result = await base44.functions.invoke('createRecordFromDocument', payload);
      toast({ title: 'Purchase Bill created successfully.' });
      onCreated?.();
      onOpenChange(false);
      if (result.data.record_path) navigate(result.data.record_path);
    } catch (e) {
      toast({ title: 'Error creating purchase bill', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus className="w-4 h-4 text-primary" />
            Approve and Create Purchase Bill
          </DialogTitle>
          <DialogDescription>Review the extracted data and select a supplier to create a purchase bill.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Supplier:</span><span className="font-medium">{extractedSupplierName || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Invoice No:</span><span className="font-medium">{doc.reference_number || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span className="font-medium">{doc.document_date ? moment(doc.document_date).format('DD MMM YYYY') : '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Net:</span><span className="font-medium">{formatCurrency(doc.net_amount)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">VAT:</span><span className="font-medium">{formatCurrency(doc.vat_amount)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Gross:</span><span className="font-medium">{formatCurrency(doc.gross_amount)}</span></div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant={mode === 'existing' ? 'default' : 'outline'} size="sm" onClick={() => setMode('existing')}>Select Existing</Button>
            <Button variant={mode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setMode('new')}>Create New</Button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              {existingMatch && !selectedSupplierId && (
                <p className="text-xs text-emerald-600">A supplier named "{extractedSupplierName}" already exists — select it below.</p>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                <SelectContent>
                  {filteredSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Supplier Name</Label>
              <Input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Enter supplier name" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Approve and Create Purchase Bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}