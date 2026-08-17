import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Loader2, UserCog } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLE_LABELS = {
  owner: 'Owner',
  accountant: 'Accountant',
  staff: 'Staff',
  read_only: 'Read Only',
};

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  invited: 'bg-amber-100 text-amber-700',
  removed: 'bg-muted text-muted-foreground',
};

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'staff', label: 'Staff' },
  { value: 'read_only', label: 'Read Only' },
];

export default function CompanyUserList({ companyId, isOwner, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (companyId) loadUsers();
  }, [companyId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/companies/${companyId}/members`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error('Failed to load users:', e);
      toast({ title: 'Could not load team members', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/companies/${companyId}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers(u => u.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
      toast({ title: 'Role updated' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (member) => {
    if (!confirm(`Remove ${member.user_email || member.user_id} from this company?`)) return;
    setUpdating(member.user_id);
    try {
      const res = await fetch(`/api/companies/${companyId}/members/${member.user_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers(u => u.filter(m => m.user_id !== member.user_id));
      toast({ title: 'User removed' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex flex-col items-center py-12">
          <UserCog className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">No users in this company yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {users.map(u => {
        const isSelf = u.user_id === currentUserId;
        return (
          <Card key={u.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary">{(u.user_email || '?')[0].toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {u.user_email || u.user_id}
                    {isSelf && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                  </p>
                  <Badge className={'text-xs mt-0.5 ' + (STATUS_STYLES[u.status] || '')}>{u.status || 'active'}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isOwner && !isSelf ? (
                  <Select value={u.role} onValueChange={v => handleRoleChange(u.user_id, v)} disabled={updating === u.user_id}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue>{ROLE_LABELS[u.role] || u.role}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="text-xs">{ROLE_LABELS[u.role] || u.role}</Badge>
                )}
                {isOwner && !isSelf && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(u)} disabled={updating === u.user_id}>
                    {updating === u.user_id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4 text-destructive" />}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
