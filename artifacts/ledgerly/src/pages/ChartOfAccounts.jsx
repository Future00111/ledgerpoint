import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '@/lib/useCompany';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Archive, ArchiveRestore, AlertCircle, Lock } from 'lucide-react';
import NativeAccountForm, { CATEGORIES } from '@/components/chart_of_accounts/NativeAccountForm';
import { accounting } from '@/api/accountingDocuments.mjs';
import { ROLE_LABELS } from '@/lib/accountingEditor.mjs';
import { ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';

const typeColors = {
  income: 'bg-emerald-50 text-emerald-700', cost_of_sales: 'bg-orange-50 text-orange-700', expense: 'bg-red-50 text-red-700',
  asset: 'bg-blue-50 text-blue-700', liability: 'bg-purple-50 text-purple-700', equity: 'bg-indigo-50 text-indigo-700',
};
const typeLabels = Object.fromEntries(CATEGORIES);

export default function ChartOfAccounts() {
  const { activeCompany, roles } = useCompany();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const canEdit = ['owner', 'admin', 'accountant'].includes(roles?.[activeCompany?.id]);

  const load = useCallback((signal) => {
    if (!activeCompany) return;
    setError(null);
    accounting.accounts(activeCompany.id, signal)
      .then(list => { if (!Array.isArray(list)) throw new Error('Unexpected accounts response from server.'); setAccounts(list); })
      .catch(e => { if (!signal?.aborted) setError(e); });
  }, [activeCompany?.id]);
  useEffect(() => { setAccounts(null); const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);

  const setActive = async (account, active) => {
    if (!active && account.control_mapped) return;
    setBusyId(account.id);
    try {
      await accounting.updateAccount(activeCompany.id, account.id, { is_active: active }, account.revision);
      toast({ title: active ? 'Account restored' : 'Account archived', description: active ? `${account.code} can be chosen again.` : `${account.code} is hidden from new choices. Its posted history remains.` });
      load();
    } catch (e) {
      const issue = (e.issues ?? []).find(i => i.path === '/is_active');
      toast({ title: 'Could not change account', description: issue?.message || e.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  const list = (accounts ?? []).filter(a => {
    const q = search.trim().toLowerCase();
    return (showArchived || a.is_active !== false) && (typeFilter === 'all' || a.account_type === typeFilter) &&
      (!q || a.code?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q) || a.report_group?.toLowerCase().includes(q));
  });
  const archivedCount = (accounts ?? []).filter(a => a.is_active === false).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Accounting · Nominal ledger</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">Your own codes, names and report groups. Accounts are archived, never deleted, so posted history stays intact.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!canEdit} className="gap-2" data-testid="button-new-account">
          <Plus className="w-4 h-4" />New account
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search code, name or group" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-accounts" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm sm:w-44" data-testid="select-type-filter">
          <option value="all">All categories</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} data-testid="checkbox-show-archived" />
          Show archived ({archivedCount})
        </label>
      </div>
      {!canEdit && <p className="text-xs text-muted-foreground">Your role can view the chart but not change it.</p>}

      <ErrorBox error={error} onRetry={() => load()} />
      {!accounts && !error && <SkeletonRows rows={6} />}
      {accounts && list.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed py-14 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">{accounts.length ? 'No accounts match these filters' : 'No accounts yet'}</p>
          {!accounts.length && <p className="mt-1 text-sm text-muted-foreground">Create your first nominal account to start mapping documents.</p>}
        </div>
      )}
      {list.length > 0 && <p className="text-xs text-muted-foreground" data-testid="text-eligible-uses-help">Eligible uses lists the posting choices each account is allowed for. It does not show what Posting setup currently uses.</p>}
      {list.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Report group</th><th className="px-4 py-3" title="Posting choices this account is allowed for. Not the current Posting setup mappings.">Eligible uses</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {list.map(a => {
                const archived = a.is_active === false;
                return (
                  <tr key={a.id} className={`border-b last:border-0 ${archived ? 'bg-muted/30 text-muted-foreground' : ''}`} data-testid={`row-account-${a.id}`}>
                    <td className="px-4 py-3 font-mono font-semibold">{a.code}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{a.name}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {archived && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
                        {a.used && <Badge variant="outline" className="text-[10px]">Has postings</Badge>}
                        {a.control_mapped && <Badge variant="outline" className="text-[10px]">Mapped in setup</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${typeColors[a.account_type] || 'bg-muted'}`}>
                        {a.classification_locked && <Lock className="h-3 w-3" aria-label="Category locked" />}{typeLabels[a.account_type] ?? a.account_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{a.report_group || <span className="text-muted-foreground">Ungrouped</span>}<span className="ml-1 text-muted-foreground">#{a.display_order ?? 0}</span></td>
                    <td className="px-4 py-3 text-xs" data-testid={`posting-roles-${a.id}`}>
                      {(a.eligible_roles ?? []).length > 0
                        ? <div className="flex flex-wrap gap-1">{a.eligible_roles.map(r => <span key={r} className="rounded bg-primary/[0.07] px-1.5 py-0.5 font-medium text-primary">{ROLE_LABELS[r] ?? r}</span>)}</div>
                        : <span className="text-muted-foreground">Not allowed for document posting{a.eligibility_reason ? `: ${a.eligibility_reason}` : ''}</span>}
                      {Array.isArray(a.mapped_roles) && a.mapped_roles.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground" data-testid={`mapped-roles-${a.id}`}>Currently mapped: {a.mapped_roles.map(r => ROLE_LABELS[r] ?? r).join(', ')}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit" aria-label={`Edit ${a.code}`} disabled={!canEdit} onClick={() => { setEditing(a); setFormOpen(true); }} data-testid={`button-edit-account-${a.id}`}><Pencil className="h-4 w-4" /></Button>
                        {archived
                          ? <Button variant="ghost" size="icon" title="Restore" aria-label={`Restore ${a.code}`} disabled={!canEdit || busyId === a.id} onClick={() => setActive(a, true)} data-testid={`button-restore-account-${a.id}`}><ArchiveRestore className="h-4 w-4" /></Button>
                          : <Button variant="ghost" size="icon" aria-label={`Archive ${a.code}`} disabled={!canEdit || busyId === a.id || a.control_mapped}
                              title={a.control_mapped ? 'Mapped in Posting setup. Choose another account there before archiving.' : a.used ? 'Archive: hidden from new choices, posted history remains' : 'Archive'}
                              onClick={() => setActive(a, false)} data-testid={`button-archive-account-${a.id}`}><Archive className="h-4 w-4" /></Button>}
                      </div>
                      {a.control_mapped && !archived && <Link to="/accounting/setup" className="block text-right text-[11px] text-primary hover:underline">Remap to archive</Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NativeAccountForm companyId={activeCompany.id} account={editing} open={formOpen} onOpenChange={setFormOpen} onSaved={() => load()} />
    </div>
  );
}
