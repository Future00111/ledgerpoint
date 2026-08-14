import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { gbp, fmtDate } from '@/lib/format';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Sales CN', supplier_credit_note: 'Supplier CN', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function confBadge(c) {
  if (c == null) return null;
  if (c >= 80) return { dot: 'bg-emerald-500', label: 'High confidence', text: 'text-emerald-600' };
  if (c >= 50) return { dot: 'bg-amber-500', label: 'Medium confidence', text: 'text-amber-600' };
  return { dot: 'bg-rose-500', label: 'Low confidence', text: 'text-rose-600', warn: true };
}

function Overflow({ onSplit, onFindMatch, onCategorise, onEdit, size }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`${size === 'sm' ? 'h-6 w-6' : 'h-7 w-7'} text-muted-foreground hover:text-foreground`}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onSplit?.()}>Split</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onFindMatch?.()}>Find match</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCategorise?.()}>Categorise</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit?.()}>Edit</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// One transaction = one decision. Click selects; double-click edits.
export default function ReconciliationInboxCard({
  transaction, suggestion, onApprove, onSplit, onFindMatch, onCategorise, onEdit, onSelect,
  approving, selected, compact,
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  const isMatched = t.status === 'matched';
  const hasSuggestion = !!suggestion;
  const conf = hasSuggestion ? confBadge(suggestion.confidence) : null;
  const isLow = conf?.warn;
  const pct = hasSuggestion ? Math.round(suggestion.confidence) : null;
  const select = () => onSelect?.(t.id);
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };

  if (isMatched) {
    return (
      <div
        id={`txn-${t.id}`}
        onClick={select}
        onDoubleClick={() => onEdit?.()}
        className={`flex items-center gap-3 ${compact ? 'py-1.5' : 'py-2'} border-b border-border/40 cursor-pointer transition-colors ${selected ? 'bg-primary/[0.04]' : 'hover:bg-muted/30'}`}
      >
        <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Check className="w-3 h-3 text-emerald-600" />
        </div>
        <p className={`flex-1 min-w-0 truncate font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{t.description || 'Untitled transaction'}</p>
        <span className={`text-muted-foreground hidden sm:block ${compact ? 'text-[11px]' : 'text-xs'}`}>{fmtDate(t.date)}</span>
        <p className={`font-semibold flex-shrink-0 ${compact ? 'text-xs' : 'text-sm'} ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
      </div>
    );
  }

  if (compact) {
    // Dense single-line row — Xero-like.
    return (
      <div
        id={`txn-${t.id}`}
        className={`border-b border-border/40 transition-colors ${selected ? 'bg-primary/[0.04]' : 'hover:bg-muted/30'}`}
      >
        <div className="flex items-center gap-2 py-1.5 cursor-pointer" onClick={select} onDoubleClick={() => onEdit?.()}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            {isIncome ? <ArrowDownRight className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
          </div>
          <p className="text-xs font-medium truncate min-w-0 flex-1">{t.description || 'Untitled transaction'}</p>
          <span className="text-[11px] text-muted-foreground hidden md:block flex-shrink-0">{fmtDate(t.date)}</span>
          {hasSuggestion ? (
            <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground flex-shrink-0">
              <Check className="w-3 h-3 text-emerald-500" /> {TYPE_LABELS[suggestion.record_type]} {suggestion.record_number}
              <span className={`inline-flex items-center gap-0.5 ${conf.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />{pct}%
              </span>
              {isLow && (
                <button type="button" onClick={stop(() => setWhyOpen((v) => !v))} className="text-primary hover:underline">Why?</button>
              )}
            </span>
          ) : (
            <span className="hidden lg:flex items-center gap-1 text-[11px] text-rose-600 flex-shrink-0">
              <AlertTriangle className="w-3 h-3" /> No match
            </span>
          )}
          <p className={`text-xs font-semibold flex-shrink-0 ml-auto ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {hasSuggestion && (
              <Button size="sm" onClick={() => onApprove?.(suggestion)} disabled={approving} className="h-6 px-2 text-[11px]">{approving ? '…' : 'Approve'}</Button>
            )}
            <Overflow onSplit={onSplit} onFindMatch={onFindMatch} onCategorise={onCategorise} onEdit={onEdit} size="sm" />
          </div>
        </div>
        {whyOpen && hasSuggestion && (
          <p className="px-7 pb-1.5 text-[11px] text-muted-foreground italic">{suggestion.reasons.join(' · ')}</p>
        )}
      </div>
    );
  }

  // Normal mode — two compact lines.
  return (
    <div
      id={`txn-${t.id}`}
      className={`border-b border-border/40 transition-colors ${selected ? 'bg-primary/[0.04] ring-1 ring-primary/20' : 'hover:bg-muted/30'}`}
    >
      <div className="flex items-center gap-3 py-2 cursor-pointer" onClick={select} onDoubleClick={() => onEdit?.()}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          {isIncome ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium truncate">{t.description || 'Untitled transaction'}</p>
            <p className={`text-sm font-semibold flex-shrink-0 ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{fmtDate(t.date)}{t.bank_account_name ? ` · ${t.bank_account_name}` : ''}</span>
            {hasSuggestion ? (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1 text-foreground/75 truncate">
                  <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {TYPE_LABELS[suggestion.record_type]} {suggestion.record_number} · {suggestion.record_name}
                </span>
                <span className={`inline-flex items-center gap-1 flex-shrink-0 ${conf.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />{conf.label} ({pct}%)
                </span>
                {isLow && (
                  <button type="button" onClick={stop(() => setWhyOpen((v) => !v))} className="text-primary hover:underline flex-shrink-0">Why?</button>
                )}
              </>
            ) : (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1 text-rose-600 flex-shrink-0"><AlertTriangle className="w-3 h-3" /> No match found</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {hasSuggestion && (
            <Button size="sm" onClick={() => onApprove?.(suggestion)} disabled={approving} className="h-7 px-3 text-xs">{approving ? '…' : 'Approve'}</Button>
          )}
          <Overflow onSplit={onSplit} onFindMatch={onFindMatch} onCategorise={onCategorise} onEdit={onEdit} />
        </div>
      </div>
      {whyOpen && hasSuggestion && (
        <p className="pl-10 pr-3 pb-2 text-xs text-muted-foreground italic">{suggestion.reasons.join(' · ')}</p>
      )}
    </div>
  );
}