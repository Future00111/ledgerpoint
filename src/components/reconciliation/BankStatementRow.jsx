import React from 'react';
import { gbp, fmtDate } from '@/lib/format';

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

// Minimal bank-statement row: date, payee, reference, account, amount. No badges, no actions.
export default function BankStatementRow({ transaction, selected, onSelect, compact }) {
  const t = transaction;
  const isIncome = Number(t.money_in || 0) > 0;
  const amount = txnAmount(t);
  const meta = [t.reference, t.bank_account_name].filter(Boolean).join('  ·  ');
  const interactive = !!onSelect;

  return (
    <div
      id={`txn-${t.id}`}
      onClick={onSelect}
      className={`flex items-center gap-3 ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2'} border-b border-border/40 last:border-b-0 transition-colors ${interactive ? 'cursor-pointer ' + (selected ? 'bg-muted/50' : 'hover:bg-muted/30') : ''}`}
    >
      <span className="text-xs text-muted-foreground/70 w-[68px] flex-shrink-0 tabular-nums">{fmtDate(t.date)}</span>
      <p className="text-sm font-medium truncate flex-1 min-w-0">{t.description || 'Untitled transaction'}</p>
      <p className="text-xs text-muted-foreground/60 truncate hidden md:block flex-shrink-0 max-w-[240px]">{meta}</p>
      <p className={`text-sm font-semibold flex-shrink-0 tabular-nums ${isIncome ? 'text-emerald-700' : 'text-foreground'}`}>{isIncome ? '+' : '−'}{gbp(amount)}</p>
    </div>
  );
}