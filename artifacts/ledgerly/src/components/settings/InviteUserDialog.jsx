import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLES = [
  { value: 'accountant', label: 'Accountant' },
  { value: 'staff', label: 'Staff' },
  { value: 'read_only', label: 'Read Only' },
];

export default function InviteUserDialog({ open, onOpenChange, companyId, onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email.trim()) { toast({ title: 'Email is required', variant: 'destructive' }); return; }
    setInviting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface actionable message (e.g. user not yet registered)
        throw new Error(data.error || 'Invite failed');
      }
      toast({ title: 'User added', description: data.message || `${email} has been added to the company.` });
      setEmail('');
      setRole('staff');
      onOpenChange(false);
      if (onInvited) onInvited();
    } catch (e) {
      toast({ title: 'Invite failed', description: e.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">The user must have a Ledgerly account. They will be added immediately once found by email.</p>
          <div>
            <Label>Email Address</Label>
            <Input type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={inviting || !email.trim()} className="gap-2">
            {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
            Add User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
