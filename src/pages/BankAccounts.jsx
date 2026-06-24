import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, AlertCircle, Eye } from 'lucide-react';
import BankAccountForm from '@/components/bank_accounts/BankAccountForm';

export default function BankAccounts() {
  const { activeCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeCompany) loadAccounts();
  }, [activeCompany]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.BankAccount.filter({ company_id: activeCompany.id }, 'account_name');
      setAccounts(list);
    } catch (e) {
      toast({ title: 'Error loading accounts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (account) => {
    if (!confirm(`Delete ${account.account_name}?`)) return;
    try {
      await base44.entities.BankAccount.delete(account.id);
      toast({ title: 'Account deleted' });
      await loadAccounts();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (account) => {
    try {
      const newStatus = account.status === 'active' ? 'inactive' : 'active';
      await base44.entities.BankAccount.update(account.id, { status: newStatus });
      toast({ title: 'Account updated' });
      await loadAccounts();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (!activeCompany) {
    return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Account
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No bank accounts yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {accounts.map(account => (
            <Card key={account.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-sm">{account.account_name}</p>
                    <Badge variant={account.status === 'active' ? 'default' : 'outline'} className="text-xs">
                      {account.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-muted-foreground">
                    <div>
                      <p className="text-xs text-muted-foreground/70">Bank</p>
                      <p className="font-medium text-foreground">{account.bank_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70">Sort Code</p>
                      <p className="font-medium text-foreground font-mono">{account.sort_code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70">Account Number</p>
                      <p className="font-medium text-foreground font-mono">****{account.account_number?.slice(-4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/70">Balance</p>
                      <p className="font-medium text-foreground">{account.currency} {(account.current_balance || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditing(account); setFormOpen(true); }}
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleStatus(account)}
                    title={account.status === 'active' ? 'Deactivate' : 'Activate'}
                  >
                    <span className={`w-4 h-4 rounded border ${account.status === 'active' ? 'bg-emerald-100 border-emerald-300' : 'border-muted-foreground/30'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(account)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BankAccountForm account={editing} open={formOpen} onOpenChange={setFormOpen} onSave={loadAccounts} companyId={activeCompany.id} />
    </div>
  );
}