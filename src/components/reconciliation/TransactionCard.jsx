import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Check, Split, FolderTree, Search, Sparkles, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { gbp, fmtDate } from '@/lib/format';
import { confidenceTone } from '@/lib/reconciliationEngine';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Sales CN', supplier_credit_note: 'Supplier CN', ledger_account: 'Ledger',
};

// Entire card is clickable — click the body to reveal the AI reasoning.
// Action buttons stopPropagation so they remain independently clickable.
export default function TransactionCard({
  transaction, suggestion, onApprove, onSplit, onCategorise, onFindMatch, onAsk, onEdit, approving, highlight,
}) {
  const [expanded, setExpanded] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = Number(t.money_in || 0) + Number(t.money_out || 0);
  const isMatched = t.status === 'matched';
  const tone = confidenceTone(suggestion?.confidence);
  const cardId = `txn-${t.id}`;

  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };

  return (
    <div
      id={cardId}
      role="button"
      tabIndex={0}
      onClick={() => (isMatched ? onEdit?.() : setExpanded((v) => !v))}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isMatched ? onEdit?.() : setExpanded((v) => !v); } }}
      className={`rounded-xl border bg-card shadow-sm transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${highlight ? 'ring-2 ring-primary/50 border-primary/40' : 'hover:shadow-md hover:border-border'} ${expanded ? 'border-primary/30' : ''}`}
    >
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              {isIncome ? <ArrowDownRight className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">{t.description || 'Untitled transaction'}</p>
                {isMatched ? (
                  <Badge variant="outline" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700">Reconciled</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-700">Needs review</Badge>
                )}
                {t.matched_type && isMatched && (
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[t.matched_type]}{t.matched_record_number ? `: ${t.matched_record_number}` : ''}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {fmtDate(t.date)}{t.bank_account_name ? ` · ${t.bank_account_name}` : ''}{t.reference ? ` · ${t.reference}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>{isIncome ? '+' : '-'}{gbp(amount)}</p>
              {t.balance != null && <p className="text-[11px] text-muted-foreground">Bal {gbp(t.balance)}</p>}
            </div>
            {!isMatched && (
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>

        {/* Suggested match chip (always visible for review txns with a suggestion) */}
        {!isMatched && suggestion && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Suggested:</span>
            <Badge variant="outline" className="text-xs">{TYPE_LABELS[suggestion.record_type]}: {suggestion.record_number}</Badge>
            <span className="text-xs text-muted-foreground truncate">{suggestion.record_name}</span>
            <Badge className={`text-xs border-transparent ${tone.badge}`}>{suggestion.confidence}%</Badge>
          </div>
        )}

        {/* Reasoning — revealed when the card body is clicked */}
        {!isMatched && expanded && (
          <div className="mt-3 pt-3 border-t border-dashed space-y-2">
            {suggestion ? (
              <div className="rounded-lg bg-amber-50/50 border border-amber-200/60 px-3 py-2">
                <p className="text-[11px] font-medium text-amber-700 mb-0.5">Why this match?</p>
                <p className="text-xs text-amber-800/80">{suggestion.reasons.join(' · ')}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {TYPE_LABELS[suggestion.record_type]} {suggestion.record_number} · {gbp(suggestion.record_amount)} · {fmtDate(suggestion.record_date)}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-600">No automatic match found. Categorise this transaction to a ledger account, or find a match manually.</p>
              </div>
            )}
          </div>
        )}

        {/* Action row — always visible for review transactions */}
        {!isMatched && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {suggestion ? (
              <Button size="sm" onClick={stop(() => onApprove?.(suggestion))} disabled={approving} className="h-7 gap-1 text-xs">
                {approving ? <Sparkles className="w-3 h-3 animate-pulse" /> : <Check className="w-3 h-3" />} Approve
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={stop(() => onSplit?.())} className="h-7 gap-1 text-xs"><Split className="w-3 h-3" /> Split</Button>
            <Button size="sm" variant="outline" onClick={stop(() => onCategorise?.())} className="h-7 gap-1 text-xs"><FolderTree className="w-3 h-3" /> Categorise</Button>
            <Button size="sm" variant="outline" onClick={stop(() => onFindMatch?.())} className="h-7 gap-1 text-xs"><Search className="w-3 h-3" /> Find match</Button>
            <Button size="sm" variant="ghost" onClick={stop(() => onAsk?.())} className="h-7 gap-1 text-xs text-primary"><Sparkles className="w-3 h-3" /> Ask Ledgerly</Button>
            <Button size="sm" variant="ghost" onClick={stop(() => onEdit?.())} className="h-7 w-7 p-0 ml-auto"><Pencil className="w-3.5 h-3.5" /></Button>
          </div>
        )}

        {isMatched && (
          <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={stop(() => onFindMatch?.())} className="h-7 gap-1 text-xs"><Search className="w-3 h-3" /> Re-match</Button>
            <Button size="sm" variant="ghost" onClick={stop(() => onAsk?.())} className="h-7 gap-1 text-xs text-primary"><Sparkles className="w-3 h-3" /> Ask Ledgerly</Button>
          </div>
        )}
      </div>
    </div>
  );
}