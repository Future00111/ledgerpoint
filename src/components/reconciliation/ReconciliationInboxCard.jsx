import React, { useState } from 'react';
import { ChevronDown, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { gbp, fmtDate } from '@/lib/format';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Credit note', supplier_credit_note: 'Credit note', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function statusInfo(t, suggestion) {
  if (t.status === 'matched') return { label: 'Reconciled', chip: 'bg-emerald-500/10 text-emerald-700' };
  if (!suggestion) return { label: 'Investigate', chip: 'bg-rose-500/10 text-rose-600' };
  if (suggestion.confidence < 50) return { label: 'Investigate', chip: 'bg-rose-500/10 text-rose-600' };
  if (suggestion.confidence >= 80) return { label: 'Ready', chip: 'bg-emerald-500/10 text-emerald-700' };
  return { label: 'Review', chip: 'bg-amber-500/10 text-amber-700' };
}

// Flat, light reconciliation row. Click expands a natural-language explanation.
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

  const displayName = hasSuggestion ? suggestion.record_name : (t.description || 'Untitled transaction');
  const refText = hasSuggestion
    ? `${TYPE_LABELS[suggestion.record_type]} ${suggestion.record_number}`
    : (t.reference || '');
  const meta = [refText, fmtDate(t.date), t.bank_account_name].filter(Boolean).join('  ·  ');
  const amountDiff = hasSuggestion ? Math.abs(amount - (suggestion.record_amount || 0)) : 0;

  const rowPad = compact ? 'py-1.5 px-3' : 'py-2.5 px-3.5';

  const handleClick = () => {
    onSelect?.(t.id);
    setExpanded((v) => !v);
  };

  return (
    <div
      id={`txn-${t.id}`}
      className={`border-b border-border/40 last:border-b-0 transition-colors ${selected ? 'bg-muted/40' : 'hover:bg-muted/30'}`}
    >
      <div className={`flex items-center gap-3 ${rowPad} cursor-pointer`} onClick={handleClick} onDoubleClick={() => onEdit?.()}>
        {isIncome
          ? <ArrowDownRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
          : <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
        <p className="text-sm font-medium truncate flex-1 min-w-0">{displayName}</p>
        <p className="text-xs text-muted-foreground/70 truncate hidden lg:block flex-shrink-0 max-w-[300px]">{meta}</p>
        <p className={`text-sm font-semibold flex-shrink-0 ${isIncome ? 'text-emerald-700' : 'text-foreground'}`}>
          {isIncome ? '+' : '−'}{gbp(amount)}
        </p>
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium flex-shrink-0 ${status.chip}`}>
          {status.label}
        </span>
        {!isMatched && (
          <ChevronDown className={`w-4 h-4 text-muted-foreground/40 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </div>

      {!isMatched && expanded && (
        <div className={`${compact ? 'px-3 pb-2' : 'px-3.5 pb-2.5'} pl-9 text-xs`}>
          {hasSuggestion ? (
            <div className="text-muted-foreground space-y-1">
              <p>
                Suggested match:{' '}
                <span className="text-foreground/80 font-medium">{TYPE_LABELS[suggestion.record_type]} {suggestion.record_number}</span>
                <span className="text-muted-foreground/60"> · {suggestion.record_name}</span>
              </p>
              <p className="text-muted-foreground/70">Why this transaction was matched:</p>
              <ul className="space-y-0.5">
                {(suggestion.reasons || []).map((r, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-emerald-600">✓</span><span>{r}</span></li>
                ))}
                {amountDiff > 0.01 && (
                  <li className="flex gap-1.5"><span className="text-amber-600">⚠</span><span>Payment amount differs by {gbp(amountDiff)}.</span></li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No suggested match found. Use <span className="text-foreground/80 font-medium">Find match</span> to locate a record, or categorise this transaction.
            </p>
          )}
          <div className="mt-2 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {hasSuggestion && (
              <button type="button" onClick={() => onApprove?.(suggestion)} disabled={approving} className="text-foreground font-medium hover:underline disabled:opacity-50">
                {approving ? 'Approving…' : 'Approve'}
              </button>
            )}
            <button type="button" onClick={() => onSplit?.()} className="text-muted-foreground hover:text-foreground hover:underline">Split</button>
            <button type="button" onClick={() => onFindMatch?.()} className="text-muted-foreground hover:text-foreground hover:underline">Find match</button>
            <button type="button" onClick={() => onCategorise?.()} className="text-muted-foreground hover:text-foreground hover:underline">Categorise</button>
          </div>
        </div>
      )}
    </div>
  );
}