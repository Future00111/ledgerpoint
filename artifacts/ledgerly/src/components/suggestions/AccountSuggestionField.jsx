import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lightbulb, Check, Pencil, Plus, Loader2, AlertCircle } from 'lucide-react';
import AccountForm from '@/components/chart_of_accounts/AccountForm';

export default function AccountSuggestionField({ companyId, context, onAccountSelected }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const ctxKey = JSON.stringify(context || {});

  useEffect(() => {
    if (!companyId || !context || !context.source_type) return;
    let cancelled = false;
    setLoading(true);
    setSuggestion(null);
    const t = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('suggestAccount', { ...context, company_id: companyId });
        if (!cancelled) setSuggestion(res?.data ?? res);
      } catch (e) {
        if (!cancelled) setSuggestion({ suggestion: null, confidence: 0, reason: 'Suggestion unavailable', source: 'none' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [companyId, ctxKey]);

  const loadAccounts = async () => {
    if (!companyId) return;
    const list = await base44.entities.ChartOfAccount.filter({ company_id: companyId });
    setAccounts(list.filter(a => a.is_active !== false));
  };

  useEffect(() => { loadAccounts(); }, [companyId]);

  const confidence = suggestion?.confidence || 0;
  const confTier = confidence >= 95 ? 'high' : confidence >= 70 ? 'medium' : 'low';
  const confColor = confTier === 'high' ? 'bg-emerald-100 text-emerald-700' : confTier === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  const recordAndEmit = async (finalAccount) => {
    if (!finalAccount || !finalAccount.code) return;
    const suggested = suggestion?.suggestion || null;
    try {
      setRecording(true);
      await base44.functions.invoke('recordAccountChoice', {
        company_id: companyId,
        source_type: context.source_type,
        source_record_id: context.source_record_id,
        party_type: context.party_type,
        party_id: context.party_id,
        party_name: context.party_name,
        suggested_account: suggested ? { id: suggested.account_id, code: suggested.account_code, name: suggested.account_name } : null,
        final_account: finalAccount,
        confidence,
        reason: suggestion?.reason || '',
        suggestion_source: suggestion?.source || 'none',
      });
    } catch (e) {
      // non-fatal
    } finally {
      setRecording(false);
    }
    onAccountSelected?.(finalAccount);
  };

  const accept = () => {
    const s = suggestion?.suggestion;
    if (!s) return;
    recordAndEmit({ id: s.account_id, code: s.account_code, name: s.account_name });
  };

  const pickDifferent = (accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setPickerOpen(false);
    recordAndEmit({ id: acc.id, code: acc.code, name: acc.name });
  };

  const onAccountCreated = (account) => {
    setCreateOpen(false);
    loadAccounts();
    recordAndEmit({ id: account?.id, code: account?.code, name: account?.name });
  };

  const hasSuggestion = suggestion && suggestion.suggestion;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Smart Account Suggestion</span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {!loading && hasSuggestion ? (
        <>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm">
                <span className="text-muted-foreground">Suggested: </span>
                <span className="font-medium">{suggestion.suggestion.account_name}</span>
                <span className="text-muted-foreground text-xs ml-1">({suggestion.suggestion.account_code})</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
            </div>
            <Badge className={confColor} variant="secondary">{confidence}% {confTier}</Badge>
          </div>

          {confTier === 'low' && (
            <p className="text-xs text-red-600 flex items-center gap-1 mt-2"><AlertCircle className="w-3 h-3" /> Please review before posting.</p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button size="sm" onClick={accept} disabled={recording}><Check className="w-3.5 h-3.5" /> Accept</Button>
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}><Pencil className="w-3.5 h-3.5" /> Choose Different</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" /> Create New</Button>
          </div>
        </>
      ) : !loading ? (
        <>
          <p className="text-sm text-muted-foreground">{suggestion?.reason || 'No suggestion available — please choose an account.'}</p>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}><Pencil className="w-3.5 h-3.5" /> Choose Account</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" /> Create New</Button>
          </div>
        </>
      ) : null}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Choose ledger account</DialogTitle></DialogHeader>
          <Select onValueChange={pickDifferent}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>

      <AccountForm open={createOpen} onOpenChange={setCreateOpen} onCreated={onAccountCreated} onSave={loadAccounts} />
    </div>
  );
}