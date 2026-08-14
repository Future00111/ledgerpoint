import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gbp, fmtDate } from '@/lib/format';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function statusInfo(t, suggestion) {
  if (t.status === 'matched') return { label: 'Reconciled', dot: 'bg-emerald-500', text: 'text-emerald-600' };
  if (!suggestion) return { label: 'No match found', dot: 'bg-rose-400', text: 'text-rose-500' };
  if (suggestion.confidence < 50) return { label: 'AI uncertain', dot: 'bg-amber-500', text: 'text-amber-600' };
  if (suggestion.confidence >= 80) return { label: 'Ready to approve', dot: 'bg-emerald-500', text: 'text-emerald-600' };
  return { label: 'Needs review', dot: 'bg-amber-500', text: 'text-amber-600' };
}

function confLabel(c) {
  if (c >= 80) return `High confidence (${Math.round(c)}%)`;
  if (c >= 50) return `Medium confidence (${Math.round(c)}%)`;
  return `Low confidence (${Math.round(c)}%)`;
}

// Soft, spacious reconciliation card. Collapsed shows name, amount, reference,
// date, bank account and status. Advanced match detail lives behind an expand.
export default function ReconciliationInboxCard({
  transaction, suggestion, onApprove, onSplit, onFindMatch, onCategorise, onEdit, onSelect,
  approving, selected, compact,
}) {
  const [expanded, setExpanded] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  const isMatched = t.status === 'matched';
  const hasSuggestion = !!suggestion;
  const status = statusInfo(t, suggestion);

  // Customer / supplier name is the primary focus; fall back to the bank line.
  const displayName = hasSuggestion ? suggestion.record_name : (t.description || 'Untitled transaction');
  const refText = hasSuggestion
    ? `${TYPE_LABELS[suggestion.record_type]} ${suggestion.record_number}`
    : (t.reference || '');
  const meta = [refText, fmtDate(t.date), t.bank_account_name].filter(Boolean).join('  ·  ');

  const pad = compact ? 'px-4 py-3' : 'px-5 py-4';
  const titleSize = compact ? 'text-sm' : 'text-base';
  const amtSize = compact ? 'text-sm' : 'text-base';

  const handleClick = () => {
    onSelect?.(t.id);
    setExpanded((v) => !v);
  };

  if (isMatched) {
    return (
      <div id={`txn-${t.id}`} className={`rounded-xl border bg-card shadow-sm transition-all ${selected ? 'border-border ring-1 ring-border' : 'border-border/50 hover:shadow-md'}`}>
        <div className={`flex items-center gap-3 ${pad} cursor-pointer`} onClick={() => onSelect?.(t.id)} onDoubleClick={() => onEdit?.()}>
          <div className={`flex-shrink-0 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-medium ${compact ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'}`}>
            {initials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`${titleSize} font-medium truncate`}>{displayName}</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">{meta}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`${amtSize} font-semibold ${isIncome ? 'text-emerald-700' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
            <p className={`text-xs mt-0.5 flex items-center gap-1 justify-end ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const showActions = selected || expanded;

  return (
    <div
      id={`txn-${t.id}`}
      className={`rounded-xl border bg-card shadow-sm transition-all ${selected ? 'border-border ring-1 ring-border' : 'border-border/50 hover:shadow-md'}`}
    >
      <div className={`flex items-center gap-3 ${pad} cursor-pointer`} onClick={handleClick} onDoubleClick={() => onEdit?.()}>
        <div className={`flex-shrink-0 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-medium ${compact ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'}`}>
          {initials(displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`${titleSize} font-medium truncate`}>{displayName}</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">{meta}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`${amtSize} font-semibold ${isIncome ? 'text-emerald-700' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
          <p className={`text-xs mt-0.5 flex items-center gap-1 justify-end ${status.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground/50 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className={`${pad} pt-0 pb-3.5`}>
          <div className="rounded-lg bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground space-y-2">
            {hasSuggestion ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground/70">Suggested match</span>
                  <span className="text-foreground/80 text-right">{TYPE_LABELS[suggestion.record_type]} {suggestion.record_number} · {suggestion.record_name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground/70">AI confidence</span>
                  <span className="text-foreground/80">{confLabel(suggestion.confidence)}</span>
                </div>
                {suggestion.reasons?.length > 0 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground/70 flex-shrink-0">Why</span>
                    <span className="text-foreground/70 text-right italic">{suggestion.reasons.join(' · ')}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground/70">No suggested match found. Use <span className="text-foreground/80">Find match</span> to locate a record, or categorise this transaction.</p>
            )}
          </div>
        </div>
      )}

      {showActions && (
        <div className={`${pad} pt-0 pb-3.5 flex items-center gap-1`} onClick={(e) => e.stopPropagation()}>
          {hasSuggestion && (
            <Button variant="secondary" size="sm" onClick={() => onApprove?.(suggestion)} disabled={approving} className="h-7 px-3 text-xs">
              {approving ? 'Approving…' : 'Approve'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onSplit?.()} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">Split</Button>
          <Button variant="ghost" size="sm" onClick={() => onFindMatch?.()} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">Find match</Button>
          <Button variant="ghost" size="sm" onClick={() => onCategorise?.()} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">Categorise</Button>
        </div>
      )}
    </div>
  );
}