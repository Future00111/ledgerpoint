import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, FilePlus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  purchase_invoice: 'Purchase Bill',
  sales_invoice: 'Sales Invoice',
  credit_note: 'Credit Note',
};

export default function CreateRecordDialog({ open, onOpenChange, document: doc, onCreated }) {
  const [creditNoteType, setCreditNoteType] = useState('sales');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  if (!doc) return null;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload = { document_id: doc.id };
      if (doc.document_type === 'credit_note') payload.credit_note_type = creditNoteType;
      const result = await base44.functions.invoke('createRecordFromDocument', payload);
      toast({ title: `${result.data.record_type} created successfully` });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus className="w-4 h-4 text-primary" />
            Create Accounting Record
          </DialogTitle>
          <DialogDescription>
            This will create a new {TYPE_LABELS[doc.document_type] || 'record'} from "{doc.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {doc.document_type === 'credit_note' && (
            <div>
              <Label>Credit Note Type</Label>
              <Select value={creditNoteType} onValueChange={setCreditNoteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Credit Note</SelectItem>
                  <SelectItem value="supplier">Supplier Credit Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              This action requires your explicit approval and will create a permanent accounting record. AI cannot create records automatically — only you can approve this.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Approve & Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}