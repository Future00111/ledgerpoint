import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, AlertCircle } from 'lucide-react';
import AccountForm from '@/components/chart_of_accounts/AccountForm';

const typeColors = {
  income: 'bg-emerald-50 text-emerald-700',
  cost_of_sales: 'bg-orange-50 text-orange-700',
  expense: 'bg-red-50 text-red-700',
  asset: 'bg-blue-50 text-blue-700',
  liability: 'bg-purple-50 text-purple-700',
  equity: 'bg-indigo-50 text-indigo-700',
  vat: 'bg-pink-50 text-pink-700',
};

const typeLabels = {
  income: 'Income',
  cost_of_sales: 'Cost of Sales',
  expense: 'Expense',
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  vat: 'VAT',
};

export default function ChartOfAccounts() {
  const { activeCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeCompany) loadAccounts();
  }, [activeCompany]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ChartOfAccount.filter({ company_id: activeCompany.id }, 'code');
      setAccounts(list);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error loading accounts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDefaults = async () => {
    if (!confirm('Create default chart of accounts?')) return;
    try {
      const result = await base44.functions.invoke('createDefaultAccounts', { company_id: activeCompany.id });
      const count = result.data?.count || 6;
      toast({ title: `Success`, description: `${count} default accounts created` });
      await loadAccounts();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (account) => {
    if (!confirm(`Delete account ${account.code} - ${account.name}?`)) return;
    try {
      await base44.entities.ChartOfAccount.delete(account.id);
      toast({ title: 'Account deleted' });
      await loadAccounts();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (account) => {
    try {
      await base44.entities.ChartOfAccount.update(account.id, { is_active: !account.is_active });
      toast({ title: account.is_active ? 'Account deactivated' : 'Account activated' });
      await loadAccounts();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const filtered = accounts.filter(a => {
    const matchSearch = a.code?.includes(search) || a.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    return matchSearch && matchType;
  });

  if (!activeCompany) {
    return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length === 0 && (
            <Button onClick={handleCreateDefaults} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Defaults
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            New Account
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by code or name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(typeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search || typeFilter !== 'all' ? 'No accounts match your filters' : 'No accounts yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(account => (
            <Card key={account.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-mono text-sm font-semibold text-foreground/70">{account.code}</p>
                    <p className="font-medium text-sm">{account.name}</p>
                    <Badge className={`text-xs ${typeColors[account.type] || ''}`}>{typeLabels[account.type]}</Badge>
                    {!account.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                  </div>
                  {account.description && (
                    <p className="text-xs text-muted-foreground">{account.description}</p>
                  )}
                  {account.tax_rate > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Tax Rate: {account.tax_rate}%</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
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
                    onClick={() => handleToggleActive(account)}
                    title={account.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <span className={`w-4 h-4 rounded border ${account.is_active ? 'bg-emerald-100 border-emerald-300' : 'border-muted-foreground/30'}`} />
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

      <AccountForm account={editing} open={formOpen} onOpenChange={setFormOpen} onSave={loadAccounts} />
    </div>
  );
}