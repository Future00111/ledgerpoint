import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, MoreHorizontal, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { gbp, fmtDate } from '@/lib/format';
import { confidenceTone } from '@/lib/reconciliationEngine';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Sales CN', supplier_credit_note: 'Supplier CN', ledger_account: 'Ledger',
};

// Compact list row — no card, subtle separator. Click the body to reveal reasoning.
export default function TransactionCard({
  transaction, suggestion, onApprove, onSplit, onCategorise, onFindMatch, onAsk, onEdit, approving, highlight,
}) {
  const [expanded, setExpanded] = useState(false);
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = Number(t.money_in || 0) + Number(t.money_out || 0);
  const isMatched = t.status === 'matched';
  const tone = confidenceTone(suggestion?.confidence);

  return (
    <div
      id={`txn-${t.id}`}
      className={`group flex items-start gap-3 py-3 border-b border-border/60 transition-colors ${highlight ? 'bg-primary/5' : 'hover:bg-muted/30'} ${expanded ? 'bg-muted/20' : ''}`}
    >
      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-rose-50'}`}>
        {isIncome ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}
      </div>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => !isMatched && setExpanded((v) => !v)}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isMatched) { e.preventDefault(); setExpanded((v) => !v); } }}
        tabIndex={isMatched ? -1 : 0}
        role={isMatched ? undefined : 'button'}
      >
        <p className="text-sm font-medium truncate">{t.description || 'Untitled transaction'}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {fmtDate(t.date)}{t.bank_account_name ? ` · ${t.bank_account_name}` : ''}{t.reference ? ` · ${t.reference}` : ''}
        </p>
        {!isMatched && suggestion && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            <span className="text-foreground/60">Suggested:</span> {TYPE_LABELS[suggestion.record_type]} {suggestion.record_number} · {suggestion.record_name} · <span className={tone.ring}>{tone.label} confidence</span>
          </p>
        )}
        {!isMatched && !suggestion && (
          <p className="text-xs text-muted-foreground/70 mt-1">No suggested match</p>
        )}
        {isMatched && t.matched_record_number && (
          <p className="text-xs text-muted-foreground mt-0.5">Matched to {TYPE_LABELS[t.matched_type]} {t.matched_record_number}</p>
        )}
        {expanded && suggestion && (
          <p className="text-xs text-muted-foreground/80 mt-1.5 italic">{suggestion.reasons.join(' · ')}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <p className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>
          {isIncome ? '+' : '−'}{gbp(amount)}
        </p>
        <div className="flex items-center gap-1">
          {!isMatched && suggestion && (
            <Button
              size="sm"
              onClick={() => onApprove?.(suggestion)}
              disabled={approving}
              className="h-7 px-2.5 text-xs gap-1"
            >
              {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Approve
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onSplit?.()}>Split</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCategorise?.()}>Categorise</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFindMatch?.()}>Find match</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.()}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAsk?.()} className="text-primary focus:text-primary">Ask Ledgerly</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}