import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

// Merge another customer INTO the current one: reassigns invoices, then
// deletes the selected source customer.
export default function CustomerMergeDialog({ customer, customers, open, onOpenChange, onMerged }) {
  const [targetId, setTargetId] = useState('');
  const [merging, setMerging] = useState(false);
  const { toast } = useToast();

  const others = (customers || []).filter((c) => c.id !== customer?.id);

  const handleMerge = async () => {
    if (!targetId || !customer) return;
    const target = others.find((c) => c.id === targetId);
    if (!target) return;
    if (!confirm(`Merge "${target.name}" into "${customer.name}"? Invoices will be reassigned to ${customer.name} and "${target.name}" will be deleted.`)) return;
    setMerging(true);
    try {
      const invoices = await base44.entities.SalesInvoice.filter({ customer_id: targetId });
      if (invoices.length) {
        await base44.entities.SalesInvoice.bulkUpdate(
          invoices.map((i) => ({ id: i.id, customer_id: customer.id, customer_name: customer.name }))
        );
      }
      await base44.entities.Customer.delete(targetId);
      toast({ title: 'Customers merged', description: `${target.name} merged into ${customer.name}` });
      setTargetId('');
      onMerged();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge into {customer?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Select a customer to merge INTO {customer?.name}. Their invoices will be reassigned to {customer?.name} and the selected customer will be deleted.
        </p>
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger><SelectValue placeholder="Select customer to merge" /></SelectTrigger>
          <SelectContent>
            {others.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMerge} disabled={!targetId || merging}>
            {merging ? 'Merging...' : 'Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}