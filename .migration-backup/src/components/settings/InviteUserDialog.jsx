import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
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
      await base44.functions.invoke('inviteUserToCompany', {
        company_id: companyId,
        email: email.trim(),
        role,
      });
      toast({ title: 'User invited', description: 'Invitation sent to ' + email });
      setEmail('');
      setRole('staff');
      onOpenChange(false);
      if (onInvited) onInvited();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Invite failed', description: msg, variant: 'destructive' });
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
          <div>
            <Label>Email Address</Label>
            <Input type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}