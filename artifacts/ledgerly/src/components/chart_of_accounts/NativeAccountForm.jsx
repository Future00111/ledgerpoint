import { useEffect, useState } from 'react';
import { accounting } from '@/api/accountingDocuments.mjs';
import { issueFor } from '@/lib/accountingEditor.mjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export const CATEGORIES = [
  ['income', 'Income'], ['cost_of_sales', 'Cost of sales'], ['expense', 'Expense'],
  ['asset', 'Asset'], ['liability', 'Liability'], ['equity', 'Equity'],
];
const sel = 'mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm disabled:opacity-60';
const blank = { code: '', name: '', account_type: '', report_group: '', display_order: '' };

/** Native, revision-protected create/edit for one company nominal account. No deletion. */
export default function NativeAccountForm({ companyId, account, open, onOpenChange, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(account);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(account ? {
      code: account.code ?? '', name: account.name ?? '', account_type: account.account_type ?? '',
      report_group: account.report_group ?? '', display_order: account.display_order == null ? '' : String(account.display_order),
    } : blank);
  }, [open, account?.id, account?.revision]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const issue = (k) => issueFor(error, `/${k}`);
  const field = (k) => {
    const i = issue(k);
    return { 'aria-invalid': i ? 'true' : undefined, 'aria-describedby': i ? `acct-${k}-issue` : `acct-${k}-help`, className: i ? 'border-red-500' : '' };
  };
  const Issue = ({ k }) => issue(k) ? <p id={`acct-${k}-issue`} role="alert" className="mt-1 text-xs text-red-700" data-testid={`error-account-${k}`}>{issue(k).message}</p> : null;
  const locked = editing && account.classification_locked;
  const order = form.display_order.trim();
  const orderInvalid = order !== '' && (!/^\d+$/.test(order) || Number(order) > 9999);

  const submit = async (e) => {
    e.preventDefault();
    if (busy || orderInvalid) return;
    setBusy(true); setError(null);
    const body = {
      code: form.code.trim(), name: form.name.trim(),
      report_group: form.report_group.trim() || null,
      display_order: order === '' ? (editing ? account.display_order ?? 0 : 0) : Number(order),
    };
    if (!editing || !locked) body.account_type = form.account_type;
    try {
      const saved = editing ? await accounting.updateAccount(companyId, account.id, body, account.revision) : await accounting.createAccount(companyId, body);
      toast({ title: editing ? 'Account updated' : 'Account created', description: `${saved?.code ?? body.code} · ${saved?.name ?? body.name}` });
      onSaved?.(saved); onOpenChange(false);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${account.code} · ${account.name}` : 'New nominal account'}</DialogTitle>
          <DialogDescription>Codes and names are yours to choose. Every change is recorded; posted history keeps pointing at the same account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" data-testid="form-account">
          {error && !(error.issues ?? []).length && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error.message}{error.status === 412 || error.code === 'REVISION_CONFLICT' || error.code === 'CHART_REVISION_CONFLICT' ? ' Close and reopen to load the latest version.' : ''}</p>}
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div><Label htmlFor="acct-code">Code</Label>
              <Input id="acct-code" data-testid="input-account-code" required maxLength={20} value={form.code} onChange={e => set('code', e.target.value)} {...field('code')} className={`mt-1.5 font-mono ${field('code').className}`} />
              <p id="acct-code-help" className="mt-1 text-[11px] text-muted-foreground">Letters and digits; leading zeros kept.</p><Issue k="code" /></div>
            <div><Label htmlFor="acct-name">Name</Label>
              <Input id="acct-name" data-testid="input-account-name" required maxLength={120} value={form.name} onChange={e => set('name', e.target.value)} {...field('name')} className={`mt-1.5 ${field('name').className}`} />
              <p id="acct-name-help" className="sr-only">Account name</p><Issue k="name" /></div>
          </div>
          <div><Label htmlFor="acct-type">Category</Label>
            <select id="acct-type" data-testid="select-account-type" required disabled={locked} value={form.account_type} onChange={e => set('account_type', e.target.value)} {...field('account_type')} className={`${sel} ${field('account_type').className}`}>
              <option value="">Select category</option>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {form.account_type && !CATEGORIES.some(([v]) => v === form.account_type) && <option value={form.account_type}>{form.account_type}</option>}
            </select>
            <p id="acct-account_type-help" className="mt-1 text-[11px] text-muted-foreground">
              {locked ? `Category is locked because this account ${[account.used && 'has posted entries', account.control_mapped && 'is mapped in Posting setup'].filter(Boolean).join(' and ') || 'is in use'}. Its code and name can still change.` : 'Decides where the account appears in profit and loss or the balance sheet.'}
            </p><Issue k="account_type" /></div>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div><Label htmlFor="acct-group">Report group <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="acct-group" data-testid="input-account-group" maxLength={80} placeholder="e.g. Professional fees" value={form.report_group} onChange={e => set('report_group', e.target.value)} {...field('report_group')} className={`mt-1.5 ${field('report_group').className}`} />
              <p id="acct-report_group-help" className="mt-1 text-[11px] text-muted-foreground">Groups accounts with a subtotal in reports.</p><Issue k="report_group" /></div>
            <div><Label htmlFor="acct-order">Order</Label>
              <Input id="acct-order" data-testid="input-account-order" inputMode="numeric" placeholder="0" value={form.display_order} onChange={e => set('display_order', e.target.value)} aria-invalid={orderInvalid ? 'true' : undefined} aria-describedby="acct-order-help" className={`mt-1.5 ${orderInvalid ? 'border-red-500' : ''}`} />
              <p id="acct-order-help" className={`mt-1 text-[11px] ${orderInvalid ? 'text-red-700' : 'text-muted-foreground'}`}>Whole number 0 to 9999.</p></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || orderInvalid} data-testid="button-save-account">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create account'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
