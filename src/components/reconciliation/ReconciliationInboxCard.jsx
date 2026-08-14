import React from 'react';
import { ArrowDownRight, ArrowUpRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gbp, fmtDate } from '@/lib/format';
import AIExplanationCard from '@/components/reconciliation/AIExplanationCard';

const TYPE_LABELS = {
  sales_invoice: 'Invoice', purchase_bill: 'Bill',
  sales_credit_note: 'Sales CN', supplier_credit_note: 'Supplier CN', ledger_account: 'Ledger',
};

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

function confInfo(c) {
  if (c == null) return { dot: 'bg-slate-400', label: 'No match', text: 'text-slate-500' };
  if (c >= 80) return { dot: 'bg-emerald-500', label: 'High confidence', text: 'text-emerald-600' };
  if (c >= 50) return { dot: 'bg-amber-500', label: 'Medium confidence', text: 'text-amber-600' };
  return { dot: 'bg-rose-500', label: 'Low confidence', text: 'text-rose-600' };
}

// Compact reconciliation inbox card. Click selects; double-click edits.
export default function ReconciliationInboxCard({
  transaction, suggestion, onApprove, onSplit, onFindMatch, onCategorise, onEdit, onSelect,
  companyId, approving, selected, compact,
}) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  const isMatched = t.status === 'matched';
  const hasSuggestion = !!suggestion;
  const conf = confInfo(suggestion?.confidence);
  const lowConf = hasSuggestion && suggestion.confidence < 50;
  const pad = compact ? 'py-2' : 'py-3';
  const textSize = compact ? 'text-[13px]' : 'text-sm';
  const subSize = compact ? 'text-[11px]' : 'text-xs';

  const select = () => onSelect?.(t.id);

  if (isMatched) {
    return (
      <div
        id={`txn-${t.id}`}
        onClick={select}
        onDoubleClick={() => onEdit?.()}
        className={`flex items-center gap-3 ${pad} border-b border-border/60 cursor-pointer transition-colors ${selected ? 'bg-primary/[0.04]' : 'hover:bg-muted/30'}`}
      >
        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className={`${textSize} font-medium truncate`}>{t.description || 'Untitled transaction'}</p>
            <p className={`${textSize} font-semibold flex-shrink-0 ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
          </div>
          <p className={`${subSize} text-muted-foreground mt-0.5 truncate`}>
            {fmtDate(t.date)}{t.bank_account_name ? ` · ${t.bank_account_name}` : ''}
            {t.matched_record_number ? ` · Matched to ${TYPE_LABELS[t.matched_type] || 'Record'} ${t.matched_record_number}` : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`txn-${t.id}`}
      onClick={select}
      onDoubleClick={() => onEdit?.()}
      className={`group ${pad} border-b border-border/60 cursor-pointer transition-colors ${selected ? 'bg-primary/[0.04] ring-1 ring-primary/30' : 'hover:bg-muted/30'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          {isIncome ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className={`${textSize} font-medium truncate`}>{t.description || 'Untitled transaction'}</p>
            <p className={`${textSize} font-semibold flex-shrink-0 ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>
              {isIncome ? '+' : '−'}{gbp(amount)}
            </p>
          </div>
          <p className={`${subSize} text-muted-foreground mt-0.5 truncate`}>
            {fmtDate(t.date)}{t.bank_account_name ? ` · ${t.bank_account_name}` : ''}{t.reference ? ` · ${t.reference}` : ''}
          </p>
          {hasSuggestion ? (
            <div className={`${subSize} mt-1.5 flex items-center gap-2 flex-wrap`}>
              <span className="text-muted-foreground">Suggested match:</span>
              <span className="inline-flex items-center gap-1 text-foreground/80">
                <Check className="w-3 h-3 text-emerald-500" /> {TYPE_LABELS[suggestion.record_type]} {suggestion.record_number} · {suggestion.record_name}
              </span>
              <span className={`inline-flex items-center gap-1 ${conf.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} /> {conf.label}
              </span>
            </div>
          ) : (
            <div className={`${subSize} mt-1.5 flex items-center gap-1.5 text-rose-600`}>
              <span>🚨</span> No match found
            </div>
          )}
        </div>
      </div>

      {lowConf && (
        <div className="mt-2 ml-10" onClick={(e) => e.stopPropagation()}>
          <AIExplanationCard transaction={t} suggestion={suggestion} companyId={companyId} />
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2 ml-10" onClick={(e) => e.stopPropagation()}>
        {hasSuggestion && (
          <Button size="sm" onClick={() => onApprove?.(suggestion)} disabled={approving} className="h-7 px-3 text-xs">
            {approving ? '…' : 'Approve'}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onSplit?.()} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">Split</Button>
        <Button size="sm" variant="ghost" onClick={() => onFindMatch?.()} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">Find Match</Button>
        <Button size="sm" variant="ghost" onClick={() => onCategorise?.()} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground">Categorise</Button>
      </div>
    </div>
  );
}