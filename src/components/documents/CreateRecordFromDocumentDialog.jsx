import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilePlus, Search, Receipt, Undo2, FileText, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const RECORD_TYPES = [
  { value: 'purchase_bill', label: 'Purchase Bill', icon: Receipt, needs: 'supplier' },
  { value: 'supplier_credit_note', label: 'Supplier Credit Note', icon: Undo2, needs: 'supplier' },
  { value: 'sales_invoice', label: 'Sales Invoice', icon: FileText, needs: 'customer' },
  { value: 'sales_credit_note', label: 'Sales Credit Note', icon: Undo2, needs: 'customer' },
  { value: 'receipt_only', label: 'Receipt Only', icon: Check, needs: null },
];

export default function CreateRecordFromDocumentDialog({ open, onOpenChange, document: doc, onCreated }) {
  const { activeCompany } = useCompany();
  const [step, setStep] = useState('choose');
  const [recordType, setRecordType] = useState('');
  const [contacts, setContacts] = useState([]);
  const [mode, setMode] = useState('existing');
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && doc) {
      setStep('choose');
      setRecordType('');
      setMode('existing');
      setSelectedId('');
      setNewName(doc.supplier_or_customer || '');
      setSearch('');
    }
  }, [open, doc?.id]);

  useEffect(() => {
    if (step === 'details' && activeCompany && recordType) {
      const rt = RECORD_TYPES.find(r => r.value === recordType);
      if (rt?.needs === 'supplier') {
        base44.entities.Supplier.filter({ company_id: activeCompany.id }, 'name', 200).then(setContacts).catch(() => {});
      } else if (rt?.needs === 'customer') {
        base44.entities.Customer.filter({ company_id: activeCompany.id }, 'name', 200).then(setContacts).catch(() => {});
      }
    }
  }, [step, recordType, activeCompany]);

  if (!doc) return null;

  const rt = RECORD_TYPES.find(r => r.value === recordType);
  const filteredContacts = contacts.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
  const contactLabel = rt?.needs === 'supplier' ? 'Supplier' : 'Customer';

  const handleChoose = (type) => {
    if (type === 'receipt_only') {
      handleReceiptOnly();
    } else {
      setRecordType(type);
      setStep('details');
    }
  };

  const handleReceiptOnly = async () => {
    setCreating(true);
    try {
      await base44.entities.Document.update(doc.id, { status: 'approved' });
      toast({ title: 'Document approved' });
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Error approving document', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleCreate = async () => {
    if (mode === 'existing' && !selectedId) {
      toast({ title: `Please select a ${contactLabel.toLowerCase()}`, variant: 'destructive' });
      return;
    }
    if (mode === 'new' && !newName.trim()) {
      toast({ title: `Please enter a ${contactLabel.toLowerCase()} name`, variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const payload = { document_id: doc.id, record_type: recordType };
      if (mode === 'existing') {
        if (rt.needs === 'supplier') payload.supplier_id = selectedId;
        else payload.customer_id = selectedId;
      } else {
        if (rt.needs === 'supplier') payload.new_supplier_name = newName.trim();
        else payload.new_customer_name = newName.trim();
      }
      const result = await base44.functions.invoke('createRecordFromDocument', payload);
      toast({ title: `${result.data.record_type} created successfully.` });
      onCreated?.();
      onOpenChange(false);
      if (result.data.record_path) navigate(result.data.record_path);
    } catch (e) {
      toast({ title: 'Error creating record', description: e.response?.data?.error || e.message, variant: 'destructive' });
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
            {step === 'choose' ? 'Approve Document' : `Create ${rt?.label || ''}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'choose' ? 'Choose what to create from this document.' : 'Review the pre-filled data and select a contact.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' ? (
          <div className="space-y-2">
            {RECORD_TYPES.map(type => {
              const Icon = type.icon;
              return (
                <Button key={type.value} variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => handleChoose(type.value)} disabled={creating}>
                  <Icon className="w-4 h-4 text-primary" />
                  {type.label}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Contact:</span><span className="font-medium">{doc.supplier_or_customer || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference:</span><span className="font-medium">{doc.reference_number || '—'}</span></div>
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
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder={`Search ${contactLabel.toLowerCase()}s...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger><SelectValue placeholder={`Select a ${contactLabel.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>
                      {filteredContacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>{contactLabel} Name</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={`Enter ${contactLabel.toLowerCase()} name`} />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('choose')}>Back</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : `Create ${rt?.label || ''}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}