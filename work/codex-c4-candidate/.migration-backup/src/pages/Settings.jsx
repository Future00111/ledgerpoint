import React, { useState } from 'react';
import { User, Bell, Shield, Building2, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/lib/useCompany';
import { useAuth } from '@/lib/AuthContext';
import InviteUserDialog from '@/components/settings/InviteUserDialog';
import CompanyUserList from '@/components/settings/CompanyUserList';

const ROLE_LABELS = {
  owner: 'Owner',
  accountant: 'Accountant',
  staff: 'Staff',
  read_only: 'Read Only',
};

export default function Settings() {
  const { activeCompany, roles } = useCompany();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [userListRefresh, setUserListRefresh] = useState(0);

  const isOwner = activeCompany && roles[activeCompany.id] === 'owner';
  const currentRole = activeCompany ? (ROLE_LABELS[roles[activeCompany.id]] || '-') : '-';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and application preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal details.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="Your name" defaultValue={user?.full_name || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" defaultValue={user?.email || ''} disabled />
          </div>
          <Button>Save changes</Button>
        </CardContent>
      </Card>

      {activeCompany && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle>Company Access</CardTitle>
                <CardDescription>
                  {activeCompany.name} · Your role: <span className="font-medium">{currentRole}</span>
                </CardDescription>
              </div>
              {isOwner && (
                <Button size="sm" className="gap-2" onClick={() => setInviteOpen(true)}>
                  <Plus className="w-4 h-4" />Invite User
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <CompanyUserList key={userListRefresh} companyId={activeCompany.id} isOwner={isOwner} currentUserId={user?.id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what alerts you receive.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Notification preferences coming soon.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage password and access.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline">Change password</Button>
        </CardContent>
      </Card>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        companyId={activeCompany?.id}
        onInvited={() => setUserListRefresh(k => k + 1)}
      />
    </div>
  );
}